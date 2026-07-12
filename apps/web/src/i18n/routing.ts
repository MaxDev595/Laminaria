import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "ru"],
  defaultLocale: "en",
  localePrefix: "always",
  localeCookie: {
    name: "LAMINARIA_LOCALE",
    sameSite: "lax",
  },
});
