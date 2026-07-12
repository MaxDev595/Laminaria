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

  it("leaves every unconfirmed commercial value explicitly pending", () => {
    for (const planId of PLAN_IDS) {
      const plan = PLAN_CATALOG[planId];

      expect(plan.price).toEqual({
        status: "pending_business_decision",
        value: null,
      });

      for (const limit of LIMIT_KEYS) {
        expect(plan.limits[limit]).toEqual({
          status: "pending_business_decision",
          value: null,
        });
      }

      for (const feature of FEATURE_KEYS) {
        expect(plan.features[feature]).toEqual({
          status: "pending_business_decision",
          value: null,
        });
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

  it("fails closed for every pending feature decision", () => {
    for (const planId of PLAN_IDS) {
      for (const feature of FEATURE_KEYS) {
        expect(service.checkFeatureAccess(planId, feature)).toEqual({
          allowed: false,
          reason: "pending_business_decision",
        });
      }
    }
  });

  it("fails closed for unknown plans", () => {
    expect(service.checkFeatureAccess("unknown", "customLogo")).toEqual({
      allowed: false,
      reason: "unknown_plan",
    });
  });

  it("fails closed for unknown entitlement keys", () => {
    expect(service.checkFeatureAccess("free", "unlistedFeature")).toEqual({
      allowed: false,
      reason: "unknown_feature",
    });
    expect(service.checkLimit("free", "unlistedLimit", 0)).toEqual({
      allowed: false,
      reason: "unknown_limit",
    });
  });

  it("fails closed for pending limits and rejects invalid usage", () => {
    expect(service.checkLimit("free", "teamMembers", 0)).toEqual({
      allowed: false,
      reason: "pending_business_decision",
    });
    expect(service.checkLimit("free", "teamMembers", -1)).toEqual({
      allowed: false,
      reason: "invalid_usage",
    });
  });

  it("exposes a fail-closed shared feature access function", () => {
    expect(checkFeatureAccess("business", "dataExport")).toEqual({
      allowed: false,
      reason: "pending_business_decision",
    });
  });
});
