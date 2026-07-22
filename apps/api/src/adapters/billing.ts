import { AppError, ServiceNotConfiguredError } from "../errors.js";

export interface BillingAdapter {
  readonly configured: boolean;
  createCheckout(input: {
    workspaceId: string;
    planKey: "professional" | "business";
    interval: "month" | "year";
    customerEmail: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ url: string }>;
  createCustomerPortal(input: { customerId: string; returnUrl: string }): Promise<{ url: string }>;
  verifyWebhook(input: { rawBody: Uint8Array; signature: string }): Promise<{
    id: string;
    type: string;
    data: unknown;
  }>;
}

type StripeBillingConfig = Readonly<{
  apiKey: string;
  webhookSecret: string;
  prices: Readonly<Record<"professional" | "business", Readonly<Record<"month" | "year", string>>>>;
}>;

export class StripeBillingAdapter implements BillingAdapter {
  public readonly configured = true;

  public constructor(private readonly config: StripeBillingConfig) {}

  public async createCheckout(input: {
    workspaceId: string;
    planKey: "professional" | "business";
    interval: "month" | "year";
    customerEmail: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ url: string }> {
    const metadata = { workspaceId: input.workspaceId, planCode: input.planKey };
    const body = new URLSearchParams({
      mode: "subscription",
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      customer_email: input.customerEmail,
      client_reference_id: input.workspaceId,
      "line_items[0][price]": this.config.prices[input.planKey][input.interval],
      "line_items[0][quantity]": "1",
      "metadata[workspaceId]": metadata.workspaceId,
      "metadata[planCode]": metadata.planCode,
      "subscription_data[metadata][workspaceId]": metadata.workspaceId,
      "subscription_data[metadata][planCode]": metadata.planCode,
      allow_promotion_codes: "true",
    });
    const session = await this.request<{ url: string | null }>("/v1/checkout/sessions", body);
    if (!session.url) throw new Error("Stripe did not return a Checkout URL");
    return { url: session.url };
  }

  public async createCustomerPortal(input: {
    customerId: string;
    returnUrl: string;
  }): Promise<{ url: string }> {
    const portal = await this.request<{ url: string }>(
      "/v1/billing_portal/sessions",
      new URLSearchParams({ customer: input.customerId, return_url: input.returnUrl }),
    );
    return { url: portal.url };
  }

  public async verifyWebhook(input: { rawBody: Uint8Array; signature: string }): Promise<{
    id: string;
    type: string;
    data: unknown;
  }> {
    const { createHmac, timingSafeEqual } = await import("node:crypto");
    const parts = input.signature.split(",").map((part) => part.split("=", 2));
    const timestamp = parts.find(([key]) => key === "t")?.[1];
    const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value ?? "");
    if (!timestamp || signatures.length === 0) throw new Error("Invalid Stripe signature header");
    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) throw new Error("Expired Stripe webhook");
    const expected = createHmac("sha256", this.config.webhookSecret)
      .update(`${timestamp}.`)
      .update(input.rawBody)
      .digest("hex");
    const expectedBuffer = Buffer.from(expected);
    const valid = signatures.some((signature) => {
      const candidate = Buffer.from(signature);
      return candidate.length === expectedBuffer.length && timingSafeEqual(candidate, expectedBuffer);
    });
    if (!valid) throw new Error("Invalid Stripe webhook signature");
    const event = JSON.parse(Buffer.from(input.rawBody).toString("utf8")) as {
      id: string;
      type: string;
      data: unknown;
    };
    return event;
  }

  private async request<T>(path: string, body: URLSearchParams): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`https://api.stripe.com${path}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.config.apiKey}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body,
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new AppError(502, "BILLING_ERROR", "Stripe is temporarily unreachable");
    }
    const payload = (await response.json()) as T & {
      error?: { message?: string; code?: string; type?: string; param?: string };
    };
    if (!response.ok) {
      const providerMessage = payload.error?.message?.slice(0, 300) ?? `Request failed (${response.status})`;
      throw new AppError(502, "BILLING_ERROR", `Stripe rejected checkout: ${providerMessage}`, {
        provider: "stripe",
        ...(payload.error?.code ? { code: payload.error.code } : {}),
        ...(payload.error?.type ? { type: payload.error.type } : {}),
        ...(payload.error?.param ? { param: payload.error.param } : {}),
      });
    }
    return payload;
  }
}

export class NotConfiguredBillingAdapter implements BillingAdapter {
  public readonly configured = false;

  public async createCheckout(): Promise<never> {
    throw new ServiceNotConfiguredError("Billing provider");
  }

  public async createCustomerPortal(): Promise<never> {
    throw new ServiceNotConfiguredError("Billing provider");
  }

  public async verifyWebhook(): Promise<never> {
    throw new ServiceNotConfiguredError("Billing provider");
  }
}
