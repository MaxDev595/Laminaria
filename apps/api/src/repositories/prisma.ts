import { PrismaPg } from "@prisma/adapter-pg";

import {
  Prisma,
  PrismaClient,
  type AuthToken,
  type Registration,
  type Session,
  type User,
  type WorkspaceMember,
} from "../generated/prisma/client.js";
import type {
  Locale,
  OneTimeTokenKind,
  OneTimeTokenRecord,
  ParticipantRole,
  RecordingRecord,
  RegistrationRecord,
  SessionRecord,
  UserRecord,
  WebinarRecord,
  WebinarStatus,
  WorkspaceMemberRecord,
} from "../domain/models.js";
import type { ChatMessage, ChatRepository } from "../realtime/types.js";
import type {
  OneTimeTokenRepository,
  RecordingRepository,
  RegistrationRepository,
  ModerationRestrictionRecord,
  ModerationRestrictionRepository,
  SessionRepository,
  UnitOfWork,
  UserRepository,
  WebinarRepository,
  WorkspaceRepository,
} from "./contracts.js";

const webinarInclude = {
  sessions: {
    orderBy: { sequence: "desc" },
    take: 1,
  },
} as const satisfies Prisma.WebinarInclude;

type WebinarWithSession = Prisma.WebinarGetPayload<{
  include: typeof webinarInclude;
}>;

type SupportedAuthTokenKind = "EMAIL_VERIFICATION" | "PASSWORD_RESET";

/**
 * PostgreSQL-backed repository composition root.
 *
 * Prisma 7 requires a driver adapter, so this class owns both the generated
 * client and its `pg` adapter for the lifetime of the API process.
 */
export class PrismaUnitOfWork implements UnitOfWork {
  readonly #client: PrismaClient;

  public readonly users: UserRepository;
  public readonly sessions: SessionRepository;
  public readonly tokens: OneTimeTokenRepository;
  public readonly workspaces: WorkspaceRepository;
  public readonly webinars: WebinarRepository;
  public readonly recordings: RecordingRepository;
  public readonly realtimeChat: ChatRepository;
  public readonly registrations: RegistrationRepository;
  public readonly moderationRestrictions: ModerationRestrictionRepository;

  public constructor(databaseUrl: string) {
    const adapter = new PrismaPg({ connectionString: databaseUrl });
    this.#client = new PrismaClient({ adapter });

    this.users = this.createUserRepository();
    this.sessions = this.createSessionRepository();
    this.tokens = this.createOneTimeTokenRepository();
    this.workspaces = this.createWorkspaceRepository();
    this.webinars = this.createWebinarRepository();
    this.recordings = this.createRecordingRepository();
    this.realtimeChat = this.createRealtimeChatRepository();
    this.registrations = this.createRegistrationRepository();
    this.moderationRestrictions = this.createModerationRestrictionRepository();
  }

  public async healthcheck(): Promise<void> {
    await this.#client.$queryRaw`SELECT 1`;
  }

  public async close(): Promise<void> {
    await this.#client.$disconnect();
  }

  private createModerationRestrictionRepository(): ModerationRestrictionRepository {
    return {
      find: async (webinarId, targetId) => {
        const event = await this.#client.moderationEvent.findFirst({
          where: {
            webinarSession: { webinarId },
            category: "CUSTOM",
            metadata: { path: ["targetId"], equals: targetId },
          },
          orderBy: { createdAt: "desc" },
          select: { metadata: true },
        });
        return restrictionFromMetadata(event?.metadata);
      },
      save: async ({ webinarId, targetId, state }) => {
        const session = await this.#client.webinarSession.findFirst({
          where: { webinarId },
          orderBy: { sequence: "desc" },
          select: { id: true },
        });
        if (!session) throw missingWebinarSessionError(webinarId);
        await this.#client.moderationEvent.create({
          data: {
            webinarSessionId: session.id,
            source: "MANUAL",
            category: "CUSTOM",
            action: state.bannedUntil !== undefined ? "DISCONNECT" : "MUTE",
            ...(state.reason !== undefined ? { reason: state.reason } : {}),
            metadata: {
              targetId,
              targetName: state.targetName,
              ...(state.mutedUntil !== undefined ? { mutedUntil: state.mutedUntil } : {}),
              ...(state.bannedUntil !== undefined ? { bannedUntil: state.bannedUntil } : {}),
              ...(state.reason !== undefined ? { reason: state.reason } : {}),
            },
          },
        });
      },
    };
  }

  private createUserRepository(): UserRepository {
    return {
      findById: async (id) => {
        const user = await this.#client.user.findFirst({
          where: { id, deletedAt: null },
        });
        return user ? mapUser(user) : null;
      },

      findByEmail: async (email) => {
        const user = await this.#client.user.findFirst({
          where: {
            normalizedEmail: normalizeEmail(email),
            deletedAt: null,
          },
        });
        return user ? mapUser(user) : null;
      },

      create: async (input) => {
        const user = await this.#client.user.create({
          data: {
            email: input.email.trim(),
            normalizedEmail: normalizeEmail(input.email),
            name: input.name,
            passwordHash: input.passwordHash,
            locale: toDatabaseLocale(input.locale),
          },
        });
        return mapUser(user);
      },

      markEmailVerified: async (userId, verifiedAt) => {
        await this.#client.user.updateMany({
          where: { id: userId, deletedAt: null },
          data: { emailVerifiedAt: verifiedAt },
        });
      },

      updatePassword: async (userId, passwordHash) => {
        await this.#client.user.updateMany({
          where: { id: userId, deletedAt: null },
          data: { passwordHash },
        });
      },

      updateProfile: async (userId, input) => {
        const result = await this.#client.user.updateMany({
          where: { id: userId, deletedAt: null },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
            ...(input.locale !== undefined ? { locale: toDatabaseLocale(input.locale) } : {}),
            ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
            ...(input.preferences !== undefined
              ? { preferences: input.preferences as Prisma.InputJsonValue }
              : {}),
          },
        });
        if (result.count !== 1) return null;
        const user = await this.#client.user.findUnique({ where: { id: userId } });
        return user ? mapUser(user) : null;
      },

      softDelete: async (userId, at) => {
        await this.#client.user.updateMany({
          where: { id: userId, deletedAt: null },
          data: { deletedAt: at },
        });
      },
    };
  }

  private createSessionRepository(): SessionRepository {
    return {
      create: async (input) => {
        const session = await this.#client.session.create({ data: input });
        return mapSession(session);
      },

      findActiveByTokenHash: async (tokenHash, now) => {
        const session = await this.#client.session.findFirst({
          where: {
            tokenHash,
            revokedAt: null,
            expiresAt: { gt: now },
            user: { deletedAt: null },
          },
        });
        return session ? mapSession(session) : null;
      },

      touchIfOlderThan: async (sessionId, threshold, now) => {
        await this.#client.session.updateMany({
          where: {
            id: sessionId,
            lastSeenAt: { lt: threshold },
            expiresAt: { gt: now },
            revokedAt: null,
          },
          data: { lastSeenAt: now },
        });
      },

      revoke: async (sessionId, at) => {
        await this.#client.session.updateMany({
          where: { id: sessionId, revokedAt: null },
          data: { revokedAt: at },
        });
      },

      revokeAllForUser: async (userId, at) => {
        await this.#client.session.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: at },
        });
      },

      listActiveForUser: async (userId, now) => {
        const sessions = await this.#client.session.findMany({
          where: { userId, revokedAt: null, expiresAt: { gt: now } },
          orderBy: { lastSeenAt: "desc" },
        });
        return sessions.map(mapSession);
      },
    };
  }

  private createOneTimeTokenRepository(): OneTimeTokenRepository {
    return {
      create: async (input) => {
        const kind = toSupportedAuthTokenKind(input.kind);
        if (!kind || !input.userId || input.registrationId !== undefined) {
          throw unsupportedTokenError(input.kind);
        }

        const token = await this.#client.authToken.create({
          data: {
            userId: input.userId,
            kind,
            tokenHash: input.tokenHash,
            expiresAt: input.expiresAt,
          },
        });
        return mapOneTimeToken(token);
      },

      consume: async (tokenHash, requestedKind, now) => {
        const kind = toSupportedAuthTokenKind(requestedKind);
        if (!kind) return null;

        return this.#client.$transaction(async (transaction) => {
          const consumed = await transaction.authToken.updateMany({
            where: {
              tokenHash,
              kind,
              consumedAt: null,
              expiresAt: { gt: now },
            },
            data: { consumedAt: now },
          });

          if (consumed.count !== 1) return null;

          const token = await transaction.authToken.findUnique({
            where: { tokenHash },
          });
          return token ? mapOneTimeToken(token) : null;
        });
      },

      invalidateForUser: async (userId, requestedKind, at) => {
        const kind = toSupportedAuthTokenKind(requestedKind);
        if (!kind) throw unsupportedTokenError(requestedKind);

        await this.#client.authToken.updateMany({
          where: { userId, kind, consumedAt: null },
          data: { consumedAt: at },
        });
      },
    };
  }

  private createWorkspaceRepository(): WorkspaceRepository {
    return {
      findActivePlanCode: async (workspaceId) => {
        const subscription = await this.#client.subscription.findFirst({
          where: {
            workspaceId,
            deletedAt: null,
            status: { in: ["ACTIVE", "TRIALING"] },
            plan: { active: true },
          },
          orderBy: { createdAt: "desc" },
          select: { plan: { select: { code: true } } },
        });
        return subscription?.plan.code ?? null;
      },

      findMember: async (workspaceId, userId) => {
        const member = await this.#client.workspaceMember.findFirst({
          where: {
            workspaceId,
            userId,
            deletedAt: null,
            workspace: { deletedAt: null },
          },
        });
        return member ? mapWorkspaceMember(member) : null;
      },

      upsertMember: async (input) => {
        const existing = await this.#client.workspaceMember.findUnique({
          where: {
            workspaceId_userId: {
              workspaceId: input.workspaceId,
              userId: input.userId,
            },
          },
        });
        if (existing) {
          const role =
            existing.role === "OWNER" || existing.role === "ADMIN" ? existing.role : input.role;
          const member = await this.#client.workspaceMember.update({
            where: { id: existing.id },
            data: {
              role,
              deletedAt: null,
            },
          });
          return mapWorkspaceMember(member);
        }
        const member = await this.#client.workspaceMember.create({
          data: {
            workspaceId: input.workspaceId,
            userId: input.userId,
            role: input.role,
          },
        });
        return mapWorkspaceMember(member);
      },

      createWithOwner: async (input) => {
        for (let attempt = 0; attempt < 8; attempt += 1) {
          const slug = attempt === 0 ? input.slug : `${input.slug}-${attempt + 1}`;
          try {
            const workspace = await this.#client.workspace.create({
              data: {
                name: input.name,
                slug,
                ownerId: input.ownerId,
                members: {
                  create: {
                    userId: input.ownerId,
                    role: "OWNER",
                  },
                },
              },
              select: { id: true, name: true, slug: true, logoUrl: true, timezone: true },
            });
            return { ...workspace, role: "OWNER" as const };
          } catch (error) {
            if (!isUniqueConstraintError(error)) throw error;
          }
        }
        throw new Error("Unable to allocate a unique workspace slug");
      },

      listForUser: async (userId) => {
        const memberships = await this.#client.workspaceMember.findMany({
          where: {
            userId,
            deletedAt: null,
            workspace: { deletedAt: null },
          },
          select: {
            role: true,
            workspace: {
              select: { id: true, name: true, slug: true, logoUrl: true, timezone: true },
            },
          },
          orderBy: { joinedAt: "asc" },
        });

        return memberships.map(({ role, workspace }) => ({
          ...workspace,
          role,
        }));
      },

      listMembers: async (workspaceId) => {
        const members = await this.#client.workspaceMember.findMany({
          where: { workspaceId, deletedAt: null, user: { deletedAt: null } },
          select: {
            userId: true,
            role: true,
            joinedAt: true,
            user: { select: { name: true, email: true, avatarUrl: true } },
          },
          orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
        });
        return members.map(({ user, ...member }) => ({ ...member, ...user }));
      },

      updateMemberRole: async (workspaceId, userId, role) => {
        const result = await this.#client.workspaceMember.updateMany({
          where: { workspaceId, userId, deletedAt: null, role: { not: "OWNER" } },
          data: { role },
        });
        if (result.count !== 1) return null;
        const member = await this.#client.workspaceMember.findUnique({
          where: { workspaceId_userId: { workspaceId, userId } },
        });
        return member ? mapWorkspaceMember(member) : null;
      },

      removeMember: async (workspaceId, userId, at) => {
        const result = await this.#client.workspaceMember.updateMany({
          where: { workspaceId, userId, deletedAt: null, role: { not: "OWNER" } },
          data: { deletedAt: at },
        });
        return result.count === 1;
      },

      getSettings: async (workspaceId) => {
        const workspace = await this.#client.workspace.findFirst({
          where: { id: workspaceId, deletedAt: null },
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            locale: true,
            timezone: true,
            settings: true,
          },
        });
        return workspace
          ? {
              ...workspace,
              locale: fromDatabaseLocale(workspace.locale),
              settings: jsonObject(workspace.settings),
            }
          : null;
      },

      updateSettings: async (workspaceId, input) => {
        await this.#client.workspace.updateMany({
          where: { id: workspaceId, deletedAt: null },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
            ...(input.locale !== undefined ? { locale: toDatabaseLocale(input.locale) } : {}),
            ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
            ...(input.settings !== undefined
              ? { settings: input.settings as Prisma.InputJsonValue }
              : {}),
          },
        });
      },

      softDelete: async (workspaceId, at) => {
        await this.#client.workspace.updateMany({
          where: { id: workspaceId, deletedAt: null },
          data: { deletedAt: at },
        });
      },

      getUsageSummary: async (workspaceId) => {
        const [members, webinars, recordings, storage] = await Promise.all([
          this.#client.workspaceMember.count({
            where: { workspaceId, deletedAt: null, user: { deletedAt: null } },
          }),
          this.#client.webinar.count({ where: { workspaceId, deletedAt: null } }),
          this.#client.recording.count({
            where: { webinarSession: { webinar: { workspaceId } }, deletedAt: null },
          }),
          this.#client.recording.aggregate({
            where: { webinarSession: { webinar: { workspaceId } }, deletedAt: null },
            _sum: { sizeBytes: true },
          }),
        ]);
        return {
          members,
          webinars,
          recordings,
          storageBytes: Number(storage._sum.sizeBytes ?? 0n),
        };
      },
    };
  }

  private createWebinarRepository(): WebinarRepository {
    return {
      findById: async (id) => {
        const webinar = await this.#client.webinar.findFirst({
          where: { id, deletedAt: null },
          include: webinarInclude,
        });
        return webinar ? mapWebinar(webinar) : null;
      },

      findPublicBySlug: async (slug) => {
        // The current schema scopes slug uniqueness to a workspace, while the
        // public route accepts a bare slug. Refuse ambiguous matches instead of
        // exposing an arbitrary workspace's webinar.
        const matches = await this.#client.webinar.findMany({
          where: { slug, access: "PUBLIC", deletedAt: null },
          include: webinarInclude,
          orderBy: { createdAt: "asc" },
          take: 2,
        });
        return matches.length === 1 ? mapWebinar(matches[0]!) : null;
      },

      findParticipantRole: async (webinarId, userId) => {
        const host = await this.#client.webinarHost.findFirst({
          where: {
            webinarId,
            userId,
            acceptedAt: { not: null },
            deletedAt: null,
            webinar: { deletedAt: null },
          },
          select: { role: true },
        });
        if (host) return host.role;

        const participant = await this.#client.participantSession.findFirst({
          where: {
            userId,
            leftAt: null,
            removedAt: null,
            webinarSession: {
              webinarId,
              webinar: { deletedAt: null },
            },
          },
          select: { role: true },
          orderBy: { lastSeenAt: "desc" },
        });
        return participant ? (participant.role as ParticipantRole) : null;
      },

      upsertHost: async (input) => {
        const existing = await this.#client.webinarHost.findFirst({
          where: { webinarId: input.webinarId, userId: input.userId },
          select: { id: true },
        });
        if (existing) {
          await this.#client.webinarHost.update({
            where: { id: existing.id },
            data: {
              role: input.role,
              acceptedAt: input.acceptedAt,
              deletedAt: null,
            },
          });
          return;
        }
        await this.#client.webinarHost.create({
          data: {
            webinarId: input.webinarId,
            userId: input.userId,
            role: input.role,
            invitedAt: input.acceptedAt,
            acceptedAt: input.acceptedAt,
          },
        });
      },

      listByWorkspace: async (workspaceId) => {
        const webinars = await this.#client.webinar.findMany({
          where: { workspaceId, deletedAt: null },
          include: webinarInclude,
          orderBy: [{ scheduledStartAt: "asc" }, { createdAt: "desc" }],
        });
        return webinars.map(mapWebinar);
      },

      create: async (input) => {
        const createdAt = new Date();
        const webinar = await this.#client.webinar.create({
          data: {
            workspaceId: input.workspaceId,
            createdById: input.createdById,
            slug: input.slug,
            title: input.title,
            description: input.description,
            coverImageUrl: input.coverImageUrl,
            language: toDatabaseLocale(input.language),
            timezone: input.timezone,
            status: input.status,
            access: input.visibility,
            scheduledStartAt: input.scheduledStartAt,
            maxParticipants: input.maxAttendees,
            recordingEnabled: input.recordingEnabled,
            requireEmailRegistration: input.requireEmailRegistration,
            allowGuestJoin: input.allowGuests,
            sessions: {
              create: {
                status: toSessionStatus(input.status),
                livekitRoomName: input.livekitRoomName,
                scheduledStartAt: input.scheduledStartAt,
              },
            },
            hosts: {
              create: {
                userId: input.createdById,
                role: "HOST",
                invitedAt: createdAt,
                acceptedAt: createdAt,
              },
            },
          },
          include: webinarInclude,
        });
        return mapWebinar(webinar);
      },

      updateDraft: async (id, version, patch) => {
        return this.#client.$transaction(async (transaction) => {
          const data: Prisma.WebinarUpdateManyMutationInput = {
            version: { increment: 1 },
          };

          if (patch.title !== undefined) data.title = patch.title;
          if (patch.description !== undefined) data.description = patch.description;
          if (patch.coverImageUrl !== undefined) data.coverImageUrl = patch.coverImageUrl;
          if (patch.scheduledStartAt !== undefined) {
            data.scheduledStartAt = patch.scheduledStartAt;
          }
          if (patch.timezone !== undefined) data.timezone = patch.timezone;
          if (patch.language !== undefined) {
            data.language = toDatabaseLocale(patch.language);
          }
          if (patch.visibility !== undefined) data.access = patch.visibility;
          if (patch.allowGuests !== undefined) data.allowGuestJoin = patch.allowGuests;
          if (patch.requireEmailRegistration !== undefined) {
            data.requireEmailRegistration = patch.requireEmailRegistration;
          }
          if (patch.maxAttendees !== undefined) {
            data.maxParticipants = patch.maxAttendees;
          }
          if (patch.recordingEnabled !== undefined) {
            data.recordingEnabled = patch.recordingEnabled;
          }

          const result = await transaction.webinar.updateMany({
            where: { id, version, status: "DRAFT", deletedAt: null },
            data,
          });
          if (result.count !== 1) return null;

          const webinar = await loadWebinar(transaction, id);
          if (!webinar) throw missingWebinarSessionError(id);

          if (patch.scheduledStartAt !== undefined) {
            await transaction.webinarSession.update({
              where: { id: webinar.sessions[0]!.id },
              data: { scheduledStartAt: patch.scheduledStartAt ?? null },
            });
          }

          const updated = await loadWebinar(transaction, id);
          if (!updated) throw missingWebinarSessionError(id);
          return mapWebinar(updated);
        });
      },

      transition: async (id, version, from, to) => {
        const at = new Date();
        return this.#client.$transaction(async (transaction) => {
          const data: Prisma.WebinarUpdateManyMutationInput = {
            status: to,
            version: { increment: 1 },
            ...transitionTimestamps(to, at),
          };
          const result = await transaction.webinar.updateMany({
            where: { id, version, status: from, deletedAt: null },
            data,
          });
          if (result.count !== 1) return null;

          const webinar = await loadWebinar(transaction, id);
          if (!webinar) throw missingWebinarSessionError(id);

          await transaction.webinarSession.update({
            where: { id: webinar.sessions[0]!.id },
            data: {
              status: toSessionStatusAfterTransition(from, to),
              ...sessionTransitionTimestamps(to, at),
            },
          });

          const updated = await loadWebinar(transaction, id);
          if (!updated) throw missingWebinarSessionError(id);
          return mapWebinar(updated);
        });
      },

      softDelete: async (id, at) => {
        await this.#client.webinar.updateMany({
          where: { id, deletedAt: null },
          data: { deletedAt: at, version: { increment: 1 } },
        });
      },

      countActiveParticipants: async (id) => {
        return this.#client.participantSession.count({
          where: {
            leftAt: null,
            removedAt: null,
            webinarSession: {
              webinarId: id,
              status: { in: ["WAITING", "LIVE"] },
              webinar: { deletedAt: null },
            },
          },
        });
      },
    };
  }

  private createRecordingRepository(): RecordingRepository {
    return {
      listByWebinar: async (webinarId) => {
        const recordings = await this.#client.recording.findMany({
          where: {
            deletedAt: null,
            webinarSession: { webinarId, webinar: { deletedAt: null } },
          },
          orderBy: { createdAt: "desc" },
        });
        return recordings.map(mapRecording);
      },

      findPublicById: async (recordingId) => {
        const result = await this.#client.recording.findFirst({
          where: {
            id: recordingId,
            status: "READY",
            playbackUrl: { not: null },
            deletedAt: null,
            webinarSession: { webinar: { deletedAt: null } },
          },
          include: {
            webinarSession: {
              include: {
                webinar: true,
                chatMessages: { orderBy: { createdAt: "asc" } },
              },
            },
          },
        });
        if (!result) return null;
        return {
          recording: mapRecording(result),
          webinar: {
            id: result.webinarSession.webinar.id,
            slug: result.webinarSession.webinar.slug,
            title: result.webinarSession.webinar.title,
          },
          chat: result.webinarSession.chatMessages.map((message) =>
            mapStoredChatMessage(result.webinarSession.webinar.id, message),
          ),
        };
      },

      ensureAutomaticForWebinar: async (input) => {
        const session = await this.#client.webinarSession.findFirst({
          where: { webinarId: input.webinarId },
          orderBy: { sequence: "desc" },
          select: { id: true },
        });
        if (!session) throw missingWebinarSessionError(input.webinarId);

        const existing = await this.#client.recording.findFirst({
          where: {
            webinarSessionId: session.id,
            provider: input.provider,
            deletedAt: null,
          },
          orderBy: { createdAt: "desc" },
        });

        const data = {
          status: input.status,
          startedAt: input.startedAt,
          endedAt: input.endedAt,
          ...(input.externalId !== undefined ? { externalId: input.externalId } : {}),
          ...(input.storageKey !== undefined ? { storageKey: input.storageKey } : {}),
          ...(input.playbackUrl !== undefined ? { playbackUrl: input.playbackUrl } : {}),
          ...(input.mimeType !== undefined ? { mimeType: input.mimeType } : {}),
          ...(input.sizeBytes !== undefined
            ? { sizeBytes: input.sizeBytes === null ? null : BigInt(input.sizeBytes) }
            : {}),
          ...(input.durationSeconds !== undefined ? { durationSeconds: input.durationSeconds } : {}),
          ...(input.availableAt !== undefined ? { availableAt: input.availableAt } : {}),
          ...(input.status === "FAILED"
            ? {
                failureCode: input.failureCode ?? "EGRESS_NOT_CONFIGURED",
                failureMessage:
                  input.failureMessage ??
                  "LiveKit Egress/S3 is not configured yet. Recording was requested automatically but no video file was produced.",
              }
            : {}),
        } as const;

        const recording = existing
          ? await this.#client.recording.update({ where: { id: existing.id }, data })
          : await this.#client.recording.create({
              data: {
                webinarSessionId: session.id,
                provider: input.provider,
                externalId: input.externalId ?? null,
                ...data,
              },
            });
        return mapRecording(recording);
      },

      softDelete: async (id, at) => {
        const recording = await this.#client.recording.updateMany({
          where: { id, deletedAt: null },
          data: { deletedAt: at, status: "DELETED" },
        });
        if (recording.count !== 1) return null;
        const updated = await this.#client.recording.findFirst({ where: { id } });
        return updated ? mapRecording(updated) : null;
      },
    };
  }

  private createRealtimeChatRepository(): ChatRepository {
    return {
      create: async (message) => {
        const session = await this.#client.webinarSession.findFirst({
          where: { webinarId: message.webinarId },
          orderBy: { sequence: "desc" },
          select: { id: true },
        });
        if (!session) throw missingWebinarSessionError(message.webinarId);
        const stored = await this.#client.chatMessage.create({
          data: {
            id: message.id,
            webinarSessionId: session.id,
            authorId: message.author.id,
            authorDisplayName: message.author.displayName,
            authorRole: message.author.role === "OWNER" ? "HOST" : message.author.role,
            body: message.body,
            status: message.status === "visible" ? "PUBLISHED" : "FLAGGED",
            idempotencyKey: message.id,
            publishedAt: message.status === "visible" ? new Date(message.createdAt) : null,
            createdAt: new Date(message.createdAt),
            ...(message.replyToId ? { replyToId: message.replyToId } : {}),
          },
        });
        return mapStoredChatMessage(message.webinarId, stored);
      },
      listByWebinar: async (webinarId) => {
        const messages = await this.#client.chatMessage.findMany({
          where: { webinarSession: { webinarId } },
          orderBy: { createdAt: "asc" },
        });
        return messages.map((message) => mapStoredChatMessage(webinarId, message));
      },
      markDeleted: async (input) => {
        const current = await this.#client.chatMessage.findFirst({
          where: { id: input.messageId, webinarSession: { webinarId: input.webinarId } },
        });
        if (!current) return null;
        const stored = await this.#client.chatMessage.update({
          where: { id: current.id },
          data: { status: "DELETED", deletedAt: new Date(input.deletedAt) },
        });
        return {
          ...mapStoredChatMessage(input.webinarId, stored),
          deletedById: input.deletedById,
          ...(input.reason ? { deletionReason: input.reason } : {}),
        };
      },
    };
  }

  private createRegistrationRepository(): RegistrationRepository {
    return {
      findById: async (id) => {
        const registration = await this.#client.registration.findFirst({
          where: { id, deletedAt: null },
        });
        return registration ? mapRegistration(registration) : null;
      },

      findByWebinarAndEmail: async (webinarId, email) => {
        const registration = await this.#client.registration.findFirst({
          where: {
            webinarId,
            normalizedEmail: normalizeEmail(email),
            deletedAt: null,
          },
        });
        return registration ? mapRegistration(registration) : null;
      },

      findByTokenHash: async (tokenHash) => {
        const registration = await this.#client.registration.findFirst({
          where: { tokenHash, deletedAt: null },
        });
        return registration ? mapRegistration(registration) : null;
      },

      listByWebinar: async (webinarId) => {
        const registrations = await this.#client.registration.findMany({
          where: { webinarId, deletedAt: null },
          orderBy: { createdAt: "desc" },
        });
        return registrations.map(mapRegistration);
      },

      confirmByTokenHash: async (tokenHash, confirmedAt) => {
        return this.#client.$transaction(async (transaction) => {
          const result = await transaction.registration.updateMany({
            where: {
              tokenHash,
              status: "PENDING",
              deletedAt: null,
            },
            data: {
              status: "CONFIRMED",
              confirmedAt,
            },
          });
          if (result.count !== 1) return null;

          const registration = await transaction.registration.findUnique({
            where: { tokenHash },
          });
          return registration ? mapRegistration(registration) : null;
        });
      },

      create: async (input) => {
        const registration = await this.#client.registration.create({
          data: {
            webinarId: input.webinarId,
            ...(input.userId === undefined ? {} : { userId: input.userId }),
            email: input.email.trim(),
            normalizedEmail: normalizeEmail(input.email),
            phone: input.phone.trim(),
            displayName: input.name,
            locale: toDatabaseLocale(input.locale),
            status: input.status,
            tokenHash: input.tokenHash,
            ...(input.status === "CONFIRMED" ? { confirmedAt: new Date() } : {}),
          },
        });
        return mapRegistration(registration);
      },
    };
  }
}

export function createPrismaUnitOfWork(databaseUrl: string): UnitOfWork {
  return new PrismaUnitOfWork(databaseUrl);
}

async function loadWebinar(
  transaction: Prisma.TransactionClient,
  id: string,
): Promise<WebinarWithSession | null> {
  const webinar = await transaction.webinar.findFirst({
    where: { id, deletedAt: null },
    include: webinarInclude,
  });
  if (!webinar || webinar.sessions.length !== 1) return null;
  return webinar;
}

function mapUser(user: User): UserRecord {
  if (!user.passwordHash || !user.name) {
    throw new Error(`User ${user.id} cannot be represented by the password-auth domain model`);
  }
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    passwordHash: user.passwordHash,
    locale: fromDatabaseLocale(user.locale),
    avatarUrl: user.avatarUrl,
    timezone: user.timezone,
    preferences: jsonObject(user.preferences),
    emailVerifiedAt: user.emailVerifiedAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function mapSession(session: Session): SessionRecord {
  return {
    id: session.id,
    userId: session.userId,
    tokenHash: session.tokenHash,
    expiresAt: session.expiresAt,
    lastSeenAt: session.lastSeenAt,
    ipAddress: session.ipAddress,
    userAgent: session.userAgent,
    revokedAt: session.revokedAt,
    createdAt: session.createdAt,
  };
}

function jsonObject(value: Prisma.JsonValue): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function mapOneTimeToken(token: AuthToken): OneTimeTokenRecord {
  return {
    id: token.id,
    userId: token.userId,
    registrationId: null,
    kind: token.kind,
    tokenHash: token.tokenHash,
    expiresAt: token.expiresAt,
    consumedAt: token.consumedAt,
    createdAt: token.createdAt,
  };
}

function mapWorkspaceMember(member: WorkspaceMember): WorkspaceMemberRecord {
  return {
    workspaceId: member.workspaceId,
    userId: member.userId,
    role: member.role,
  };
}

function mapWebinar(webinar: WebinarWithSession): WebinarRecord {
  const session = webinar.sessions[0];
  if (!session) throw missingWebinarSessionError(webinar.id);

  return {
    id: webinar.id,
    workspaceId: webinar.workspaceId,
    slug: webinar.slug,
    title: webinar.title,
    description: webinar.description ?? "",
    coverImageUrl: webinar.coverImageUrl,
    status: webinar.status,
    scheduledStartAt: webinar.scheduledStartAt,
    timezone: webinar.timezone,
    language: fromDatabaseLocale(webinar.language),
    visibility: webinar.access === "PUBLIC" ? "PUBLIC" : "PRIVATE",
    allowGuests: webinar.allowGuestJoin,
    requireEmailRegistration: webinar.requireEmailRegistration,
    maxAttendees: webinar.maxParticipants,
    recordingEnabled: webinar.recordingEnabled,
    livekitRoomName: session.livekitRoomName,
    createdById: webinar.createdById,
    startedAt: webinar.startedAt,
    endedAt: webinar.endedAt,
    version: webinar.version,
    createdAt: webinar.createdAt,
    updatedAt: webinar.updatedAt,
    deletedAt: webinar.deletedAt,
  };
}

function mapRegistration(registration: Registration): RegistrationRecord {
  return {
    id: registration.id,
    webinarId: registration.webinarId,
    userId: registration.userId,
    email: registration.email,
    phone: registration.phone,
    name: registration.displayName,
    locale: fromDatabaseLocale(registration.locale),
    status: toDomainRegistrationStatus(registration.status),
    createdAt: registration.createdAt,
    updatedAt: registration.updatedAt,
  };
}

function mapStoredChatMessage(
  webinarId: string,
  message: {
    id: string;
    authorId: string;
    authorDisplayName: string;
    authorRole: ParticipantRole;
    body: string;
    status: "PENDING" | "PUBLISHED" | "FLAGGED" | "BLOCKED" | "DELETED";
    replyToId: string | null;
    createdAt: Date;
    deletedAt: Date | null;
  },
): ChatMessage {
  return {
    id: message.id,
    webinarId,
    author: {
      id: message.authorId,
      displayName: message.authorDisplayName,
      role: message.authorRole,
    },
    body: message.body,
    status:
      message.status === "DELETED"
        ? "deleted"
        : message.status === "PUBLISHED"
          ? "visible"
          : "pending_review",
    createdAt: message.createdAt.toISOString(),
    ...(message.replyToId ? { replyToId: message.replyToId } : {}),
    ...(message.deletedAt ? { deletedAt: message.deletedAt.toISOString() } : {}),
  };
}

function mapRecording(recording: {
  id: string;
  webinarSessionId: string;
  provider: string;
  externalId: string | null;
  status: RecordingRecord["status"];
  storageKey: string | null;
  playbackUrl: string | null;
  mimeType: string | null;
  sizeBytes: bigint | number | null;
  durationSeconds: number | null;
  retentionUntil: Date | null;
  startedAt: Date | null;
  endedAt: Date | null;
  availableAt: Date | null;
  failureCode: string | null;
  failureMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}): RecordingRecord {
  return {
    id: recording.id,
    webinarSessionId: recording.webinarSessionId,
    provider: recording.provider,
    externalId: recording.externalId,
    status: recording.status,
    storageKey: recording.storageKey,
    playbackUrl: recording.playbackUrl,
    mimeType: recording.mimeType,
    sizeBytes: recording.sizeBytes === null ? null : Number(recording.sizeBytes),
    durationSeconds: recording.durationSeconds,
    retentionUntil: recording.retentionUntil,
    startedAt: recording.startedAt,
    endedAt: recording.endedAt,
    availableAt: recording.availableAt,
    failureCode: recording.failureCode,
    failureMessage: recording.failureMessage,
    createdAt: recording.createdAt,
    updatedAt: recording.updatedAt,
    deletedAt: recording.deletedAt,
  };
}

function toDomainRegistrationStatus(
  status: "PENDING" | "CONFIRMED" | "WAITLISTED" | "CANCELLED" | "ATTENDED" | "NO_SHOW",
): RegistrationRecord["status"] {
  switch (status) {
    case "PENDING":
    case "WAITLISTED":
      return "PENDING";
    case "CONFIRMED":
    case "ATTENDED":
    case "NO_SHOW":
      return "CONFIRMED";
    case "CANCELLED":
      return "CANCELLED";
  }
}

function toDatabaseLocale(locale: Locale): "EN" | "RU" {
  return locale === "ru" ? "RU" : "EN";
}

function fromDatabaseLocale(locale: "EN" | "RU"): Locale {
  return locale === "RU" ? "ru" : "en";
}

function normalizeEmail(email: string): string {
  return email.trim().toLocaleLowerCase("en-US");
}

function toSupportedAuthTokenKind(kind: OneTimeTokenKind): SupportedAuthTokenKind | null {
  if (kind === "EMAIL_VERIFICATION" || kind === "PASSWORD_RESET") return kind;
  return null;
}

function unsupportedTokenError(kind: OneTimeTokenKind): Error {
  return new Error(
    `One-time token kind ${kind} is not supported by the AuthToken persistence model`,
  );
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function missingWebinarSessionError(webinarId: string): Error {
  return new Error(`Webinar ${webinarId} has no current WebinarSession`);
}

function toSessionStatus(status: WebinarStatus): "SCHEDULED" | "LIVE" | "ENDED" | "CANCELLED" {
  switch (status) {
    case "DRAFT":
    case "SCHEDULED":
      return "SCHEDULED";
    case "LIVE":
      return "LIVE";
    case "ENDED":
    case "ARCHIVED":
      return "ENDED";
    case "CANCELLED":
      return "CANCELLED";
  }
}

function toSessionStatusAfterTransition(
  from: WebinarStatus,
  to: WebinarStatus,
): "SCHEDULED" | "LIVE" | "ENDED" | "CANCELLED" {
  if (to === "ARCHIVED" && from === "CANCELLED") return "CANCELLED";
  return toSessionStatus(to);
}

function transitionTimestamps(
  status: WebinarStatus,
  at: Date,
): Prisma.WebinarUpdateManyMutationInput {
  switch (status) {
    case "LIVE":
      return { startedAt: at };
    case "ENDED":
      return { endedAt: at };
    case "CANCELLED":
      return { cancelledAt: at };
    case "ARCHIVED":
      return { archivedAt: at };
    case "DRAFT":
    case "SCHEDULED":
      return {};
  }
}

function sessionTransitionTimestamps(
  status: WebinarStatus,
  at: Date,
): Prisma.WebinarSessionUpdateInput {
  switch (status) {
    case "LIVE":
      return { startedAt: at };
    case "ENDED":
    case "CANCELLED":
      return { endedAt: at };
    case "DRAFT":
    case "SCHEDULED":
    case "ARCHIVED":
      return {};
  }
}

function restrictionFromMetadata(
  value: Prisma.JsonValue | null | undefined,
): ModerationRestrictionRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const targetName = value["targetName"];
  if (typeof targetName !== "string") return null;
  const mutedUntil = restrictionTimestamp(value["mutedUntil"]);
  const bannedUntil = restrictionTimestamp(value["bannedUntil"]);
  const reason = value["reason"];
  return {
    targetName,
    ...(mutedUntil !== undefined ? { mutedUntil } : {}),
    ...(bannedUntil !== undefined ? { bannedUntil } : {}),
    ...(typeof reason === "string" ? { reason } : {}),
  };
}

function restrictionTimestamp(value: Prisma.JsonValue | undefined): number | null | undefined {
  return value === null || typeof value === "number" ? value : undefined;
}
