export const dashboardSections = [
  "upcoming",
  "past",
  "drafts",
  "recordings",
  "analytics",
  "team",
  "settings",
] as const;

export type DashboardSectionName = (typeof dashboardSections)[number];
