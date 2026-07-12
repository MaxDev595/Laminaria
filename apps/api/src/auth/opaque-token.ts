import { createHash, randomBytes } from "node:crypto";

export function createOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashOpaqueToken(token: string, pepper: string): string {
  return createHash("sha256").update(pepper).update("\0").update(token).digest("hex");
}
