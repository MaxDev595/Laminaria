export const dashboardSections = [
  "upcoming",
  "past",
  "drafts",
  "analytics",
  "team",
  "settings",
] as const;

export type DashboardSectionName = (typeof dashboardSections)[number];
