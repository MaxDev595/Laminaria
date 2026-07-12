import { ServiceNotConfiguredError } from "../errors.js";

export interface AiProvider {
  readonly configured: boolean;
  moderate(input: { text: string; locale: "en" | "ru" }): Promise<{
    flagged: boolean;
    categories: readonly string[];
  }>;
  draftAnswer(input: {
    webinarTitle: string;
    question: string;
    locale: "en" | "ru";
  }): Promise<{ text: string; providerRequestId?: string }>;
}

export class NotConfiguredAiProvider implements AiProvider {
  public readonly configured = false;

  public async moderate(): Promise<never> {
    throw new ServiceNotConfiguredError("AI provider");
  }

  public async draftAnswer(): Promise<never> {
    throw new ServiceNotConfiguredError("AI provider");
  }
}
