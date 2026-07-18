import { randomUUID } from "node:crypto";

import type { ZodType } from "zod";

import { RealtimeDomainError } from "./errors.js";
import {
  createIdempotencyFingerprint,
  IdempotencyConflictError,
  type IdempotencyExecutor,
} from "./idempotency.js";
import { RuleBasedModerationService } from "./moderation.js";
import {
  chatDeleteSchema,
  chatSendSchema,
  chatStateSchema,
  moderationRestrictSchema,
  pollChangeStateSchema,
  pollCreateSchema,
  pollVoteSchema,
  questionAnswerSchema,
  questionAskSchema,
  questionModerateSchema,
  questionUpvoteSchema,
  webinarJoinSchema,
  webinarLeaveSchema,
  type ChatDeletePayload,
  type ChatSendPayload,
  type ChatStatePayload,
  type ModerationRestrictPayload,
  type PollChangeStatePayload,
  type PollCreatePayload,
  type PollVotePayload,
  type QuestionAnswerPayload,
  type QuestionAskPayload,
  type QuestionModeratePayload,
  type QuestionUpvotePayload,
  type WebinarJoinPayload,
  type WebinarLeavePayload,
} from "./schemas.js";
import type {
  ActorSnapshot,
  ChatDeleted,
  ChatMessage,
  ChatStateChanged,
  ModerationRestrictionChanged,
  ModerationResult,
  ModerationService,
  Poll,
  Question,
  RealtimeAck,
  RealtimeAcknowledge,
  RealtimeAuthRequest,
  RealtimeAuthResolver,
  RealtimeErrorPayload,
  RealtimeLogger,
  RealtimePrincipal,
  RealtimeRepositories,
  RealtimeRole,
  RealtimeServer,
  RealtimeSocket,
  WebinarAccessDecision,
  WebinarAccessResolver,
  WebinarAction,
  WebinarJoined,
  WebinarLeft,
} from "./types.js";

const DEFAULT_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1_000;
const noOpLogger: RealtimeLogger = { error: () => undefined };
const viewerChatEnabledByWebinar = new Map<string, boolean>();
const moderationRestrictionsByWebinar = new Map<string, Map<string, RestrictionState>>();

export interface RestrictionState {
  mutedUntil?: number | null;
  bannedUntil?: number | null;
  targetName: string;
  reason?: string;
}

export type RealtimeEntityKind = "chat" | "question" | "poll" | "poll_option" | "moderation";

export interface RegisterRealtimeDependencies {
  auth: RealtimeAuthResolver;
  access: WebinarAccessResolver;
  repositories: RealtimeRepositories;
  idempotency: IdempotencyExecutor;
  moderation?: ModerationService;
  logger?: RealtimeLogger;
  now?: () => Date;
  idFactory?: (kind: RealtimeEntityKind) => string;
  idempotencyTtlMs?: number;
  removeBannedParticipant?: (webinarId: string, subject: string) => Promise<void>;
  restrictions?: {
    find(webinarId: string, targetId: string): Promise<RestrictionState | null>;
    save(input: { webinarId: string; targetId: string; state: RestrictionState }): Promise<void>;
  };
}

interface ResolvedDependencies {
  auth: RealtimeAuthResolver;
  access: WebinarAccessResolver;
  repositories: RealtimeRepositories;
  idempotency: IdempotencyExecutor;
  moderation: ModerationService;
  logger: RealtimeLogger;
  now: () => Date;
  idFactory: (kind: RealtimeEntityKind) => string;
  idempotencyTtlMs: number;
  removeBannedParticipant: (webinarId: string, subject: string) => Promise<void>;
  restrictions: NonNullable<RegisterRealtimeDependencies["restrictions"]>;
}

interface OperationResponse<T> {
  data: T;
  replayed: boolean;
}

interface MutationPayload {
  webinarId: string;
  idempotencyKey: string;
}

function createDefaultId(kind: RealtimeEntityKind): string {
  return `${kind}_${randomUUID()}`;
}

function resolveDependencies(dependencies: RegisterRealtimeDependencies): ResolvedDependencies {
  const idempotencyTtlMs = dependencies.idempotencyTtlMs ?? DEFAULT_IDEMPOTENCY_TTL_MS;
  if (!Number.isFinite(idempotencyTtlMs) || idempotencyTtlMs <= 0) {
    throw new TypeError("idempotencyTtlMs must be a positive number");
  }

  return {
    auth: dependencies.auth,
    access: dependencies.access,
    repositories: dependencies.repositories,
    idempotency: dependencies.idempotency,
    moderation: dependencies.moderation ?? new RuleBasedModerationService(),
    logger: dependencies.logger ?? noOpLogger,
    now: dependencies.now ?? (() => new Date()),
    idFactory: dependencies.idFactory ?? createDefaultId,
    idempotencyTtlMs,
    removeBannedParticipant: dependencies.removeBannedParticipant ?? (async () => undefined),
    restrictions: dependencies.restrictions ?? {
      async find() {
        return null;
      },
      async save() {
        return undefined;
      },
    },
  };
}

export function webinarRoom(webinarId: string): string {
  return `webinar:${webinarId}`;
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Readonly<Record<string, unknown>>;
  }
  return {};
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  return value?.[0];
}

function createAuthRequest(socket: RealtimeSocket): RealtimeAuthRequest {
  const auth = asRecord(socket.handshake.auth);
  const headers = socket.handshake.headers as Readonly<
    Record<string, string | string[] | undefined>
  >;
  const authorization = firstHeader(headers["authorization"]);
  const cookie = firstHeader(headers["cookie"]);
  const token =
    optionalString(auth["token"]) ??
    optionalString(auth["bearerToken"]) ??
    (authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : undefined);
  const sessionId = optionalString(auth["sessionId"]);

  return {
    auth,
    headers,
    ...(authorization ? { authorization } : {}),
    ...(cookie ? { cookie } : {}),
    ...(token ? { token } : {}),
    ...(sessionId ? { sessionId } : {}),
  };
}

function isValidPrincipal(principal: RealtimePrincipal | null): principal is RealtimePrincipal {
  return Boolean(
    principal &&
    principal.id.trim() &&
    principal.displayName.trim() &&
    (principal.kind === "user" || principal.kind === "guest"),
  );
}

function handshakeError(
  code: "UNAUTHORIZED" | "INTERNAL_ERROR",
  message: string,
): Error & { data: { code: string } } {
  return Object.assign(new Error(message), { data: { code } });
}

function requirePrincipal(socket: RealtimeSocket): RealtimePrincipal {
  const principal = socket.data.principal;
  if (!principal) {
    throw new RealtimeDomainError("UNAUTHORIZED", "Authentication required");
  }
  return principal;
}

async function authorize(
  socket: RealtimeSocket,
  dependencies: ResolvedDependencies,
  webinarId: string,
  action: WebinarAction,
  requireJoined = true,
): Promise<Extract<WebinarAccessDecision, { allowed: true }>> {
  if (requireJoined && !socket.data.joinedWebinarIds?.has(webinarId)) {
    throw new RealtimeDomainError("NOT_JOINED", "Join the webinar first");
  }

  const decision = await dependencies.access.authorize({
    principal: requirePrincipal(socket),
    webinarId,
    action,
  });
  if (!decision.allowed) {
    throw new RealtimeDomainError("FORBIDDEN", "Webinar access denied");
  }
  return decision;
}

function actorFrom(
  principal: RealtimePrincipal,
  decision: Extract<WebinarAccessDecision, { allowed: true }>,
): ActorSnapshot {
  return {
    id: decision.participantId,
    displayName: principal.displayName,
    role: decision.role,
  };
}

function isViewerRole(role: string): boolean {
  return role === "ATTENDEE" || role === "GUEST";
}

function isProtectedModerationRole(role: RealtimeRole | undefined): boolean {
  return role === "OWNER" || role === "HOST" || role === "COHOST" || role === "MODERATOR";
}

async function restrictionFor(
  dependencies: ResolvedDependencies,
  webinarId: string,
  targetId: string,
): Promise<RestrictionState | null> {
  const cached = moderationRestrictionsByWebinar.get(webinarId)?.get(targetId);
  if (cached) return cached;
  const persisted = await dependencies.restrictions.find(webinarId, targetId);
  if (!persisted) return null;
  const byTarget =
    moderationRestrictionsByWebinar.get(webinarId) ?? new Map<string, RestrictionState>();
  byTarget.set(targetId, persisted);
  moderationRestrictionsByWebinar.set(webinarId, byTarget);
  return persisted;
}

function isRestrictionActive(until: number | null | undefined, now = Date.now()): boolean {
  return until === null || (typeof until === "number" && until > now);
}

async function assertNotBanned(
  dependencies: ResolvedDependencies,
  webinarId: string,
  principal: RealtimePrincipal,
): Promise<void> {
  const restriction = await restrictionFor(dependencies, webinarId, principal.id);
  if (restriction && isRestrictionActive(restriction.bannedUntil)) {
    throw new RealtimeDomainError("FORBIDDEN", "You are banned from this webinar");
  }
}

async function assertNotMuted(
  dependencies: ResolvedDependencies,
  webinarId: string,
  principal: RealtimePrincipal,
): Promise<void> {
  const restriction = await restrictionFor(dependencies, webinarId, principal.id);
  if (restriction && isRestrictionActive(restriction.mutedUntil)) {
    throw new RealtimeDomainError("FORBIDDEN", "You are muted in this webinar");
  }
}

function toClientError(error: unknown): RealtimeErrorPayload {
  if (error instanceof RealtimeDomainError) {
    return error.toPayload();
  }
  if (error instanceof IdempotencyConflictError) {
    return {
      code: "CONFLICT",
      message: "Idempotency key conflicts with an earlier request",
    };
  }
  return { code: "INTERNAL_ERROR", message: "Realtime operation failed" };
}

function acknowledgeError<T>(
  socket: RealtimeSocket,
  acknowledge: RealtimeAcknowledge<T> | undefined,
  error: RealtimeErrorPayload,
): void {
  if (typeof acknowledge === "function") {
    acknowledge({ ok: false, error });
  } else {
    socket.emit("realtime:error", error);
  }
}

async function handleValidated<TPayload, TData>(
  socket: RealtimeSocket,
  dependencies: ResolvedDependencies,
  eventName: string,
  schema: ZodType<TPayload>,
  rawPayload: unknown,
  acknowledge: RealtimeAcknowledge<TData> | undefined,
  operation: (payload: TPayload) => Promise<OperationResponse<TData>>,
): Promise<void> {
  const result = schema.safeParse(rawPayload);
  if (!result.success) {
    acknowledgeError(socket, acknowledge, {
      code: "VALIDATION_ERROR",
      message: "Invalid realtime event payload",
      issues: result.error.issues.map((issue) => ({
        path: issue.path.map(String).join("."),
        message: issue.message,
      })),
    });
    return;
  }

  try {
    const response = await operation(result.data);
    const acknowledgement: RealtimeAck<TData> = {
      ok: true,
      data: response.data,
      replayed: response.replayed,
    };
    acknowledge?.(acknowledgement);
  } catch (error) {
    const clientError = toClientError(error);
    if (clientError.code === "INTERNAL_ERROR") {
      dependencies.logger.error("Realtime event failed", {
        eventName,
        socketId: socket.id,
        principalId: socket.data.principal?.id,
        errorName: error instanceof Error ? error.name : typeof error,
      });
    }
    acknowledgeError(socket, acknowledge, clientError);
  }
}

async function executeMutation<T>(
  socket: RealtimeSocket,
  dependencies: ResolvedDependencies,
  eventName: string,
  payload: MutationPayload,
  operation: () => Promise<T>,
): Promise<OperationResponse<T>> {
  const principal = requirePrincipal(socket);
  const result = await dependencies.idempotency.execute(
    {
      scope: `${principal.kind}:${principal.id}:${payload.webinarId}:${eventName}`,
      key: payload.idempotencyKey,
      fingerprint: createIdempotencyFingerprint({ eventName, payload }),
      ttlMs: dependencies.idempotencyTtlMs,
    },
    operation,
  );
  return { data: result.value, replayed: result.replayed };
}

async function moderateText(
  dependencies: ResolvedDependencies,
  input: {
    webinarId: string;
    actor: RealtimePrincipal;
    targetId: string;
    targetType: "chat_message" | "question";
    text: string;
    maximumLength: number;
  },
): Promise<{ text: string; pendingReview: boolean }> {
  const result: ModerationResult = await dependencies.moderation.evaluate({
    webinarId: input.webinarId,
    actor: input.actor,
    targetId: input.targetId,
    targetType: input.targetType,
    text: input.text,
  });
  const text = result.normalizedText ?? input.text;
  if (text.length === 0 || text.length > input.maximumLength) {
    throw new Error("Moderation service returned invalid normalized text");
  }

  if (result.decision === "allow") {
    return { text, pendingReview: false };
  }

  await dependencies.repositories.moderation.record({
    id: dependencies.idFactory("moderation"),
    webinarId: input.webinarId,
    actorId: input.actor.id,
    targetId: input.targetId,
    targetType: input.targetType,
    decision: result.decision,
    reasonCode: result.reasonCode ?? "unspecified",
    labels: [...(result.labels ?? [])],
    createdAt: dependencies.now().toISOString(),
  });

  if (result.decision === "block") {
    throw new RealtimeDomainError("CONTENT_BLOCKED", "Content was rejected by moderation");
  }
  return { text, pendingReview: true };
}

function registerJoinHandlers(socket: RealtimeSocket, dependencies: ResolvedDependencies): void {
  socket.on("webinar:join", (payload, acknowledge) => {
    void handleValidated<WebinarJoinPayload, WebinarJoined>(
      socket,
      dependencies,
      "webinar:join",
      webinarJoinSchema,
      payload,
      acknowledge,
      async ({ webinarId }) => {
        const access = await authorize(socket, dependencies, webinarId, "join", false);
        await assertNotBanned(dependencies, webinarId, requirePrincipal(socket));
        await socket.join(webinarRoom(webinarId));
        socket.data.joinedWebinarIds?.add(webinarId);
        socket.data.webinarRoles?.set(webinarId, access.role);
        const participant: WebinarJoined = {
          webinarId,
          participantId: access.participantId,
          role: access.role,
        };
        socket.to(webinarRoom(webinarId)).emit("webinar:participant_joined", participant);
        socket.emit("chat:state", {
          webinarId,
          enabled: viewerChatEnabledByWebinar.get(webinarId) ?? false,
        });
        return { data: participant, replayed: false };
      },
    );
  });

  socket.on("webinar:leave", (payload, acknowledge) => {
    void handleValidated<WebinarLeavePayload, WebinarLeft>(
      socket,
      dependencies,
      "webinar:leave",
      webinarLeaveSchema,
      payload,
      acknowledge,
      async ({ webinarId }) => {
        await socket.leave(webinarRoom(webinarId));
        socket.data.joinedWebinarIds?.delete(webinarId);
        socket.data.webinarRoles?.delete(webinarId);
        return { data: { webinarId }, replayed: false };
      },
    );
  });
}

function registerChatHandlers(socket: RealtimeSocket, dependencies: ResolvedDependencies): void {
  socket.on("chat:send", (payload, acknowledge) => {
    void handleValidated<ChatSendPayload, ChatMessage>(
      socket,
      dependencies,
      "chat:send",
      chatSendSchema,
      payload,
      acknowledge,
      async (validated) => {
        const access = await authorize(socket, dependencies, validated.webinarId, "join");
        const principal = requirePrincipal(socket);
        await assertNotMuted(dependencies, validated.webinarId, principal);
        if (
          isViewerRole(access.role) &&
          !(viewerChatEnabledByWebinar.get(validated.webinarId) ?? false)
        ) {
          throw new RealtimeDomainError("FORBIDDEN", "Viewer chat is closed");
        }
        return executeMutation(socket, dependencies, "chat:send", validated, async () => {
          const id = dependencies.idFactory("chat");
          const moderated = await moderateText(dependencies, {
            webinarId: validated.webinarId,
            actor: principal,
            targetId: id,
            targetType: "chat_message",
            text: validated.body,
            maximumLength: 2_000,
          });
          const message: ChatMessage = {
            id,
            webinarId: validated.webinarId,
            author: actorFrom(principal, access),
            body: moderated.text,
            status: moderated.pendingReview ? "pending_review" : "visible",
            createdAt: dependencies.now().toISOString(),
            ...(validated.replyToId ? { replyToId: validated.replyToId } : {}),
          };
          const created = await dependencies.repositories.chat.create(message);
          if (created.status === "visible") {
            socket.to(webinarRoom(validated.webinarId)).emit("chat:created", created);
            socket.emit("chat:created", created);
          }
          return created;
        });
      },
    );
  });

  socket.on("chat:set_state", (payload, acknowledge) => {
    void handleValidated<ChatStatePayload, ChatStateChanged>(
      socket,
      dependencies,
      "chat:set_state",
      chatStateSchema,
      payload,
      acknowledge,
      async (validated) => {
        await authorize(socket, dependencies, validated.webinarId, "chat.moderate");
        const state = { webinarId: validated.webinarId, enabled: validated.enabled };
        viewerChatEnabledByWebinar.set(validated.webinarId, validated.enabled);
        socket.to(webinarRoom(validated.webinarId)).emit("chat:state", state);
        socket.emit("chat:state", state);
        return { data: state, replayed: false };
      },
    );
  });

  socket.on("chat:delete", (payload, acknowledge) => {
    void handleValidated<ChatDeletePayload, ChatDeleted>(
      socket,
      dependencies,
      "chat:delete",
      chatDeleteSchema,
      payload,
      acknowledge,
      async (validated) => {
        await authorize(socket, dependencies, validated.webinarId, "chat.moderate");
        return executeMutation(socket, dependencies, "chat:delete", validated, async () => {
          const deletedAt = dependencies.now().toISOString();
          const deleted = await dependencies.repositories.chat.markDeleted({
            webinarId: validated.webinarId,
            messageId: validated.messageId,
            deletedAt,
            deletedById: requirePrincipal(socket).id,
            ...(validated.reason ? { reason: validated.reason } : {}),
          });
          if (!deleted) {
            throw new RealtimeDomainError("NOT_FOUND", "Chat message was not found");
          }
          const event: ChatDeleted = {
            webinarId: validated.webinarId,
            messageId: deleted.id,
            deletedAt: deleted.deletedAt ?? deletedAt,
          };
          socket.to(webinarRoom(validated.webinarId)).emit("chat:deleted", event);
          socket.emit("chat:deleted", event);
          return event;
        });
      },
    );
  });
}

function registerModerationHandlers(
  socket: RealtimeSocket,
  dependencies: ResolvedDependencies,
): void {
  socket.on("moderation:restrict", (payload, acknowledge) => {
    void handleValidated<ModerationRestrictPayload, ModerationRestrictionChanged>(
      socket,
      dependencies,
      "moderation:restrict",
      moderationRestrictSchema,
      payload,
      acknowledge,
      async (validated) => {
        await authorize(socket, dependencies, validated.webinarId, "chat.moderate");
        const roomSockets = await socket.nsp.in(webinarRoom(validated.webinarId)).fetchSockets();
        const targetSockets = roomSockets.filter(
          (candidate) => candidate.data.principal?.id === validated.targetId,
        );
        const targetRole = targetSockets
          .map((candidate) => candidate.data.webinarRoles?.get(validated.webinarId))
          .find((role) => role !== undefined);
        if (isProtectedModerationRole(targetRole)) {
          throw new RealtimeDomainError(
            "FORBIDDEN",
            "Privileged participants cannot be restricted",
          );
        }
        const stateByTarget =
          moderationRestrictionsByWebinar.get(validated.webinarId) ??
          new Map<string, RestrictionState>();
        moderationRestrictionsByWebinar.set(validated.webinarId, stateByTarget);
        const current = (await restrictionFor(
          dependencies,
          validated.webinarId,
          validated.targetId,
        )) ?? { targetName: validated.targetName };
        const until =
          validated.action === "mute" || validated.action === "ban"
            ? validated.durationMinutes
              ? Date.now() + validated.durationMinutes * 60_000
              : null
            : undefined;
        const next: RestrictionState = {
          ...current,
          targetName: validated.targetName,
          ...(validated.reason ? { reason: validated.reason } : {}),
        };
        if (validated.action === "mute") next.mutedUntil = until ?? null;
        if (validated.action === "ban") next.bannedUntil = until ?? null;
        if (validated.action === "unmute") delete next.mutedUntil;
        if (validated.action === "unban") delete next.bannedUntil;
        stateByTarget.set(validated.targetId, next);
        await dependencies.restrictions.save({
          webinarId: validated.webinarId,
          targetId: validated.targetId,
          state: next,
        });
        const event: ModerationRestrictionChanged = {
          webinarId: validated.webinarId,
          targetId: validated.targetId,
          targetName: validated.targetName,
          action: validated.action,
          active: validated.action === "mute" || validated.action === "ban",
          until:
            validated.action === "mute"
              ? typeof next.mutedUntil === "number"
                ? new Date(next.mutedUntil).toISOString()
                : next.mutedUntil === null
                  ? null
                  : null
              : validated.action === "ban"
                ? typeof next.bannedUntil === "number"
                  ? new Date(next.bannedUntil).toISOString()
                  : next.bannedUntil === null
                    ? null
                    : null
                : null,
          ...(validated.reason ? { reason: validated.reason } : {}),
        };
        socket.nsp.to(webinarRoom(validated.webinarId)).emit("moderation:restriction", event);
        if (validated.action === "ban") {
          try {
            await dependencies.removeBannedParticipant(validated.webinarId, validated.targetId);
          } catch (error) {
            dependencies.logger.error("Failed to remove banned LiveKit participant", {
              webinarId: validated.webinarId,
              targetId: validated.targetId,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
          for (const targetSocket of targetSockets) {
            targetSocket.emit("moderation:kicked", event);
            targetSocket.disconnect(true);
          }
        }
        return { data: event, replayed: false };
      },
    );
  });
}

function registerQuestionHandlers(
  socket: RealtimeSocket,
  dependencies: ResolvedDependencies,
): void {
  socket.on("question:ask", (payload, acknowledge) => {
    void handleValidated<QuestionAskPayload, Question>(
      socket,
      dependencies,
      "question:ask",
      questionAskSchema,
      payload,
      acknowledge,
      async (validated) => {
        const access = await authorize(socket, dependencies, validated.webinarId, "question.ask");
        const principal = requirePrincipal(socket);
        await assertNotMuted(dependencies, validated.webinarId, principal);
        return executeMutation(socket, dependencies, "question:ask", validated, async () => {
          const id = dependencies.idFactory("question");
          const moderated = await moderateText(dependencies, {
            webinarId: validated.webinarId,
            actor: principal,
            targetId: id,
            targetType: "question",
            text: validated.body,
            maximumLength: 2_000,
          });
          const now = dependencies.now().toISOString();
          const question: Question = {
            id,
            webinarId: validated.webinarId,
            author: actorFrom(principal, access),
            body: moderated.text,
            status: moderated.pendingReview ? "pending_review" : "open",
            upvoteCount: 0,
            createdAt: now,
            updatedAt: now,
          };
          const created = await dependencies.repositories.questions.create(question);
          if (created.status !== "pending_review") {
            socket.to(webinarRoom(validated.webinarId)).emit("question:created", created);
            socket.emit("question:created", created);
          }
          return created;
        });
      },
    );
  });

  socket.on("question:upvote", (payload, acknowledge) => {
    void handleValidated<QuestionUpvotePayload, Question>(
      socket,
      dependencies,
      "question:upvote",
      questionUpvoteSchema,
      payload,
      acknowledge,
      async (validated) => {
        const access = await authorize(
          socket,
          dependencies,
          validated.webinarId,
          "question.upvote",
        );
        return executeMutation(socket, dependencies, "question:upvote", validated, async () => {
          const question = await dependencies.repositories.questions.addUpvote({
            webinarId: validated.webinarId,
            questionId: validated.questionId,
            voterId: access.participantId,
            updatedAt: dependencies.now().toISOString(),
          });
          if (!question) {
            throw new RealtimeDomainError("NOT_FOUND", "Question was not found");
          }
          socket.to(webinarRoom(validated.webinarId)).emit("question:updated", question);
          socket.emit("question:updated", question);
          return question;
        });
      },
    );
  });

  socket.on("question:answer", (payload, acknowledge) => {
    void handleValidated<QuestionAnswerPayload, Question>(
      socket,
      dependencies,
      "question:answer",
      questionAnswerSchema,
      payload,
      acknowledge,
      async (validated) => {
        const access = await authorize(
          socket,
          dependencies,
          validated.webinarId,
          "question.manage",
        );
        return executeMutation(socket, dependencies, "question:answer", validated, async () => {
          const answeredAt = dependencies.now().toISOString();
          const question = await dependencies.repositories.questions.answer({
            webinarId: validated.webinarId,
            questionId: validated.questionId,
            answer: {
              body: validated.answer,
              author: actorFrom(requirePrincipal(socket), access),
              createdAt: answeredAt,
            },
            updatedAt: answeredAt,
          });
          if (!question) {
            throw new RealtimeDomainError("NOT_FOUND", "Question was not found");
          }
          socket.to(webinarRoom(validated.webinarId)).emit("question:updated", question);
          socket.emit("question:updated", question);
          return question;
        });
      },
    );
  });

  socket.on("question:moderate", (payload, acknowledge) => {
    void handleValidated<QuestionModeratePayload, Question>(
      socket,
      dependencies,
      "question:moderate",
      questionModerateSchema,
      payload,
      acknowledge,
      async (validated) => {
        await authorize(socket, dependencies, validated.webinarId, "question.manage");
        return executeMutation(socket, dependencies, "question:moderate", validated, async () => {
          const question = await dependencies.repositories.questions.setVisibility({
            webinarId: validated.webinarId,
            questionId: validated.questionId,
            hidden: validated.action === "hide",
            updatedAt: dependencies.now().toISOString(),
            ...(validated.reason ? { reason: validated.reason } : {}),
          });
          if (!question) {
            throw new RealtimeDomainError("NOT_FOUND", "Question was not found");
          }
          socket.to(webinarRoom(validated.webinarId)).emit("question:updated", question);
          socket.emit("question:updated", question);
          return question;
        });
      },
    );
  });
}

function registerPollHandlers(socket: RealtimeSocket, dependencies: ResolvedDependencies): void {
  socket.on("poll:create", (payload, acknowledge) => {
    void handleValidated<PollCreatePayload, Poll>(
      socket,
      dependencies,
      "poll:create",
      pollCreateSchema,
      payload,
      acknowledge,
      async (validated) => {
        const access = await authorize(socket, dependencies, validated.webinarId, "poll.manage");
        return executeMutation(socket, dependencies, "poll:create", validated, async () => {
          const now = dependencies.now().toISOString();
          const poll: Poll = {
            id: dependencies.idFactory("poll"),
            webinarId: validated.webinarId,
            question: validated.question,
            options: validated.options.map((label) => ({
              id: dependencies.idFactory("poll_option"),
              label,
              voteCount: 0,
            })),
            allowMultiple: validated.allowMultiple,
            status: "draft",
            createdBy: actorFrom(requirePrincipal(socket), access),
            createdAt: now,
            updatedAt: now,
          };
          const created = await dependencies.repositories.polls.create(poll);
          socket.to(webinarRoom(validated.webinarId)).emit("poll:created", created);
          socket.emit("poll:created", created);
          return created;
        });
      },
    );
  });

  const changePollState = (
    eventName: "poll:open" | "poll:close",
    status: "open" | "closed",
    payload: PollChangeStatePayload,
    acknowledge: RealtimeAcknowledge<Poll> | undefined,
  ): void => {
    void handleValidated<PollChangeStatePayload, Poll>(
      socket,
      dependencies,
      eventName,
      pollChangeStateSchema,
      payload,
      acknowledge,
      async (validated) => {
        await authorize(socket, dependencies, validated.webinarId, "poll.manage");
        return executeMutation(socket, dependencies, eventName, validated, async () => {
          const poll = await dependencies.repositories.polls.setStatus({
            webinarId: validated.webinarId,
            pollId: validated.pollId,
            status,
            updatedAt: dependencies.now().toISOString(),
          });
          if (!poll) {
            throw new RealtimeDomainError("NOT_FOUND", "Poll was not found");
          }
          socket.to(webinarRoom(validated.webinarId)).emit("poll:updated", poll);
          socket.emit("poll:updated", poll);
          return poll;
        });
      },
    );
  };

  socket.on("poll:open", (payload, acknowledge) => {
    changePollState("poll:open", "open", payload, acknowledge);
  });

  socket.on("poll:close", (payload, acknowledge) => {
    changePollState("poll:close", "closed", payload, acknowledge);
  });

  socket.on("poll:vote", (payload, acknowledge) => {
    void handleValidated<PollVotePayload, Poll>(
      socket,
      dependencies,
      "poll:vote",
      pollVoteSchema,
      payload,
      acknowledge,
      async (validated) => {
        const access = await authorize(socket, dependencies, validated.webinarId, "poll.vote");
        return executeMutation(socket, dependencies, "poll:vote", validated, async () => {
          const poll = await dependencies.repositories.polls.recordVote({
            webinarId: validated.webinarId,
            pollId: validated.pollId,
            voterId: access.participantId,
            optionIds: validated.optionIds,
            updatedAt: dependencies.now().toISOString(),
          });
          if (!poll) {
            throw new RealtimeDomainError("NOT_FOUND", "Poll was not found");
          }
          socket.to(webinarRoom(validated.webinarId)).emit("poll:updated", poll);
          socket.emit("poll:updated", poll);
          return poll;
        });
      },
    );
  });
}

export function registerRealtime(
  io: RealtimeServer,
  dependencyInput: RegisterRealtimeDependencies,
): void {
  const dependencies = resolveDependencies(dependencyInput);

  io.use((socket, next) => {
    void (async () => {
      try {
        const principal = await dependencies.auth.resolve(createAuthRequest(socket));
        if (!isValidPrincipal(principal)) {
          next(handshakeError("UNAUTHORIZED", "Authentication required"));
          return;
        }
        socket.data.principal = principal;
        socket.data.joinedWebinarIds = new Set<string>();
        socket.data.webinarRoles = new Map<string, RealtimeRole>();
        next();
      } catch (error) {
        dependencies.logger.error("Realtime authentication failed", {
          socketId: socket.id,
          errorName: error instanceof Error ? error.name : typeof error,
        });
        next(handshakeError("INTERNAL_ERROR", "Authentication unavailable"));
      }
    })();
  });

  io.on("connection", (socket) => {
    if (!socket.data.principal) {
      socket.disconnect(true);
      return;
    }
    socket.data.joinedWebinarIds ??= new Set<string>();
    socket.data.webinarRoles ??= new Map<string, RealtimeRole>();

    registerJoinHandlers(socket, dependencies);
    registerChatHandlers(socket, dependencies);
    registerModerationHandlers(socket, dependencies);
    registerQuestionHandlers(socket, dependencies);
    registerPollHandlers(socket, dependencies);
  });
}
