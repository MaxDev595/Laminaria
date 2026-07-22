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
import type { ChatMessage, ChatRepository } from "../realtime/types.js";

export interface PublicRecordingRecord {
  recording: RecordingRecord;
  webinar: { id: string; slug: string; title: string };
  chat: readonly ChatMessage[];
}

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
  updateProfile(
    userId: string,
    input: {
      name?: string;
      avatarUrl?: string | null;
      locale?: "en" | "ru";
      timezone?: string;
      preferences?: Record<string, unknown>;
    },
  ): Promise<UserRecord | null>;
  softDelete(userId: string, at: Date): Promise<void>;
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
  listActiveForUser(userId: string, now: Date): Promise<readonly SessionRecord[]>;
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
  }): Promise<{
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    timezone: string;
    role: WorkspaceRole;
  }>;
  listForUser(
    userId: string,
  ): Promise<
    readonly {
      id: string;
      name: string;
      slug: string;
      logoUrl: string | null;
      timezone: string;
      role: WorkspaceRole;
    }[]
  >;
  listMembers(workspaceId: string): Promise<
    readonly {
      userId: string;
      role: WorkspaceRole;
      joinedAt: Date;
      name: string | null;
      email: string;
      avatarUrl: string | null;
    }[]
  >;
  updateMemberRole(
    workspaceId: string,
    userId: string,
    role: Exclude<WorkspaceRole, "OWNER">,
  ): Promise<WorkspaceMemberRecord | null>;
  removeMember(workspaceId: string, userId: string, at: Date): Promise<boolean>;
  getSettings(workspaceId: string): Promise<{
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    locale: "en" | "ru";
    timezone: string;
    settings: Record<string, unknown>;
  } | null>;
  updateSettings(
    workspaceId: string,
    input: {
      name?: string;
      logoUrl?: string | null;
      locale?: "en" | "ru";
      timezone?: string;
      settings?: Record<string, unknown>;
    },
  ): Promise<void>;
  softDelete(workspaceId: string, at: Date): Promise<void>;
  getUsageSummary(workspaceId: string): Promise<{
    members: number;
    webinars: number;
    recordings: number;
    storageBytes: number;
  }>;
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
  findPublicById(recordingId: string): Promise<PublicRecordingRecord | null>;
  ensureAutomaticForWebinar(input: {
    webinarId: string;
    provider: string;
    status: "RECORDING" | "PROCESSING" | "READY" | "FAILED";
    startedAt: Date | null;
    endedAt: Date;
    externalId?: string;
    storageKey?: string;
    playbackUrl?: string | null;
    mimeType?: string;
    sizeBytes?: number | null;
    durationSeconds?: number | null;
    availableAt?: Date | null;
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

export type BillingPlanCode = "professional" | "business";
export type BillingSubscriptionStatus =
  | "INCOMPLETE"
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "PAUSED"
  | "CANCELLED"
  | "EXPIRED";

export interface BillingRepository {
  getCustomerId(workspaceId: string): Promise<string | null>;
  syncStripeSubscription(input: {
    workspaceId: string;
    planCode: BillingPlanCode;
    status: BillingSubscriptionStatus;
    providerCustomerId: string | null;
    providerSubscriptionId: string;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
  }): Promise<void>;
}

export interface UnitOfWork {
  readonly users: UserRepository;
  readonly sessions: SessionRepository;
  readonly tokens: OneTimeTokenRepository;
  readonly workspaces: WorkspaceRepository;
  readonly webinars: WebinarRepository;
  readonly recordings: RecordingRepository;
  readonly realtimeChat?: ChatRepository;
  readonly registrations: RegistrationRepository;
  readonly moderationRestrictions?: ModerationRestrictionRepository;
  readonly billing: BillingRepository;
  healthcheck(): Promise<void>;
  close(): Promise<void>;
}
