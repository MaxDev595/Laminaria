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
});
