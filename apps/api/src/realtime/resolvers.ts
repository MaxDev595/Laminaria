import { hasWebinarPermission, type WebinarPermission } from "../auth/rbac.js";
import type { ParticipantTokenService } from "../auth/participant-token.js";
import type { UnitOfWork } from "../repositories/contracts.js";
import type { RealtimeAuthResolver, WebinarAccessResolver, WebinarAction } from "./types.js";

const actionPermissions: Readonly<Record<WebinarAction, WebinarPermission>> = {
  join: "webinar:join",
  "stage.manage": "webinar:manage_stage",
  "chat.send": "chat:write",
  "chat.moderate": "webinar:moderate",
  "question.ask": "qa:write",
  "question.upvote": "qa:write",
  "question.manage": "webinar:moderate",
  "poll.manage": "poll:manage",
  "poll.vote": "poll:vote",
};

export function createRealtimeAuthResolver(
  participantTokens: ParticipantTokenService,
): RealtimeAuthResolver {
  return {
    async resolve(request) {
      if (!request.token) return null;
      const payload = participantTokens.verify(request.token);
      if (!payload) return null;
      return {
        id: payload.subject,
        kind: payload.subject.startsWith("user:") ? "user" : "guest",
        displayName: payload.name,
        sessionId: request.token,
      };
    },
  };
}

export function createWebinarAccessResolver(
  participantTokens: ParticipantTokenService,
  repositories: UnitOfWork,
): WebinarAccessResolver {
  return {
    async authorize({ principal, webinarId, action }) {
      if (!principal.sessionId) return { allowed: false, reason: "forbidden" };
      const payload = participantTokens.verify(principal.sessionId);
      if (!payload || payload.subject !== principal.id || payload.webinarId !== webinarId) {
        return { allowed: false, reason: "forbidden" };
      }
      const webinar = await repositories.webinars.findById(webinarId);
      if (!webinar || webinar.deletedAt) return { allowed: false, reason: "not_found" };
      if (webinar.status !== "LIVE") return { allowed: false, reason: "waiting_room" };
      if (!hasWebinarPermission(payload.role, actionPermissions[action])) {
        return { allowed: false, reason: "forbidden" };
      }
      return {
        allowed: true,
        participantId: payload.subject,
        role: payload.role,
      };
    },
  };
}
