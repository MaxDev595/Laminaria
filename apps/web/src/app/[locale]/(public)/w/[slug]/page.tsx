import { setRequestLocale } from "next-intl/server";
import { PublicWebinar } from "@/components/public-webinar";

export default async function PublicWebinarPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <PublicWebinar slug={slug} />;
}
