import { randomUUID } from "node:crypto";
import type { MailAdapter } from "../adapters/mail.js";
import { createOpaqueToken, hashOpaqueToken } from "../auth/opaque-token.js";
import { ParticipantTokenService } from "../auth/participant-token.js";
import type { Locale, RegistrationRecord, WebinarRecord } from "../domain/models.js";
import { AppError, ServiceNotConfiguredError } from "../errors.js";
import { LiveKitTokenService } from "../livekit/token-service.js";
import type { UnitOfWork } from "../repositories/contracts.js";

export class PublicRegistrationService {
  public constructor(
    private readonly repositories: UnitOfWork,
    private readonly mail: MailAdapter,
    private readonly livekit: LiveKitTokenService,
    private readonly participants: ParticipantTokenService,
    private readonly tokenPepper: string,
    private readonly webAppUrl: string,
  ) {}

  public async publicWebinar(slug: string): Promise<WebinarRecord> {
    const webinar = await this.repositories.webinars.findPublicBySlug(slug);
    if (
      !webinar ||
      webinar.deletedAt ||
      webinar.visibility !== "PUBLIC" ||
      webinar.status === "DRAFT" ||
      webinar.status === "ARCHIVED"
    ) {
      throw new AppError(404, "NOT_FOUND", "Webinar not found");
    }
    return webinar;
  }

  public async register(input: {
    slug: string;
    email: string;
    name: string;
    locale: Locale;
    userId?: string;
  }): Promise<{ registration: RegistrationRecord; accessToken: string | null; confirmationRequired: boolean }> {
    const webinar = await this.publicWebinar(input.slug);
    if (webinar.status !== "SCHEDULED" && webinar.status !== "LIVE") {
      throw new AppError(409, "CONFLICT", "Registration is closed", { status: webinar.status });
    }
    if (webinar.requireEmailRegistration && !this.mail.configured) {
      throw new ServiceNotConfiguredError("Mail");
    }
    const normalizedEmail = input.email.trim().toLocaleLowerCase("en-US");
    if (await this.repositories.registrations.findByWebinarAndEmail(webinar.id, normalizedEmail)) {
      throw new AppError(409, "CONFLICT", "This email is already registered");
    }
    const accessToken = createOpaqueToken();
    const status = webinar.requireEmailRegistration ? "PENDING" : "CONFIRMED";
    const registration = await this.repositories.registrations.create({
      webinarId: webinar.id,
      ...(input.userId ? { userId: input.userId } : {}),
      email: normalizedEmail,
      name: input.name.trim(),
      locale: input.locale,
      status,
      tokenHash: hashOpaqueToken(accessToken, this.tokenPepper),
    });
    if (status === "PENDING") {
      await this.mail.sendWebinarRegistration({
        to: registration.email,
        name: registration.name,
        webinarTitle: webinar.title,
        locale: registration.locale,
        confirmationUrl: `${this.webAppUrl}/${registration.locale}/webinars/${encodeURIComponent(webinar.slug)}/confirm?token=${encodeURIComponent(accessToken)}`,
      });
    }
    return {
      registration,
      accessToken: status === "CONFIRMED" ? accessToken : null,
      confirmationRequired: status === "PENDING",
    };
  }

  public async confirm(token: string): Promise<{ registration: RegistrationRecord; accessToken: string }> {
    const registration = await this.repositories.registrations.confirmByTokenHash(
      hashOpaqueToken(token, this.tokenPepper),
      new Date(),
    );
    if (!registration) throw new AppError(400, "BAD_REQUEST", "Registration token is invalid");
    return { registration, accessToken: token };
  }

  public async prejoin(input: {
    slug: string;
    accessToken?: string;
    guestName?: string;
  }) {
    const webinar = await this.publicWebinar(input.slug);
    if (webinar.status !== "LIVE") {
      throw new AppError(409, "CONFLICT", "The webinar room is not open", { status: webinar.status });
    }
    const active = await this.repositories.webinars.countActiveParticipants(webinar.id);
    if (webinar.maxAttendees !== null && active >= webinar.maxAttendees) {
      throw new AppError(409, "CONFLICT", "The webinar is at capacity", { reason: "ROOM_FULL" });
    }

    let subject: string;
    let displayName: string;
    let role: "ATTENDEE" | "GUEST";
    if (input.accessToken) {
      const registration = await this.repositories.registrations.findByTokenHash(
        hashOpaqueToken(input.accessToken, this.tokenPepper),
      );
      if (!registration || registration.webinarId !== webinar.id || registration.status !== "CONFIRMED") {
        throw new AppError(401, "UNAUTHENTICATED", "Registration token is invalid");
      }
      subject = `registration:${registration.id}`;
      displayName = registration.name;
      role = "ATTENDEE";
    } else {
      if (!webinar.allowGuests) throw new AppError(401, "UNAUTHENTICATED", "Registration is required");
      const guestName = input.guestName?.trim();
      if (!guestName) throw new AppError(400, "BAD_REQUEST", "Guest name is required");
      subject = `guest:${randomUUID()}`;
      displayName = guestName;
      role = "GUEST";
    }
    const identity = `${subject}:${randomUUID()}`;
    const media = await this.livekit.issue({
      webinar,
      identity,
      displayName,
      role,
      metadata: { subject },
    });
    return {
      webinarId: webinar.id,
      media,
      realtimeToken: this.participants.issue({ subject, webinarId: webinar.id, role, name: displayName }),
      participant: { identity, displayName, role },
    };
  }
}
