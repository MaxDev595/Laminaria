import type { FastifyInstance } from "fastify";

import { requireUser } from "../auth/plugin.js";
import type { AppConfig } from "../config.js";

export async function registerSystemRoutes(app: FastifyInstance, config: AppConfig): Promise<void> {
  app.get(
    "/v1/system/services",
    {
      schema: { tags: ["Health"], summary: "List configured optional services" },
    },
    async (request) => {
      requireUser(request);
      return {
        services: [
          {
            key: "livekit",
            label: "LiveKit",
            configured: Boolean(config.livekit),
            requiredEnv: ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"],
          },
          {
            key: "mail",
            label: "Email delivery",
            configured: Boolean(config.mail),
            requiredEnv: ["SMTP_HOST", "EMAIL_FROM"],
          },
          {
            key: "google",
            label: "Google OAuth",
            configured: Boolean(config.google),
            requiredEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
          },
          {
            key: "ai",
            label: "AI provider",
            configured: Boolean(config.ai),
            requiredEnv: ["AI_PROVIDER", "AI_API_KEY", "AI_MODEL"],
          },
          {
            key: "billing",
            label: "Billing",
            configured: Boolean(config.billing),
            requiredEnv: ["BILLING_PROVIDER", "BILLING_API_KEY", "BILLING_WEBHOOK_SECRET"],
          },
          {
            key: "storage",
            label: "S3 storage",
            configured: Boolean(config.storage),
            requiredEnv: [
              "STORAGE_ENDPOINT",
              "STORAGE_REGION",
              "STORAGE_BUCKET",
              "STORAGE_ACCESS_KEY_ID",
              "STORAGE_SECRET_ACCESS_KEY",
            ],
          },
        ],
      };
    },
  );
}
