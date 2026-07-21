import type { WebinarRole } from "./webinar.js";
import type { WorkspaceRole } from "./workspace.js";

export const PERMISSIONS = [
  "workspace.read",
  "workspace.update",
  "workspace.members.manage",
  "workspace.billing.manage",
  "webinar.create",
  "webinar.read",
  "webinar.update",
  "webinar.delete",
  "webinar.start",
  "webinar.end",
  "participant.promote",
  "participant.remove",
  "media.subscribe",
  "media.publish.audio",
  "media.publish.video",
  "media.publish.screen",
  "chat.send",
  "chat.moderate",
  "question.submit",
  "question.manage",
  "poll.vote",
  "poll.manage",
  "recording.manage",
  "analytics.read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL_PERMISSIONS = new Set<Permission>(PERMISSIONS);

const workspacePermissions: Record<WorkspaceRole, ReadonlySet<Permission>> = {
  OWNER: ALL_PERMISSIONS,
  ADMIN: new Set(PERMISSIONS.filter((permission) => permission !== "workspace.billing.manage")),
  HOST: new Set([
    "workspace.read",
    "webinar.create",
    "webinar.read",
    "webinar.update",
    "webinar.start",
    "webinar.end",
    "participant.promote",
    "media.subscribe",
    "media.publish.audio",
    "media.publish.video",
    "media.publish.screen",
    "chat.send",
    "poll.manage",
    "poll.vote",
    "analytics.read",
  ]),
  MODERATOR: new Set([
    "workspace.read",
    "webinar.read",
    "media.subscribe",
    "chat.send",
    "chat.moderate",
    "question.manage",
    "poll.manage",
    "poll.vote",
  ]),
  ANALYST: new Set([
    "workspace.read",
    "webinar.read",
    "media.subscribe",
    "analytics.read",
  ]),
  MEMBER: new Set(["workspace.read", "webinar.read"]),
};

const webinarPermissions: Record<WebinarRole, ReadonlySet<Permission>> = {
  HOST: new Set([
    "webinar.read",
    "webinar.update",
    "webinar.start",
    "webinar.end",
    "participant.promote",
    "participant.remove",
    "media.subscribe",
    "media.publish.audio",
    "media.publish.video",
    "media.publish.screen",
    "chat.send",
    "chat.moderate",
    "question.submit",
    "question.manage",
    "poll.vote",
    "poll.manage",
    "recording.manage",
    "analytics.read",
  ]),
  COHOST: new Set([
    "webinar.read",
    "webinar.update",
    "webinar.start",
    "webinar.end",
    "participant.promote",
    "participant.remove",
    "media.subscribe",
    "media.publish.audio",
    "media.publish.video",
    "media.publish.screen",
    "chat.send",
    "chat.moderate",
    "question.submit",
    "question.manage",
    "poll.vote",
    "poll.manage",
    "recording.manage",
    "analytics.read",
  ]),
  MODERATOR: new Set([
    "webinar.read",
    "participant.remove",
    "media.subscribe",
    "chat.send",
    "chat.moderate",
    "question.submit",
    "question.manage",
    "poll.vote",
  ]),
  SPEAKER: new Set([
    "webinar.read",
    "media.subscribe",
    "media.publish.audio",
    "media.publish.video",
    "media.publish.screen",
    "chat.send",
    "question.submit",
    "poll.vote",
  ]),
  ATTENDEE: new Set(["webinar.read", "media.subscribe", "question.submit", "poll.vote"]),
  GUEST: new Set(["webinar.read", "media.subscribe", "question.submit", "poll.vote"]),
};

export interface AccessContext {
  workspaceRole?: WorkspaceRole | null;
  webinarRole?: WebinarRole | null;
}

export function hasPermission(context: AccessContext, permission: Permission): boolean {
  return Boolean(
    (context.workspaceRole && workspacePermissions[context.workspaceRole].has(permission)) ||
    (context.webinarRole && webinarPermissions[context.webinarRole].has(permission)),
  );
}

export function assertPermission(context: AccessContext, permission: Permission): void {
  if (!hasPermission(context, permission)) {
    const error = new Error(`Missing permission: ${permission}`);
    error.name = "ForbiddenError";
    throw error;
  }
}

export interface LiveKitGrant {
  roomJoin: true;
  canSubscribe: true;
  canPublish: boolean;
  canPublishData: boolean;
  canPublishSources: readonly ("camera" | "microphone" | "screen_share" | "screen_share_audio")[];
}

export function liveKitGrantForRole(role: WebinarRole): LiveKitGrant {
  const canPublish = role === "HOST" || role === "COHOST" || role === "SPEAKER";
  return {
    roomJoin: true,
    canSubscribe: true,
    canPublish,
    canPublishData: false,
    canPublishSources: canPublish
      ? ["camera", "microphone", "screen_share", "screen_share_audio"]
      : [],
  };
}
