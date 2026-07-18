import { createHash } from "node:crypto";

export interface IdempotencyExecutionRequest {
  scope: string;
  key: string;
  fingerprint: string;
  ttlMs: number;
}

export interface IdempotencyExecutionResult<T> {
  value: T;
  replayed: boolean;
}

/**
 * Infrastructure adapters (for example Redis or PostgreSQL) implement this
 * contract. Implementations must atomically coalesce an in-flight duplicate.
 */
export interface IdempotencyExecutor {
  execute<T>(
    request: IdempotencyExecutionRequest,
    operation: () => Promise<T>,
  ): Promise<IdempotencyExecutionResult<T>>;
}

export class IdempotencyConflictError extends Error {
  constructor() {
    super("The idempotency key was already used for a different request");
    this.name = "IdempotencyConflictError";
  }
}

function normalizeForFingerprint(value: unknown, ancestors: WeakSet<object>): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Idempotency fingerprints require finite numbers");
    }
    return value;
  }

  if (typeof value === "bigint") {
    return { $bigint: value.toString() };
  }

  if (typeof value === "undefined") {
    return { $undefined: true };
  }

  if (typeof value !== "object") {
    throw new TypeError("Unsupported value in idempotency fingerprint");
  }

  if (ancestors.has(value)) {
    throw new TypeError("Circular value in idempotency fingerprint");
  }

  ancestors.add(value);
  try {
    if (value instanceof Date) {
      return { $date: value.toISOString() };
    }

    if (Array.isArray(value)) {
      return value.map((item) => normalizeForFingerprint(item, ancestors));
    }

    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      normalized[key] = normalizeForFingerprint((value as Record<string, unknown>)[key], ancestors);
    }
    return normalized;
  } finally {
    ancestors.delete(value);
  }
}

export function createIdempotencyFingerprint(value: unknown): string {
  const canonical = JSON.stringify(normalizeForFingerprint(value, new WeakSet()));
  return createHash("sha256").update(canonical).digest("hex");
}

interface InMemoryEntry {
  fingerprint: string;
  promise: Promise<unknown>;
  completed: boolean;
  expiresAt: number;
}

export interface InMemoryIdempotencyOptions {
  now?: () => number;
}

/**
 * Process-local adapter intended for tests and single-process development.
 * Production deployments with more than one API instance should inject a
 * distributed implementation of IdempotencyExecutor.
 */
export class InMemoryIdempotencyExecutor implements IdempotencyExecutor {
  readonly #entries = new Map<string, InMemoryEntry>();
  readonly #now: () => number;

  constructor(options: InMemoryIdempotencyOptions = {}) {
    this.#now = options.now ?? Date.now;
  }

  async execute<T>(
    request: IdempotencyExecutionRequest,
    operation: () => Promise<T>,
  ): Promise<IdempotencyExecutionResult<T>> {
    if (!Number.isFinite(request.ttlMs) || request.ttlMs <= 0) {
      throw new TypeError("Idempotency ttlMs must be a positive number");
    }

    const storageKey = JSON.stringify([request.scope, request.key]);
    const found = this.#entries.get(storageKey);

    if (found && (!found.completed || found.expiresAt > this.#now())) {
      if (found.fingerprint !== request.fingerprint) {
        throw new IdempotencyConflictError();
      }

      const value = (await found.promise) as T;
      return { value, replayed: true };
    }

    if (found) {
      this.#entries.delete(storageKey);
    }

    const entry: InMemoryEntry = {
      fingerprint: request.fingerprint,
      promise: Promise.resolve().then(operation),
      completed: false,
      expiresAt: Number.POSITIVE_INFINITY,
    };
    this.#entries.set(storageKey, entry);

    try {
      const value = (await entry.promise) as T;
      entry.completed = true;
      entry.expiresAt = this.#now() + request.ttlMs;
      return { value, replayed: false };
    } catch (error) {
      if (this.#entries.get(storageKey) === entry) {
        this.#entries.delete(storageKey);
      }
      throw error;
    }
  }

  clear(): void {
    this.#entries.clear();
  }

  get size(): number {
    return this.#entries.size;
  }
}
