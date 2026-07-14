import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, { type FastifyInstance } from "fastify";
import { Server as SocketIoServer } from "socket.io";

import { NotConfiguredMailAdapter, SmtpMailAdapter } from "./adapters/mail.js";
import { ParticipantTokenService } from "./auth/participant-token.js";
import { authenticationPlugin } from "./auth/plugin.js";
import { AuthService } from "./auth/service.js";
import { parseConfig, type AppConfig } from "./config.js";
import { registerErrorHandler } from "./errors.js";
import { LiveKitTokenService } from "./livekit/token-service.js";
import { PrismaUnitOfWork } from "./repositories/prisma.js";
import type { UnitOfWork } from "./repositories/contracts.js";
import {
  createRealtimeAuthResolver,
  createWebinarAccessResolver,
  InMemoryIdempotencyExecutor,
  InMemoryRealtimeRepositories,
  registerRealtime,
  type ClientToServerEvents,
  type InterServerEvents,
  type RealtimeSocketData,
  type ServerToClientEvents,
  webinarRoom,
} from "./realtime/index.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerPublicRoutes } from "./routes/public.js";
import { registerSystemRoutes } from "./routes/system.js";
import { registerWebinarRoutes } from "./routes/webinars.js";
import { registerWorkspaceRoutes } from "./routes/workspaces.js";
import { securityPlugin } from "./security/plugin.js";
import { PublicRegistrationService } from "./webinars/public-registration-service.js";

export interface BuildApplicationOptions {
  config?: AppConfig;
  repositories?: UnitOfWork;
}

export interface LaminariaApplication {
  app: FastifyInstance;
  config: AppConfig;
  repositories: UnitOfWork;
  io: SocketIoServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    RealtimeSocketData
  >;
}

export async function buildApplication(
  options: BuildApplicationOptions = {},
): Promise<LaminariaApplication> {
  const config = options.config ?? parseConfig();
  const ownsRepositories = options.repositories === undefined;
  const repositories = options.repositories ?? new PrismaUnitOfWork(config.databaseUrl);
  const app = Fastify({
    bodyLimit: 1_048_576,
    logger: config.nodeEnv === "test" ? false : { level: config.logLevel },
    requestIdHeader: "x-request-id",
    trustProxy: config.trustProxy,
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "Laminaria API",
        description: "Bilingual webinar infrastructure API",
        version: "0.1.0",
      },
      servers: [{ url: config.publicApiUrl }],
      tags: [
        { name: "Authentication" },
        { name: "Workspaces" },
        { name: "Webinars" },
        { name: "Public webinars" },
        { name: "Health" },
      ],
    },
  });
  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: { deepLinking: true, docExpansion: "list" },
  });
  await app.register(securityPlugin(config));

  const mail = config.mail
    ? new SmtpMailAdapter(config.mail)
    : new NotConfiguredMailAdapter();
  const participants = new ParticipantTokenService(config.tokenPepper);
  const livekit = new LiveKitTokenService(config.livekit);
  const auth = new AuthService(repositories, mail, config);
  const publicRegistration = new PublicRegistrationService(
    repositories,
    mail,
    livekit,
    participants,
    config.tokenPepper,
    config.webAppUrl,
    config.skipEmailVerification,
  );
  const io = new SocketIoServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    RealtimeSocketData
  >(app.server, {
    cors: {
      credentials: true,
      origin: [...config.corsOrigins],
      methods: ["GET", "POST"],
    },
    maxHttpBufferSize: 64 * 1024,
    transports: ["websocket", "polling"],
  });

  await app.register(authenticationPlugin(config, auth));
  await registerAuthRoutes(app, auth, config);
  await registerWorkspaceRoutes(app, repositories);
  await registerSystemRoutes(app, config);
  await registerWebinarRoutes(app, repositories, {
    livekit,
    participants,
    realtime: {
      webinarEnded(event) {
        io.to(webinarRoom(event.webinarId)).emit("webinar:ended", event);
      },
    },
  });
  await registerPublicRoutes(app, publicRegistration);

  app.get(
    "/health/live",
    { schema: { tags: ["Health"], summary: "Liveness probe" } },
    async () => ({ status: "ok" as const }),
  );
  app.get(
    "/health/ready",
    { schema: { tags: ["Health"], summary: "Database readiness probe" } },
    async () => {
      await repositories.healthcheck();
      return { status: "ready" as const };
    },
  );

  registerErrorHandler(app);
  registerRealtime(io, {
    auth: createRealtimeAuthResolver(participants),
    access: createWebinarAccessResolver(participants, repositories),
    repositories: new InMemoryRealtimeRepositories(),
    idempotency: new InMemoryIdempotencyExecutor(),
    logger: {
      error(message, context) {
        app.log.error(context ?? {}, message);
      },
    },
  });

  app.addHook("onClose", async () => {
    await io.close();
    if (ownsRepositories) await repositories.close();
  });

  return { app, config, repositories, io };
}
