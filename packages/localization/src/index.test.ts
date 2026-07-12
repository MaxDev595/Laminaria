import { describe, expect, it } from "vitest";
import { en, resolveLocale, ru } from "./index.js";

function paths(value: object, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof child === "object" && child !== null ? paths(child, path) : [path];
  });
}

describe("localization catalogs", () => {
  it("keeps English and Russian keys in lockstep", () => {
    expect(paths(ru)).toEqual(paths(en));
  });

  it("resolves supported regional locales", () => {
    expect(resolveLocale("ru-KZ")).toBe("ru");
    expect(resolveLocale("en-US")).toBe("en");
    expect(resolveLocale("de-DE")).toBe("en");
  });
});
