import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { getLocaleFromUrl } from "./utils";

/**
 * Property 15: Default language fallback
 * **Validates: Requirements 11.2, 11.7**
 *
 * For any URL without a language prefix, the system SHALL serve content
 * in Bahasa Indonesia (the default language).
 */
describe("Property 15: Default language fallback", () => {
  const baseUrl = "https://infotour.id";

  // Generator for path segments that are NOT "en"
  const segmentCharArb = fc.constantFrom(
    ..."abcdfghijklmnopqrstuvwxyz0123456789-_".split("")
  );
  const nonEnSegmentArb = fc
    .array(segmentCharArb, { minLength: 1, maxLength: 20 })
    .map((chars) => chars.join(""))
    .filter((s) => s !== "en");

  // Generator for URL paths that do NOT start with /en/ or equal /en
  const nonEnPathArb = fc
    .array(nonEnSegmentArb, { minLength: 0, maxLength: 5 })
    .map((segments) => {
      if (segments.length === 0) return "/";
      return "/" + segments.join("/");
    })
    .filter((path) => path !== "/en" && !path.startsWith("/en/"));

  // Generator for URL paths that DO start with /en/ or equal /en
  const enPathArb = fc
    .array(nonEnSegmentArb, { minLength: 0, maxLength: 5 })
    .map((segments) => {
      if (segments.length === 0) return "/en";
      return "/en/" + segments.join("/");
    });

  it("returns 'id' for any URL path without /en prefix", () => {
    fc.assert(
      fc.property(nonEnPathArb, (path) => {
        const url = new URL(path, baseUrl);
        const locale = getLocaleFromUrl(url);
        expect(locale).toBe("id");
      }),
      { numRuns: 200 }
    );
  });

  it("returns 'en' for any URL path starting with /en/ or equal to /en", () => {
    fc.assert(
      fc.property(enPathArb, (path) => {
        const url = new URL(path, baseUrl);
        const locale = getLocaleFromUrl(url);
        expect(locale).toBe("en");
      }),
      { numRuns: 200 }
    );
  });
});
