import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { normalizePlainText } from "../security/text.js";
import { PublicRegistrationService } from "../webinars/public-registration-service.js";

const slugParams = z.object({ slug: z.string().min(1).max(100) });
const registerSchema = z.object({
  email: z.email().max(320),
  name: z.string().min(1).max(100).transform((value) => normalizePlainText(value, 100)),
  locale: z.enum(["en", "ru"]).default("en"),
});
const confirmSchema = z.object({ token: z.string().min(32).max(256) });
const prejoinSchema = z.object({
  accessToken: z.string().min(32).max(256).optional(),
  guestName: z.string().min(1).max(100).optional(),
});

export async function registerPublicRoutes(app: FastifyInstance, service: PublicRegistrationService): Promise<void> {
  app.get<{ Params: { slug: string } }>("/v1/public/webinars/:slug", {
    schema: { tags: ["Public webinars"], summary: "Get a public registration page payload" },
  }, async (request) => {
    const { slug } = slugParams.parse(request.params);
    const webinar = await service.publicWebinar(slug);
    return { webinar: publicProjection(webinar) };
  });

  app.post<{ Params: { slug: string } }>("/v1/public/webinars/:slug/registrations", {
    config: { rateLimit: { max: 10, timeWindow: "1 hour" } },
    schema: { tags: ["Public webinars"], summary: "Register an attendee" },
  }, async (request, reply) => {
    const { slug } = slugParams.parse(request.params);
    const result = await service.register({ slug, ...registerSchema.parse(request.body) });
    return reply.status(201).send(result);
  });

  app.post("/v1/public/registrations/confirm", {
    config: { rateLimit: { max: 20, timeWindow: "1 hour" } },
    schema: { tags: ["Public webinars"], summary: "Confirm an attendee email" },
  }, async (request) => service.confirm(confirmSchema.parse(request.body).token));

  app.post<{ Params: { slug: string } }>("/v1/public/webinars/:slug/prejoin", {
    config: { rateLimit: { max: 30, timeWindow: "5 minutes" } },
    schema: { tags: ["Public webinars"], summary: "Issue short-lived LiveKit and realtime credentials" },
  }, async (request) => {
    const { slug } = slugParams.parse(request.params);
    const body = prejoinSchema.parse(request.body);
    return service.prejoin({
      slug,
      ...(body.accessToken !== undefined ? { accessToken: body.accessToken } : {}),
      ...(body.guestName !== undefined ? { guestName: body.guestName } : {}),
    });
  });
}

function publicProjection(webinar: Awaited<ReturnType<PublicRegistrationService["publicWebinar"]>>) {
  return {
    slug: webinar.slug,
    title: webinar.title,
    description: webinar.description,
    status: webinar.status,
    scheduledStartAt: webinar.scheduledStartAt,
    timezone: webinar.timezone,
    language: webinar.language,
    visibility: webinar.visibility,
    allowGuests: webinar.allowGuests,
    requireEmailRegistration: webinar.requireEmailRegistration,
  };
}
