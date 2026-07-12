import type { MetadataRoute } from "next";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const enUrl = new URL("/en", appUrl).toString();
  const ruUrl = new URL("/ru", appUrl).toString();

  return [
    {
      url: enUrl,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
      alternates: { languages: { en: enUrl, ru: ruUrl } },
    },
    {
      url: ruUrl,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
      alternates: { languages: { en: enUrl, ru: ruUrl } },
    },
  ];
}
