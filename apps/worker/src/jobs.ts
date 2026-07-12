import { createHash } from "node:crypto";
import { z } from "zod";

const baseJob = z.object({
  workspaceId: z.uuid(),
  requestedBy: z.uuid(),
  idempotencyKey: z.string().min(12).max(200),
  requestedAt: z.iso.datetime(),
});

export const emailJob = baseJob.extend({
  kind: z.enum(["verification", "password-reset", "webinar-reminder", "invitation"]),
  recipient: z.email(),
  locale: z.enum(["en", "ru"]),
  subject: z.string().min(1).max(180),
  text: z.string().min(1).max(20_000),
  html: z.string().min(1).max(100_000).optional(),
});

export const aiJob = baseJob.extend({
  kind: z.enum(["moderate", "answer", "summarize"]),
  webinarId: z.uuid(),
  locale: z.enum(["en", "ru"]),
  input: z.string().min(1).max(100_000),
  context: z.string().max(300_000).optional(),
});

export const storageJob = baseJob.extend({
  kind: z.enum(["recording-manifest", "resource-copy", "export"]),
  webinarId: z.uuid(),
  objectKey: z.string().min(1).max(1024),
  contentType: z.string().min(1).max(200),
  payloadBase64: z.string().max(14_000_000),
});

export type EmailJob = z.infer<typeof emailJob>;
export type AiJob = z.infer<typeof aiJob>;
export type StorageJob = z.infer<typeof storageJob>;

export function stableJobId(queue: string, data: { workspaceId: string; idempotencyKey: string }) {
  const digest = createHash("sha256")
    .update(`${queue}:${data.workspaceId}:${data.idempotencyKey}`)
    .digest("hex")
    .slice(0, 40);
  return `${queue}-${digest}`;
}
