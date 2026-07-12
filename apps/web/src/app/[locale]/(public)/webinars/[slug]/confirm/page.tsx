import { setRequestLocale } from "next-intl/server";
import { RegistrationConfirmation } from "@/components/registration-confirmation";

export default async function ConfirmRegistrationPage({ params, searchParams }: { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<{ token?: string }> }) { const { locale, slug } = await params; const { token } = await searchParams; setRequestLocale(locale); return <RegistrationConfirmation slug={slug} token={token} />; }
