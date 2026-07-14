import { describe, expect, it } from "vitest";
import { canTransitionWebinar, createWebinarRequestSchema, hasPermission, liveKitGrantForRole } from "../src/index.js";

describe("webinar state machine", () => {
  it("allows the happy path and keeps terminal states terminal", () => {
    expect(canTransitionWebinar("DRAFT", "SCHEDULED")).toBe(true);
    expect(canTransitionWebinar("SCHEDULED", "LIVE")).toBe(true);
    expect(canTransitionWebinar("LIVE", "ENDED")).toBe(true);
    expect(canTransitionWebinar("ENDED", "LIVE")).toBe(false);
    expect(canTransitionWebinar("ARCHIVED", "DRAFT")).toBe(false);
  });
});

describe("RBAC", () => {
  it("never grants attendee publishing permissions", () => {
    expect(hasPermission({ webinarRole: "ATTENDEE" }, "media.publish.audio")).toBe(false);
    expect(hasPermission({ webinarRole: "ATTENDEE" }, "chat.send")).toBe(false);
    expect(hasPermission({ webinarRole: "MODERATOR" }, "chat.send")).toBe(true);
    expect(liveKitGrantForRole("ATTENDEE").canPublish).toBe(false);
    expect(liveKitGrantForRole("SPEAKER").canPublish).toBe(true);
  });
});

describe("webinar validation", () => {
  it("requires a password for password-protected access", () => {
    const result = createWebinarRequestSchema.safeParse({
      workspaceId: "e83da10e-629d-4c7f-a54b-50ff342b19d6",
      slug: "weekly-demo",
      title: "Weekly demo",
      language: "EN",
      timezone: "UTC",
      access: "PASSWORD_PROTECTED",
    });
    expect(result.success).toBe(false);
  });
});
