import { z } from "zod";

export const idSchema = z.string().uuid();
export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(100)
  .regex(/^[A-Za-z0-9._:-]+$/, "Invalid idempotency key");
export const emailSchema = z.string().trim().toLowerCase().email().max(320);
export const localeSchema = z.enum(["EN", "RU"]);
export const dateTimeSchema = z.string().datetime({ offset: true });
export const timezoneSchema = z.string().trim().min(1).max(100);
export const slugSchema = z
  .string()
  .trim()
  .min(3)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens");

export const pageRequestSchema = z.object({
  cursor: idSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const apiErrorCodeSchema = z.enum([
  "BAD_REQUEST",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "SERVICE_NOT_CONFIGURED",
  "PLAN_LIMIT_REACHED",
  "BUSINESS_DECISION_REQUIRED",
  "INTERNAL_ERROR",
]);

export const apiErrorSchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
    requestId: z.string().min(1),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});

export type Locale = z.infer<typeof localeSchema>;
export type PageRequest = z.infer<typeof pageRequestSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
