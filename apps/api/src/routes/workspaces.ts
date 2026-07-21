import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser, requireWorkspacePermission } from "../auth/plugin.js";
import type { UnitOfWork } from "../repositories/contracts.js";
import { AppError } from "../errors.js";

const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .min(3)
    .max(63),
});
const memberSchema = z.object({
  email: z.email().max(320),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});
const memberRoleSchema = z.object({ role: z.enum(["ADMIN", "MEMBER"]) });
const webinarDefaultsSchema = z.object({
  language: z.enum(["en", "ru"]),
  timezone: z.string().trim().min(1).max(100),
  access: z.enum(["PUBLIC", "PRIVATE"]),
  allowGuests: z.boolean(),
  requireRegistration: z.boolean(),
  autoRecording: z.boolean(),
  viewerChat: z.boolean(),
});
const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  logoUrl: z.url().max(2048).nullable().optional(),
  locale: z.enum(["en", "ru"]).optional(),
  timezone: z.string().trim().min(1).max(100).optional(),
  settings: z.object({ webinarDefaults: webinarDefaultsSchema }).optional(),
});

export async function registerWorkspaceRoutes(
  app: FastifyInstance,
  repositories: UnitOfWork,
): Promise<void> {
  app.get(
    "/v1/workspaces",
    {
      schema: { tags: ["Workspaces"], summary: "List accessible workspaces" },
    },
    async (request) => {
      const actor = requireUser(request);
      return { workspaces: await repositories.workspaces.listForUser(actor.user.id) };
    },
  );

  app.post(
    "/v1/workspaces",
    {
      schema: {
        tags: ["Workspaces"],
        summary: "Create a workspace with the current user as owner",
        body: {
          type: "object",
          required: ["name", "slug"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
            slug: {
              type: "string",
              minLength: 3,
              maxLength: 63,
              pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
            },
          },
        },
      },
    },
    async (request, reply) => {
      const actor = requireUser(request);
      const workspace = await repositories.workspaces.createWithOwner({
        ...createWorkspaceSchema.parse(request.body),
        ownerId: actor.user.id,
      });
      return reply.status(201).send({ workspace });
    },
  );

  app.get<{ Params: { workspaceId: string } }>(
    "/v1/workspaces/:workspaceId",
    {
      schema: { tags: ["Workspaces"], summary: "Verify workspace access" },
    },
    async (request) => {
      const membership = await requireWorkspacePermission(
        request,
        repositories,
        request.params.workspaceId,
        "workspace:read",
      );
      return { workspaceId: membership.workspaceId, role: membership.role };
    },
  );

  app.get<{ Params: { workspaceId: string } }>(
    "/v1/workspaces/:workspaceId/settings",
    { schema: { tags: ["Workspaces"], summary: "Get workspace settings and usage" } },
    async (request) => {
      const membership = await requireWorkspacePermission(
        request,
        repositories,
        request.params.workspaceId,
        "workspace:read",
      );
      const workspace = await repositories.workspaces.getSettings(request.params.workspaceId);
      if (!workspace) throw new AppError(404, "NOT_FOUND", "Workspace not found");
      const [planCode, usage] = await Promise.all([
        repositories.workspaces.findActivePlanCode(request.params.workspaceId),
        repositories.workspaces.getUsageSummary(request.params.workspaceId),
      ]);
      return { workspace, role: membership.role, planCode: planCode ?? "FREE", usage };
    },
  );

  app.patch<{ Params: { workspaceId: string } }>(
    "/v1/workspaces/:workspaceId/settings",
    { schema: { tags: ["Workspaces"], summary: "Update workspace settings" } },
    async (request) => {
      await requireWorkspacePermission(
        request,
        repositories,
        request.params.workspaceId,
        "workspace:manage",
      );
      const parsed = updateWorkspaceSchema.parse(request.body);
      await repositories.workspaces.updateSettings(request.params.workspaceId, {
        ...(parsed.name !== undefined ? { name: parsed.name } : {}),
        ...(parsed.logoUrl !== undefined ? { logoUrl: parsed.logoUrl } : {}),
        ...(parsed.locale !== undefined ? { locale: parsed.locale } : {}),
        ...(parsed.timezone !== undefined ? { timezone: parsed.timezone } : {}),
        ...(parsed.settings !== undefined ? { settings: parsed.settings } : {}),
      });
      const workspace = await repositories.workspaces.getSettings(request.params.workspaceId);
      if (!workspace) throw new AppError(404, "NOT_FOUND", "Workspace not found");
      return { workspace };
    },
  );

  app.delete<{ Params: { workspaceId: string } }>(
    "/v1/workspaces/:workspaceId",
    { schema: { tags: ["Workspaces"], summary: "Delete a workspace" } },
    async (request, reply) => {
      const membership = await requireWorkspacePermission(
        request,
        repositories,
        request.params.workspaceId,
        "workspace:manage",
      );
      if (membership.role !== "OWNER") {
        throw new AppError(403, "FORBIDDEN", "Only the owner can delete a workspace");
      }
      z.object({ confirmation: z.literal("DELETE") }).parse(request.body);
      await repositories.workspaces.softDelete(request.params.workspaceId, new Date());
      return reply.status(204).send();
    },
  );

  app.get<{ Params: { workspaceId: string } }>(
    "/v1/workspaces/:workspaceId/members",
    { schema: { tags: ["Workspaces"], summary: "List workspace team members" } },
    async (request) => {
      await requireWorkspacePermission(
        request,
        repositories,
        request.params.workspaceId,
        "workspace:read",
      );
      return { members: await repositories.workspaces.listMembers(request.params.workspaceId) };
    },
  );

  app.post<{ Params: { workspaceId: string } }>(
    "/v1/workspaces/:workspaceId/members",
    { schema: { tags: ["Workspaces"], summary: "Add a registered user to the workspace" } },
    async (request, reply) => {
      const actorMembership = await requireWorkspacePermission(
        request,
        repositories,
        request.params.workspaceId,
        "workspace:manage",
      );
      const body = memberSchema.parse(request.body);
      if (actorMembership.role !== "OWNER" && body.role === "ADMIN") {
        throw new AppError(403, "FORBIDDEN", "Only the owner can appoint workspace admins");
      }
      const user = await repositories.users.findByEmail(body.email);
      if (!user) {
        throw new AppError(404, "NOT_FOUND", "The user must create a Laminaria account first");
      }
      const member = await repositories.workspaces.upsertMember({
        workspaceId: request.params.workspaceId,
        userId: user.id,
        role: body.role,
      });
      return reply.status(201).send({ member });
    },
  );

  app.patch<{ Params: { workspaceId: string; userId: string } }>(
    "/v1/workspaces/:workspaceId/members/:userId",
    { schema: { tags: ["Workspaces"], summary: "Change a workspace member role" } },
    async (request) => {
      const actorMembership = await requireWorkspacePermission(
        request,
        repositories,
        request.params.workspaceId,
        "workspace:manage",
      );
      const body = memberRoleSchema.parse(request.body);
      if (actorMembership.role !== "OWNER" && body.role === "ADMIN") {
        throw new AppError(403, "FORBIDDEN", "Only the owner can appoint workspace admins");
      }
      const member = await repositories.workspaces.updateMemberRole(
        request.params.workspaceId,
        request.params.userId,
        body.role,
      );
      if (!member) throw new AppError(404, "NOT_FOUND", "Member not found or is the owner");
      return { member };
    },
  );

  app.delete<{ Params: { workspaceId: string; userId: string } }>(
    "/v1/workspaces/:workspaceId/members/:userId",
    { schema: { tags: ["Workspaces"], summary: "Remove a member from the workspace" } },
    async (request, reply) => {
      await requireWorkspacePermission(
        request,
        repositories,
        request.params.workspaceId,
        "workspace:manage",
      );
      const removed = await repositories.workspaces.removeMember(
        request.params.workspaceId,
        request.params.userId,
        new Date(),
      );
      if (!removed) throw new AppError(404, "NOT_FOUND", "Member not found or is the owner");
      return reply.status(204).send();
    },
  );
}
