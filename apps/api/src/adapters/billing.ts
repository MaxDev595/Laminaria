import { ServiceNotConfiguredError } from "../errors.js";

export interface BillingAdapter {
  readonly configured: boolean;
  createCheckout(input: {
    workspaceId: string;
    planKey: "STARTER" | "PROFESSIONAL" | "BUSINESS";
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ url: string }>;
  createCustomerPortal(input: { workspaceId: string; returnUrl: string }): Promise<{ url: string }>;
  verifyWebhook(input: { rawBody: Uint8Array; signature: string }): Promise<{
    id: string;
    type: string;
    data: unknown;
  }>;
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
