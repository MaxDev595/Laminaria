export const dashboardSections = [
  "upcoming",
  "past",
  "drafts",
  "recordings",
  "analytics",
  "team",
  "billing",
  "settings",
] as const;

export type DashboardSectionName = (typeof dashboardSections)[number];
