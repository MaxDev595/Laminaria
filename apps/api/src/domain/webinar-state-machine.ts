import { AppError } from "../errors.js";
import type { WebinarStatus } from "./models.js";

const transitions: Readonly<Record<WebinarStatus, readonly WebinarStatus[]>> = {
  DRAFT: ["SCHEDULED", "CANCELLED", "ARCHIVED"],
  SCHEDULED: ["DRAFT", "LIVE", "CANCELLED", "ARCHIVED"],
  LIVE: ["ENDED", "CANCELLED"],
  ENDED: ["ARCHIVED"],
  CANCELLED: ["ARCHIVED"],
  ARCHIVED: [],
};

export function allowedWebinarTransitions(status: WebinarStatus): readonly WebinarStatus[] {
  return transitions[status];
}

export function canTransitionWebinar(from: WebinarStatus, to: WebinarStatus): boolean {
  return transitions[from].includes(to);
}

export function assertWebinarTransition(from: WebinarStatus, to: WebinarStatus): void {
  if (!canTransitionWebinar(from, to)) {
    throw new AppError(409, "CONFLICT", `Webinar cannot transition from ${from} to ${to}`, {
      from,
      to,
      allowed: transitions[from],
    });
  }
}

export function assertWebinarEditable(status: WebinarStatus): void {
  if (status !== "DRAFT") {
    throw new AppError(409, "CONFLICT", "Only draft webinars can be freely edited", { status });
  }
}
