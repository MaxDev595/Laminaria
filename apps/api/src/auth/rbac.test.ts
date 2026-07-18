import { describe, expect, it } from "vitest";
import { assertWebinarPermission, hasWebinarPermission, hasWorkspacePermission } from "./rbac.js";

describe("RBAC", () => {
  it("keeps workspace billing owner-only", () => {
    expect(hasWorkspacePermission("OWNER", "billing:manage")).toBe(true);
    expect(hasWorkspacePermission("ADMIN", "billing:manage")).toBe(false);
    expect(hasWorkspacePermission("MEMBER", "billing:manage")).toBe(false);
  });

  it("never grants attendee or guest media publication", () => {
    expect(hasWebinarPermission("ATTENDEE", "webinar:publish_media")).toBe(false);
    expect(hasWebinarPermission("GUEST", "webinar:publish_media")).toBe(false);
    expect(() => assertWebinarPermission("ATTENDEE", "webinar:publish_media")).toThrowError(
      expect.objectContaining({ code: "FORBIDDEN" }),
    );
  });

  it("keeps viewer chat closed unless a privileged role sends", () => {
    expect(hasWebinarPermission("ATTENDEE", "chat:write")).toBe(false);
    expect(hasWebinarPermission("GUEST", "chat:write")).toBe(false);
    expect(hasWebinarPermission("MODERATOR", "chat:write")).toBe(true);
    expect(hasWebinarPermission("HOST", "chat:write")).toBe(true);
  });

  it("lets moderators moderate without publishing media", () => {
    expect(hasWebinarPermission("MODERATOR", "webinar:moderate")).toBe(true);
    expect(hasWebinarPermission("MODERATOR", "webinar:publish_media")).toBe(false);
  });

  it("lets speakers publish but not manage the stage", () => {
    expect(hasWebinarPermission("SPEAKER", "webinar:publish_media")).toBe(true);
    expect(hasWebinarPermission("SPEAKER", "webinar:manage_stage")).toBe(false);
  });
});
