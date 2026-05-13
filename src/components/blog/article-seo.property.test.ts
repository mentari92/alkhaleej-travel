import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import type { BlogArticle } from "../../lib/types";
import type { Locale } from "../../lib/i18n/config";
import { generateMetaTags } from "../../lib/seo/meta";

/**
 * Property 10: Article SEO metadata with hreflang
 * **Validates: Requirements 7.3, 11.6**
 *
 * For any published blog article that has a paired translation, the rendered
 * article page SHALL include hreflang link elements pointing to the paired
 * article URL in the alternate language.
 */

// --- Generators ---

const localeArb: fc.Arbitrary<Locale> = fc.constantFrom("id" as Locale, "en" as Locale);

const slugArb = fc
  .array(
    fc.stringMatching(/^[a-z0-9]+$/),
    { minLength: 1, maxLength: 5 }
  )
  .map((parts) => parts.join("-"))
  .filter((s) => s.length > 0 && s.length <= 60);

/** Generates a BlogArticle WITH a pairedArticleId (non-null) */
const pairedBlogArticleArb: fc.Arbitrary<BlogArticle> = fc
  .record({
    id: fc.uuid(),
    slug: slugArb,
    title: fc.string({ minLength: 1, maxLength: 100 }),
    excerpt: fc.string({ minLength: 1, maxLength: 200 }),
    content: fc.string({ minLength: 1, maxLength: 500 }),
    language: localeArb,
    thumbnailUrl: fc.webUrl(),
    metaDescription: fc.string({ minLength: 1, maxLength: 160 }),
    ogImage: fc.webUrl(),
    relatedDestinationIds: fc.array(fc.uuid(), { minLength: 0, maxLength: 3 }),
    pairedArticleId: fc.uuid(),
    status: fc.constant("published" as const),
    publishedAt: fc.constant("2024-06-01T00:00:00Z"),
    createdAt: fc.constant("2024-01-01T00:00:00Z"),
    updatedAt: fc.constant("2024-06-01T00:00:00Z"),
  });

/** Generates a BlogArticle WITHOUT a pairedArticleId (null) */
const unpairedBlogArticleArb: fc.Arbitrary<BlogArticle> = fc
  .record({
    id: fc.uuid(),
    slug: slugArb,
    title: fc.string({ minLength: 1, maxLength: 100 }),
    excerpt: fc.string({ minLength: 1, maxLength: 200 }),
    content: fc.string({ minLength: 1, maxLength: 500 }),
    language: localeArb,
    thumbnailUrl: fc.webUrl(),
    metaDescription: fc.string({ minLength: 1, maxLength: 160 }),
    ogImage: fc.webUrl(),
    relatedDestinationIds: fc.array(fc.uuid(), { minLength: 0, maxLength: 3 }),
    pairedArticleId: fc.constant(null),
    status: fc.constant("published" as const),
    publishedAt: fc.constant("2024-06-01T00:00:00Z"),
    createdAt: fc.constant("2024-01-01T00:00:00Z"),
    updatedAt: fc.constant("2024-06-01T00:00:00Z"),
  });

// --- Property Tests ---

describe("Property 10: Article SEO metadata with hreflang", () => {
  it("paired article produces exactly 2 hreflang entries (self + alternate)", () => {
    fc.assert(
      fc.property(pairedBlogArticleArb, localeArb, (article, locale) => {
        const meta = generateMetaTags(article, locale);
        expect(meta.hreflang).toHaveLength(2);
      })
    );
  });

  it("paired article hreflang includes self locale entry", () => {
    fc.assert(
      fc.property(pairedBlogArticleArb, localeArb, (article, locale) => {
        const meta = generateMetaTags(article, locale);
        const selfEntry = meta.hreflang.find((h) => h.locale === locale);
        expect(selfEntry).toBeDefined();
      })
    );
  });

  it("paired article hreflang includes alternate locale entry", () => {
    fc.assert(
      fc.property(pairedBlogArticleArb, localeArb, (article, locale) => {
        const meta = generateMetaTags(article, locale);
        const alternateLocale: Locale = locale === "id" ? "en" : "id";
        const alternateEntry = meta.hreflang.find((h) => h.locale === alternateLocale);
        expect(alternateEntry).toBeDefined();
      })
    );
  });

  it("paired article alternate hreflang URL uses the opposite locale prefix", () => {
    fc.assert(
      fc.property(pairedBlogArticleArb, localeArb, (article, locale) => {
        const meta = generateMetaTags(article, locale);
        const alternateLocale: Locale = locale === "id" ? "en" : "id";
        const alternateEntry = meta.hreflang.find((h) => h.locale === alternateLocale);
        expect(alternateEntry).toBeDefined();

        if (alternateLocale === "en") {
          expect(alternateEntry!.url).toContain("/en/blog/");
        } else {
          // ID locale has no prefix, so URL should contain /blog/ but not /en/blog/
          expect(alternateEntry!.url).toContain("/blog/");
          expect(alternateEntry!.url).not.toContain("/en/blog/");
        }
      })
    );
  });

  it("unpaired article produces exactly 1 hreflang entry (self only)", () => {
    fc.assert(
      fc.property(unpairedBlogArticleArb, localeArb, (article, locale) => {
        const meta = generateMetaTags(article, locale);
        expect(meta.hreflang).toHaveLength(1);
      })
    );
  });

  it("unpaired article hreflang entry matches the self locale", () => {
    fc.assert(
      fc.property(unpairedBlogArticleArb, localeArb, (article, locale) => {
        const meta = generateMetaTags(article, locale);
        expect(meta.hreflang[0].locale).toBe(locale);
      })
    );
  });
});
