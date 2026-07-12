import { z } from "zod";
import { dateTimeSchema, idempotencyKeySchema, idSchema } from "./common.js";
import { webinarRoleSchema, webinarStatusSchema } from "./webinar.js";

const clientEnvelope = {
  idempotencyKey: idempotencyKeySchema,
  webinarSessionId: idSchema,
};

export const clientRealtimeEventSchema = z.discriminatedUnion("type", [
  z.object({
    ...clientEnvelope,
    type: z.literal("chat.send"),
    payload: z.object({ body: z.string().trim().min(1).max(4_000), replyToId: idSchema.optional() }),
  }),
  z.object({
    ...clientEnvelope,
    type: z.literal("question.submit"),
    payload: z.object({ body: z.string().trim().min(1).max(4_000) }),
  }),
  z.object({
    ...clientEnvelope,
    type: z.literal("poll.vote"),
    payload: z.object({ pollId: idSchema, optionIds: z.array(idSchema).min(1).max(20) }),
  }),
  z.object({
    ...clientEnvelope,
    type: z.literal("reaction.send"),
    payload: z.object({ reaction: z.enum(["APPLAUSE", "HEART", "CELEBRATE", "THUMBS_UP"]) }),
  }),
  z.object({
    ...clientEnvelope,
    type: z.literal("waiting-room.decide"),
    payload: z.object({ participantSessionId: idSchema, decision: z.enum(["ADMIT", "REJECT"]) }),
  }),
]);

const serverEnvelope = {
  eventId: idSchema,
  webinarSessionId: idSchema,
  occurredAt: dateTimeSchema,
  sequence: z.number().int().nonnegative(),
};

export const serverRealtimeEventSchema = z.discriminatedUnion("type", [
  z.object({
    ...serverEnvelope,
    type: z.literal("chat.message.updated"),
    payload: z.object({
      id: idSchema,
      body: z.string(),
      status: z.enum(["PENDING", "PUBLISHED", "FLAGGED", "BLOCKED", "DELETED"]),
      authorParticipantSessionId: idSchema.nullable(),
      createdAt: dateTimeSchema,
    }),
  }),
  z.object({
    ...serverEnvelope,
    type: z.literal("question.updated"),
    payload: z.object({
      id: idSchema,
      body: z.string(),
      status: z.enum(["PENDING", "PUBLISHED", "FLAGGED", "ANSWERED", "DISMISSED", "BLOCKED", "DELETED"]),
      answerBody: z.string().nullable(),
      upvoteCount: z.number().int().nonnegative(),
    }),
  }),
  z.object({
    ...serverEnvelope,
    type: z.literal("poll.updated"),
    payload: z.object({ pollId: idSchema, status: z.enum(["DRAFT", "OPEN", "CLOSED", "CANCELLED"]) }),
  }),
  z.object({
    ...serverEnvelope,
    type: z.literal("participant.updated"),
    payload: z.object({ participantSessionId: idSchema, role: webinarRoleSchema, presence: z.enum(["WAITING", "JOINED", "LEFT", "REMOVED"]) }),
  }),
  z.object({
    ...serverEnvelope,
    type: z.literal("moderation.notice"),
    payload: z.object({ targetId: idSchema, targetType: z.enum(["CHAT_MESSAGE", "QUESTION", "PARTICIPANT"]), action: z.string() }),
  }),
  z.object({
    ...serverEnvelope,
    type: z.literal("webinar.state.changed"),
    payload: z.object({ webinarId: idSchema, status: webinarStatusSchema }),
  }),
]);

export type ClientRealtimeEvent = z.infer<typeof clientRealtimeEventSchema>;
export type ServerRealtimeEvent = z.infer<typeof serverRealtimeEventSchema>;
