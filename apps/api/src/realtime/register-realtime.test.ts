import { createServer, type Server as HttpServer } from "node:http";

import { Server as SocketIoServer } from "socket.io";
import { io as createClient, type Socket as ClientSocket } from "socket.io-client";
import { afterEach, describe, expect, it } from "vitest";

import { InMemoryIdempotencyExecutor } from "./idempotency.js";
import { InMemoryRealtimeRepositories } from "./in-memory-repositories.js";
import { registerRealtime } from "./register-realtime.js";
import type { RealtimeRole, RealtimeServer, WebinarAction } from "./types.js";

type Ack<T> =
  | { ok: true; data: T; replayed: boolean }
  | { ok: false; error: { code: string; message: string } };

const openClients: ClientSocket[] = [];
let io: RealtimeServer | null = null;
let httpServer: HttpServer | null = null;

afterEach(async () => {
  for (const client of openClients.splice(0)) client.disconnect();
  if (io) await io.close();
  io = null;
  if (httpServer?.listening) {
    await new Promise<void>((resolve, reject) =>
      httpServer!.close((error) => (error ? reject(error) : resolve())),
    );
  }
  httpServer = null;
});

describe("realtime moderation", () => {
  it("lets a moderator ban a viewer, disconnects the viewer, and rejects re-entry", async () => {
    const webinarId = `webinar_${crypto.randomUUID()}`;
    const roles = new Map<string, RealtimeRole>([
      ["moderator", "MODERATOR"],
      ["viewer", "ATTENDEE"],
    ]);
    const removedFromMedia: Array<{ webinarId: string; subject: string }> = [];
    const savedRestrictions: Array<{
      webinarId: string;
      targetId: string;
      bannedUntil?: number | null;
    }> = [];

    httpServer = createServer();
    io = new SocketIoServer(httpServer, {
      transports: ["websocket"],
    }) as RealtimeServer;
    registerRealtime(io, {
      auth: {
        async resolve(request) {
          const token = request.token;
          if (!token || !roles.has(token)) return null;
          return {
            id: `user:${token}`,
            kind: "user",
            displayName: token,
            sessionId: token,
          };
        },
      },
      access: {
        async authorize({ principal, action }) {
          const token = principal.sessionId ?? "";
          const role = roles.get(token);
          if (!role || !canPerform(role, action)) return { allowed: false, reason: "forbidden" };
          return { allowed: true, participantId: principal.id, role };
        },
      },
      repositories: new InMemoryRealtimeRepositories(),
      idempotency: new InMemoryIdempotencyExecutor(),
      async removeBannedParticipant(id, subject) {
        removedFromMedia.push({ webinarId: id, subject });
      },
      restrictions: {
        async find() {
          return null;
        },
        async save({ webinarId: id, targetId, state }) {
          savedRestrictions.push({
            webinarId: id,
            targetId,
            ...(state.bannedUntil !== undefined ? { bannedUntil: state.bannedUntil } : {}),
          });
        },
      },
    });

    const port = await listen(httpServer);
    const moderator = await connect(port, "moderator");
    const viewer = await connect(port, "viewer");
    expect((await emitAck(moderator, "webinar:join", { webinarId })).ok).toBe(true);
    expect((await emitAck(viewer, "webinar:join", { webinarId })).ok).toBe(true);

    const kicked = new Promise<unknown>((resolve) => viewer.once("moderation:kicked", resolve));
    const disconnected = new Promise<string>((resolve) => viewer.once("disconnect", resolve));
    const ban = await emitAck(moderator, "moderation:restrict", {
      webinarId,
      idempotencyKey: `ban_${crypto.randomUUID()}`,
      targetId: "user:viewer",
      targetName: "viewer",
      action: "ban",
      durationMinutes: 60,
    });

    expect(ban.ok).toBe(true);
    expect(removedFromMedia).toEqual([{ webinarId, subject: "user:viewer" }]);
    expect(savedRestrictions).toHaveLength(1);
    expect(savedRestrictions[0]).toMatchObject({
      webinarId,
      targetId: "user:viewer",
    });
    expect(savedRestrictions[0]?.bannedUntil).toBeTypeOf("number");
    await expect(kicked).resolves.toMatchObject({ targetId: "user:viewer", action: "ban" });
    await expect(disconnected).resolves.toBe("io server disconnect");

    const retryingViewer = await connect(port, "viewer");
    const rejoin = await emitAck(retryingViewer, "webinar:join", { webinarId });
    expect(rejoin).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
  });

  it("does not let a moderator restrict another privileged participant", async () => {
    const webinarId = `webinar_${crypto.randomUUID()}`;
    const roles = new Map<string, RealtimeRole>([
      ["moderator", "MODERATOR"],
      ["host", "HOST"],
    ]);

    httpServer = createServer();
    io = new SocketIoServer(httpServer, { transports: ["websocket"] }) as RealtimeServer;
    registerRealtime(io, {
      auth: {
        async resolve(request) {
          const token = request.token;
          if (!token || !roles.has(token)) return null;
          return { id: `user:${token}`, kind: "user", displayName: token, sessionId: token };
        },
      },
      access: {
        async authorize({ principal, action }) {
          const role = roles.get(principal.sessionId ?? "");
          if (!role || !canPerform(role, action)) return { allowed: false, reason: "forbidden" };
          return { allowed: true, participantId: principal.id, role };
        },
      },
      repositories: new InMemoryRealtimeRepositories(),
      idempotency: new InMemoryIdempotencyExecutor(),
    });

    const port = await listen(httpServer);
    const moderator = await connect(port, "moderator");
    const host = await connect(port, "host");
    await emitAck(moderator, "webinar:join", { webinarId });
    await emitAck(host, "webinar:join", { webinarId });

    const result = await emitAck(moderator, "moderation:restrict", {
      webinarId,
      idempotencyKey: `ban_${crypto.randomUUID()}`,
      targetId: "user:host",
      targetName: "host",
      action: "ban",
      durationMinutes: null,
    });

    expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(host.connected).toBe(true);
  });
});

function canPerform(role: RealtimeRole, action: WebinarAction): boolean {
  if (action === "chat.moderate") {
    return role === "OWNER" || role === "HOST" || role === "COHOST" || role === "MODERATOR";
  }
  return true;
}

async function listen(server: HttpServer): Promise<number> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Test server did not bind to a TCP port");
  return address.port;
}

async function connect(port: number, token: string): Promise<ClientSocket> {
  const client = createClient(`http://127.0.0.1:${port}`, {
    auth: { token },
    transports: ["websocket"],
    reconnection: false,
    forceNew: true,
  });
  openClients.push(client);
  await new Promise<void>((resolve, reject) => {
    client.once("connect", resolve);
    client.once("connect_error", reject);
  });
  return client;
}

async function emitAck<T>(client: ClientSocket, event: string, payload: unknown): Promise<Ack<T>> {
  return new Promise<Ack<T>>((resolve) => client.emit(event, payload, resolve));
}
