import { setRequestLocale } from "next-intl/server";
import Script from "next/script";

import { LandingExperience } from "@/components/landing-experience";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <LandingExperience />
      <Script
        id="lemiri-widget"
        src="https://lemeriai.com/api/widget/b16668f4-0aac-491d-96e8-ed1e0a73d4bf/embed.js"
        strategy="afterInteractive"
      />
    </>
  );
}
