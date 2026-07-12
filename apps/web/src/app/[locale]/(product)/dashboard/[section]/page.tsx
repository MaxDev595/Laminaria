import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { DashboardSection } from "@/components/dashboard-section";
import { dashboardSections, type DashboardSectionName } from "@/lib/dashboard-sections";

export function generateStaticParams() { return dashboardSections.map((section) => ({ section })); }

export default async function DashboardSectionPage({ params }: { params: Promise<{ locale: string; section: string }> }) {
  const { locale, section } = await params; setRequestLocale(locale);
  if (!dashboardSections.includes(section as DashboardSectionName)) notFound();
  return <DashboardSection section={section as DashboardSectionName} />;
}
