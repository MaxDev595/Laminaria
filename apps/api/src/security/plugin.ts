import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import type { AppConfig } from "../config.js";
import { csrfPlugin } from "./csrf.js";

export function securityPlugin(config: AppConfig) {
  return fp(async (app: FastifyInstance) => {
    await app.register(cookie);
    await app.register(cors, {
      credentials: true,
      methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["content-type", "x-csrf-token", "x-idempotency-key", "authorization"],
      origin(origin, callback) {
        if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
        return callback(new Error("Origin is not allowed"), false);
      },
    });
    await app.register(helmet, {
      global: true,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: "same-site" },
      referrerPolicy: { policy: "no-referrer" },
    });
    await app.register(rateLimit, {
      global: true,
      max: 300,
      timeWindow: "1 minute",
      ban: 3,
      allowList: (request) => request.url === "/health/live",
    });
    await app.register(csrfPlugin(config));
  }, { name: "laminaria-security" });
}
