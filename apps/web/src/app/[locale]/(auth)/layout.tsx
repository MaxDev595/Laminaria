import { AuthShell } from "@/components/auth-shell";

export default async function AuthLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <AuthShell locale={locale}>{children}</AuthShell>;
}
