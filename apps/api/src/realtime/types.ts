import type { Server, Socket } from "socket.io";

import type {
  ChatDeletePayload,
  ChatSendPayload,
  ChatStatePayload,
  ModerationRestrictPayload,
  PollChangeStatePayload,
  PollCreatePayload,
  PollVotePayload,
  QuestionAnswerPayload,
  QuestionAskPayload,
  QuestionModeratePayload,
  QuestionUpvotePayload,
  StageLayoutPayload,
  WebinarJoinPayload,
  WebinarLeavePayload,
} from "./schemas.js";

export type RealtimeRole =
  "OWNER" | "HOST" | "COHOST" | "MODERATOR" | "SPEAKER" | "ATTENDEE" | "GUEST";

export interface RealtimePrincipal {
  id: string;
  kind: "user" | "guest";
  displayName: string;
  sessionId?: string;
}

export interface ActorSnapshot {
  id: string;
  displayName: string;
  role: RealtimeRole;
}

export type ChatMessageStatus = "visible" | "pending_review" | "deleted";

export interface ChatMessage {
  id: string;
  webinarId: string;
  author: ActorSnapshot;
  body: string;
  status: ChatMessageStatus;
  replyToId?: string;
  createdAt: string;
  deletedAt?: string;
  deletedById?: string;
  deletionReason?: string;
}

export type QuestionStatus = "open" | "answered" | "hidden" | "pending_review";

export interface QuestionAnswer {
  body: string;
  author: ActorSnapshot;
  createdAt: string;
}

export interface Question {
  id: string;
  webinarId: string;
  author: ActorSnapshot;
  body: string;
  status: QuestionStatus;
  upvoteCount: number;
  answer?: QuestionAnswer;
  createdAt: string;
  updatedAt: string;
  moderationReason?: string;
}

export type PollStatus = "draft" | "open" | "closed";

export interface PollOption {
  id: string;
  label: string;
  voteCount: number;
}

export interface Poll {
  id: string;
  webinarId: string;
  question: string;
  options: PollOption[];
  allowMultiple: boolean;
  status: PollStatus;
  createdBy: ActorSnapshot;
  createdAt: string;
  updatedAt: string;
}

export type ModerationTargetType = "chat_message" | "question";
export type ModerationDecision = "allow" | "flag" | "block";

export interface ModerationRecord {
  id: string;
  webinarId: string;
  actorId: string;
  targetId: string;
  targetType: ModerationTargetType;
  decision: Exclude<ModerationDecision, "allow">;
  reasonCode: string;
  labels: string[];
  createdAt: string;
}

export interface ChatRepository {
  create(message: ChatMessage): Promise<ChatMessage>;
  listByWebinar(webinarId: string): Promise<readonly ChatMessage[]>;
  markDeleted(input: {
    webinarId: string;
    messageId: string;
    deletedAt: string;
    deletedById: string;
    reason?: string;
  }): Promise<ChatMessage | null>;
}

export interface QuestionRepository {
  create(question: Question): Promise<Question>;
  addUpvote(input: {
    webinarId: string;
    questionId: string;
    voterId: string;
    updatedAt: string;
  }): Promise<Question | null>;
  answer(input: {
    webinarId: string;
    questionId: string;
    answer: QuestionAnswer;
    updatedAt: string;
  }): Promise<Question | null>;
  setVisibility(input: {
    webinarId: string;
    questionId: string;
    hidden: boolean;
    updatedAt: string;
    reason?: string;
  }): Promise<Question | null>;
}

export interface PollRepository {
  create(poll: Poll): Promise<Poll>;
  setStatus(input: {
    webinarId: string;
    pollId: string;
    status: Extract<PollStatus, "open" | "closed">;
    updatedAt: string;
  }): Promise<Poll | null>;
  recordVote(input: {
    webinarId: string;
    pollId: string;
    voterId: string;
    optionIds: string[];
    updatedAt: string;
  }): Promise<Poll | null>;
}

export interface ModerationRepository {
  record(event: ModerationRecord): Promise<void>;
}

export interface RealtimeRepositories {
  chat: ChatRepository;
  questions: QuestionRepository;
  polls: PollRepository;
  moderation: ModerationRepository;
}

export interface RealtimeAuthRequest {
  authorization?: string;
  cookie?: string;
  token?: string;
  sessionId?: string;
  auth: Readonly<Record<string, unknown>>;
  headers: Readonly<Record<string, string | string[] | undefined>>;
}

export interface RealtimeAuthResolver {
  resolve(request: RealtimeAuthRequest): Promise<RealtimePrincipal | null>;
}

export type WebinarAction =
  | "join"
  | "stage.manage"
  | "chat.send"
  | "chat.moderate"
  | "question.ask"
  | "question.upvote"
  | "question.manage"
  | "poll.manage"
  | "poll.vote";

export type WebinarAccessDecision =
  | {
      allowed: true;
      participantId: string;
      role: RealtimeRole;
    }
  | {
      allowed: false;
      reason?: "not_found" | "not_registered" | "waiting_room" | "forbidden";
    };

export interface WebinarAccessResolver {
  authorize(input: {
    principal: RealtimePrincipal;
    webinarId: string;
    action: WebinarAction;
  }): Promise<WebinarAccessDecision>;
}

export interface ModerationInput {
  webinarId: string;
  actor: RealtimePrincipal;
  targetId: string;
  targetType: ModerationTargetType;
  text: string;
}

export interface ModerationResult {
  decision: ModerationDecision;
  normalizedText?: string;
  reasonCode?: string;
  labels?: readonly string[];
}

export interface ModerationService {
  evaluate(input: ModerationInput): Promise<ModerationResult>;
}

export interface RealtimeLogger {
  debug?(message: string, context?: Readonly<Record<string, unknown>>): void;
  warn?(message: string, context?: Readonly<Record<string, unknown>>): void;
  error(message: string, context?: Readonly<Record<string, unknown>>): void;
}

export type RealtimeErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_JOINED"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "CONTENT_BLOCKED"
  | "INTERNAL_ERROR";

export interface RealtimeValidationIssue {
  path: string;
  message: string;
}

export interface RealtimeErrorPayload {
  code: RealtimeErrorCode;
  message: string;
  issues?: RealtimeValidationIssue[];
}

export type RealtimeAck<T> =
  { ok: true; data: T; replayed: boolean } | { ok: false; error: RealtimeErrorPayload };

export type RealtimeAcknowledge<T> = (result: RealtimeAck<T>) => void;

export interface WebinarJoined {
  webinarId: string;
  participantId: string;
  role: RealtimeRole;
}

export interface WebinarLeft {
  webinarId: string;
}

export interface WebinarEnded {
  webinarId: string;
  status: "ENDED" | "CANCELLED" | "ARCHIVED";
}

export interface ChatDeleted {
  webinarId: string;
  messageId: string;
  deletedAt: string;
}

export interface ChatStateChanged {
  webinarId: string;
  enabled: boolean;
}

export interface StageLayoutChanged {
  webinarId: string;
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  sizePercent: number;
  widthPercent: number;
  heightPercent: number;
}

export interface ModerationRestrictionChanged {
  webinarId: string;
  targetId: string;
  targetName: string;
  action: "mute" | "ban" | "unmute" | "unban";
  active: boolean;
  until: string | null;
  reason?: string;
}

export interface ClientToServerEvents {
  "webinar:join": (
    payload: WebinarJoinPayload,
    acknowledge?: RealtimeAcknowledge<WebinarJoined>,
  ) => void;
  "webinar:leave": (
    payload: WebinarLeavePayload,
    acknowledge?: RealtimeAcknowledge<WebinarLeft>,
  ) => void;
  "chat:send": (payload: ChatSendPayload, acknowledge?: RealtimeAcknowledge<ChatMessage>) => void;
  "chat:delete": (
    payload: ChatDeletePayload,
    acknowledge?: RealtimeAcknowledge<ChatDeleted>,
  ) => void;
  "chat:set_state": (
    payload: ChatStatePayload,
    acknowledge?: RealtimeAcknowledge<ChatStateChanged>,
  ) => void;
  "stage:set_layout": (
    payload: StageLayoutPayload,
    acknowledge?: RealtimeAcknowledge<StageLayoutChanged>,
  ) => void;
  "moderation:restrict": (
    payload: ModerationRestrictPayload,
    acknowledge?: RealtimeAcknowledge<ModerationRestrictionChanged>,
  ) => void;
  "question:ask": (
    payload: QuestionAskPayload,
    acknowledge?: RealtimeAcknowledge<Question>,
  ) => void;
  "question:upvote": (
    payload: QuestionUpvotePayload,
    acknowledge?: RealtimeAcknowledge<Question>,
  ) => void;
  "question:answer": (
    payload: QuestionAnswerPayload,
    acknowledge?: RealtimeAcknowledge<Question>,
  ) => void;
  "question:moderate": (
    payload: QuestionModeratePayload,
    acknowledge?: RealtimeAcknowledge<Question>,
  ) => void;
  "poll:create": (payload: PollCreatePayload, acknowledge?: RealtimeAcknowledge<Poll>) => void;
  "poll:open": (payload: PollChangeStatePayload, acknowledge?: RealtimeAcknowledge<Poll>) => void;
  "poll:close": (payload: PollChangeStatePayload, acknowledge?: RealtimeAcknowledge<Poll>) => void;
  "poll:vote": (payload: PollVotePayload, acknowledge?: RealtimeAcknowledge<Poll>) => void;
}

export interface ServerToClientEvents {
  "webinar:participant_joined": (participant: WebinarJoined) => void;
  "webinar:ended": (event: WebinarEnded) => void;
  "chat:created": (message: ChatMessage) => void;
  "chat:deleted": (message: ChatDeleted) => void;
  "chat:state": (state: ChatStateChanged) => void;
  "stage:layout": (state: StageLayoutChanged) => void;
  "moderation:restriction": (state: ModerationRestrictionChanged) => void;
  "moderation:kicked": (state: ModerationRestrictionChanged) => void;
  "question:created": (question: Question) => void;
  "question:updated": (question: Question) => void;
  "poll:created": (poll: Poll) => void;
  "poll:updated": (poll: Poll) => void;
  "realtime:error": (error: RealtimeErrorPayload) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface RealtimeSocketData {
  principal?: RealtimePrincipal;
  joinedWebinarIds?: Set<string>;
  webinarRoles?: Map<string, RealtimeRole>;
}

export type RealtimeServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  RealtimeSocketData
>;

export type RealtimeSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  RealtimeSocketData
>;
