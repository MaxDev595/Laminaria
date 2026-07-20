import { randomUUID } from "node:crypto";
import type { Locale, WebinarRecord, WebinarStatus } from "../domain/models.js";
import { assertWebinarEditable, assertWebinarTransition } from "../domain/webinar-state-machine.js";
import { AppError } from "../errors.js";
import type { WebinarRepository } from "../repositories/contracts.js";

export interface CreateWebinarInput {
  workspaceId: string;
  createdById: string;
  slug: string;
  title: string;
  description: string;
  coverImageUrl: string | null;
  scheduledStartAt: Date | null;
  timezone: string;
  language: Locale;
  visibility: "PUBLIC" | "PRIVATE";
  allowGuests: boolean;
  requireEmailRegistration: boolean;
  maxAttendees: number | null;
  recordingEnabled: boolean;
}

export type UpdateWebinarInput = Partial<
  Omit<CreateWebinarInput, "workspaceId" | "createdById" | "slug">
> & { version: number };

export class WebinarService {
  public constructor(private readonly webinars: WebinarRepository) {}

  public async create(input: CreateWebinarInput): Promise<WebinarRecord> {
    validateTimezone(input.timezone);
    if (input.scheduledStartAt && !Number.isFinite(input.scheduledStartAt.getTime())) {
      throw new AppError(400, "BAD_REQUEST", "scheduledStartAt must be a valid ISO timestamp");
    }
    return this.webinars.create({
      ...input,
      livekitRoomName: `webinar_${randomUUID()}`,
      status: "DRAFT",
      startedAt: null,
      endedAt: null,
    });
  }

  public async update(id: string, input: UpdateWebinarInput): Promise<WebinarRecord> {
    const current = await this.find(id);
    assertWebinarEditable(current.status);
    if (input.timezone) validateTimezone(input.timezone);
    const { version, ...patch } = input;
    const updated = await this.webinars.updateDraft(id, version, patch);
    if (!updated) {
      throw new AppError(409, "CONFLICT", "Webinar was changed by another request", {
        reason: "STALE_VERSION",
      });
    }
    return updated;
  }

  public async transition(
    id: string,
    target: WebinarStatus,
    version: number,
  ): Promise<WebinarRecord> {
    const current = await this.find(id);
    assertWebinarTransition(current.status, target);
    if (target === "SCHEDULED" && !current.scheduledStartAt) {
      throw new AppError(409, "CONFLICT", "A start time is required before scheduling");
    }
    const updated = await this.webinars.transition(id, version, current.status, target);
    if (!updated) {
      throw new AppError(
        409,
        "CONFLICT",
        "Webinar state changed before this transition completed",
        {
          reason: "STALE_VERSION",
        },
      );
    }
    return updated;
  }

  public async find(id: string): Promise<WebinarRecord> {
    const webinar = await this.webinars.findById(id);
    if (!webinar || webinar.deletedAt) throw new AppError(404, "NOT_FOUND", "Webinar not found");
    return webinar;
  }
}

function validateTimezone(timezone: string): void {
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
  } catch {
    throw new AppError(400, "BAD_REQUEST", "Unknown IANA timezone");
  }
}
