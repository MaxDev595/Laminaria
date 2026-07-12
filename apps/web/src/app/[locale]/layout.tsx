import "@laminaria/ui/styles.css";
import "@livekit/components-styles";
import "../globals.css";

import { en, ru } from "@laminaria/localization";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";

import { Providers } from "@/components/providers";
import { routing } from "@/i18n/routing";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const messages = locale === "ru" ? ru : en;
  const title = messages.meta.title;
  const description = messages.meta.description;
  const url = new URL(`/${locale}`, appUrl);

  return {
    metadataBase: new URL(appUrl),
    title,
    description,
    applicationName: "Laminaria",
    keywords: ["webinars", "LiveKit", "online events", "video platform", "Laminaria", "вебинары", "онлайн-трансляции"],
    authors: [{ name: "Laminaria" }],
    creator: "Laminaria",
    publisher: "Laminaria",
    alternates: {
      canonical: url,
      languages: { en: "/en", ru: "/ru" },
    },
    openGraph: {
      type: "website",
      siteName: "Laminaria",
      locale: locale === "ru" ? "ru_RU" : "en_US",
      alternateLocale: locale === "ru" ? ["en_US"] : ["ru_RU"],
      url,
      title,
      description,
      images: [{ url: "/icon.svg", width: 512, height: 512, alt: "Laminaria" }],
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: ["/icon.svg"],
    },
    icons: {
      icon: "/icon.svg",
      shortcut: "/icon.svg",
      apple: "/icon.svg",
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#071b24",
  colorScheme: "dark light",
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} data-theme="dark" suppressHydrationWarning>
      <body>
        <NextIntlClientProvider messages={messages} locale={locale}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
