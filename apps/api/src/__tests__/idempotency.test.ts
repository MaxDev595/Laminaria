import { describe, expect, it, vi } from "vitest";

import {
  createIdempotencyFingerprint,
  IdempotencyConflictError,
  InMemoryIdempotencyExecutor,
  type IdempotencyExecutionRequest,
} from "../realtime/idempotency.js";

function request(
  overrides: Partial<IdempotencyExecutionRequest> = {},
): IdempotencyExecutionRequest {
  return {
    scope: "user-1:webinar-1:chat:send",
    key: "request-123",
    fingerprint: createIdempotencyFingerprint({ body: "Hello" }),
    ttlMs: 60_000,
    ...overrides,
  };
}

describe("InMemoryIdempotencyExecutor", () => {
  it("replays a completed operation without executing it twice", async () => {
    const executor = new InMemoryIdempotencyExecutor();
    const operation = vi.fn(async () => ({ id: "message-1" }));

    const first = await executor.execute(request(), operation);
    const second = await executor.execute(request(), operation);

    expect(operation).toHaveBeenCalledTimes(1);
    expect(first).toEqual({ value: { id: "message-1" }, replayed: false });
    expect(second).toEqual({ value: { id: "message-1" }, replayed: true });
  });

  it("coalesces concurrent requests while the first operation is in flight", async () => {
    const executor = new InMemoryIdempotencyExecutor();
    let resolveOperation: ((value: string) => void) | undefined;
    const operation = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveOperation = resolve;
        }),
    );

    const firstPromise = executor.execute(request(), operation);
    await Promise.resolve();
    const secondPromise = executor.execute(request(), operation);
    resolveOperation?.("persisted-once");

    await expect(firstPromise).resolves.toEqual({
      value: "persisted-once",
      replayed: false,
    });
    await expect(secondPromise).resolves.toEqual({
      value: "persisted-once",
      replayed: true,
    });
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("rejects reuse of a key with a different request fingerprint", async () => {
    const executor = new InMemoryIdempotencyExecutor();
    await executor.execute(request(), async () => "first-result");

    const conflict = executor.execute(
      request({
        fingerprint: createIdempotencyFingerprint({ body: "Different" }),
      }),
      async () => "must-not-run",
    );

    await expect(conflict).rejects.toBeInstanceOf(IdempotencyConflictError);
  });

  it("allows a failed operation to be retried with the same key", async () => {
    const executor = new InMemoryIdempotencyExecutor();
    const failure = new Error("database unavailable");

    await expect(
      executor.execute(request(), async () => Promise.reject(failure)),
    ).rejects.toBe(failure);

    await expect(
      executor.execute(request(), async () => "saved-after-retry"),
    ).resolves.toEqual({ value: "saved-after-retry", replayed: false });
  });

  it("expires completed entries after their ttl", async () => {
    let now = 1_000;
    const executor = new InMemoryIdempotencyExecutor({ now: () => now });
    const operation = vi.fn(async () => "result");
    const expiringRequest = request({ ttlMs: 100 });

    await executor.execute(expiringRequest, operation);
    now = 1_101;
    const afterExpiry = await executor.execute(expiringRequest, operation);

    expect(afterExpiry.replayed).toBe(false);
    expect(operation).toHaveBeenCalledTimes(2);
  });
});

describe("createIdempotencyFingerprint", () => {
  it("is stable for objects with different key insertion order", () => {
    expect(createIdempotencyFingerprint({ a: 1, b: 2 })).toBe(
      createIdempotencyFingerprint({ b: 2, a: 1 }),
    );
  });
});

