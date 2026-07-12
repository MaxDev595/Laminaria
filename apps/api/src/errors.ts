import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "SERVICE_NOT_CONFIGURED"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  public constructor(
    public readonly statusCode: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ServiceNotConfiguredError extends AppError {
  public constructor(service: string) {
    super(503, "SERVICE_NOT_CONFIGURED", `${service} is not configured`);
  }
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) => {
    return sendError(reply, request, new AppError(404, "NOT_FOUND", "Route not found"));
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return sendError(
        reply,
        request,
        new AppError(400, "BAD_REQUEST", "Request validation failed", error.issues),
      );
    }
    if (error instanceof AppError) {
      return sendError(reply, request, error);
    }
    if (typeof error === "object" && error !== null && "statusCode" in error) {
      const statusCode = Number(error.statusCode);
      if (statusCode === 429) {
        return sendError(reply, request, new AppError(429, "RATE_LIMITED", "Too many requests"));
      }
    }

    request.log.error({ err: error }, "Unhandled request error");
    return sendError(reply, request, new AppError(500, "INTERNAL_ERROR", "Internal server error"));
  });
}

function sendError(reply: FastifyReply, request: FastifyRequest, error: AppError) {
  return reply.status(error.statusCode).send({
    error: {
      code: error.code,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details }),
      requestId: request.id,
    },
  });
}
