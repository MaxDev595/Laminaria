import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

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

afterEach(() => {
  vi.unstubAllGlobals();
});

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

describe("PaddleBillingAdapter subscription cancellation", () => {
  it("cancels at the next billing period without requesting a refund", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            scheduled_change: {
              action: "cancel",
              effective_at: "2027-07-26T00:00:00.000Z",
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new PaddleBillingAdapter(config);
    await expect(
      adapter.cancelAtPeriodEnd({ subscriptionId: "sub_test" }),
    ).resolves.toEqual({
      effectiveAt: "2027-07-26T00:00:00.000Z",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://sandbox-api.paddle.com/subscriptions/sub_test/cancel",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ effective_from: "next_billing_period" }),
      }),
    );
  });
});
