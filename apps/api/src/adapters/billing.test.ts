import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { PaddleBillingAdapter } from "./billing.js";

const config = {
  apiKey: "pdl_test_api-key",
  clientToken: "test_client-token",
  webhookSecret: "pdl_ntfset_test-secret",
  environment: "sandbox" as const,
  prices: {
    professional: {
      month: "pri_month",
      year: "pri_year",
    },
  },
};

describe("PaddleBillingAdapter webhook verification", () => {
  it("accepts a valid Paddle signature and normalizes the event", async () => {
    const adapter = new PaddleBillingAdapter(config);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const rawBody = JSON.stringify({
      event_id: "evt_test",
      event_type: "subscription.activated",
      data: { id: "sub_test" },
    });
    const signature = createHmac("sha256", config.webhookSecret)
      .update(`${timestamp}:${rawBody}`)
      .digest("hex");

    await expect(
      adapter.verifyWebhook({
        rawBody: Buffer.from(rawBody),
        signature: `ts=${timestamp};h1=${signature}`,
      }),
    ).resolves.toEqual({
      id: "evt_test",
      type: "subscription.activated",
      data: { id: "sub_test" },
    });
  });

  it("rejects a forged signature", async () => {
    const adapter = new PaddleBillingAdapter(config);
    const timestamp = Math.floor(Date.now() / 1000).toString();

    await expect(
      adapter.verifyWebhook({
        rawBody: Buffer.from('{"event_id":"evt_test"}'),
        signature: `ts=${timestamp};h1=${"0".repeat(64)}`,
      }),
    ).rejects.toThrow("Invalid Paddle webhook signature");
  });
});
