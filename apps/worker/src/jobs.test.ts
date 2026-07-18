import { describe, expect, it } from "vitest";
import { stableJobId } from "./jobs.js";
import { createAiProvider } from "./providers/ai.js";
import { readWorkerConfig } from "./config.js";
import { ServiceNotConfiguredError } from "./errors.js";

describe("worker boundaries", () => {
  it("uses stable, scoped job ids for idempotency", () => {
    const input = {
      workspaceId: "08e54170-f91d-4f40-a46f-c70a20f5a0b9",
      idempotencyKey: "request-00000001",
    };
    expect(stableJobId("ai", input)).toBe(stableJobId("ai", input));
    expect(stableJobId("email", input)).not.toBe(stableJobId("ai", input));
  });

  it("fails explicitly when AI has not been configured", async () => {
    const provider = createAiProvider(
      readWorkerConfig({ NODE_ENV: "test", AI_PROVIDER: "disabled" }),
    );
    await expect(
      provider.complete({ system: "test", prompt: "test", maxOutputTokens: 10 }),
    ).rejects.toBeInstanceOf(ServiceNotConfiguredError);
  });
});
