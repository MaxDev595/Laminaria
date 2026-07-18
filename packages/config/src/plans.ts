/**
 * Stable public plan identifiers. This tuple is deliberately the single source
 * of truth so a fourth plan cannot silently appear in another application.
 */
export const PLAN_IDS = ["free", "professional", "business"] as const;

export type PlanId = (typeof PLAN_IDS)[number];

export const LIMIT_KEYS = [
  "maxConcurrentAttendees",
  "concurrentWebinars",
  "recordingRetentionDays",
  "storageBytes",
  "aiQuota",
  "teamMembers",
] as const;

export type LimitKey = (typeof LIMIT_KEYS)[number];

export const FEATURE_KEYS = [
  "additionalRoomStyles",
  "interfaceElementCustomization",
  "customLogo",
  "removeLaminariaBranding",
  "advancedAnalytics",
  "dataExport",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export function isLimitKey(value: string): value is LimitKey {
  return (LIMIT_KEYS as readonly string[]).includes(value);
}

export function isFeatureKey(value: string): value is FeatureKey {
  return (FEATURE_KEYS as readonly string[]).includes(value);
}

export type BusinessDecision<T> =
  | Readonly<{
      status: "configured";
      value: T;
    }>
  | Readonly<{
      status: "pending_business_decision";
      value: null;
    }>;

export interface Money {
  readonly amountMinorUnits: number;
  readonly currency: string;
  readonly billingInterval: "month" | "year";
}

export interface LocalizedPlanName {
  readonly en: string;
  readonly ru: string;
}

export interface PlanDefinition {
  readonly id: PlanId;
  readonly name: LocalizedPlanName;
  readonly price: BusinessDecision<Money>;
  readonly limits: Readonly<Record<LimitKey, BusinessDecision<number>>>;
  readonly features: Readonly<Record<FeatureKey, BusinessDecision<boolean>>>;
}

export type PlanCatalog = Readonly<Record<PlanId, PlanDefinition>>;

const pendingDecision = <T>(): BusinessDecision<T> =>
  Object.freeze({
    status: "pending_business_decision",
    value: null,
  });

const pendingLimits = (): PlanDefinition["limits"] =>
  Object.freeze({
    maxConcurrentAttendees: pendingDecision<number>(),
    concurrentWebinars: pendingDecision<number>(),
    recordingRetentionDays: pendingDecision<number>(),
    storageBytes: pendingDecision<number>(),
    aiQuota: pendingDecision<number>(),
    teamMembers: pendingDecision<number>(),
  });

const pendingFeatures = (): PlanDefinition["features"] =>
  Object.freeze({
    additionalRoomStyles: pendingDecision<boolean>(),
    interfaceElementCustomization: pendingDecision<boolean>(),
    customLogo: pendingDecision<boolean>(),
    removeLaminariaBranding: pendingDecision<boolean>(),
    advancedAnalytics: pendingDecision<boolean>(),
    dataExport: pendingDecision<boolean>(),
  });

const createPendingPlan = (id: PlanId, name: LocalizedPlanName): PlanDefinition =>
  Object.freeze({
    id,
    name: Object.freeze(name),
    price: pendingDecision<Money>(),
    limits: pendingLimits(),
    features: pendingFeatures(),
  });

/**
 * Commercial values remain intentionally unresolved until the business owner
 * confirms them. Consumers must go through SubscriptionService, which treats
 * every pending decision as denied.
 *
 * Webinar duration is intentionally absent: plans must never limit it.
 */
export const PLAN_CATALOG: PlanCatalog = Object.freeze({
  free: createPendingPlan("free", { en: "Free", ru: "Бесплатный" }),
  professional: createPendingPlan("professional", {
    en: "Professional",
    ru: "Профессиональный",
  }),
  business: createPendingPlan("business", {
    en: "Business",
    ru: "Бизнес",
  }),
});

export function isPlanId(value: string): value is PlanId {
  return (PLAN_IDS as readonly string[]).includes(value);
}

export function getPlan(value: string): PlanDefinition | null {
  return isPlanId(value) ? PLAN_CATALOG[value] : null;
}
