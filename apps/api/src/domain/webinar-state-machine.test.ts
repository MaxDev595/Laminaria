import { describe, expect, it } from "vitest";
import { AppError } from "../errors.js";
import {
  allowedWebinarTransitions,
  assertWebinarEditable,
  assertWebinarTransition,
  canTransitionWebinar,
} from "./webinar-state-machine.js";

describe("webinar state machine", () => {
  it("allows the canonical lifecycle", () => {
    expect(canTransitionWebinar("DRAFT", "SCHEDULED")).toBe(true);
    expect(canTransitionWebinar("SCHEDULED", "LIVE")).toBe(true);
    expect(canTransitionWebinar("LIVE", "ENDED")).toBe(true);
    expect(canTransitionWebinar("ENDED", "ARCHIVED")).toBe(true);
  });

  it("never restarts ended or archived webinars", () => {
    expect(canTransitionWebinar("ENDED", "LIVE")).toBe(false);
    expect(canTransitionWebinar("ARCHIVED", "LIVE")).toBe(false);
    expect(() => assertWebinarTransition("ENDED", "LIVE")).toThrow(AppError);
    expect(allowedWebinarTransitions("ARCHIVED")).toEqual([]);
  });

  it("only permits free editing while draft", () => {
    expect(() => assertWebinarEditable("DRAFT")).not.toThrow();
    expect(() => assertWebinarEditable("SCHEDULED")).toThrowError(
      expect.objectContaining({ code: "CONFLICT" }),
    );
  });
});
