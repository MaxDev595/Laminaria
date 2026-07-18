import { z } from "zod";

const identifier = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, "Invalid identifier");

const idempotencyKey = z
  .string()
  .trim()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, "Invalid idempotency key");

const webinarMutation = {
  webinarId: identifier,
  idempotencyKey,
} as const;

export const webinarJoinSchema = z
  .object({
    webinarId: identifier,
  })
  .strict();

export const webinarLeaveSchema = webinarJoinSchema;

export const chatSendSchema = z
  .object({
    ...webinarMutation,
    body: z.string().trim().min(1).max(2_000),
    replyToId: identifier.optional(),
  })
  .strict();

export const chatDeleteSchema = z
  .object({
    ...webinarMutation,
    messageId: identifier,
    reason: z.string().trim().min(1).max(280).optional(),
  })
  .strict();

export const chatStateSchema = z
  .object({
    ...webinarMutation,
    enabled: z.boolean(),
  })
  .strict();

export const moderationRestrictSchema = z
  .object({
    ...webinarMutation,
    targetId: identifier,
    targetName: z.string().trim().min(1).max(160),
    action: z.enum(["mute", "ban", "unmute", "unban"]),
    durationMinutes: z.number().int().positive().max(43_200).nullable().optional(),
    reason: z.string().trim().min(1).max(280).optional(),
  })
  .strict();

export const questionAskSchema = z
  .object({
    ...webinarMutation,
    body: z.string().trim().min(1).max(2_000),
  })
  .strict();

export const questionUpvoteSchema = z
  .object({
    ...webinarMutation,
    questionId: identifier,
  })
  .strict();

export const questionAnswerSchema = z
  .object({
    ...webinarMutation,
    questionId: identifier,
    answer: z.string().trim().min(1).max(4_000),
  })
  .strict();

export const questionModerateSchema = z
  .object({
    ...webinarMutation,
    questionId: identifier,
    action: z.enum(["hide", "restore"]),
    reason: z.string().trim().min(1).max(280).optional(),
  })
  .strict();

const pollOptionLabel = z.string().trim().min(1).max(240);

export const pollCreateSchema = z
  .object({
    ...webinarMutation,
    question: z.string().trim().min(1).max(500),
    options: z.array(pollOptionLabel).min(2).max(10),
    allowMultiple: z.boolean().default(false),
  })
  .strict()
  .refine(
    ({ options }) =>
      new Set(options.map((option) => option.toLocaleLowerCase("en-US"))).size === options.length,
    { message: "Poll options must be unique", path: ["options"] },
  );

export const pollChangeStateSchema = z
  .object({
    ...webinarMutation,
    pollId: identifier,
  })
  .strict();

export const pollVoteSchema = z
  .object({
    ...webinarMutation,
    pollId: identifier,
    optionIds: z.array(identifier).min(1).max(10),
  })
  .strict()
  .refine(({ optionIds }) => new Set(optionIds).size === optionIds.length, {
    message: "Poll option ids must be unique",
    path: ["optionIds"],
  });

export type WebinarJoinPayload = z.infer<typeof webinarJoinSchema>;
export type WebinarLeavePayload = z.infer<typeof webinarLeaveSchema>;
export type ChatSendPayload = z.infer<typeof chatSendSchema>;
export type ChatDeletePayload = z.infer<typeof chatDeleteSchema>;
export type ChatStatePayload = z.infer<typeof chatStateSchema>;
export type ModerationRestrictPayload = z.infer<typeof moderationRestrictSchema>;
export type QuestionAskPayload = z.infer<typeof questionAskSchema>;
export type QuestionUpvotePayload = z.infer<typeof questionUpvoteSchema>;
export type QuestionAnswerPayload = z.infer<typeof questionAnswerSchema>;
export type QuestionModeratePayload = z.infer<typeof questionModerateSchema>;
export type PollCreatePayload = z.infer<typeof pollCreateSchema>;
export type PollChangeStatePayload = z.infer<typeof pollChangeStateSchema>;
export type PollVotePayload = z.infer<typeof pollVoteSchema>;
