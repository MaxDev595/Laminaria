import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { BillingAdapter } from "../adapters/billing.js";
import { requireUser, requireWorkspacePermission } from "../auth/plugin.js";
import type { AppConfig } from "../config.js";
import { AppError, ServiceNotConfiguredError } from "../errors.js";
import type {
  BillingPlanCode,
  BillingSubscriptionStatus,
  UnitOfWork,
} from "../repositories/contracts.js";

const checkoutSchema = z.object({
  plan: z.enum(["professional", "business"]),
  interval: z.enum(["month", "year"]),
  locale: z.enum(["en", "ru"]).default("en"),
});

const portalSchema = z.object({ locale: z.enum(["en", "ru"]).default("en") });

export async function registerBillingRoutes(
  app: FastifyInstance,
  repositories: UnitOfWork,
  billing: BillingAdapter,
  config: AppConfig,
): Promise<void> {
  app.post<{ Params: { workspaceId: string } }>(
    "/v1/workspaces/:workspaceId/billing/checkout",
    { schema: { tags: ["Billing"], summary: "Create a Paddle subscription checkout" } },
    async (request) => {
      const actor = requireUser(request);
      await requireWorkspacePermission(
        request,
        repositories,
        request.params.workspaceId,
        "billing:manage",
      );
      if (!billing.configured) throw new ServiceNotConfiguredError("Billing provider");
      const body = checkoutSchema.parse(request.body);
      if (body.plan === "business") {
        throw new AppError(409, "BILLING_ERROR", "Business plan is coming soon");
      }
      const returnBase = `${config.webAppUrl.replace(/\/$/, "")}/${body.locale}/dashboard/settings`;
      return billing.createCheckout({
        workspaceId: request.params.workspaceId,
        planKey: body.plan,
        interval: body.interval,
        customerEmail: actor.user.email,
        successUrl: `${returnBase}?tab=billing&checkout=success`,
      });
    },
  );

  app.post<{ Params: { workspaceId: string } }>(
    "/v1/workspaces/:workspaceId/billing/portal",
    { schema: { tags: ["Billing"], summary: "Open the Paddle customer portal" } },
    async (request) => {
      requireUser(request);
      await requireWorkspacePermission(
        request,
        repositories,
        request.params.workspaceId,
        "billing:manage",
      );
      if (!billing.configured) throw new ServiceNotConfiguredError("Billing provider");
      portalSchema.parse(request.body);
      const customerId = await repositories.billing.getCustomerId(request.params.workspaceId);
      if (!customerId) throw new AppError(404, "NOT_FOUND", "No paid subscription found");
      return billing.createCustomerPortal({ customerId });
    },
  );

  app.post<{ Params: { workspaceId: string } }>(
    "/v1/workspaces/:workspaceId/billing/cancel",
    {
      schema: {
        tags: ["Billing"],
        summary: "Cancel Paddle renewal at the end of the paid period",
      },
    },
    async (request) => {
      requireUser(request);
      await requireWorkspacePermission(
        request,
        repositories,
        request.params.workspaceId,
        "billing:manage",
      );
      if (!billing.configured) throw new ServiceNotConfiguredError("Billing provider");
      const subscription = await repositories.billing.getActivePaddleSubscription(
        request.params.workspaceId,
      );
      if (!subscription) throw new AppError(404, "NOT_FOUND", "No active paid subscription found");
      const result = await billing.cancelAtPeriodEnd({
        subscriptionId: subscription.providerSubscriptionId,
      });
      await repositories.billing.syncPaddleSubscription({
        workspaceId: request.params.workspaceId,
        planCode: subscription.planCode,
        status: subscription.status,
        providerCustomerId: subscription.providerCustomerId,
        providerSubscriptionId: subscription.providerSubscriptionId,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: true,
      });
      return {
        cancellationScheduled: true as const,
        effectiveAt: result.effectiveAt,
      };
    },
  );

  await app.register(async (webhookApp) => {
    webhookApp.removeContentTypeParser("application/json");
    webhookApp.addContentTypeParser(
      "application/json",
      { parseAs: "buffer" },
      (_request, body, done) => done(null, body),
    );
    webhookApp.get(
      "/v1/webhooks/paddle",
      { schema: { tags: ["Billing"], summary: "Check the Paddle webhook endpoint" } },
      async () => ({
        status: "ready" as const,
        provider: "paddle" as const,
        configured: billing.configured,
        method: "POST" as const,
      }),
    );
    webhookApp.post(
      "/v1/webhooks/paddle",
      { schema: { tags: ["Billing"], summary: "Receive signed Paddle events" } },
      async (request, reply) => {
        if (!billing.configured) throw new ServiceNotConfiguredError("Billing provider");
        const signature = request.headers["paddle-signature"];
        if (typeof signature !== "string" || !Buffer.isBuffer(request.body)) {
          throw new AppError(400, "BAD_REQUEST", "Invalid Paddle webhook");
        }
        let event: { id: string; type: string; data: unknown };
        try {
          event = await billing.verifyWebhook({ rawBody: request.body, signature });
        } catch {
          throw new AppError(400, "BAD_REQUEST", "Invalid Paddle webhook signature");
        }
        await applyPaddleEvent(repositories, event);
        return reply.status(200).send({ received: true });
      },
    );
  });
}

async function applyPaddleEvent(
  repositories: UnitOfWork,
  event: { id: string; type: string; data: unknown },
): Promise<void> {
  if (!event.type.startsWith("subscription.")) return;
  const subscription = event.data as PaddleSubscription;
  const workspaceId = customValue(subscription, "workspaceId");
  const planCode = parsePlan(customValue(subscription, "planCode"));
  if (!workspaceId || !planCode || !subscription.id) return;

  await repositories.billing.syncPaddleSubscription({
    workspaceId,
    planCode,
    status: paddleStatus(subscription.status),
    providerCustomerId: subscription.customer_id ?? null,
    providerSubscriptionId: subscription.id,
    currentPeriodStart: paddleDate(subscription.current_billing_period?.starts_at),
    currentPeriodEnd: paddleDate(subscription.current_billing_period?.ends_at),
    cancelAtPeriodEnd: subscription.scheduled_change?.action === "cancel",
  });
}

type PaddleSubscription = {
  id?: string;
  status?: string;
  customer_id?: string | null;
  custom_data?: Record<string, unknown> | null;
  current_billing_period?: { starts_at?: string; ends_at?: string } | null;
  scheduled_change?: { action?: string; effective_at?: string } | null;
};

function customValue(object: PaddleSubscription, key: string): string | null {
  const value = object.custom_data?.[key];
  return typeof value === "string" ? value : null;
}

function parsePlan(value: string | null): BillingPlanCode | null {
  return value === "professional" || value === "business" ? value : null;
}

function paddleStatus(value: string | undefined): BillingSubscriptionStatus {
  if (value === "trialing") return "TRIALING";
  if (value === "active") return "ACTIVE";
  if (value === "past_due") return "PAST_DUE";
  if (value === "paused") return "PAUSED";
  if (value === "canceled") return "CANCELLED";
  return "INCOMPLETE";
}

function paddleDate(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
