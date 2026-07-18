import { describe, expect, it } from "vitest";

import { buildApplication } from "../app.js";
import type { AppConfig } from "../config.js";
import type {
  OneTimeTokenKind,
  OneTimeTokenRecord,
  RegistrationRecord,
  SessionRecord,
  UserRecord,
  WebinarRecord,
  WebinarStatus,
  WorkspaceMemberRecord,
  WorkspaceRole,
} from "../domain/models.js";
import type { UnitOfWork } from "../repositories/contracts.js";

describe("auth session cookie", () => {
  it("keeps the user authenticated on a later request with the same cookie", async () => {
    const repositories = new MemoryUnitOfWork();
    const application = await buildApplication({
      config: testConfig,
      repositories,
    });

    try {
      const csrf = await application.app.inject({
        method: "GET",
        url: "/v1/auth/csrf",
      });
      expect(csrf.statusCode).toBe(200);
      const csrfToken = (JSON.parse(csrf.body) as { csrfToken: string }).csrfToken;
      const csrfCookie = toCookieHeader(csrf.headers["set-cookie"]);

      const providers = await application.app.inject({
        method: "GET",
        url: "/v1/auth/providers",
      });
      expect(JSON.parse(providers.body)).toEqual({
        google: { enabled: false },
      });

      const rejectedOrigin = await application.app.inject({
        method: "OPTIONS",
        url: "/v1/auth/providers",
        headers: {
          origin: "https://evil.example",
          "access-control-request-method": "GET",
        },
      });
      expect(rejectedOrigin.statusCode).toBeLessThan(500);
      expect(rejectedOrigin.headers["access-control-allow-origin"]).toBeUndefined();

      const removedPhoneAuth = await application.app.inject({
        method: "POST",
        url: "/v1/auth/phone/verify",
        headers: {
          cookie: csrfCookie,
          "x-csrf-token": csrfToken,
        },
        payload: { phone: "+15550000000", code: "000000" },
      });
      expect(removedPhoneAuth.statusCode).toBe(404);

      const signUp = await application.app.inject({
        method: "POST",
        url: "/v1/auth/sign-up",
        headers: {
          cookie: csrfCookie,
          "x-csrf-token": csrfToken,
        },
        payload: {
          email: "founder@example.com",
          name: "Founder",
          password: "very-secure-password",
          locale: "ru",
        },
      });
      expect(signUp.statusCode).toBe(202);

      const signIn = await application.app.inject({
        method: "POST",
        url: "/v1/auth/sign-in",
        headers: {
          cookie: csrfCookie,
          "x-csrf-token": csrfToken,
        },
        payload: {
          email: "founder@example.com",
          password: "very-secure-password",
        },
      });
      expect(signIn.statusCode).toBe(200);

      const sessionCookie = toCookieHeader(signIn.headers["set-cookie"]);
      expect(sessionCookie).toContain("laminaria_session=");

      const me = await application.app.inject({
        method: "GET",
        url: "/v1/auth/me",
        headers: { cookie: sessionCookie },
      });

      expect(me.statusCode).toBe(200);
      expect(JSON.parse(me.body)).toMatchObject({
        user: {
          email: "founder@example.com",
          name: "Founder",
          locale: "ru",
        },
      });
    } finally {
      await application.app.close();
    }
  });
});

const testConfig: AppConfig = {
  nodeEnv: "test",
  host: "127.0.0.1",
  port: 4000,
  logLevel: "silent",
  trustProxy: false,
  publicApiUrl: "http://localhost:4000",
  webAppUrl: "http://localhost:3000",
  corsOrigins: ["http://localhost:3000"],
  databaseUrl: "postgresql://example.test/laminaria",
  sessionCookieName: "laminaria_session",
  sessionTtlSeconds: 2_592_000,
  sessionIdleTtlSeconds: 604_800,
  csrfCookieName: "laminaria_csrf",
  tokenPepper: "test-token-pepper-must-be-at-least-32-chars",
  skipEmailVerification: true,
  livekit: null,
  mail: null,
  google: null,
  ai: null,
  billing: null,
  storage: null,
};

function toCookieHeader(value: number | string | string[] | undefined): string {
  const cookies = Array.isArray(value) ? value : value ? [String(value)] : [];
  return cookies.map((cookie) => cookie.split(";")[0]).join("; ");
}

class MemoryUnitOfWork implements UnitOfWork {
  readonly #users = new Map<string, UserRecord>();
  readonly #sessions = new Map<string, SessionRecord>();
  #id = 0;

  public readonly users = {
    findById: async (id: string) => this.#users.get(id) ?? null,
    findByEmail: async (email: string) => {
      const normalized = email.trim().toLocaleLowerCase("en-US");
      return [...this.#users.values()].find((user) => user.email === normalized) ?? null;
    },
    create: async (input: {
      email: string;
      name: string;
      passwordHash: string;
      locale: "en" | "ru";
    }) => {
      const now = new Date();
      const user: UserRecord = {
        id: this.nextId("user"),
        email: input.email.trim().toLocaleLowerCase("en-US"),
        name: input.name,
        passwordHash: input.passwordHash,
        locale: input.locale,
        emailVerifiedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      this.#users.set(user.id, user);
      return user;
    },
    markEmailVerified: async (userId: string, verifiedAt: Date) => {
      const user = this.#users.get(userId);
      if (user)
        this.#users.set(userId, { ...user, emailVerifiedAt: verifiedAt, updatedAt: verifiedAt });
    },
    updatePassword: async (userId: string, passwordHash: string) => {
      const user = this.#users.get(userId);
      if (user) this.#users.set(userId, { ...user, passwordHash, updatedAt: new Date() });
    },
  };

  public readonly sessions = {
    create: async (input: {
      userId: string;
      tokenHash: string;
      expiresAt: Date;
      lastSeenAt: Date;
    }) => {
      const session: SessionRecord = {
        id: this.nextId("session"),
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        lastSeenAt: input.lastSeenAt,
        revokedAt: null,
        createdAt: input.lastSeenAt,
      };
      this.#sessions.set(session.id, session);
      return session;
    },
    findActiveByTokenHash: async (tokenHash: string, now: Date) =>
      [...this.#sessions.values()].find(
        (session) =>
          session.tokenHash === tokenHash &&
          session.revokedAt === null &&
          session.expiresAt > now &&
          this.#users.has(session.userId),
      ) ?? null,
    touchIfOlderThan: async (sessionId: string, threshold: Date, now: Date) => {
      const session = this.#sessions.get(sessionId);
      if (
        session &&
        session.lastSeenAt < threshold &&
        session.expiresAt > now &&
        !session.revokedAt
      ) {
        this.#sessions.set(sessionId, { ...session, lastSeenAt: now });
      }
    },
    revoke: async (sessionId: string, at: Date) => {
      const session = this.#sessions.get(sessionId);
      if (session && !session.revokedAt)
        this.#sessions.set(sessionId, { ...session, revokedAt: at });
    },
    revokeAllForUser: async (userId: string, at: Date) => {
      for (const session of this.#sessions.values()) {
        if (session.userId === userId && !session.revokedAt) {
          this.#sessions.set(session.id, { ...session, revokedAt: at });
        }
      }
    },
  };

  public readonly tokens = {
    create: async (_input: {
      userId?: string;
      registrationId?: string;
      kind: OneTimeTokenKind;
      tokenHash: string;
      expiresAt: Date;
    }): Promise<OneTimeTokenRecord> => {
      throw new Error("tokens.create is not used in this test");
    },
    consume: async (): Promise<OneTimeTokenRecord | null> => null,
    invalidateForUser: async (): Promise<void> => undefined,
  };

  public readonly workspaces = {
    findMember: async (): Promise<WorkspaceMemberRecord | null> => null,
    upsertMember: async (): Promise<WorkspaceMemberRecord> => ({
      workspaceId: this.nextId("workspace"),
      userId: this.nextId("user"),
      role: "MEMBER",
    }),
    createWithOwner: async (): Promise<{
      id: string;
      name: string;
      slug: string;
      role: WorkspaceRole;
    }> => ({
      id: this.nextId("workspace"),
      name: "Test",
      slug: "test",
      role: "OWNER",
    }),
    listForUser: async (): Promise<
      readonly { id: string; name: string; slug: string; role: WorkspaceRole }[]
    > => [],
  };

  public readonly webinars = {
    findById: async (): Promise<WebinarRecord | null> => null,
    findPublicBySlug: async (): Promise<WebinarRecord | null> => null,
    findParticipantRole: async () => null,
    listByWorkspace: async (): Promise<readonly WebinarRecord[]> => [],
    create: async (): Promise<WebinarRecord> => {
      throw new Error("webinars.create is not used in this test");
    },
    updateDraft: async (): Promise<WebinarRecord | null> => null,
    transition: async (): Promise<WebinarRecord | null> => null,
    softDelete: async (): Promise<void> => undefined,
    countActiveParticipants: async (): Promise<number> => 0,
  };

  public readonly registrations = {
    findById: async (): Promise<RegistrationRecord | null> => null,
    findByWebinarAndEmail: async (): Promise<RegistrationRecord | null> => null,
    findByTokenHash: async (): Promise<RegistrationRecord | null> => null,
    listByWebinar: async (): Promise<readonly RegistrationRecord[]> => [],
    confirmByTokenHash: async (): Promise<RegistrationRecord | null> => null,
    create: async (): Promise<RegistrationRecord> => {
      throw new Error("registrations.create is not used in this test");
    },
  };

  public async healthcheck(): Promise<void> {
    return undefined;
  }

  public async close(): Promise<void> {
    return undefined;
  }

  private nextId(prefix: string): string {
    this.#id += 1;
    return `${prefix}_${this.#id}`;
  }
}
