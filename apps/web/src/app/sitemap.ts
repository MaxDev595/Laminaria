import type { MetadataRoute } from "next";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = ["", "/privacy", "/terms", "/refund"] as const;

  return routes.flatMap((route) => {
    const enUrl = new URL(`/en${route}`, appUrl).toString();
    const ruUrl = new URL(`/ru${route}`, appUrl).toString();
    return [
      {
        url: enUrl,
        lastModified: now,
        changeFrequency: "monthly" as const,
        priority: route ? 0.5 : 1,
        alternates: { languages: { en: enUrl, ru: ruUrl } },
      },
      {
        url: ruUrl,
        lastModified: now,
        changeFrequency: "monthly" as const,
        priority: route ? 0.5 : 1,
        alternates: { languages: { en: enUrl, ru: ruUrl } },
      },
    ];
  });
}
