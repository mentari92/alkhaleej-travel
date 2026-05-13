import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { generateSlug } from "./slug";

/**
 * Property 8: Blog URL slug generation
 * **Validates: Requirements 6.5**
 *
 * For any blog article title, the generated slug SHALL be lowercase, contain
 * only alphanumeric characters and hyphens, not start or end with a hyphen,
 * and not contain consecutive hyphens.
 */
describe("Property 8: Blog URL slug generation", () => {
  // Generator for arbitrary non-empty strings as titles
  const titleArb = fc.string({ minLength: 1, maxLength: 200 });

  // Generator for titles that contain at least one alphanumeric character
  const titleWithAlphanumArb = fc
    .tuple(
      fc.string({ minLength: 0, maxLength: 50 }),
      fc.stringMatching(/[a-zA-Z0-9]{1,10}/),
      fc.string({ minLength: 0, maxLength: 50 })
    )
    .map(([prefix, alphanum, suffix]) => prefix + alphanum + suffix);

  it("slug is lowercase (no uppercase characters)", () => {
    fc.assert(
      fc.property(titleArb, (title) => {
        const slug = generateSlug(title);
        expect(slug).toBe(slug.toLowerCase());
      })
    );
  });

  it("slug contains only [a-z0-9-] characters", () => {
    fc.assert(
      fc.property(titleArb, (title) => {
        const slug = generateSlug(title);
        expect(slug).toMatch(/^[a-z0-9-]*$/);
      })
    );
  });

  it("slug does not start with a hyphen", () => {
    fc.assert(
      fc.property(titleArb, (title) => {
        const slug = generateSlug(title);
        if (slug.length > 0) {
          expect(slug[0]).not.toBe("-");
        }
      })
    );
  });

  it("slug does not end with a hyphen", () => {
    fc.assert(
      fc.property(titleArb, (title) => {
        const slug = generateSlug(title);
        if (slug.length > 0) {
          expect(slug[slug.length - 1]).not.toBe("-");
        }
      })
    );
  });

  it("slug does not contain consecutive hyphens", () => {
    fc.assert(
      fc.property(titleArb, (title) => {
        const slug = generateSlug(title);
        expect(slug).not.toContain("--");
      })
    );
  });

  it("slug is non-empty for titles containing at least one alphanumeric character", () => {
    fc.assert(
      fc.property(titleWithAlphanumArb, (title) => {
        const slug = generateSlug(title);
        expect(slug.length).toBeGreaterThan(0);
      })
    );
  });
});
