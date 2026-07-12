import { describe, expect, it } from "vitest";
import { slugify } from "./text";

describe("slugify", () => {
  it("creates a safe public route segment", () => {
    expect(slugify("  Product Briefing: Q3  ")).toBe("product-briefing-q3");
  });

  it("never leaves separators at route edges", () => {
    expect(slugify("---Calm room---")).toBe("calm-room");
  });
});
