export const WORKSPACE_ROLES = ["OWNER", "ADMIN", "MEMBER"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const PARTICIPANT_ROLES = [
  "OWNER",
  "HOST",
  "COHOST",
  "MODERATOR",
  "SPEAKER",
  "ATTENDEE",
  "GUEST",
] as const;
export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number];

export const WEBINAR_STATUSES = [
  "DRAFT",
  "SCHEDULED",
  "LIVE",
  "ENDED",
  "CANCELLED",
  "ARCHIVED",
] as const;
export type WebinarStatus = (typeof WEBINAR_STATUSES)[number];

export type Locale = "en" | "ru";

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  locale: Locale;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  lastSeenAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export type OneTimeTokenKind = "EMAIL_VERIFICATION" | "PASSWORD_RESET" | "REGISTRATION_ACCESS";

export interface OneTimeTokenRecord {
  id: string;
  userId: string | null;
  registrationId: string | null;
  kind: OneTimeTokenKind;
  tokenHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

export interface WorkspaceMemberRecord {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
}

export interface WebinarRecord {
  id: string;
  workspaceId: string;
  slug: string;
  title: string;
  description: string;
  coverImageUrl: string | null;
  status: WebinarStatus;
  scheduledStartAt: Date | null;
  timezone: string;
  language: Locale;
  visibility: "PUBLIC" | "PRIVATE";
  allowGuests: boolean;
  requireEmailRegistration: boolean;
  maxAttendees: number | null;
  livekitRoomName: string;
  createdById: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface RegistrationRecord {
  id: string;
  webinarId: string;
  userId: string | null;
  email: string;
  phone: string;
  name: string;
  locale: Locale;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthenticatedActor {
  kind: "user";
  user: Pick<UserRecord, "id" | "email" | "name" | "locale" | "emailVerifiedAt">;
  session: Pick<SessionRecord, "id" | "expiresAt">;
}

export interface RegisteredParticipantActor {
  kind: "registration";
  registration: RegistrationRecord;
}

export type RequestActor = AuthenticatedActor | RegisteredParticipantActor;
