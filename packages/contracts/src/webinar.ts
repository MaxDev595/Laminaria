import { z } from "zod";
import {
  dateTimeSchema,
  emailSchema,
  idempotencyKeySchema,
  idSchema,
  localeSchema,
  slugSchema,
  timezoneSchema,
} from "./common.js";

export const webinarStatusSchema = z.enum([
  "DRAFT",
  "SCHEDULED",
  "LIVE",
  "ENDED",
  "CANCELLED",
  "ARCHIVED",
]);
export const webinarSessionStatusSchema = z.enum([
  "SCHEDULED",
  "WAITING",
  "LIVE",
  "ENDED",
  "CANCELLED",
]);
export const webinarAccessSchema = z.enum(["PUBLIC", "PRIVATE", "PASSWORD_PROTECTED"]);
export const webinarRoleSchema = z.enum([
  "HOST",
  "COHOST",
  "MODERATOR",
  "SPEAKER",
  "ATTENDEE",
  "GUEST",
]);
export const webinarHostRoleSchema = webinarRoleSchema.extract([
  "HOST",
  "COHOST",
  "MODERATOR",
  "SPEAKER",
]);
export const registrationStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "WAITLISTED",
  "CANCELLED",
  "ATTENDED",
  "NO_SHOW",
]);

const webinarFeatureSettingsSchema = z.object({
  requireEmailRegistration: z.boolean().default(true),
  allowGuestJoin: z.boolean().default(false),
  waitingRoomEnabled: z.boolean().default(false),
  recordingEnabled: z.boolean().default(false),
  chatEnabled: z.boolean().default(true),
  qaEnabled: z.boolean().default(true),
  reactionsEnabled: z.boolean().default(true),
  pollsEnabled: z.boolean().default(true),
  aiModerationEnabled: z.boolean().default(false),
  aiAnswersEnabled: z.boolean().default(false),
  remindersEnabled: z.boolean().default(true),
});

export const createWebinarRequestSchema = z
  .object({
    workspaceId: idSchema,
    slug: slugSchema,
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(20_000).nullable().optional(),
    coverImageUrl: z.string().url().nullable().optional(),
    language: localeSchema.default("EN"),
    timezone: timezoneSchema,
    access: webinarAccessSchema.default("PUBLIC"),
    scheduledStartAt: dateTimeSchema.nullable().optional(),
    maxParticipants: z.number().int().positive().nullable().optional(),
    password: z.string().min(8).max(128).optional(),
  })
  .extend(webinarFeatureSettingsSchema.shape)
  .superRefine((value, context) => {
    if (value.access === "PASSWORD_PROTECTED" && !value.password) {
      context.addIssue({ code: "custom", path: ["password"], message: "A password is required" });
    }
    if (value.allowGuestJoin && value.requireEmailRegistration) {
      context.addIssue({
        code: "custom",
        path: ["allowGuestJoin"],
        message: "Guest join and required email registration are mutually exclusive",
      });
    }
  });

export const updateWebinarRequestSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(20_000).nullable().optional(),
  coverImageUrl: z.string().url().nullable().optional(),
  language: localeSchema.optional(),
  timezone: timezoneSchema.optional(),
  access: webinarAccessSchema.optional(),
  scheduledStartAt: dateTimeSchema.nullable().optional(),
  maxParticipants: z.number().int().positive().nullable().optional(),
  password: z.string().min(8).max(128).nullable().optional(),
  ...webinarFeatureSettingsSchema.partial().shape,
});

export const transitionWebinarRequestSchema = z.object({
  to: webinarStatusSchema,
  idempotencyKey: idempotencyKeySchema,
});

export const registerForWebinarRequestSchema = z.object({
  email: emailSchema,
  displayName: z.string().trim().min(1).max(160),
  locale: localeSchema.default("EN"),
  consent: z.literal(true),
});

export const preJoinRequestSchema = z.object({
  registrationToken: z.string().min(32).max(512).optional(),
  invitationToken: z.string().min(32).max(512).optional(),
  displayName: z.string().trim().min(1).max(160),
  password: z.string().max(128).optional(),
  idempotencyKey: idempotencyKeySchema,
});

export const webinarDtoSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  coverImageUrl: z.string().url().nullable(),
  language: localeSchema,
  timezone: timezoneSchema,
  status: webinarStatusSchema,
  access: webinarAccessSchema,
  scheduledStartAt: dateTimeSchema.nullable(),
  maxParticipants: z.number().int().positive().nullable(),
  settings: webinarFeatureSettingsSchema,
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
});

export type WebinarStatus = z.infer<typeof webinarStatusSchema>;
export type WebinarSessionStatus = z.infer<typeof webinarSessionStatusSchema>;
export type WebinarRole = z.infer<typeof webinarRoleSchema>;
export type WebinarHostRole = z.infer<typeof webinarHostRoleSchema>;
export type CreateWebinarRequest = z.infer<typeof createWebinarRequestSchema>;
export type UpdateWebinarRequest = z.infer<typeof updateWebinarRequestSchema>;
export type WebinarDto = z.infer<typeof webinarDtoSchema>;

export const WEBINAR_TRANSITIONS = {
  DRAFT: ["SCHEDULED", "CANCELLED", "ARCHIVED"],
  SCHEDULED: ["LIVE", "CANCELLED"],
  LIVE: ["ENDED"],
  ENDED: ["ARCHIVED"],
  CANCELLED: ["ARCHIVED"],
  ARCHIVED: [],
} as const satisfies Record<WebinarStatus, readonly WebinarStatus[]>;

export function canTransitionWebinar(from: WebinarStatus, to: WebinarStatus): boolean {
  return (WEBINAR_TRANSITIONS[from] as readonly WebinarStatus[]).includes(to);
}

export class InvalidWebinarTransitionError extends Error {
  readonly code = "INVALID_WEBINAR_TRANSITION";

  constructor(
    readonly from: WebinarStatus,
    readonly to: WebinarStatus,
  ) {
    super(`Webinar cannot transition from ${from} to ${to}`);
    this.name = "InvalidWebinarTransitionError";
  }
}

export function assertWebinarTransition(from: WebinarStatus, to: WebinarStatus): void {
  if (!canTransitionWebinar(from, to)) throw new InvalidWebinarTransitionError(from, to);
}
