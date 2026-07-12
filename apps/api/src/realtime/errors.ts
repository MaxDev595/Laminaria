import type {
  RealtimeErrorCode,
  RealtimeErrorPayload,
  RealtimeValidationIssue,
} from "./types.js";

export class RealtimeDomainError extends Error {
  readonly code: RealtimeErrorCode;
  readonly issues?: RealtimeValidationIssue[];

  constructor(
    code: RealtimeErrorCode,
    message: string,
    issues?: RealtimeValidationIssue[],
  ) {
    super(message);
    this.name = "RealtimeDomainError";
    this.code = code;
    if (issues) {
      this.issues = issues;
    }
  }

  toPayload(): RealtimeErrorPayload {
    if (this.issues) {
      return { code: this.code, message: this.message, issues: this.issues };
    }
    return { code: this.code, message: this.message };
  }
}

