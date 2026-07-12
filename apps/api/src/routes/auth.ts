import type { FastifyInstance } from "fastify";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { AppConfig } from "../config.js";
import type { AuthService } from "../auth/service.js";
import { requireUser } from "../auth/plugin.js";

const email = z.email().max(320);
const password = z.string().min(12).max(128);
const signUpSchema = z.object({
  email,
  name: z.string().trim().min(1).max(100),
  password,
  locale: z.enum(["en", "ru"]).default("en"),
});
const signInSchema = z.object({ email, password: z.string().min(1).max(128) });
const phoneStartSchema = z.object({ phone: z.string().min(7).max(32), locale: z.enum(["en", "ru"]).default("en") });
const phoneVerifySchema = phoneStartSchema.extend({
  code: z.string().regex(/^[0-9]{6}$/),
  name: z.string().trim().min(1).max(100).optional(),
});
const tokenSchema = z.object({ token: z.string().min(32).max(256) });
const GOOGLE_STATE_COOKIE = "laminaria_google_state";

export async function registerAuthRoutes(
  app: FastifyInstance,
  auth: AuthService,
  config: Pick<
    AppConfig,
    | "sessionCookieName"
    | "sessionTtlSeconds"
    | "nodeEnv"
    | "phoneAuth"
    | "google"
    | "webAppUrl"
  >,
): Promise<void> {
  app.get("/v1/auth/providers", {
    schema: { tags: ["Authentication"], summary: "List enabled authentication providers" },
  }, async () => ({
    phone: {
      enabled: true,
      delivery: config.nodeEnv === "production" ? "sms" : "dev",
      devCode: config.nodeEnv === "production" ? null : config.phoneAuth.devCode,
    },
    google: { enabled: Boolean(config.google) },
  }));

  app.post("/v1/auth/sign-up", {
    config: { rateLimit: { max: 10, timeWindow: "1 hour" } },
    schema: {
      tags: ["Authentication"],
      summary: "Create an account and send email verification",
      body: {
        type: "object",
        required: ["email", "name", "password"],
        properties: {
          email: { type: "string", format: "email", maxLength: 320 },
          name: { type: "string", minLength: 1, maxLength: 100 },
          password: { type: "string", minLength: 12, maxLength: 128 },
          locale: { type: "string", enum: ["en", "ru"] },
        },
      },
    },
  }, async (request, reply) => {
    const user = await auth.signUp(signUpSchema.parse(request.body));
    return reply.status(202).send({ user, verificationRequired: !user.emailVerifiedAt });
  });

  app.post("/v1/auth/sign-in", {
    config: { rateLimit: { max: 10, timeWindow: "15 minutes" } },
    schema: {
      tags: ["Authentication"],
      summary: "Sign in with an opaque server session",
      body: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", minLength: 1, maxLength: 128 },
        },
      },
    },
  }, async (request, reply) => {
    const result = await auth.signIn(signInSchema.parse(request.body));
    reply.setCookie(config.sessionCookieName, result.sessionToken, sessionCookie(config));
    return { user: result.actor.user, sessionExpiresAt: result.actor.session.expiresAt.toISOString() };
  });

  app.post("/v1/auth/phone/start", {
    config: { rateLimit: { max: 10, timeWindow: "15 minutes" } },
    schema: { tags: ["Authentication"], summary: "Start phone sign-in" },
  }, async (request) => {
    phoneStartSchema.parse(request.body);
    return {
      accepted: true,
      delivery: config.nodeEnv === "production" ? "sms" : "dev",
      devCode: config.nodeEnv === "production" ? null : config.phoneAuth.devCode,
    };
  });

  app.post("/v1/auth/phone/verify", {
    config: { rateLimit: { max: 10, timeWindow: "15 minutes" } },
    schema: { tags: ["Authentication"], summary: "Verify phone sign-in code" },
  }, async (request, reply) => {
    const result = await auth.signInWithPhone(phoneVerifySchema.parse(request.body));
    reply.setCookie(config.sessionCookieName, result.sessionToken, sessionCookie(config));
    return { user: result.actor.user, sessionExpiresAt: result.actor.session.expiresAt.toISOString() };
  });

  app.get("/v1/auth/google/start", {
    config: { rateLimit: { max: 20, timeWindow: "15 minutes" } },
    schema: { tags: ["Authentication"], summary: "Start Google OAuth sign-in" },
  }, async (request, reply) => {
    const query = z.object({ locale: z.enum(["en", "ru"]).default("en") }).parse(request.query);
    if (!config.google) {
      return reply.redirect(`${config.webAppUrl}/${query.locale}/sign-in?error=google_not_configured`);
    }
    const state = `${query.locale}.${randomBytes(24).toString("base64url")}`;
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", config.google.clientId);
    url.searchParams.set("redirect_uri", config.google.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("prompt", "select_account");
    reply.setCookie(GOOGLE_STATE_COOKIE, state, {
      path: "/v1/auth/google",
      httpOnly: true,
      secure: config.nodeEnv === "production",
      sameSite: "lax",
      maxAge: 10 * 60,
    });
    return reply.redirect(url.toString());
  });

  app.get("/v1/auth/google/callback", {
    config: { rateLimit: { max: 20, timeWindow: "15 minutes" } },
    schema: { tags: ["Authentication"], summary: "Complete Google OAuth sign-in" },
  }, async (request, reply) => {
    if (!config.google) {
      return reply.redirect(`${config.webAppUrl}/sign-in?error=google_not_configured`);
    }
    const query = z.object({
      code: z.string().min(1).optional(),
      state: z.string().min(16).optional(),
      error: z.string().optional(),
    }).parse(request.query);
    const locale = query.state?.startsWith("ru.") ? "ru" : "en";
    const signInUrl = `${config.webAppUrl}/${locale}/sign-in`;
    if (query.error || !query.code || !query.state || !sameToken(request.cookies[GOOGLE_STATE_COOKIE], query.state)) {
      return reply.redirect(`${signInUrl}?error=google_auth_failed`);
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: query.code,
        client_id: config.google.clientId,
        client_secret: config.google.clientSecret,
        redirect_uri: config.google.redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenResponse.ok) return reply.redirect(`${signInUrl}?error=google_auth_failed`);
    const tokenPayload = await tokenResponse.json() as { access_token?: string };
    if (!tokenPayload.access_token) return reply.redirect(`${signInUrl}?error=google_auth_failed`);

    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { authorization: `Bearer ${tokenPayload.access_token}` },
    });
    if (!profileResponse.ok) return reply.redirect(`${signInUrl}?error=google_auth_failed`);
    const profile = await profileResponse.json() as {
      email?: string;
      email_verified?: boolean;
      name?: string;
    };
    if (!profile.email || !profile.name) return reply.redirect(`${signInUrl}?error=google_auth_failed`);

    const result = await auth.signInWithGoogle({
      email: profile.email,
      name: profile.name,
      emailVerified: Boolean(profile.email_verified),
      locale,
    });
    reply.clearCookie(GOOGLE_STATE_COOKIE, { path: "/v1/auth/google" });
    reply.setCookie(config.sessionCookieName, result.sessionToken, sessionCookie(config));
    return reply.redirect(`${config.webAppUrl}/${locale}/dashboard`);
  });

  app.post("/v1/auth/sign-out", {
    schema: { tags: ["Authentication"], summary: "Revoke the current session" },
  }, async (request, reply) => {
    const actor = requireUser(request);
    await auth.signOut(actor.session.id);
    reply.clearCookie(config.sessionCookieName, { path: "/" });
    return reply.status(204).send();
  });

  app.get("/v1/auth/me", {
    schema: { tags: ["Authentication"], summary: "Get the current account" },
  }, async (request) => {
    const actor = requireUser(request);
    return { user: actor.user, sessionExpiresAt: actor.session.expiresAt.toISOString() };
  });

  app.post("/v1/auth/verify-email", {
    config: { rateLimit: { max: 20, timeWindow: "1 hour" } },
    schema: { tags: ["Authentication"], summary: "Consume an email verification token" },
  }, async (request, reply) => {
    await auth.verifyEmail(tokenSchema.parse(request.body).token);
    return reply.status(204).send();
  });

  app.post("/v1/auth/resend-verification", {
    config: { rateLimit: { max: 5, timeWindow: "1 hour" } },
    schema: { tags: ["Authentication"], summary: "Resend email verification without account enumeration" },
  }, async (request, reply) => {
    await auth.resendVerification(z.object({ email }).parse(request.body).email);
    return reply.status(202).send({ accepted: true });
  });

  app.post("/v1/auth/forgot-password", {
    config: { rateLimit: { max: 5, timeWindow: "1 hour" } },
    schema: { tags: ["Authentication"], summary: "Request password reset without account enumeration" },
  }, async (request, reply) => {
    await auth.requestPasswordReset(z.object({ email }).parse(request.body).email);
    return reply.status(202).send({ accepted: true });
  });

  app.post("/v1/auth/reset-password", {
    config: { rateLimit: { max: 10, timeWindow: "1 hour" } },
    schema: { tags: ["Authentication"], summary: "Consume reset token and revoke existing sessions" },
  }, async (request, reply) => {
    const body = tokenSchema.extend({ password }).parse(request.body);
    await auth.resetPassword(body.token, body.password);
    return reply.status(204).send();
  });
}

function sessionCookie(config: Pick<AppConfig, "sessionTtlSeconds" | "nodeEnv">) {
  return {
    path: "/",
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: config.nodeEnv === "production" ? "none" as const : "lax" as const,
    maxAge: config.sessionTtlSeconds,
  };
}

function sameToken(left: string | undefined, right: string): boolean {
  if (!left) return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
