import type { FastifyInstance } from "fastify";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { z } from "zod";

import { requireUser } from "../auth/plugin.js";
import type { AppConfig } from "../config.js";
import { AppError, ServiceNotConfiguredError } from "../errors.js";

const uploadSchema = z.object({
  kind: z.enum(["avatar", "workspace-logo"]),
  dataUrl: z.string().max(3_000_000),
});

const MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export async function registerUploadRoutes(
  app: FastifyInstance,
  storage: AppConfig["storage"],
): Promise<void> {
  app.post(
    "/v1/uploads/images",
    {
      config: { rateLimit: { max: 30, timeWindow: "1 hour" } },
      schema: { tags: ["Uploads"], summary: "Upload a profile or workspace image" },
    },
    async (request, reply) => {
      const actor = requireUser(request);
      if (!storage?.publicUrl) throw new ServiceNotConfiguredError("Public object storage");
      const body = uploadSchema.parse(request.body);
      const match = /^data:(image\/(?:jpeg|png|webp));base64,([a-zA-Z0-9+/=]+)$/.exec(body.dataUrl);
      if (!match) throw new AppError(400, "BAD_REQUEST", "Use a JPEG, PNG or WebP image");
      const contentType = match[1] as keyof typeof MIME_EXTENSIONS;
      const bytes = Buffer.from(match[2] ?? "", "base64");
      if (bytes.length === 0 || bytes.length > 2 * 1024 * 1024) {
        throw new AppError(400, "BAD_REQUEST", "Image must be smaller than 2 MB");
      }
      const key = `images/${actor.user.id}/${body.kind}/${randomUUID()}.${MIME_EXTENSIONS[contentType]}`;
      await putR2Object(storage, key, bytes, contentType);
      return reply.status(201).send({
        url: `${storage.publicUrl.replace(/\/$/, "")}/${key.split("/").map(encodeURIComponent).join("/")}`,
      });
    },
  );
}

async function putR2Object(
  storage: NonNullable<AppConfig["storage"]>,
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const endpoint = new URL(storage.endpoint);
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  const url = new URL(`${endpoint.toString().replace(/\/$/, "")}/${encodeURIComponent(storage.bucket)}/${encodedKey}`);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const shortDate = amzDate.slice(0, 8);
  const payloadHash = sha256(body);
  const canonicalHeaders = `host:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    "PUT",
    url.pathname,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const scope = `${shortDate}/${storage.region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonicalRequest)].join("\n");
  const dateKey = hmac(`AWS4${storage.secretAccessKey}`, shortDate);
  const regionKey = hmac(dateKey, storage.region);
  const serviceKey = hmac(regionKey, "s3");
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = hmac(signingKey, stringToSign).toString("hex");
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      authorization: `AWS4-HMAC-SHA256 Credential=${storage.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      "content-type": contentType,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    },
    body,
  });
  if (!response.ok) {
    throw new AppError(502, "INTERNAL_ERROR", "Object storage rejected the image upload");
  }
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: string | Buffer, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}
