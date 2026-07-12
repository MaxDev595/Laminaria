import { setRequestLocale } from "next-intl/server";
import { DashboardOverview } from "@/components/dashboard-overview";

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) { const { locale } = await params; setRequestLocale(locale); return <DashboardOverview />; }
