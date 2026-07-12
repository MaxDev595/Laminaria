import { randomBytes, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import type { AppConfig } from "../config.js";
import { AppError } from "../errors.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function equalTokens(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function headerToken(request: FastifyRequest): string | null {
  const value = request.headers["x-csrf-token"];
  return typeof value === "string" ? value : null;
}

function looksLikeIssuedToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{32,128}$/.test(value);
}

export function csrfPlugin(config: Pick<AppConfig, "csrfCookieName" | "nodeEnv">) {
  return fp(async (app: FastifyInstance) => {
    app.get("/v1/auth/csrf", {
      schema: {
        tags: ["Authentication"],
        summary: "Issue a CSRF double-submit token",
        response: { 200: { type: "object", properties: { csrfToken: { type: "string" } } } },
      },
    }, async (_request, reply) => {
      const token = randomBytes(32).toString("base64url");
      reply.setCookie(config.csrfCookieName, token, {
        path: "/",
        httpOnly: false,
        secure: config.nodeEnv === "production",
        sameSite: config.nodeEnv === "production" ? "none" : "lax",
        maxAge: 60 * 60,
      });
      return { csrfToken: token };
    });

    app.addHook("onRequest", async (request) => {
      if (SAFE_METHODS.has(request.method)) return;
      if (request.url.startsWith("/v1/webhooks/")) return;
      const cookie = request.cookies[config.csrfCookieName];
      const header = headerToken(request);
      if (!header) {
        throw new AppError(403, "FORBIDDEN", "CSRF token is missing or invalid");
      }
      if (cookie && !equalTokens(cookie, header)) {
        throw new AppError(403, "FORBIDDEN", "CSRF token is missing or invalid");
      }
      if (!cookie && !looksLikeIssuedToken(header)) {
        throw new AppError(403, "FORBIDDEN", "CSRF token is missing or invalid");
      }
    });
  }, { name: "laminaria-csrf", dependencies: ["@fastify/cookie"] });
}
