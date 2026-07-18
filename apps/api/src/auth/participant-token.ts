import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { ParticipantRole } from "../domain/models.js";

const payloadSchema = z.object({
  v: z.literal(1),
  sub: z.string().min(1).max(200),
  webinarId: z.string().min(1).max(200),
  role: z.enum(["OWNER", "HOST", "COHOST", "MODERATOR", "SPEAKER", "ATTENDEE", "GUEST"]),
  name: z.string().min(1).max(100),
  exp: z.number().int().positive(),
});

export interface ParticipantTokenPayload {
  subject: string;
  webinarId: string;
  role: ParticipantRole;
  name: string;
  expiresAt: Date;
}

export class ParticipantTokenService {
  public constructor(private readonly secret: string) {}

  public issue(input: Omit<ParticipantTokenPayload, "expiresAt">, ttlSeconds = 900): string {
    const encoded = Buffer.from(
      JSON.stringify({
        v: 1,
        sub: input.subject,
        webinarId: input.webinarId,
        role: input.role,
        name: input.name,
        exp: Math.floor(Date.now() / 1_000) + ttlSeconds,
      }),
    ).toString("base64url");
    return `${encoded}.${this.sign(encoded)}`;
  }

  public verify(token: string): ParticipantTokenPayload | null {
    const [encoded, signature, extra] = token.split(".");
    if (!encoded || !signature || extra) return null;
    const expected = Buffer.from(this.sign(encoded));
    const actual = Buffer.from(signature);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    try {
      const payload = payloadSchema.parse(
        JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")),
      );
      if (payload.exp <= Math.floor(Date.now() / 1_000)) return null;
      return {
        subject: payload.sub,
        webinarId: payload.webinarId,
        role: payload.role,
        name: payload.name,
        expiresAt: new Date(payload.exp * 1_000),
      };
    } catch {
      return null;
    }
  }

  private sign(encoded: string): string {
    return createHmac("sha256", this.secret)
      .update("laminaria-participant-v1\0")
      .update(encoded)
      .digest("base64url");
  }
}
