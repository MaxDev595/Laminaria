import type {
  ModerationDecision,
  ModerationInput,
  ModerationResult,
  ModerationService,
} from "./types.js";

export interface TextModerationRule {
  code: string;
  decision: Exclude<ModerationDecision, "allow">;
  labels?: readonly string[];
  matches(input: ModerationInput): boolean | Promise<boolean>;
}

const unsafeControlCharacters = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;

const baselineRules: readonly TextModerationRule[] = [
  {
    code: "unsafe_control_characters",
    decision: "block",
    labels: ["malformed_text"],
    matches: ({ text }) => unsafeControlCharacters.test(text),
  },
];

/**
 * Deterministic baseline only; it does not impersonate an AI moderation
 * provider. Additional policy or provider rules are injected by composition.
 */
export class RuleBasedModerationService implements ModerationService {
  readonly #rules: readonly TextModerationRule[];

  constructor(rules: readonly TextModerationRule[] = baselineRules) {
    this.#rules = rules;
  }

  async evaluate(input: ModerationInput): Promise<ModerationResult> {
    const normalizedText = input.text.normalize("NFC");
    const normalizedInput = { ...input, text: normalizedText };

    for (const rule of this.#rules) {
      if (await rule.matches(normalizedInput)) {
        return {
          decision: rule.decision,
          normalizedText,
          reasonCode: rule.code,
          labels: rule.labels ?? [],
        };
      }
    }

    return { decision: "allow", normalizedText };
  }
}

