import type { AppConfig } from "../config.js";
import type { AuthenticatedActor, Locale, UserRecord } from "../domain/models.js";
import { AppError } from "../errors.js";
import type { UnitOfWork } from "../repositories/contracts.js";
import type { MailAdapter } from "../adapters/mail.js";
import { createOpaqueToken, hashOpaqueToken } from "./opaque-token.js";
import { hashPassword, needsPasswordRehash, verifyPassword } from "./password.js";

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1_000;
const RESET_TTL_MS = 60 * 60 * 1_000;
const INVALID_CREDENTIALS = new AppError(401, "UNAUTHENTICATED", "Invalid email or password");

export interface Clock {
  now(): Date;
}

export class AuthService {
  public constructor(
    private readonly repositories: UnitOfWork,
    private readonly mail: MailAdapter,
    private readonly config: Pick<
      AppConfig,
      | "tokenPepper"
      | "sessionTtlSeconds"
      | "sessionIdleTtlSeconds"
      | "webAppUrl"
      | "skipEmailVerification"
    >,
    private readonly clock: Clock = { now: () => new Date() },
  ) {}

  public async signUp(input: {
    email: string;
    name: string;
    password: string;
    locale: Locale;
  }): Promise<Pick<UserRecord, "id" | "email" | "name" | "locale" | "emailVerifiedAt">> {
    if (!this.config.skipEmailVerification && !this.mail.configured) {
      throw new (await import("../errors.js")).ServiceNotConfiguredError("Mail");
    }
    const email = normalizeEmail(input.email);
    if (await this.repositories.users.findByEmail(email)) {
      throw new AppError(409, "CONFLICT", "An account with this email already exists");
    }
    const user = await this.repositories.users.create({
      email,
      name: input.name.trim(),
      passwordHash: await hashPassword(input.password),
      locale: input.locale,
    });
    if (this.config.skipEmailVerification) {
      const verifiedAt = this.clock.now();
      await this.repositories.users.markEmailVerified(user.id, verifiedAt);
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        locale: user.locale,
        emailVerifiedAt: verifiedAt,
      };
    }

    await this.issueVerification(user);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      locale: user.locale,
      emailVerifiedAt: user.emailVerifiedAt,
    };
  }

  public async signIn(input: { email: string; password: string }): Promise<{
    actor: AuthenticatedActor;
    sessionToken: string;
  }> {
    const user = await this.repositories.users.findByEmail(normalizeEmail(input.email));
    if (!user || !(await verifyPassword(user.passwordHash, input.password))) {
      throw INVALID_CREDENTIALS;
    }
    if (!user.emailVerifiedAt) {
      throw new AppError(403, "FORBIDDEN", "Email verification is required", {
        reason: "EMAIL_NOT_VERIFIED",
      });
    }
    if (needsPasswordRehash(user.passwordHash)) {
      await this.repositories.users.updatePassword(user.id, await hashPassword(input.password));
    }

    return this.createSession(user);
  }

  public async signInWithGoogle(input: {
    email: string;
    name: string;
    locale: Locale;
    emailVerified: boolean;
  }): Promise<{ actor: AuthenticatedActor; sessionToken: string }> {
    if (!input.emailVerified) {
      throw new AppError(403, "FORBIDDEN", "Google email is not verified");
    }

    const email = normalizeEmail(input.email);
    const existing = await this.repositories.users.findByEmail(email);
    const user =
      existing ??
      (await this.repositories.users.create({
        email,
        name: input.name.trim() || email.split("@")[0] || "Google user",
        passwordHash: await hashPassword(createOpaqueToken()),
        locale: input.locale,
      }));

    if (!user.emailVerifiedAt) {
      const verifiedAt = this.clock.now();
      await this.repositories.users.markEmailVerified(user.id, verifiedAt);
      return this.createSession({ ...user, emailVerifiedAt: verifiedAt });
    }

    return this.createSession(user);
  }

  public async authenticate(sessionToken: string): Promise<AuthenticatedActor | null> {
    if (sessionToken.length < 32 || sessionToken.length > 256) return null;
    const now = this.clock.now();
    const session = await this.repositories.sessions.findActiveByTokenHash(
      this.hashToken(sessionToken),
      now,
    );
    if (!session) return null;
    const idleLimit = new Date(now.getTime() - this.config.sessionIdleTtlSeconds * 1_000);
    if (session.lastSeenAt <= idleLimit) {
      await this.repositories.sessions.revoke(session.id, now);
      return null;
    }
    const user = await this.repositories.users.findById(session.userId);
    if (!user) return null;
    await this.repositories.sessions.touchIfOlderThan(
      session.id,
      new Date(now.getTime() - 5 * 60 * 1_000),
      now,
    );
    return {
      kind: "user",
      user: pickPublicUser(user),
      session: { id: session.id, expiresAt: session.expiresAt },
    };
  }

  public async signOut(sessionId: string): Promise<void> {
    await this.repositories.sessions.revoke(sessionId, this.clock.now());
  }

  public async verifyEmail(token: string): Promise<void> {
    const now = this.clock.now();
    const record = await this.repositories.tokens.consume(
      this.hashToken(token),
      "EMAIL_VERIFICATION",
      now,
    );
    if (!record?.userId) {
      throw new AppError(400, "BAD_REQUEST", "Verification token is invalid or expired");
    }
    await this.repositories.users.markEmailVerified(record.userId, now);
  }

  public async resendVerification(emailInput: string): Promise<void> {
    if (!this.mail.configured) {
      throw new (await import("../errors.js")).ServiceNotConfiguredError("Mail");
    }
    const user = await this.repositories.users.findByEmail(normalizeEmail(emailInput));
    if (!user || user.emailVerifiedAt) return;
    await this.repositories.tokens.invalidateForUser(
      user.id,
      "EMAIL_VERIFICATION",
      this.clock.now(),
    );
    await this.issueVerification(user);
  }

  public async requestPasswordReset(emailInput: string): Promise<void> {
    if (!this.mail.configured) {
      throw new (await import("../errors.js")).ServiceNotConfiguredError("Mail");
    }
    const user = await this.repositories.users.findByEmail(normalizeEmail(emailInput));
    if (!user) return;
    const now = this.clock.now();
    await this.repositories.tokens.invalidateForUser(user.id, "PASSWORD_RESET", now);
    const token = createOpaqueToken();
    await this.repositories.tokens.create({
      userId: user.id,
      kind: "PASSWORD_RESET",
      tokenHash: this.hashToken(token),
      expiresAt: new Date(now.getTime() + RESET_TTL_MS),
    });
    await this.mail.sendPasswordReset({
      to: user.email,
      name: user.name,
      locale: user.locale,
      resetUrl: `${this.config.webAppUrl}/${user.locale}/reset-password?token=${encodeURIComponent(token)}`,
    });
  }

  public async resetPassword(token: string, password: string): Promise<void> {
    const now = this.clock.now();
    const record = await this.repositories.tokens.consume(
      this.hashToken(token),
      "PASSWORD_RESET",
      now,
    );
    if (!record?.userId) {
      throw new AppError(400, "BAD_REQUEST", "Password reset token is invalid or expired");
    }
    await this.repositories.users.updatePassword(record.userId, await hashPassword(password));
    await this.repositories.sessions.revokeAllForUser(record.userId, now);
  }

  private async issueVerification(user: UserRecord): Promise<void> {
    const token = createOpaqueToken();
    const now = this.clock.now();
    await this.repositories.tokens.create({
      userId: user.id,
      kind: "EMAIL_VERIFICATION",
      tokenHash: this.hashToken(token),
      expiresAt: new Date(now.getTime() + VERIFICATION_TTL_MS),
    });
    await this.mail.sendEmailVerification({
      to: user.email,
      name: user.name,
      locale: user.locale,
      verificationUrl: `${this.config.webAppUrl}/${user.locale}/verify-email?token=${encodeURIComponent(token)}`,
    });
  }

  private hashToken(token: string): string {
    return hashOpaqueToken(token, this.config.tokenPepper);
  }

  private async createSession(user: UserRecord): Promise<{
    actor: AuthenticatedActor;
    sessionToken: string;
  }> {
    const sessionToken = createOpaqueToken();
    const now = this.clock.now();
    const session = await this.repositories.sessions.create({
      userId: user.id,
      tokenHash: this.hashToken(sessionToken),
      expiresAt: new Date(now.getTime() + this.config.sessionTtlSeconds * 1_000),
      lastSeenAt: now,
    });
    return {
      actor: {
        kind: "user",
        user: pickPublicUser(user),
        session: { id: session.id, expiresAt: session.expiresAt },
      },
      sessionToken,
    };
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLocaleLowerCase("en-US");
}

function pickPublicUser(user: UserRecord): AuthenticatedActor["user"] {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    locale: user.locale,
    emailVerifiedAt: user.emailVerifiedAt,
  };
}
