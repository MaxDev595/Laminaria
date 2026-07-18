import { setRequestLocale } from "next-intl/server";
import { CreateWebinarForm } from "@/components/create-webinar-form";

export default async function NewWebinarPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CreateWebinarForm />;
}
