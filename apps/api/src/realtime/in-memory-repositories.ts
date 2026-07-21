import { RealtimeDomainError } from "./errors.js";
import type {
  ChatMessage,
  ChatRepository,
  ModerationRecord,
  ModerationRepository,
  Poll,
  PollRepository,
  Question,
  QuestionAnswer,
  QuestionRepository,
  RealtimeRepositories,
} from "./types.js";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class InMemoryChatRepository implements ChatRepository {
  readonly #messages = new Map<string, ChatMessage>();

  async create(message: ChatMessage): Promise<ChatMessage> {
    if (this.#messages.has(message.id)) {
      throw new RealtimeDomainError("CONFLICT", "Chat message already exists");
    }
    this.#messages.set(message.id, clone(message));
    return clone(message);
  }

  async listByWebinar(webinarId: string): Promise<readonly ChatMessage[]> {
    return this.all()
      .filter((message) => message.webinarId === webinarId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async markDeleted(input: {
    webinarId: string;
    messageId: string;
    deletedAt: string;
    deletedById: string;
    reason?: string;
  }): Promise<ChatMessage | null> {
    const message = this.#messages.get(input.messageId);
    if (!message || message.webinarId !== input.webinarId) {
      return null;
    }

    if (message.status === "deleted") {
      return clone(message);
    }

    const updated: ChatMessage = {
      ...message,
      status: "deleted",
      deletedAt: input.deletedAt,
      deletedById: input.deletedById,
      ...(input.reason ? { deletionReason: input.reason } : {}),
    };
    this.#messages.set(updated.id, updated);
    return clone(updated);
  }

  all(): ChatMessage[] {
    return [...this.#messages.values()].map(clone);
  }
}

export class InMemoryQuestionRepository implements QuestionRepository {
  readonly #questions = new Map<string, Question>();
  readonly #voters = new Map<string, Set<string>>();

  async create(question: Question): Promise<Question> {
    if (this.#questions.has(question.id)) {
      throw new RealtimeDomainError("CONFLICT", "Question already exists");
    }
    this.#questions.set(question.id, clone(question));
    return clone(question);
  }

  async addUpvote(input: {
    webinarId: string;
    questionId: string;
    voterId: string;
    updatedAt: string;
  }): Promise<Question | null> {
    const question = this.#questions.get(input.questionId);
    if (!question || question.webinarId !== input.webinarId) {
      return null;
    }
    if (question.status === "hidden" || question.status === "pending_review") {
      throw new RealtimeDomainError("CONFLICT", "Question cannot be upvoted");
    }

    const voters = this.#voters.get(question.id) ?? new Set<string>();
    if (voters.has(input.voterId)) {
      return clone(question);
    }

    voters.add(input.voterId);
    this.#voters.set(question.id, voters);
    const updated: Question = {
      ...question,
      upvoteCount: voters.size,
      updatedAt: input.updatedAt,
    };
    this.#questions.set(updated.id, updated);
    return clone(updated);
  }

  async answer(input: {
    webinarId: string;
    questionId: string;
    answer: QuestionAnswer;
    updatedAt: string;
  }): Promise<Question | null> {
    const question = this.#questions.get(input.questionId);
    if (!question || question.webinarId !== input.webinarId) {
      return null;
    }
    if (question.status === "hidden" || question.status === "pending_review") {
      throw new RealtimeDomainError("CONFLICT", "Question cannot be answered");
    }

    const updated: Question = {
      ...question,
      answer: clone(input.answer),
      status: "answered",
      updatedAt: input.updatedAt,
    };
    this.#questions.set(updated.id, updated);
    return clone(updated);
  }

  async setVisibility(input: {
    webinarId: string;
    questionId: string;
    hidden: boolean;
    updatedAt: string;
    reason?: string;
  }): Promise<Question | null> {
    const question = this.#questions.get(input.questionId);
    if (!question || question.webinarId !== input.webinarId) {
      return null;
    }

    const { moderationReason: _previousReason, ...withoutReason } = question;
    const updated: Question = input.hidden
      ? {
          ...withoutReason,
          status: "hidden",
          updatedAt: input.updatedAt,
          ...(input.reason ? { moderationReason: input.reason } : {}),
        }
      : {
          ...withoutReason,
          status: question.answer ? "answered" : "open",
          updatedAt: input.updatedAt,
        };
    this.#questions.set(updated.id, updated);
    return clone(updated);
  }

  all(): Question[] {
    return [...this.#questions.values()].map(clone);
  }
}

export class InMemoryPollRepository implements PollRepository {
  readonly #polls = new Map<string, Poll>();
  readonly #votes = new Map<string, Map<string, string[]>>();

  async create(poll: Poll): Promise<Poll> {
    if (this.#polls.has(poll.id)) {
      throw new RealtimeDomainError("CONFLICT", "Poll already exists");
    }
    this.#polls.set(poll.id, clone(poll));
    return clone(poll);
  }

  async listByWebinar(webinarId: string): Promise<readonly Poll[]> {
    return [...this.#polls.values()]
      .filter((poll) => poll.webinarId === webinarId)
      .map(clone);
  }

  async setStatus(input: {
    webinarId: string;
    pollId: string;
    status: "open" | "closed";
    updatedAt: string;
  }): Promise<Poll | null> {
    const poll = this.#polls.get(input.pollId);
    if (!poll || poll.webinarId !== input.webinarId) {
      return null;
    }
    if (poll.status === "closed" && input.status === "open") {
      throw new RealtimeDomainError("CONFLICT", "A closed poll cannot be reopened");
    }

    const updated: Poll = {
      ...poll,
      status: input.status,
      updatedAt: input.updatedAt,
    };
    this.#polls.set(updated.id, updated);
    return clone(updated);
  }

  async recordVote(input: {
    webinarId: string;
    pollId: string;
    voterId: string;
    optionIds: string[];
    updatedAt: string;
  }): Promise<Poll | null> {
    const poll = this.#polls.get(input.pollId);
    if (!poll || poll.webinarId !== input.webinarId) {
      return null;
    }
    if (poll.status !== "open") {
      throw new RealtimeDomainError("CONFLICT", "Poll is not open");
    }
    if (!poll.allowMultiple && input.optionIds.length !== 1) {
      throw new RealtimeDomainError("CONFLICT", "Poll accepts one option only");
    }

    const validOptionIds = new Set(poll.options.map(({ id }) => id));
    if (input.optionIds.some((id) => !validOptionIds.has(id))) {
      throw new RealtimeDomainError("NOT_FOUND", "Poll option was not found");
    }

    const votesByParticipant = this.#votes.get(poll.id) ?? new Map<string, string[]>();
    const previousVotes = votesByParticipant.get(input.voterId) ?? [];
    const nextVotes = new Set(input.optionIds);
    const previousVoteSet = new Set(previousVotes);

    const options = poll.options.map((option) => ({
      ...option,
      voteCount:
        option.voteCount -
        (previousVoteSet.has(option.id) ? 1 : 0) +
        (nextVotes.has(option.id) ? 1 : 0),
    }));

    votesByParticipant.set(input.voterId, [...input.optionIds]);
    this.#votes.set(poll.id, votesByParticipant);
    const updated: Poll = { ...poll, options, updatedAt: input.updatedAt };
    this.#polls.set(updated.id, updated);
    return clone(updated);
  }

  all(): Poll[] {
    return [...this.#polls.values()].map(clone);
  }
}

export class InMemoryModerationRepository implements ModerationRepository {
  readonly #events: ModerationRecord[] = [];

  async record(event: ModerationRecord): Promise<void> {
    this.#events.push(clone(event));
  }

  all(): ModerationRecord[] {
    return this.#events.map(clone);
  }
}

export class InMemoryRealtimeRepositories implements RealtimeRepositories {
  readonly chat = new InMemoryChatRepository();
  readonly questions = new InMemoryQuestionRepository();
  readonly polls = new InMemoryPollRepository();
  readonly moderation = new InMemoryModerationRepository();
}
