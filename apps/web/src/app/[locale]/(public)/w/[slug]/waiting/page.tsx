import { WebinarWaitingRoom } from "@/components/webinar-waiting-room";
import { setRequestLocale } from "next-intl/server";

export default async function WebinarWaitingPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <WebinarWaitingRoom slug={slug} />;
}
