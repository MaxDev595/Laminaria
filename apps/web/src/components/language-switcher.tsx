"use client";

import { Languages } from "lucide-react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";

export function LanguageSwitcher() {
  const locale = useLocale() as "en" | "ru";
  const router = useRouter();
  const pathname = usePathname();
  const nextLocale = locale === "en" ? "ru" : "en";

  return (
    <button
      type="button"
      className="utility-button"
      onClick={() => router.replace(pathname, { locale: nextLocale, scroll: false })}
      aria-label={locale === "en" ? "Переключить на русский" : "Switch to English"}
    >
      <Languages size={17} aria-hidden="true" />
      <span>{nextLocale.toUpperCase()}</span>
    </button>
  );
}
