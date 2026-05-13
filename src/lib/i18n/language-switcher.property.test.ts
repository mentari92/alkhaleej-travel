import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { getAlternateUrl, getLocaleFromUrl } from "./utils";

/**
 * Property 14: Language switcher navigation
 * **Validates: Requirements 11.3, 11.4**
 *
 * For any public page in locale L, the Language_Switcher SHALL render a link
 * to the equivalent page in the alternate locale, preserving the current page
 * context (same destination or article).
 */
describe("Property 14: Language switcher navigation", () => {
  const BASE = "https://infotour.id";

  // Generator for URL path segments (slugs): lowercase alphanumeric + hyphens
  const slugArb = fc
    .array(
      fc.constantFrom(
        "a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p",
        "q","r","s","t","u","v","w","x","y","z","0","1","2","3","4","5",
        "6","7","8","9","-"
      ),
      { minLength: 1, maxLength: 20 }
    )
    .map((chars) => chars.join(""))
    .filter((s) => !s.startsWith("-") && !s.endsWith("-") && !s.includes("--") && s.length > 0);

  // Generator for page type prefixes (destinations, blog, or root-level pages)
  const pageTypeArb = fc.constantFrom("destinations", "blog", "about", "contact");

  // Generator for ID locale paths (no /en prefix)
  const idPathArb = fc.oneof(
    // Root path
    fc.constant("/"),
    // Section path: /{pageType}/{slug}
    fc.tuple(pageTypeArb, slugArb).map(([type, slug]) => `/${type}/${slug}`),
    // Section index: /{pageType}
    pageTypeArb.map((type) => `/${type}`)
  );

  // Generator for EN locale paths (with /en prefix)
  const enPathArb = fc.oneof(
    // EN root
    fc.constant("/en"),
    // EN section path: /en/{pageType}/{slug}
    fc.tuple(pageTypeArb, slugArb).map(([type, slug]) => `/en/${type}/${slug}`),
    // EN section index: /en/{pageType}
    pageTypeArb.map((type) => `/en/${type}`)
  );

  it("ID locale paths produce EN equivalent with /en prefix", () => {
    fc.assert(
      fc.property(idPathArb, (path) => {
        const url = new URL(path, BASE);
        const alternate = getAlternateUrl(url, "en");
        if (path === "/") {
          expect(alternate).toBe("/en");
        } else {
          expect(alternate).toBe(`/en${path}`);
        }
      })
    );
  });

  it("EN locale paths produce ID equivalent without /en prefix", () => {
    fc.assert(
      fc.property(enPathArb, (path) => {
        const url = new URL(path, BASE);
        const alternate = getAlternateUrl(url, "id");
        if (path === "/en") {
          expect(alternate).toBe("/");
        } else {
          // Remove /en prefix to get the expected ID path
          const expectedIdPath = path.replace(/^\/en/, "");
          expect(alternate).toBe(expectedIdPath);
        }
      })
    );
  });

  it("path slug is preserved across language switches (ID → EN)", () => {
    fc.assert(
      fc.property(
        fc.tuple(pageTypeArb, slugArb),
        ([pageType, slug]) => {
          const idPath = `/${pageType}/${slug}`;
          const url = new URL(idPath, BASE);
          const enAlternate = getAlternateUrl(url, "en");
          // The slug portion must be preserved in the EN URL
          expect(enAlternate).toContain(`/${pageType}/${slug}`);
        }
      )
    );
  });

  it("path slug is preserved across language switches (EN → ID)", () => {
    fc.assert(
      fc.property(
        fc.tuple(pageTypeArb, slugArb),
        ([pageType, slug]) => {
          const enPath = `/en/${pageType}/${slug}`;
          const url = new URL(enPath, BASE);
          const idAlternate = getAlternateUrl(url, "id");
          // The slug portion must be preserved in the ID URL
          expect(idAlternate).toBe(`/${pageType}/${slug}`);
        }
      )
    );
  });

  it("round-trip: switching ID → EN → ID returns the original path", () => {
    fc.assert(
      fc.property(idPathArb, (originalPath) => {
        const originalUrl = new URL(originalPath, BASE);
        // Switch to EN
        const enPath = getAlternateUrl(originalUrl, "en");
        // Switch back to ID
        const enUrl = new URL(enPath, BASE);
        const roundTrippedPath = getAlternateUrl(enUrl, "id");
        expect(roundTrippedPath).toBe(originalPath);
      })
    );
  });

  it("round-trip: switching EN → ID → EN returns the original path", () => {
    fc.assert(
      fc.property(enPathArb, (originalPath) => {
        const originalUrl = new URL(originalPath, BASE);
        // Switch to ID
        const idPath = getAlternateUrl(originalUrl, "id");
        // Switch back to EN
        const idUrl = new URL(idPath, BASE);
        const roundTrippedPath = getAlternateUrl(idUrl, "en");
        expect(roundTrippedPath).toBe(originalPath);
      })
    );
  });

  it("alternate URL always targets the opposite locale", () => {
    fc.assert(
      fc.property(
        fc.oneof(idPathArb, enPathArb),
        (path) => {
          const url = new URL(path, BASE);
          const currentLocale = getLocaleFromUrl(url);
          const targetLocale = currentLocale === "id" ? "en" : "id";
          const alternate = getAlternateUrl(url, targetLocale);
          const alternateUrl = new URL(alternate, BASE);
          const alternateLocale = getLocaleFromUrl(alternateUrl);
          expect(alternateLocale).toBe(targetLocale);
        }
      )
    );
  });
});
