import type { FastifyInstance, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import type { AppConfig } from "../config.js";
import type { AuthenticatedActor } from "../domain/models.js";
import { AppError } from "../errors.js";
import type { WebinarPermission, WorkspacePermission } from "./rbac.js";
import { assertWebinarPermission, assertWorkspacePermission } from "./rbac.js";
import type { UnitOfWork } from "../repositories/contracts.js";
import type { AuthService } from "./service.js";

declare module "fastify" {
  interface FastifyRequest {
    actor: AuthenticatedActor | null;
  }
}

export function authenticationPlugin(
  config: Pick<AppConfig, "sessionCookieName">,
  auth: AuthService,
) {
  return fp(async (app: FastifyInstance) => {
    app.decorateRequest("actor", null);
    app.addHook("onRequest", async (request) => {
      const token = request.cookies[config.sessionCookieName];
      request.actor = token ? await auth.authenticate(token) : null;
    });
  }, { name: "laminaria-authentication", dependencies: ["@fastify/cookie"] });
}

export function requireUser(request: FastifyRequest): AuthenticatedActor {
  if (!request.actor) throw new AppError(401, "UNAUTHENTICATED", "Authentication is required");
  return request.actor;
}

export async function requireWorkspacePermission(
  request: FastifyRequest,
  repositories: UnitOfWork,
  workspaceId: string,
  permission: WorkspacePermission,
) {
  const actor = requireUser(request);
  const membership = await repositories.workspaces.findMember(workspaceId, actor.user.id);
  if (!membership) throw new AppError(404, "NOT_FOUND", "Workspace not found");
  assertWorkspacePermission(membership.role, permission);
  return membership;
}

export async function requireWebinarPermission(
  request: FastifyRequest,
  repositories: UnitOfWork,
  webinarId: string,
  permission: WebinarPermission,
) {
  const actor = requireUser(request);
  const webinar = await repositories.webinars.findById(webinarId);
  if (!webinar) throw new AppError(404, "NOT_FOUND", "Webinar not found");
  const membership = await repositories.workspaces.findMember(webinar.workspaceId, actor.user.id);
  const explicitRole = await repositories.webinars.findParticipantRole(webinar.id, actor.user.id);
  const role = membership?.role === "OWNER" ? "OWNER" : explicitRole;
  if (!role) throw new AppError(404, "NOT_FOUND", "Webinar not found");
  assertWebinarPermission(role, permission);
  return { actor, webinar, role };
}
