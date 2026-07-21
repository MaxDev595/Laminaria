import { z } from "zod";
import {
  dateTimeSchema,
  emailSchema,
  idSchema,
  localeSchema,
  slugSchema,
  timezoneSchema,
} from "./common.js";

export const workspaceRoleSchema = z.enum(["OWNER", "ADMIN", "HOST", "MODERATOR", "ANALYST", "MEMBER"]);

export const createWorkspaceRequestSchema = z.object({
  name: z.string().trim().min(1).max(160),
  slug: slugSchema.max(100),
  locale: localeSchema.default("EN"),
  timezone: timezoneSchema.default("UTC"),
});

export const updateWorkspaceRequestSchema = createWorkspaceRequestSchema
  .partial()
  .omit({ slug: true })
  .extend({ logoUrl: z.string().url().nullable().optional() });

export const workspaceDtoSchema = z.object({
  id: idSchema,
  name: z.string(),
  slug: z.string(),
  logoUrl: z.string().url().nullable(),
  locale: localeSchema,
  timezone: timezoneSchema,
  role: workspaceRoleSchema,
  createdAt: dateTimeSchema,
});

export const inviteWorkspaceMemberRequestSchema = z.object({
  email: emailSchema,
  role: workspaceRoleSchema.exclude(["OWNER"]),
});

export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;
export type CreateWorkspaceRequest = z.infer<typeof createWorkspaceRequestSchema>;
export type UpdateWorkspaceRequest = z.infer<typeof updateWorkspaceRequestSchema>;
export type WorkspaceDto = z.infer<typeof workspaceDtoSchema>;
