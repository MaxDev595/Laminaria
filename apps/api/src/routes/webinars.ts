import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { normalizePlanId, planAllows, PLAN_POLICY, type PlanId } from "../billing/plan-policy.js";
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
const nullableDate = z.union([
  z.iso.datetime({ offset: true }).transform((value) => new Date(value)),
  z.null(),
]);
const fields = {
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(10_000).default(""),
  coverImageUrl: z.url().nullable().default(null),
  scheduledStartAt: nullableDate.default(null),
  timezone: z.string().min(1).max(100).default("UTC"),
  language: z.enum(["en", "ru"]).default("en"),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PUBLIC"),
  allowGuests: z.boolean().default(false),
  requireEmailRegistration: z.boolean().default(true),
  maxAttendees: z.number().int().positive().max(1_000_000).nullable().default(null),
};
const createSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .min(3)
    .max(100),
  ...fields,
});
const updateSchema = z.object({
  version: z.number().int().nonnegative(),
  title: fields.title.optional(),
  description: fields.description.optional(),
  coverImageUrl: fields.coverImageUrl.optional(),
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
      webinarEnded(event: { webinarId: string; status: "ENDED" | "CANCELLED" | "ARCHIVED" }): void;
    };
  },
): Promise<void> {
  const service = new WebinarService(repositories.webinars);

  app.get<{ Params: { workspaceId: string } }>(
    "/v1/workspaces/:workspaceId/webinars",
    {
      schema: { tags: ["Webinars"], summary: "List webinars in a workspace" },
    },
    async (request) => {
      const actor = requireUser(request);
      const membership = await requireWorkspacePermission(
        request,
        repositories,
        request.params.workspaceId,
        "webinar:read",
      );
      const webinars = await repositories.webinars.listByWorkspace(request.params.workspaceId);
      const withRoles = await Promise.all(
        webinars.map(async (webinar) => {
          const explicitRole = await repositories.webinars.findParticipantRole(
            webinar.id,
            actor.user.id,
          );
          const currentUserRole =
            membership.role === "OWNER" || membership.role === "ADMIN" ? "OWNER" : explicitRole;
          return { ...webinar, currentUserRole };
        }),
      );
      return {
        webinars:
          membership.role === "OWNER" || membership.role === "ADMIN"
            ? withRoles
            : withRoles.filter((webinar) => webinar.currentUserRole),
      };
    },
  );

  app.post<{ Params: { workspaceId: string } }>(
    "/v1/workspaces/:workspaceId/webinars",
    {
      schema: { tags: ["Webinars"], summary: "Create a draft webinar" },
    },
    async (request, reply) => {
      const actor = requireUser(request);
      await requireWorkspacePermission(
        request,
        repositories,
        request.params.workspaceId,
        "webinar:create",
      );
      const parsed = createSchema.parse(request.body);
      const planId = await resolveWorkspacePlan(repositories, request.params.workspaceId);
      const maxAttendees = enforceAttendeeLimit(planId, parsed.maxAttendees);
      const webinar = await service.create({
        ...parsed,
        maxAttendees,
        recordingEnabled: planAllows(planId, "webinarRecording"),
        workspaceId: request.params.workspaceId,
        createdById: actor.user.id,
      });
      return reply.status(201).send({ webinar });
    },
  );

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
      const planId = await resolveWorkspacePlan(repositories, params.workspaceId);
      const input: UpdateWebinarInput = {
        version: body.version,
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.coverImageUrl !== undefined ? { coverImageUrl: body.coverImageUrl } : {}),
        ...(body.scheduledStartAt !== undefined ? { scheduledStartAt: body.scheduledStartAt } : {}),
        ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
        ...(body.language !== undefined ? { language: body.language } : {}),
        ...(body.visibility !== undefined ? { visibility: body.visibility } : {}),
        ...(body.allowGuests !== undefined ? { allowGuests: body.allowGuests } : {}),
        ...(body.requireEmailRegistration !== undefined
          ? { requireEmailRegistration: body.requireEmailRegistration }
          : {}),
        ...(body.maxAttendees !== undefined
          ? { maxAttendees: enforceAttendeeLimit(planId, body.maxAttendees) }
          : {}),
        recordingEnabled: planAllows(planId, "webinarRecording"),
      };
      return { webinar: await service.update(params.webinarId, input) };
    },
  );

  app.post<{ Params: { workspaceId: string; webinarId: string } }>(
    "/v1/workspaces/:workspaceId/webinars/:webinarId/transitions",
    { schema: { tags: ["Webinars"], summary: "Transition the webinar state machine" } },
    async (request) => {
      const params = paramsSchema.parse(request.params);
      await requireWebinarPermission(request, repositories, params.webinarId, "webinar:transition");
      const existing = await service.find(params.webinarId);
      assertWorkspace(existing.workspaceId, params.workspaceId);
      const body = transitionSchema.parse(request.body);
      const closingLiveRoom = shouldCloseLiveRoom(existing.status, body.status);
      if (closingLiveRoom) {
        await roomAccess.livekit.closeRoom(existing.livekitRoomName);
      }
      const webinar = await service.transition(params.webinarId, body.status, body.version);
      await syncAutomaticRecording(repositories, existing, webinar.status);
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
        workspaceId: access.webinar.workspaceId,
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

  app.post<{ Params: { webinarId: string } }>(
    "/v1/webinars/:webinarId/end",
    { schema: { tags: ["Webinars"], summary: "End a live webinar from the studio" } },
    async (request) => {
      const access = await requireWebinarPermission(
        request,
        repositories,
        request.params.webinarId,
        "webinar:transition",
      );
      if (access.webinar.status !== "LIVE") {
        throw new AppError(409, "CONFLICT", "The webinar is not live");
      }
      await roomAccess.livekit.closeRoom(access.webinar.livekitRoomName);
      const webinar = await service.transition(access.webinar.id, "ENDED", access.webinar.version);
      await syncAutomaticRecording(repositories, access.webinar, "ENDED");
      roomAccess.realtime?.webinarEnded({ webinarId: webinar.id, status: "ENDED" });
      return { webinar };
    },
  );

  app.post<{ Params: { workspaceId: string; webinarId: string } }>(
    "/v1/workspaces/:workspaceId/webinars/:webinarId/hosts",
    { schema: { tags: ["Webinars"], summary: "Assign a webinar host role by email" } },
    async (request, reply) => {
      const params = paramsSchema.parse(request.params);
      await requireWebinarPermission(
        request,
        repositories,
        params.webinarId,
        "webinar:manage_stage",
      );
      const existing = await service.find(params.webinarId);
      assertWorkspace(existing.workspaceId, params.workspaceId);
      const body = hostRoleSchema.parse(request.body);
      const user = await repositories.users.findByEmail(body.email);
      if (!user) throw new AppError(404, "NOT_FOUND", "User not found");
      await repositories.workspaces.upsertMember({
        workspaceId: existing.workspaceId,
        userId: user.id,
        role: "MEMBER",
      });
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

  app.get<{ Params: { workspaceId: string; webinarId: string } }>(
    "/v1/workspaces/:workspaceId/webinars/:webinarId/registrations",
    { schema: { tags: ["Webinars"], summary: "List webinar registrations for analytics" } },
    async (request) => {
      const params = paramsSchema.parse(request.params);
      await requireWebinarPermission(request, repositories, params.webinarId, "webinar:moderate");
      const existing = await service.find(params.webinarId);
      assertWorkspace(existing.workspaceId, params.workspaceId);
      const registrations = await repositories.registrations.listByWebinar(existing.id);
      return { registrations };
    },
  );

  app.get<{ Params: { workspaceId: string; webinarId: string } }>(
    "/v1/workspaces/:workspaceId/webinars/:webinarId/recordings",
    { schema: { tags: ["Webinars"], summary: "List webinar recordings" } },
    async (request) => {
      const params = paramsSchema.parse(request.params);
      await requireWebinarPermission(request, repositories, params.webinarId, "recording:manage");
      const existing = await service.find(params.webinarId);
      assertWorkspace(existing.workspaceId, params.workspaceId);
      return { recordings: await repositories.recordings.listByWebinar(existing.id) };
    },
  );

  app.delete<{ Params: { workspaceId: string; webinarId: string; recordingId: string } }>(
    "/v1/workspaces/:workspaceId/webinars/:webinarId/recordings/:recordingId",
    { schema: { tags: ["Webinars"], summary: "Delete a webinar recording from the catalog" } },
    async (request, reply) => {
      const params = z
        .object({
          workspaceId: z.string().min(1),
          webinarId: z.string().min(1),
          recordingId: z.string().min(1),
        })
        .parse(request.params);
      await requireWebinarPermission(request, repositories, params.webinarId, "recording:manage");
      const existing = await service.find(params.webinarId);
      assertWorkspace(existing.workspaceId, params.workspaceId);
      const deleted = await repositories.recordings.softDelete(params.recordingId, new Date());
      if (!deleted) throw new AppError(404, "NOT_FOUND", "Recording not found");
      return reply.status(204).send();
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
      if (existing.status === "LIVE")
        throw new AppError(409, "CONFLICT", "End or cancel a live webinar first");
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

function isTerminalRoomStatus(status: WebinarStatus): status is "ENDED" | "CANCELLED" | "ARCHIVED" {
  return status === "ENDED" || status === "CANCELLED" || status === "ARCHIVED";
}

async function syncAutomaticRecording(
  repositories: UnitOfWork,
  webinar: { id: string; recordingEnabled: boolean; startedAt?: Date | null },
  nextStatus: WebinarStatus,
): Promise<void> {
  if (!webinar.recordingEnabled) return;
  const now = new Date();
  if (nextStatus === "LIVE") {
    await repositories.recordings.ensureAutomaticForWebinar({
      webinarId: webinar.id,
      provider: "livekit-egress",
      status: "RECORDING",
      startedAt: now,
      endedAt: now,
    });
    return;
  }
  if (nextStatus === "ENDED") {
    await repositories.recordings.ensureAutomaticForWebinar({
      webinarId: webinar.id,
      provider: "livekit-egress",
      status: "FAILED",
      startedAt: webinar.startedAt ?? null,
      endedAt: now,
      failureCode: "EGRESS_NOT_CONFIGURED",
      failureMessage:
        "Automatic recording is enabled for this plan, but LiveKit Egress/S3 is not configured yet.",
    });
  }
}

async function resolveWorkspacePlan(repositories: UnitOfWork, workspaceId: string): Promise<PlanId> {
  const planCode = await repositories.workspaces.findActivePlanCode(workspaceId);
  return normalizePlanId(planCode);
}

function enforceAttendeeLimit(planId: PlanId, requested: number | null): number {
  const max = PLAN_POLICY[planId].maxConcurrentAttendees;
  const effective = requested ?? max;
  if (effective > max) {
    throw new AppError(402, "PLAN_LIMIT_EXCEEDED", `This plan allows up to ${max} attendees`, {
      plan: planId,
      limit: "maxConcurrentAttendees",
      max,
    });
  }
  return effective;
}
