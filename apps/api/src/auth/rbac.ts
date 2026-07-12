import { AppError } from "../errors.js";
import type { ParticipantRole, WorkspaceRole } from "../domain/models.js";

export type WorkspacePermission =
  | "workspace:read"
  | "workspace:manage"
  | "webinar:create"
  | "webinar:read"
  | "webinar:update"
  | "webinar:delete"
  | "billing:manage";

export type WebinarPermission =
  | "webinar:join"
  | "webinar:publish_media"
  | "webinar:manage_stage"
  | "webinar:moderate"
  | "webinar:transition"
  | "chat:write"
  | "qa:write"
  | "poll:vote"
  | "poll:manage";

const workspacePermissions: Readonly<Record<WorkspaceRole, ReadonlySet<WorkspacePermission>>> = {
  OWNER: new Set([
    "workspace:read",
    "workspace:manage",
    "webinar:create",
    "webinar:read",
    "webinar:update",
    "webinar:delete",
    "billing:manage",
  ]),
  ADMIN: new Set([
    "workspace:read",
    "workspace:manage",
    "webinar:create",
    "webinar:read",
    "webinar:update",
    "webinar:delete",
  ]),
  MEMBER: new Set(["workspace:read", "webinar:create", "webinar:read"]),
};

const webinarPermissions: Readonly<Record<ParticipantRole, ReadonlySet<WebinarPermission>>> = {
  OWNER: new Set([
    "webinar:join",
    "webinar:publish_media",
    "webinar:manage_stage",
    "webinar:moderate",
    "webinar:transition",
    "chat:write",
    "qa:write",
    "poll:vote",
    "poll:manage",
  ]),
  HOST: new Set([
    "webinar:join",
    "webinar:publish_media",
    "webinar:manage_stage",
    "webinar:moderate",
    "webinar:transition",
    "chat:write",
    "qa:write",
    "poll:vote",
    "poll:manage",
  ]),
  COHOST: new Set([
    "webinar:join",
    "webinar:publish_media",
    "webinar:manage_stage",
    "webinar:moderate",
    "webinar:transition",
    "chat:write",
    "qa:write",
    "poll:vote",
    "poll:manage",
  ]),
  MODERATOR: new Set([
    "webinar:join",
    "webinar:moderate",
    "chat:write",
    "qa:write",
    "poll:vote",
    "poll:manage",
  ]),
  SPEAKER: new Set([
    "webinar:join",
    "webinar:publish_media",
    "chat:write",
    "qa:write",
    "poll:vote",
  ]),
  ATTENDEE: new Set(["webinar:join", "chat:write", "qa:write", "poll:vote"]),
  GUEST: new Set(["webinar:join", "chat:write", "qa:write", "poll:vote"]),
};

export function hasWorkspacePermission(role: WorkspaceRole, permission: WorkspacePermission): boolean {
  return workspacePermissions[role].has(permission);
}

export function hasWebinarPermission(role: ParticipantRole, permission: WebinarPermission): boolean {
  return webinarPermissions[role].has(permission);
}

export function assertWorkspacePermission(role: WorkspaceRole, permission: WorkspacePermission): void {
  if (!hasWorkspacePermission(role, permission)) {
    throw new AppError(403, "FORBIDDEN", "Workspace permission denied", { permission });
  }
}

export function assertWebinarPermission(role: ParticipantRole, permission: WebinarPermission): void {
  if (!hasWebinarPermission(role, permission)) {
    throw new AppError(403, "FORBIDDEN", "Webinar permission denied", { permission });
  }
}
