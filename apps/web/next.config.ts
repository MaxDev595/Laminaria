import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const isDevelopment = process.env.NODE_ENV !== "production";
const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const apiProxyTarget = (
  process.env.API_PROXY_TARGET ??
  process.env.NEXT_PUBLIC_API_URL ??
  (isDevelopment ? "http://localhost:4000" : "https://laminaria.onrender.com")
)
  .replace(/\/+$/, "")
  // Both environment variables are commonly entered with `/v1`. Rewrites
  // append that prefix themselves, so normalize it here to avoid `/v1/v1/*`.
  .replace(/\/v1$/, "");
const scriptPolicy = isDevelopment
  ? "'self' 'unsafe-inline' 'unsafe-eval'"
  : "'self' 'unsafe-inline'";
const localApiOrigin = new URL(configuredApiUrl).origin;
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
  "manifest-src 'self' https://vercel.com",
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
  async rewrites() {
    return [
      {
        source: "/api/stripe/webhook",
        destination: `${apiProxyTarget}/v1/webhooks/stripe`,
      },
      {
        source: "/v1/:path*",
        destination: `${apiProxyTarget}/v1/:path*`,
      },
    ];
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
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), display-capture=(self), geolocation=()",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default createNextIntlPlugin("./src/i18n/request.ts")(nextConfig);
