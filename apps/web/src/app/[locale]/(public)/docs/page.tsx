import { setRequestLocale } from "next-intl/server";
import { DocumentationPage } from "@/components/documentation-page";

export default async function DocsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <DocumentationPage />;
}
