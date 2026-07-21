export const dashboardSections = [
  "upcoming",
  "past",
  "recordings",
  "analytics",
  "team",
  "settings",
] as const;

export type DashboardSectionName = (typeof dashboardSections)[number];
