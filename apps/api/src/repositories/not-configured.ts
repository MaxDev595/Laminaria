import { ServiceNotConfiguredError } from "../errors.js";
import type { UnitOfWork } from "./contracts.js";

const unavailable = async (): Promise<never> => {
  throw new ServiceNotConfiguredError("Database repository");
};

/**
 * Safe startup fallback for composition tests. Production startup deliberately
 * refuses to use this object; callers must inject a persistent repository.
 */
export function createUnavailableUnitOfWork(): UnitOfWork {
  return {
    users: {
      findById: unavailable,
      findByEmail: unavailable,
      create: unavailable,
      markEmailVerified: unavailable,
      updatePassword: unavailable,
    },
    sessions: {
      create: unavailable,
      findActiveByTokenHash: unavailable,
      touchIfOlderThan: unavailable,
      revoke: unavailable,
      revokeAllForUser: unavailable,
    },
    tokens: {
      create: unavailable,
      consume: unavailable,
      invalidateForUser: unavailable,
    },
    workspaces: {
      findActivePlanCode: unavailable,
      findMember: unavailable,
      upsertMember: unavailable,
      createWithOwner: unavailable,
      listForUser: unavailable,
      listMembers: unavailable,
      updateMemberRole: unavailable,
      removeMember: unavailable,
    },
    webinars: {
      findById: unavailable,
      findPublicBySlug: unavailable,
      findParticipantRole: unavailable,
      upsertHost: unavailable,
      listByWorkspace: unavailable,
      create: unavailable,
      updateDraft: unavailable,
      transition: unavailable,
      softDelete: unavailable,
      countActiveParticipants: unavailable,
    },
    recordings: {
      listByWebinar: unavailable,
      findPublicById: unavailable,
      ensureAutomaticForWebinar: unavailable,
      softDelete: unavailable,
    },
    registrations: {
      findById: unavailable,
      findByWebinarAndEmail: unavailable,
      findByTokenHash: unavailable,
      listByWebinar: unavailable,
      confirmByTokenHash: unavailable,
      create: unavailable,
    },
    healthcheck: unavailable,
    close: async () => undefined,
  };
}
