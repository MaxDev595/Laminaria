import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser, requireWorkspacePermission } from "../auth/plugin.js";
import type { UnitOfWork } from "../repositories/contracts.js";

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
}
