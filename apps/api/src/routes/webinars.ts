import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ParticipantTokenService } from "../auth/participant-token.js";
import {
  requireUser,
  requireWebinarPermission,
  requireWorkspacePermission,
} from "../auth/plugin.js";
import { WEBINAR_STATUSES, type WebinarStatus } from "../domain/models.js";
import { AppError } from "../errors.js";
import { LiveKitTokenService } from "../livekit/token-service.js";
import type { UnitOfWork } from "../repositories/contracts.js";
import { WebinarService, type UpdateWebinarInput } from "../webinars/service.js";

const paramsSchema = z.object({ workspaceId: z.string().min(1), webinarId: z.string().min(1) });
const nullableDate = z.union([z.iso.datetime({ offset: true }).transform((value) => new Date(value)), z.null()]);
const fields = {
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(10_000).default(""),
  scheduledStartAt: nullableDate.default(null),
  timezone: z.string().min(1).max(100).default("UTC"),
  language: z.enum(["en", "ru"]).default("en"),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PUBLIC"),
  allowGuests: z.boolean().default(false),
  requireEmailRegistration: z.boolean().default(true),
  maxAttendees: z.number().int().positive().max(1_000_000).nullable().default(null),
};
const createSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(100),
  ...fields,
});
const updateSchema = z.object({
  version: z.number().int().nonnegative(),
  title: fields.title.optional(),
  description: fields.description.optional(),
  scheduledStartAt: nullableDate.optional(),
  timezone: fields.timezone.optional(),
  language: fields.language.optional(),
  visibility: fields.visibility.optional(),
  allowGuests: fields.allowGuests.optional(),
  requireEmailRegistration: fields.requireEmailRegistration.optional(),
  maxAttendees: fields.maxAttendees.optional(),
});
const transitionSchema = z.object({
  status: z.enum(WEBINAR_STATUSES),
  version: z.number().int().nonnegative(),
});
const hostRoleSchema = z.object({
  email: z.email().max(320),
  role: z.enum(["COHOST", "MODERATOR", "SPEAKER"]),
});

export async function registerWebinarRoutes(
  app: FastifyInstance,
  repositories: UnitOfWork,
  roomAccess: {
    livekit: LiveKitTokenService;
    participants: ParticipantTokenService;
    realtime?: {
      webinarEnded(event: {
        webinarId: string;
        status: "ENDED" | "CANCELLED" | "ARCHIVED";
      }): void;
    };
  },
): Promise<void> {
  const service = new WebinarService(repositories.webinars);

  app.get<{ Params: { workspaceId: string } }>("/v1/workspaces/:workspaceId/webinars", {
    schema: { tags: ["Webinars"], summary: "List webinars in a workspace" },
  }, async (request) => {
    await requireWorkspacePermission(request, repositories, request.params.workspaceId, "webinar:read");
    return { webinars: await repositories.webinars.listByWorkspace(request.params.workspaceId) };
  });

  app.post<{ Params: { workspaceId: string } }>("/v1/workspaces/:workspaceId/webinars", {
    schema: { tags: ["Webinars"], summary: "Create a draft webinar" },
  }, async (request, reply) => {
    const actor = requireUser(request);
    await requireWorkspacePermission(request, repositories, request.params.workspaceId, "webinar:create");
    const webinar = await service.create({
      ...createSchema.parse(request.body),
      workspaceId: request.params.workspaceId,
      createdById: actor.user.id,
    });
    return reply.status(201).send({ webinar });
  });

  app.get<{ Params: { workspaceId: string; webinarId: string } }>(
    "/v1/workspaces/:workspaceId/webinars/:webinarId",
    { schema: { tags: ["Webinars"], summary: "Get a webinar" } },
    async (request) => {
      const params = paramsSchema.parse(request.params);
      await requireWorkspacePermission(request, repositories, params.workspaceId, "webinar:read");
      const webinar = await service.find(params.webinarId);
      assertWorkspace(webinar.workspaceId, params.workspaceId);
      return { webinar };
    },
  );

  app.patch<{ Params: { workspaceId: string; webinarId: string } }>(
    "/v1/workspaces/:workspaceId/webinars/:webinarId",
    { schema: { tags: ["Webinars"], summary: "Update a draft with optimistic concurrency" } },
    async (request) => {
      const params = paramsSchema.parse(request.params);
      await requireWorkspacePermission(request, repositories, params.workspaceId, "webinar:update");
      const existing = await service.find(params.webinarId);
      assertWorkspace(existing.workspaceId, params.workspaceId);
      const body = updateSchema.parse(request.body);
      const input: UpdateWebinarInput = {
        version: body.version,
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.scheduledStartAt !== undefined
          ? { scheduledStartAt: body.scheduledStartAt }
          : {}),
        ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
        ...(body.language !== undefined ? { language: body.language } : {}),
        ...(body.visibility !== undefined ? { visibility: body.visibility } : {}),
        ...(body.allowGuests !== undefined ? { allowGuests: body.allowGuests } : {}),
        ...(body.requireEmailRegistration !== undefined
          ? { requireEmailRegistration: body.requireEmailRegistration }
          : {}),
        ...(body.maxAttendees !== undefined ? { maxAttendees: body.maxAttendees } : {}),
      };
      return { webinar: await service.update(params.webinarId, input) };
    },
  );

  app.post<{ Params: { workspaceId: string; webinarId: string } }>(
    "/v1/workspaces/:workspaceId/webinars/:webinarId/transitions",
    { schema: { tags: ["Webinars"], summary: "Transition the webinar state machine" } },
    async (request) => {
      const params = paramsSchema.parse(request.params);
      await requireWorkspacePermission(request, repositories, params.workspaceId, "webinar:update");
      const existing = await service.find(params.webinarId);
      assertWorkspace(existing.workspaceId, params.workspaceId);
      const body = transitionSchema.parse(request.body);
      const closingLiveRoom = shouldCloseLiveRoom(existing.status, body.status);
      if (closingLiveRoom) {
        await roomAccess.livekit.closeRoom(existing.livekitRoomName);
      }
      const webinar = await service.transition(params.webinarId, body.status, body.version);
      if (isTerminalRoomStatus(webinar.status)) {
        roomAccess.realtime?.webinarEnded({
          webinarId: webinar.id,
          status: webinar.status,
        });
      }
      return { webinar };
    },
  );

  app.post<{ Params: { workspaceId: string; webinarId: string } }>(
    "/v1/workspaces/:workspaceId/webinars/:webinarId/prejoin",
    {
      config: { rateLimit: { max: 30, timeWindow: "5 minutes" } },
      schema: {
        tags: ["Webinars"],
        summary: "Issue host or team-member room credentials",
      },
    },
    async (request) => {
      const params = paramsSchema.parse(request.params);
      const access = await requireWebinarPermission(
        request,
        repositories,
        params.webinarId,
        "webinar:join",
      );
      assertWorkspace(access.webinar.workspaceId, params.workspaceId);
      const subject = `user:${access.actor.user.id}`;
      const identity = `${subject}:${randomUUID()}`;
      const media = await roomAccess.livekit.issue({
        webinar: access.webinar,
        identity,
        displayName: access.actor.user.name,
        role: access.role,
        metadata: { subject },
      });
      return {
        webinarId: access.webinar.id,
        media,
        realtimeToken: roomAccess.participants.issue({
          subject,
          webinarId: access.webinar.id,
          role: access.role,
          name: access.actor.user.name,
        }),
        participant: {
          identity,
          displayName: access.actor.user.name,
          role: access.role,
        },
      };
    },
  );

  app.post<{ Params: { workspaceId: string; webinarId: string } }>(
    "/v1/workspaces/:workspaceId/webinars/:webinarId/hosts",
    { schema: { tags: ["Webinars"], summary: "Assign a webinar host role by email" } },
    async (request, reply) => {
      const params = paramsSchema.parse(request.params);
      await requireWebinarPermission(request, repositories, params.webinarId, "webinar:moderate");
      const existing = await service.find(params.webinarId);
      assertWorkspace(existing.workspaceId, params.workspaceId);
      const body = hostRoleSchema.parse(request.body);
      const user = await repositories.users.findByEmail(body.email);
      if (!user) throw new AppError(404, "NOT_FOUND", "User not found");
      await repositories.webinars.upsertHost({
        webinarId: existing.id,
        userId: user.id,
        role: body.role,
        acceptedAt: new Date(),
      });
      return reply.status(201).send({
        host: {
          userId: user.id,
          email: user.email,
          name: user.name,
          role: body.role,
        },
      });
    },
  );

  app.delete<{ Params: { workspaceId: string; webinarId: string } }>(
    "/v1/workspaces/:workspaceId/webinars/:webinarId",
    { schema: { tags: ["Webinars"], summary: "Soft-delete a webinar" } },
    async (request, reply) => {
      const params = paramsSchema.parse(request.params);
      await requireWorkspacePermission(request, repositories, params.workspaceId, "webinar:delete");
      const existing = await service.find(params.webinarId);
      assertWorkspace(existing.workspaceId, params.workspaceId);
      if (existing.status === "LIVE") throw new AppError(409, "CONFLICT", "End or cancel a live webinar first");
      await repositories.webinars.softDelete(existing.id, new Date());
      return reply.status(204).send();
    },
  );
}

function assertWorkspace(actual: string, expected: string): void {
  if (actual !== expected) throw new AppError(404, "NOT_FOUND", "Webinar not found");
}

function shouldCloseLiveRoom(current: WebinarStatus, next: WebinarStatus): boolean {
  return current === "LIVE" && isTerminalRoomStatus(next);
}

function isTerminalRoomStatus(
  status: WebinarStatus,
): status is "ENDED" | "CANCELLED" | "ARCHIVED" {
  return status === "ENDED" || status === "CANCELLED" || status === "ARCHIVED";
}
