import { PLAN_CATALOG, isFeatureKey, isLimitKey, isPlanId, type PlanCatalog } from "./plans.js";

export type AccessDenialReason =
  | "unknown_plan"
  | "unknown_feature"
  | "unknown_limit"
  | "pending_business_decision"
  | "not_included"
  | "limit_exceeded"
  | "invalid_usage";

export type AccessDecision =
  | Readonly<{
      allowed: true;
      reason: "explicitly_included" | "within_configured_limit";
    }>
  | Readonly<{ allowed: false; reason: AccessDenialReason }>;

const allow = (reason: "explicitly_included" | "within_configured_limit"): AccessDecision => ({
  allowed: true,
  reason,
});

const deny = (reason: AccessDenialReason): AccessDecision => ({
  allowed: false,
  reason,
});

/**
 * The only plan-policy boundary used by applications.
 *
 * It is intentionally fail-closed: an unknown plan, a missing commercial
 * decision, or anything other than an explicit `true` is denied.
 */
export class SubscriptionService {
  readonly #catalog: PlanCatalog;

  public constructor(catalog: PlanCatalog = PLAN_CATALOG) {
    this.#catalog = catalog;
  }

  public checkFeatureAccess(planId: string, feature: string): AccessDecision {
    if (!isPlanId(planId)) {
      return deny("unknown_plan");
    }

    if (!isFeatureKey(feature)) {
      return deny("unknown_feature");
    }

    const decision = this.#catalog[planId].features[feature];

    if (decision.status === "pending_business_decision") {
      return deny("pending_business_decision");
    }

    return decision.value === true ? allow("explicitly_included") : deny("not_included");
  }

  public hasFeatureAccess(planId: string, feature: string): boolean {
    return this.checkFeatureAccess(planId, feature).allowed;
  }

  public checkLimit(planId: string, limit: string, requestedUsage: number): AccessDecision {
    if (!Number.isFinite(requestedUsage) || requestedUsage < 0) {
      return deny("invalid_usage");
    }

    if (!isPlanId(planId)) {
      return deny("unknown_plan");
    }

    if (!isLimitKey(limit)) {
      return deny("unknown_limit");
    }

    const decision = this.#catalog[planId].limits[limit];

    if (decision.status === "pending_business_decision") {
      return deny("pending_business_decision");
    }

    return requestedUsage <= decision.value
      ? allow("within_configured_limit")
      : deny("limit_exceeded");
  }
}

export const subscriptionService = new SubscriptionService();

export function checkFeatureAccess(planId: string, feature: string): AccessDecision {
  return subscriptionService.checkFeatureAccess(planId, feature);
}
