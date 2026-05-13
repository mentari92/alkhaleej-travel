import { describe, it, expect } from "vitest";
import { t, getLocaleFromUrl, getAlternateUrl } from "./utils";
import type { LocalizedString } from "./config";

describe("t()", () => {
  const sample: LocalizedString = { id: "Halo", en: "Hello" };

  it("returns Bahasa Indonesia string for locale 'id'", () => {
    expect(t(sample, "id")).toBe("Halo");
  });

  it("returns English string for locale 'en'", () => {
    expect(t(sample, "en")).toBe("Hello");
  });
});

describe("getLocaleFromUrl()", () => {
  it("returns 'id' for root path /", () => {
    const url = new URL("https://infotour.id/");
    expect(getLocaleFromUrl(url)).toBe("id");
  });

  it("returns 'id' for paths without /en prefix", () => {
    const url = new URL("https://infotour.id/destinations/bali");
    expect(getLocaleFromUrl(url)).toBe("id");
  });

  it("returns 'en' for /en path", () => {
    const url = new URL("https://infotour.id/en");
    expect(getLocaleFromUrl(url)).toBe("en");
  });

  it("returns 'en' for paths starting with /en/", () => {
    const url = new URL("https://infotour.id/en/destinations/bali");
    expect(getLocaleFromUrl(url)).toBe("en");
  });

  it("returns 'id' for paths that contain 'en' but not as prefix", () => {
    const url = new URL("https://infotour.id/destinations/enchanted-forest");
    expect(getLocaleFromUrl(url)).toBe("id");
  });
});

describe("getAlternateUrl()", () => {
  it("converts root / to /en for English target", () => {
    const url = new URL("https://infotour.id/");
    expect(getAlternateUrl(url, "en")).toBe("/en");
  });

  it("converts /en to / for Indonesian target", () => {
    const url = new URL("https://infotour.id/en");
    expect(getAlternateUrl(url, "id")).toBe("/");
  });

  it("adds /en prefix to ID destination path", () => {
    const url = new URL("https://infotour.id/destinations/bali");
    expect(getAlternateUrl(url, "en")).toBe("/en/destinations/bali");
  });

  it("removes /en prefix from EN destination path", () => {
    const url = new URL("https://infotour.id/en/destinations/bali");
    expect(getAlternateUrl(url, "id")).toBe("/destinations/bali");
  });

  it("returns same path when target locale matches current locale", () => {
    const url = new URL("https://infotour.id/destinations/bali");
    expect(getAlternateUrl(url, "id")).toBe("/destinations/bali");
  });

  it("handles /en/ (with trailing slash) to ID", () => {
    const url = new URL("https://infotour.id/en/");
    expect(getAlternateUrl(url, "id")).toBe("/");
  });

  it("handles blog paths correctly", () => {
    const url = new URL("https://infotour.id/blog/my-article");
    expect(getAlternateUrl(url, "en")).toBe("/en/blog/my-article");
  });

  it("handles EN blog paths correctly", () => {
    const url = new URL("https://infotour.id/en/blog/my-article");
    expect(getAlternateUrl(url, "id")).toBe("/blog/my-article");
  });
});
