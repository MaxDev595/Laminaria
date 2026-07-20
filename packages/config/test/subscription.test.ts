import { describe, expect, it } from "vitest";

import {
  FEATURE_KEYS,
  LIMIT_KEYS,
  PLAN_CATALOG,
  PLAN_IDS,
  SubscriptionService,
  checkFeatureAccess,
} from "../src/index.js";

describe("plan catalog", () => {
  it("contains exactly the three approved plans", () => {
    expect(PLAN_IDS).toEqual(["free", "professional", "business"]);
    expect(Object.keys(PLAN_CATALOG)).toEqual(PLAN_IDS);
  });

  it("defines configured MVP prices and limits", () => {
    expect(PLAN_CATALOG.free.price).toEqual({
      status: "configured",
      value: { amountMinorUnits: 0, currency: "USD", billingInterval: "month" },
    });
    expect(PLAN_CATALOG.professional.price).toEqual({
      status: "configured",
      value: { amountMinorUnits: 1_200, currency: "USD", billingInterval: "month" },
    });
    expect(PLAN_CATALOG.business.price).toEqual({
      status: "configured",
      value: { amountMinorUnits: 2_900, currency: "USD", billingInterval: "month" },
    });

    for (const planId of PLAN_IDS) {
      for (const limit of LIMIT_KEYS) {
        expect(PLAN_CATALOG[planId].limits[limit].status).toBe("configured");
      }
      for (const feature of FEATURE_KEYS) {
        expect(PLAN_CATALOG[planId].features[feature].status).toBe("configured");
      }
    }
  });

  it("does not define a webinar duration limit", () => {
    expect(LIMIT_KEYS).not.toContain("webinarDuration");
    expect(LIMIT_KEYS).not.toContain("webinarDurationMinutes");
  });
});

describe("SubscriptionService", () => {
  const service = new SubscriptionService();

  it("gates recording and paid features by plan", () => {
    expect(service.checkFeatureAccess("free", "webinarRecording")).toEqual({
      allowed: false,
      reason: "not_included",
    });
    expect(service.checkFeatureAccess("professional", "webinarRecording")).toEqual({
      allowed: true,
      reason: "explicitly_included",
    });
    expect(service.checkFeatureAccess("business", "removeLaminariaBranding")).toEqual({
      allowed: true,
      reason: "explicitly_included",
    });
  });

  it("enforces configured limits", () => {
    expect(service.checkLimit("free", "maxConcurrentAttendees", 25)).toEqual({
      allowed: true,
      reason: "within_configured_limit",
    });
    expect(service.checkLimit("free", "maxConcurrentAttendees", 26)).toEqual({
      allowed: false,
      reason: "limit_exceeded",
    });
  });

  it("fails closed for unknown plans", () => {
    expect(service.checkFeatureAccess("unknown", "customLogo")).toEqual({
      allowed: false,
      reason: "unknown_plan",
    });
  });

  it("fails closed for unknown entitlement keys and invalid usage", () => {
    expect(service.checkFeatureAccess("free", "unlistedFeature")).toEqual({
      allowed: false,
      reason: "unknown_feature",
    });
    expect(service.checkLimit("free", "unlistedLimit", 0)).toEqual({
      allowed: false,
      reason: "unknown_limit",
    });
    expect(service.checkLimit("free", "teamMembers", -1)).toEqual({
      allowed: false,
      reason: "invalid_usage",
    });
  });

  it("exposes a shared feature access function", () => {
    expect(checkFeatureAccess("professional", "dataExport")).toEqual({
      allowed: true,
      reason: "explicitly_included",
    });
  });
});
