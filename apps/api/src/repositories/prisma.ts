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
  RegistrationRecord,
  SessionRecord,
  UserRecord,
  WebinarRecord,
  WebinarStatus,
  WorkspaceMemberRecord,
} from "../domain/models.js";
import type {
  OneTimeTokenRepository,
  RegistrationRepository,
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
  public readonly registrations: RegistrationRepository;

  public constructor(databaseUrl: string) {
    const adapter = new PrismaPg({ connectionString: databaseUrl });
    this.#client = new PrismaClient({ adapter });

    this.users = this.createUserRepository();
    this.sessions = this.createSessionRepository();
    this.tokens = this.createOneTimeTokenRepository();
    this.workspaces = this.createWorkspaceRepository();
    this.webinars = this.createWebinarRepository();
    this.registrations = this.createRegistrationRepository();
  }

  public async healthcheck(): Promise<void> {
    await this.#client.$queryRaw`SELECT 1`;
  }

  public async close(): Promise<void> {
    await this.#client.$disconnect();
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
          const role = existing.role === "OWNER" || existing.role === "ADMIN" ? existing.role : input.role;
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
              select: { id: true, name: true, slug: true },
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
              select: { id: true, name: true, slug: true },
            },
          },
          orderBy: { joinedAt: "asc" },
        });

        return memberships.map(({ role, workspace }) => ({
          ...workspace,
          role,
        }));
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
            ...(input.status === "CONFIRMED"
              ? { confirmedAt: new Date() }
              : {}),
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
    revokedAt: session.revokedAt,
    createdAt: session.createdAt,
  };
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
    livekitRoomName: session.livekitRoomName,
    createdById: webinar.createdById,
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

function toDomainRegistrationStatus(
  status:
    | "PENDING"
    | "CONFIRMED"
    | "WAITLISTED"
    | "CANCELLED"
    | "ATTENDED"
    | "NO_SHOW",
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

function toSupportedAuthTokenKind(
  kind: OneTimeTokenKind,
): SupportedAuthTokenKind | null {
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

function toSessionStatus(
  status: WebinarStatus,
): "SCHEDULED" | "LIVE" | "ENDED" | "CANCELLED" {
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
