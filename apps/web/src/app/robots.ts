import type { MetadataRoute } from "next";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/en", "/ru", "/en/w/", "/ru/w/"],
      disallow: ["/en/dashboard", "/ru/dashboard", "/en/room", "/ru/room", "/api"],
    },
    sitemap: new URL("/sitemap.xml", appUrl).toString(),
  };
}
