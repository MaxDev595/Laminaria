import { setRequestLocale } from "next-intl/server";
import { PrejoinExperience } from "@/components/prejoin-experience";

export default async function PrejoinPage({ params }: { params: Promise<{ locale: string; slug: string }> }) { const { locale, slug } = await params; setRequestLocale(locale); return <PrejoinExperience slug={slug} />; }
