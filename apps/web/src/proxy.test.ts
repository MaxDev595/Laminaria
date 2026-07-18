import { describe, expect, it } from "vitest";

import { config } from "./proxy";

describe("locale proxy matcher", () => {
  it("does not intercept backend proxy routes", () => {
    const matcher = new RegExp(`^${config.matcher}$`);

    expect(matcher.test("/v1/auth/me")).toBe(false);
    expect(matcher.test("/v1/auth/csrf")).toBe(false);
    expect(matcher.test("/ru/sign-in")).toBe(true);
  });
});
