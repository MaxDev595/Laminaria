import { z } from "zod";
import { dateTimeSchema, emailSchema, idSchema, localeSchema, timezoneSchema } from "./common.js";

export const passwordSchema = z
  .string()
  .min(12)
  .max(128)
  .refine((value) => /[a-z]/.test(value), "Password must contain a lowercase letter")
  .refine((value) => /[A-Z]/.test(value), "Password must contain an uppercase letter")
  .refine((value) => /\d/.test(value), "Password must contain a number");

export const signUpRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1).max(160),
  locale: localeSchema.default("EN"),
  timezone: timezoneSchema.default("UTC"),
});

export const signInRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const requestPasswordResetSchema = z.object({ email: emailSchema });
export const consumeAuthTokenSchema = z.object({ token: z.string().min(32).max(512) });
export const resetPasswordSchema = consumeAuthTokenSchema.extend({ password: passwordSchema });

export const authUserDtoSchema = z.object({
  id: idSchema,
  email: emailSchema,
  name: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  locale: localeSchema,
  timezone: timezoneSchema,
  emailVerifiedAt: dateTimeSchema.nullable(),
});

export const sessionDtoSchema = z.object({
  id: idSchema,
  user: authUserDtoSchema,
  expiresAt: dateTimeSchema,
});

export type SignUpRequest = z.infer<typeof signUpRequestSchema>;
export type SignInRequest = z.infer<typeof signInRequestSchema>;
export type AuthUserDto = z.infer<typeof authUserDtoSchema>;
export type SessionDto = z.infer<typeof sessionDtoSchema>;
