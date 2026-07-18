import { setRequestLocale } from "next-intl/server";
import { VerifyEmail } from "@/components/verify-email";

export default async function VerifyEmailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string; sent?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  return <VerifyEmail token={query.token} sent={query.sent === "1"} />;
}
