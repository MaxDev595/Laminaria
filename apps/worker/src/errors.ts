export class ServiceNotConfiguredError extends Error {
  readonly code = "SERVICE_NOT_CONFIGURED";

  constructor(readonly service: "ai" | "email" | "storage") {
    super(`${service} service is not configured`);
    this.name = "ServiceNotConfiguredError";
  }
}

export class ProviderResponseError extends Error {
  readonly code = "PROVIDER_RESPONSE_ERROR";

  constructor(
    readonly service: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ProviderResponseError";
  }
}
