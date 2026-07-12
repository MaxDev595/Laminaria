import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const isDevelopment = process.env.NODE_ENV !== "production";
const scriptPolicy = isDevelopment ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self' 'unsafe-inline'";
const localApiOrigin = new URL(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
).origin;
const connectPolicy = [
  "'self'",
  "https:",
  "wss:",
  "ws:",
  ...(isDevelopment ? [localApiOrigin] : []),
].join(" ");

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src ${scriptPolicy}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https:",
  "font-src 'self' data:",
  "media-src 'self' blob: https:",
  `connect-src ${connectPolicy}`,
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Type safety is enforced by the dedicated `pnpm typecheck` gate. Running the
  // same check inside `next build` requires a child process, which is blocked in
  // the managed Windows environment used for verification.
  typescript: { ignoreBuildErrors: true },
  transpilePackages: ["@laminaria/ui", "@laminaria/localization"],
  experimental: {
    cpus: 1,
    workerThreads: true,
    optimizePackageImports: ["lucide-react", "motion", "@livekit/components-react"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), display-capture=(self), geolocation=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default createNextIntlPlugin("./src/i18n/request.ts")(nextConfig);
