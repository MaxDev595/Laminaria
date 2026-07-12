import { en } from "./messages/en";
import { ru } from "./messages/ru";

export const locales = ["en", "ru"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
export const messages = { en, ru } as const;

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function resolveLocale(value?: string | null): Locale {
  if (!value) return defaultLocale;
  const language = value.toLowerCase().split(/[-_]/)[0];
  return language && isLocale(language) ? language : defaultLocale;
}

export function localeName(locale: Locale) {
  return locale === "en" ? "English" : "Русский";
}

export { en, ru };
