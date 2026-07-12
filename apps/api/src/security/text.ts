import { AppError } from "../errors.js";

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu;

export function normalizePlainText(value: string, maxLength: number): string {
  const normalized = value.normalize("NFC").replace(CONTROL_CHARACTERS, "").trim();
  if (!normalized) throw new AppError(400, "BAD_REQUEST", "Text cannot be empty");
  if (normalized.length > maxLength) {
    throw new AppError(400, "BAD_REQUEST", `Text cannot exceed ${maxLength} characters`);
  }
  return normalized;
}
