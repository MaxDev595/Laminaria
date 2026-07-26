import { describe, expect, it } from "vitest";

import { parseConfig } from "./config.js";

describe("production-safe configuration defaults", () => {
  it("fails closed to production when NODE_ENV is omitted", () => {
    const config = parseConfig({
      DATABASE_URL: "postgresql://localhost/laminaria",
      TOKEN_PEPPER: "a-production-pepper-that-is-long-enough",
    });

    expect(config.nodeEnv).toBe("production");
  });

  it("cannot run a hosted Render deployment in development mode", () => {
    const config = parseConfig({
      RENDER: "true",
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://localhost/laminaria",
      TOKEN_PEPPER: "a-production-pepper-that-is-long-enough",
    });

    expect(config.nodeEnv).toBe("production");
  });

  it("always allows the configured web application origin for realtime", () => {
    const config = parseConfig({
      DATABASE_URL: "postgresql://localhost/laminaria",
      TOKEN_PEPPER: "a-production-pepper-that-is-long-enough",
      WEB_APP_URL: "https://laminaria-api.vercel.app/",
      CORS_ORIGINS: "https://old-preview.vercel.app",
    });

    expect(config.corsOrigins).toEqual([
      "https://laminaria-api.vercel.app",
      "https://old-preview.vercel.app",
    ]);
  });

  it("builds a complete Paddle Billing configuration", () => {
    const config = parseConfig({
      DATABASE_URL: "postgresql://localhost/laminaria",
      TOKEN_PEPPER: "a-production-pepper-that-is-long-enough",
      BILLING_PROVIDER: "paddle",
      PADDLE_API_KEY: "pdl_test_api-key",
      PADDLE_CLIENT_TOKEN: "test_client-token",
      PADDLE_WEBHOOK_SECRET: "pdl_ntfset_test-secret",
      PADDLE_ENVIRONMENT: "sandbox",
      PADDLE_PRO_MONTHLY_PRICE_ID: "pri_month",
      PADDLE_PRO_YEARLY_PRICE_ID: "pri_year",
    });

    expect(config.billing).toEqual({
      provider: "paddle",
      apiKey: "pdl_test_api-key",
      clientToken: "test_client-token",
      webhookSecret: "pdl_ntfset_test-secret",
      environment: "sandbox",
      prices: {
        professional: {
          month: "pri_month",
          year: "pri_year",
        },
      },
    });
  });

  it("rejects unsupported billing providers", () => {
    expect(() =>
      parseConfig({
        DATABASE_URL: "postgresql://localhost/laminaria",
        TOKEN_PEPPER: "a-production-pepper-that-is-long-enough",
        BILLING_PROVIDER: "legacy-provider",
      }),
    ).toThrow("Only paddle is supported");
  });
});
