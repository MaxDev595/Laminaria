import type { WorkerConfig } from "../config.js";
import { ProviderResponseError, ServiceNotConfiguredError } from "../errors.js";

export interface AiUsage {
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface AiResult {
  content: string;
  usage: AiUsage;
}

export interface AiProvider {
  readonly configured: boolean;
  complete(input: { system: string; prompt: string; maxOutputTokens: number }): Promise<AiResult>;
}

export class DisabledAiProvider implements AiProvider {
  readonly configured = false;

  complete(): Promise<AiResult> {
    return Promise.reject(new ServiceNotConfiguredError("ai"));
  }
}

interface ChatCompletionResponse {
  model?: string;
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export class OpenAiCompatibleProvider implements AiProvider {
  readonly configured = true;

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly baseUrl: string,
  ) {}

  async complete(input: {
    system: string;
    prompt: string;
    maxOutputTokens: number;
  }): Promise<AiResult> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.prompt },
        ],
        max_completion_tokens: input.maxOutputTokens,
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!response.ok) {
      throw new ProviderResponseError(
        "ai",
        response.status,
        `AI provider returned ${response.status}`,
      );
    }

    const payload = (await response.json()) as ChatCompletionResponse;
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content)
      throw new ProviderResponseError("ai", 502, "AI provider returned an empty response");

    return {
      content,
      usage: {
        model: payload.model ?? this.model,
        inputTokens: payload.usage?.prompt_tokens ?? null,
        outputTokens: payload.usage?.completion_tokens ?? null,
      },
    };
  }
}

export function createAiProvider(config: WorkerConfig): AiProvider {
  if (config.AI_PROVIDER === "disabled") return new DisabledAiProvider();
  if (!config.AI_API_KEY || !config.AI_MODEL || !config.AI_BASE_URL)
    return new DisabledAiProvider();
  return new OpenAiCompatibleProvider(config.AI_API_KEY, config.AI_MODEL, config.AI_BASE_URL);
}
