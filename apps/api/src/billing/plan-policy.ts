export const PLAN_IDS = ["free", "professional", "business"] as const;

export type PlanId = (typeof PLAN_IDS)[number];

export interface PlanPolicy {
  readonly maxConcurrentAttendees: number;
  readonly webinarRecording: boolean;
  readonly polls: boolean;
  readonly advancedModeration: boolean;
  readonly advancedAnalytics: boolean;
  readonly customLogo: boolean;
  readonly removeLaminariaBranding: boolean;
  readonly dataExport: boolean;
}

export const PLAN_POLICY: Readonly<Record<PlanId, PlanPolicy>> = Object.freeze({
  free: Object.freeze({
    maxConcurrentAttendees: 25,
    webinarRecording: false,
    polls: false,
    advancedModeration: false,
    advancedAnalytics: false,
    customLogo: false,
    removeLaminariaBranding: false,
    dataExport: false,
  }),
  professional: Object.freeze({
    maxConcurrentAttendees: 150,
    webinarRecording: true,
    polls: true,
    advancedModeration: true,
    advancedAnalytics: true,
    customLogo: true,
    removeLaminariaBranding: false,
    dataExport: true,
  }),
  business: Object.freeze({
    maxConcurrentAttendees: 1_000,
    webinarRecording: true,
    polls: true,
    advancedModeration: true,
    advancedAnalytics: true,
    customLogo: true,
    removeLaminariaBranding: true,
    dataExport: true,
  }),
});

export function normalizePlanId(value: string | null | undefined): PlanId {
  return value === "professional" || value === "business" ? value : "free";
}

export function planAllows(planId: PlanId, feature: keyof Omit<PlanPolicy, "maxConcurrentAttendees">): boolean {
  return PLAN_POLICY[planId][feature];
}
