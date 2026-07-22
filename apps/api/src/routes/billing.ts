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
    { schema: { tags: ["Billing"], summary: "Create a hosted subscription checkout" } },
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
      const returnBase = `${config.webAppUrl.replace(/\/$/, "")}/${body.locale}/dashboard/settings`;
      return billing.createCheckout({
        workspaceId: request.params.workspaceId,
        planKey: body.plan,
        interval: body.interval,
        customerEmail: actor.user.email,
        successUrl: `${returnBase}?tab=billing&checkout=success`,
        cancelUrl: `${returnBase}?tab=billing&checkout=cancelled`,
      });
    },
  );

  app.post<{ Params: { workspaceId: string } }>(
    "/v1/workspaces/:workspaceId/billing/portal",
    { schema: { tags: ["Billing"], summary: "Open the hosted billing portal" } },
    async (request) => {
      requireUser(request);
      await requireWorkspacePermission(
        request,
        repositories,
        request.params.workspaceId,
        "billing:manage",
      );
      if (!billing.configured) throw new ServiceNotConfiguredError("Billing provider");
      const body = portalSchema.parse(request.body);
      const customerId = await repositories.billing.getCustomerId(request.params.workspaceId);
      if (!customerId) throw new AppError(404, "NOT_FOUND", "No paid subscription found");
      return billing.createCustomerPortal({
        customerId,
        returnUrl: `${config.webAppUrl.replace(/\/$/, "")}/${body.locale}/dashboard/settings?tab=billing`,
      });
    },
  );

  app.post<{ Params: { workspaceId: string } }>(
    "/v1/workspaces/:workspaceId/billing/cancel-and-refund",
    { schema: { tags: ["Billing"], summary: "Cancel immediately and refund the latest payment" } },
    async (request) => {
      requireUser(request);
      await requireWorkspacePermission(
        request,
        repositories,
        request.params.workspaceId,
        "billing:manage",
      );
      if (!billing.configured) throw new ServiceNotConfiguredError("Billing provider");
      const subscription = await repositories.billing.getActiveStripeSubscription(
        request.params.workspaceId,
      );
      if (!subscription) throw new AppError(404, "NOT_FOUND", "No active paid subscription found");
      const result = await billing.cancelAndRefund({
        subscriptionId: subscription.providerSubscriptionId,
      });
      await repositories.billing.syncStripeSubscription({
        workspaceId: request.params.workspaceId,
        planCode: subscription.planCode,
        status: "CANCELLED",
        providerCustomerId: subscription.providerCustomerId,
        providerSubscriptionId: subscription.providerSubscriptionId,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      });
      return { cancelled: true as const, refunded: true as const, refundId: result.refundId };
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
      "/v1/webhooks/stripe",
      { schema: { tags: ["Billing"], summary: "Check the Stripe webhook endpoint" } },
      async () => ({
        status: "ready" as const,
        provider: "stripe" as const,
        configured: billing.configured,
        method: "POST" as const,
      }),
    );
    webhookApp.post(
      "/v1/webhooks/stripe",
      { schema: { tags: ["Billing"], summary: "Receive signed Stripe events" } },
      async (request, reply) => {
        if (!billing.configured) throw new ServiceNotConfiguredError("Billing provider");
        const signature = request.headers["stripe-signature"];
        if (typeof signature !== "string" || !Buffer.isBuffer(request.body)) {
          throw new AppError(400, "BAD_REQUEST", "Invalid Stripe webhook");
        }
        let event: { id: string; type: string; data: unknown };
        try {
          event = await billing.verifyWebhook({ rawBody: request.body, signature });
        } catch {
          throw new AppError(400, "BAD_REQUEST", "Invalid Stripe webhook signature");
        }
        await applyStripeEvent(repositories, event);
        return reply.status(200).send({ received: true });
      },
    );
  });
}

async function applyStripeEvent(
  repositories: UnitOfWork,
  event: { id: string; type: string; data: unknown },
): Promise<void> {
  const object = (event.data as { object?: unknown } | null)?.object as StripeObject | undefined;
  if (!object) return;

  if (event.type === "checkout.session.completed") {
    const workspaceId = metadataValue(object, "workspaceId") ?? object.client_reference_id;
    const planCode = parsePlan(metadataValue(object, "planCode"));
    const subscriptionId = stringId(object.subscription);
    if (!workspaceId || !planCode || !subscriptionId) return;
    await repositories.billing.syncStripeSubscription({
      workspaceId,
      planCode,
      status: "ACTIVE",
      providerCustomerId: stringId(object.customer),
      providerSubscriptionId: subscriptionId,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });
    return;
  }

  if (!event.type.startsWith("customer.subscription.")) return;
  const workspaceId = metadataValue(object, "workspaceId");
  const planCode = parsePlan(metadataValue(object, "planCode"));
  const subscriptionId = stringId(object.id);
  if (!workspaceId || !planCode || !subscriptionId) return;
  const firstItem = object.items?.data?.[0];
  await repositories.billing.syncStripeSubscription({
    workspaceId,
    planCode,
    status: event.type === "customer.subscription.deleted" ? "CANCELLED" : stripeStatus(object.status),
    providerCustomerId: stringId(object.customer),
    providerSubscriptionId: subscriptionId,
    currentPeriodStart: stripeDate(object.current_period_start ?? firstItem?.current_period_start),
    currentPeriodEnd: stripeDate(object.current_period_end ?? firstItem?.current_period_end),
    cancelAtPeriodEnd: object.cancel_at_period_end === true,
  });
}

type StripeObject = {
  id?: string;
  status?: string;
  customer?: string | { id?: string } | null;
  subscription?: string | { id?: string } | null;
  client_reference_id?: string | null;
  metadata?: Record<string, string>;
  current_period_start?: number;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  items?: { data?: Array<{ current_period_start?: number; current_period_end?: number }> };
};

function metadataValue(object: StripeObject, key: string): string | null {
  return object.metadata?.[key] ?? null;
}

function stringId(value: StripeObject["customer"]): string | null {
  return typeof value === "string" ? value : value?.id ?? null;
}

function parsePlan(value: string | null): BillingPlanCode | null {
  return value === "professional" || value === "business" ? value : null;
}

function stripeStatus(value: string | undefined): BillingSubscriptionStatus {
  if (value === "trialing") return "TRIALING";
  if (value === "active") return "ACTIVE";
  if (value === "past_due" || value === "unpaid") return "PAST_DUE";
  if (value === "paused") return "PAUSED";
  if (value === "canceled") return "CANCELLED";
  if (value === "incomplete_expired") return "EXPIRED";
  return "INCOMPLETE";
}

function stripeDate(value: number | undefined): Date | null {
  return typeof value === "number" ? new Date(value * 1000) : null;
}
