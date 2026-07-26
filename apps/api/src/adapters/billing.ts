import { AppError, ServiceNotConfiguredError } from "../errors.js";

export interface BillingAdapter {
  readonly configured: boolean;
  createCheckout(input: {
    workspaceId: string;
    planKey: "professional" | "business";
    interval: "month" | "year";
    customerEmail: string;
    successUrl: string;
  }): Promise<{
    transactionId: string;
    clientToken: string;
    environment: "sandbox" | "production";
    customerEmail: string;
    successUrl: string;
  }>;
  createCustomerPortal(input: { customerId: string }): Promise<{ url: string }>;
  cancelAndRefund(input: {
    subscriptionId: string;
  }): Promise<{ refundId: string; refundStatus: string }>;
  verifyWebhook(input: { rawBody: Uint8Array; signature: string }): Promise<{
    id: string;
    type: string;
    data: unknown;
  }>;
}

type PaddleBillingConfig = Readonly<{
  apiKey: string;
  clientToken: string;
  webhookSecret: string;
  environment: "sandbox" | "production";
  prices: Readonly<Record<"professional", Readonly<Record<"month" | "year", string>>>>;
}>;

type PaddleResponse<T> = {
  data: T;
  error?: {
    type?: string;
    code?: string;
    detail?: string;
    documentation_url?: string;
  };
};

export class PaddleBillingAdapter implements BillingAdapter {
  public readonly configured = true;

  public constructor(private readonly config: PaddleBillingConfig) {}

  public async createCheckout(input: {
    workspaceId: string;
    planKey: "professional" | "business";
    interval: "month" | "year";
    customerEmail: string;
    successUrl: string;
  }): Promise<{
    transactionId: string;
    clientToken: string;
    environment: "sandbox" | "production";
    customerEmail: string;
    successUrl: string;
  }> {
    if (input.planKey !== "professional") {
      throw new AppError(409, "BILLING_ERROR", "Business plan is coming soon");
    }
    const transaction = await this.request<{ id: string }>("/transactions", {
      method: "POST",
      body: {
        items: [
          {
            price_id: this.config.prices[input.planKey][input.interval],
            quantity: 1,
          },
        ],
        collection_mode: "automatic",
        custom_data: {
          workspaceId: input.workspaceId,
          planCode: input.planKey,
        },
      },
    });
    return {
      transactionId: transaction.id,
      clientToken: this.config.clientToken,
      environment: this.config.environment,
      customerEmail: input.customerEmail,
      successUrl: input.successUrl,
    };
  }

  public async createCustomerPortal(input: { customerId: string }): Promise<{ url: string }> {
    const session = await this.request<{
      urls: { general: { overview: string } };
    }>(`/customers/${encodeURIComponent(input.customerId)}/portal-sessions`, {
      method: "POST",
      body: {},
    });
    return { url: session.urls.general.overview };
  }

  public async cancelAndRefund(input: {
    subscriptionId: string;
  }): Promise<{ refundId: string; refundStatus: string }> {
    const query = new URLSearchParams({
      subscription_id: input.subscriptionId,
      status: "completed",
      per_page: "1",
      order_by: "created_at[DESC]",
    });
    const transactions = await this.request<Array<{ id: string }>>(`/transactions?${query}`, {
      method: "GET",
    });
    const latestTransaction = transactions[0];
    if (!latestTransaction) {
      throw new AppError(
        409,
        "BILLING_ERROR",
        "The latest Paddle subscription payment cannot be refunded",
      );
    }
    const adjustment = await this.request<{ id: string; status: string }>("/adjustments", {
      method: "POST",
      body: {
        action: "refund",
        type: "full",
        transaction_id: latestTransaction.id,
        reason: "Customer requested subscription cancellation and refund",
      },
    });
    await this.request(`/subscriptions/${encodeURIComponent(input.subscriptionId)}/cancel`, {
      method: "POST",
      body: { effective_from: "immediately" },
    });
    return { refundId: adjustment.id, refundStatus: adjustment.status };
  }

  public async verifyWebhook(input: { rawBody: Uint8Array; signature: string }): Promise<{
    id: string;
    type: string;
    data: unknown;
  }> {
    const { createHmac, timingSafeEqual } = await import("node:crypto");
    const parts = input.signature.split(";").map((part) => part.trim().split("=", 2));
    const timestamp = parts.find(([key]) => key === "ts")?.[1];
    const signatures = parts.filter(([key]) => key === "h1").map(([, value]) => value ?? "");
    if (!timestamp || signatures.length === 0) throw new Error("Invalid Paddle signature header");
    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
      throw new Error("Expired Paddle webhook");
    }
    const rawBody = Buffer.from(input.rawBody).toString("utf8");
    const expected = createHmac("sha256", this.config.webhookSecret)
      .update(`${timestamp}:${rawBody}`)
      .digest("hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    const valid = signatures.some((signature) => {
      const candidate = Buffer.from(signature, "hex");
      return (
        candidate.length === expectedBuffer.length && timingSafeEqual(candidate, expectedBuffer)
      );
    });
    if (!valid) throw new Error("Invalid Paddle webhook signature");
    const event = JSON.parse(rawBody) as {
      event_id: string;
      event_type: string;
      data: unknown;
    };
    return { id: event.event_id, type: event.event_type, data: event.data };
  }

  private async request<T>(
    path: string,
    options: { method: "GET" | "POST"; body?: Record<string, unknown> },
  ): Promise<T> {
    const baseUrl =
      this.config.environment === "sandbox"
        ? "https://sandbox-api.paddle.com"
        : "https://api.paddle.com";
    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method: options.method,
        headers: {
          authorization: `Bearer ${this.config.apiKey}`,
          "paddle-version": "1",
          ...(options.body ? { "content-type": "application/json" } : {}),
        },
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new AppError(502, "BILLING_ERROR", "Paddle is temporarily unreachable");
    }
    const payload = (await response.json()) as PaddleResponse<T>;
    if (!response.ok) {
      const providerMessage =
        payload.error?.detail?.slice(0, 300) ?? `Request failed (${response.status})`;
      throw new AppError(
        502,
        "BILLING_ERROR",
        `Paddle rejected the billing request: ${providerMessage}`,
        {
          provider: "paddle",
          ...(payload.error?.code ? { code: payload.error.code } : {}),
          ...(payload.error?.type ? { type: payload.error.type } : {}),
        },
      );
    }
    return payload.data;
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

  public async cancelAndRefund(): Promise<never> {
    throw new ServiceNotConfiguredError("Billing provider");
  }

  public async verifyWebhook(): Promise<never> {
    throw new ServiceNotConfiguredError("Billing provider");
  }
}
