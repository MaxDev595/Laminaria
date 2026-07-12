import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Laminaria",
    short_name: "Laminaria",
    description: "Calm, dependable webinars for global teams.",
    start_url: "/en",
    scope: "/",
    display: "standalone",
    background_color: "#071b24",
    theme_color: "#071b24",
    orientation: "any",
    categories: ["business", "productivity", "education"],
    lang: "en",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
