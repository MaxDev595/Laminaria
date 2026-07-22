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
  "webinarRecording",
  "polls",
  "advancedModeration",
  "additionalRoomStyles",
  "interfaceElementCustomization",
  "customLogo",
  "removeLaminariaBranding",
  "advancedAnalytics",
  "dataExport",
  "apiAccess",
  "workspaceTeam",
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

const configuredDecision = <T>(value: T): BusinessDecision<T> =>
  Object.freeze({
    status: "configured",
    value,
  });

const configuredLimits = (input: Record<LimitKey, number>): PlanDefinition["limits"] =>
  Object.freeze({
    maxConcurrentAttendees: configuredDecision(input.maxConcurrentAttendees),
    concurrentWebinars: configuredDecision(input.concurrentWebinars),
    recordingRetentionDays: configuredDecision(input.recordingRetentionDays),
    storageBytes: configuredDecision(input.storageBytes),
    aiQuota: configuredDecision(input.aiQuota),
    teamMembers: configuredDecision(input.teamMembers),
  });

const configuredFeatures = (input: Record<FeatureKey, boolean>): PlanDefinition["features"] =>
  Object.freeze({
    webinarRecording: configuredDecision(input.webinarRecording),
    polls: configuredDecision(input.polls),
    advancedModeration: configuredDecision(input.advancedModeration),
    additionalRoomStyles: configuredDecision(input.additionalRoomStyles),
    interfaceElementCustomization: configuredDecision(input.interfaceElementCustomization),
    customLogo: configuredDecision(input.customLogo),
    removeLaminariaBranding: configuredDecision(input.removeLaminariaBranding),
    advancedAnalytics: configuredDecision(input.advancedAnalytics),
    dataExport: configuredDecision(input.dataExport),
    apiAccess: configuredDecision(input.apiAccess),
    workspaceTeam: configuredDecision(input.workspaceTeam),
  });

const monthlyMoney = (amountMinorUnits: number): BusinessDecision<Money> =>
  configuredDecision({
    amountMinorUnits,
    currency: "USD",
    billingInterval: "month",
  });

const createPlan = (
  id: PlanId,
  name: LocalizedPlanName,
  price: BusinessDecision<Money>,
  limits: Record<LimitKey, number>,
  features: Record<FeatureKey, boolean>,
): PlanDefinition =>
  Object.freeze({
    id,
    name: Object.freeze(name),
    price,
    limits: configuredLimits(limits),
    features: configuredFeatures(features),
  });

/**
 * Commercial MVP plan policy. Consumers must go through SubscriptionService,
 * which still fails closed for unknown plans and unknown entitlement keys.
 *
 * Webinar duration is intentionally absent: plans must never limit it.
 */
export const PLAN_CATALOG: PlanCatalog = Object.freeze({
  free: createPlan(
    "free",
    { en: "Free", ru: "Бесплатный" },
    monthlyMoney(0),
    {
      maxConcurrentAttendees: 25,
      concurrentWebinars: 1,
      recordingRetentionDays: 0,
      storageBytes: 0,
      aiQuota: 0,
      teamMembers: 1,
    },
    {
      webinarRecording: false,
      polls: false,
      advancedModeration: false,
      additionalRoomStyles: false,
      interfaceElementCustomization: false,
      customLogo: false,
      removeLaminariaBranding: false,
      advancedAnalytics: false,
      dataExport: false,
      apiAccess: false,
      workspaceTeam: false,
    },
  ),
  professional: createPlan(
    "professional",
    { en: "Pro", ru: "Pro" },
    monthlyMoney(1_200),
    {
      maxConcurrentAttendees: 150,
      concurrentWebinars: 2,
      recordingRetentionDays: 30,
      storageBytes: 10 * 1024 * 1024 * 1024,
      aiQuota: 0,
      teamMembers: 1,
    },
    {
      webinarRecording: true,
      polls: true,
      advancedModeration: true,
      additionalRoomStyles: true,
      interfaceElementCustomization: true,
      customLogo: true,
      removeLaminariaBranding: false,
      advancedAnalytics: true,
      dataExport: true,
      apiAccess: false,
      workspaceTeam: false,
    },
  ),
  business: createPlan(
    "business",
    { en: "Business", ru: "Business" },
    monthlyMoney(2_900),
    {
      maxConcurrentAttendees: 1_000,
      concurrentWebinars: 10,
      recordingRetentionDays: 365,
      storageBytes: 100 * 1024 * 1024 * 1024,
      aiQuota: 0,
      teamMembers: 25,
    },
    {
      webinarRecording: true,
      polls: true,
      advancedModeration: true,
      additionalRoomStyles: true,
      interfaceElementCustomization: true,
      customLogo: true,
      removeLaminariaBranding: true,
      advancedAnalytics: true,
      dataExport: true,
      apiAccess: true,
      workspaceTeam: true,
    },
  ),
});

export function isPlanId(value: string): value is PlanId {
  return (PLAN_IDS as readonly string[]).includes(value);
}

export function getPlan(value: string): PlanDefinition | null {
  return isPlanId(value) ? PLAN_CATALOG[value] : null;
}
