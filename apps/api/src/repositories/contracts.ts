import type {
  OneTimeTokenKind,
  OneTimeTokenRecord,
  RecordingRecord,
  RegistrationRecord,
  SessionRecord,
  UserRecord,
  WebinarRecord,
  WebinarStatus,
  WorkspaceMemberRecord,
  WorkspaceRole,
} from "../domain/models.js";

export interface UserRepository {
  findById(id: string): Promise<UserRecord | null>;
  findByEmail(email: string): Promise<UserRecord | null>;
  create(input: {
    email: string;
    name: string;
    passwordHash: string;
    locale: "en" | "ru";
  }): Promise<UserRecord>;
  markEmailVerified(userId: string, verifiedAt: Date): Promise<void>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;
}

export interface SessionRepository {
  create(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    lastSeenAt: Date;
  }): Promise<SessionRecord>;
  findActiveByTokenHash(tokenHash: string, now: Date): Promise<SessionRecord | null>;
  touchIfOlderThan(sessionId: string, threshold: Date, now: Date): Promise<void>;
  revoke(sessionId: string, at: Date): Promise<void>;
  revokeAllForUser(userId: string, at: Date): Promise<void>;
}

export interface OneTimeTokenRepository {
  create(input: {
    userId?: string;
    registrationId?: string;
    kind: OneTimeTokenKind;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<OneTimeTokenRecord>;
  consume(tokenHash: string, kind: OneTimeTokenKind, now: Date): Promise<OneTimeTokenRecord | null>;
  invalidateForUser(userId: string, kind: OneTimeTokenKind, at: Date): Promise<void>;
}

export interface WorkspaceRepository {
  findMember(workspaceId: string, userId: string): Promise<WorkspaceMemberRecord | null>;
  findActivePlanCode(workspaceId: string): Promise<string | null>;
  upsertMember(input: {
    workspaceId: string;
    userId: string;
    role: WorkspaceRole;
  }): Promise<WorkspaceMemberRecord>;
  createWithOwner(input: {
    name: string;
    slug: string;
    ownerId: string;
  }): Promise<{ id: string; name: string; slug: string; role: WorkspaceRole }>;
  listForUser(
    userId: string,
  ): Promise<readonly { id: string; name: string; slug: string; role: WorkspaceRole }[]>;
}

export interface WebinarRepository {
  findById(id: string): Promise<WebinarRecord | null>;
  findPublicBySlug(slug: string): Promise<WebinarRecord | null>;
  findParticipantRole(
    webinarId: string,
    userId: string,
  ): Promise<import("../domain/models.js").ParticipantRole | null>;
  upsertHost(input: {
    webinarId: string;
    userId: string;
    role: "HOST" | "COHOST" | "MODERATOR" | "SPEAKER";
    acceptedAt: Date;
  }): Promise<void>;
  listByWorkspace(workspaceId: string): Promise<readonly WebinarRecord[]>;
  create(
    input: Omit<WebinarRecord, "id" | "version" | "createdAt" | "updatedAt" | "deletedAt">,
  ): Promise<WebinarRecord>;
  updateDraft(
    id: string,
    version: number,
    patch: Partial<
      Pick<
        WebinarRecord,
        | "title"
        | "description"
        | "coverImageUrl"
        | "scheduledStartAt"
        | "timezone"
        | "language"
        | "visibility"
        | "allowGuests"
        | "requireEmailRegistration"
        | "maxAttendees"
        | "recordingEnabled"
      >
    >,
  ): Promise<WebinarRecord | null>;
  transition(
    id: string,
    version: number,
    from: WebinarStatus,
    to: WebinarStatus,
  ): Promise<WebinarRecord | null>;
  softDelete(id: string, at: Date): Promise<void>;
  countActiveParticipants(id: string): Promise<number>;
}

export interface RecordingRepository {
  listByWebinar(webinarId: string): Promise<readonly RecordingRecord[]>;
  ensureAutomaticForWebinar(input: {
    webinarId: string;
    provider: string;
    status: "RECORDING" | "PROCESSING" | "FAILED";
    startedAt: Date | null;
    endedAt: Date;
    failureCode?: string;
    failureMessage?: string;
  }): Promise<RecordingRecord>;
  softDelete(id: string, at: Date): Promise<RecordingRecord | null>;
}

export interface RegistrationRepository {
  findById(id: string): Promise<RegistrationRecord | null>;
  findByWebinarAndEmail(webinarId: string, email: string): Promise<RegistrationRecord | null>;
  findByTokenHash(tokenHash: string): Promise<RegistrationRecord | null>;
  listByWebinar(webinarId: string): Promise<readonly RegistrationRecord[]>;
  confirmByTokenHash(tokenHash: string, confirmedAt: Date): Promise<RegistrationRecord | null>;
  create(input: {
    webinarId: string;
    userId?: string;
    email: string;
    phone: string;
    name: string;
    locale: "en" | "ru";
    status: "PENDING" | "CONFIRMED";
    tokenHash: string;
  }): Promise<RegistrationRecord>;
}

export interface ModerationRestrictionRecord {
  targetName: string;
  mutedUntil?: number | null;
  bannedUntil?: number | null;
  reason?: string;
}

export interface ModerationRestrictionRepository {
  find(webinarId: string, targetId: string): Promise<ModerationRestrictionRecord | null>;
  save(input: {
    webinarId: string;
    targetId: string;
    state: ModerationRestrictionRecord;
  }): Promise<void>;
}

export interface UnitOfWork {
  readonly users: UserRepository;
  readonly sessions: SessionRepository;
  readonly tokens: OneTimeTokenRepository;
  readonly workspaces: WorkspaceRepository;
  readonly webinars: WebinarRepository;
  readonly recordings: RecordingRepository;
  readonly registrations: RegistrationRepository;
  readonly moderationRestrictions?: ModerationRestrictionRepository;
  healthcheck(): Promise<void>;
  close(): Promise<void>;
}
