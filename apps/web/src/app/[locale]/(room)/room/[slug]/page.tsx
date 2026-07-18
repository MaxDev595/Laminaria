import { setRequestLocale } from "next-intl/server";
import { RoomExperience } from "@/components/room-experience";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <RoomExperience slug={slug} />;
}
