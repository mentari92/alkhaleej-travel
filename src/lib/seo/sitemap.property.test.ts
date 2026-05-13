import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { generateSitemap, type SitemapEntry } from "./sitemap";
import type { HreflangEntry } from "../types";
import type { Locale } from "../i18n/config";

/**
 * Property 12: Sitemap completeness with hreflang
 * **Validates: Requirements 8.3, 11.6**
 *
 * For any set of published destinations and published blog articles, the generated
 * sitemap.xml SHALL contain URL entries for every published page in both languages,
 * with `xhtml:link` hreflang annotations linking alternate language versions.
 */

const SITE_URL = "https://infotour.id";

// --- Generators ---

const slugArb = fc
  .array(fc.stringMatching(/^[a-z0-9]+$/), { minLength: 1, maxLength: 4 })
  .map((parts) => parts.join("-"))
  .filter((s) => s.length > 0 && s.length <= 60);

const localeArb: fc.Arbitrary<Locale> = fc.constantFrom("id" as Locale, "en" as Locale);

interface PublishedDestination {
  slug: string;
  updatedAt: string;
}

interface PublishedBlogArticle {
  id: string;
  slug: string;
  language: Locale;
  updatedAt: string;
  pairedArticleId: string | null;
}

const destinationArb: fc.Arbitrary<PublishedDestination> = fc.record({
  slug: slugArb,
  updatedAt: fc.constant("2024-06-15"),
});

const blogArticleArb: fc.Arbitrary<PublishedBlogArticle> = fc.record({
  id: fc.uuid(),
  slug: slugArb,
  language: localeArb,
  updatedAt: fc.constant("2024-07-01"),
  pairedArticleId: fc.constant(null),
});

/** Generates a list of destinations with unique slugs */
const destinationsArb = fc
  .array(destinationArb, { minLength: 0, maxLength: 5 })
  .map((dests) => {
    const seen = new Set<string>();
    return dests.filter((d) => {
      if (seen.has(d.slug)) return false;
      seen.add(d.slug);
      return true;
    });
  });

/** Generates a list of blog articles with unique slugs */
const articlesArb = fc
  .array(blogArticleArb, { minLength: 0, maxLength: 5 })
  .map((articles) => {
    const seen = new Set<string>();
    return articles.filter((a) => {
      if (seen.has(a.slug)) return false;
      seen.add(a.slug);
      return true;
    });
  });

// --- Helper: Build sitemap entries (mirrors sitemap.xml.ts logic) ---

function buildSitemapEntries(
  destinations: PublishedDestination[],
  articles: PublishedBlogArticle[]
): SitemapEntry[] {
  const entries: SitemapEntry[] = [];
  const now = new Date().toISOString().split("T")[0];

  // Homepage entries (both languages)
  entries.push({
    url: SITE_URL,
    lastmod: now,
    changefreq: "weekly",
    priority: 1.0,
    alternates: [
      { locale: "id", url: SITE_URL },
      { locale: "en", url: `${SITE_URL}/en` },
    ],
  });
  entries.push({
    url: `${SITE_URL}/en`,
    lastmod: now,
    changefreq: "weekly",
    priority: 1.0,
    alternates: [
      { locale: "id", url: SITE_URL },
      { locale: "en", url: `${SITE_URL}/en` },
    ],
  });

  // Destination entries (both languages per destination)
  for (const dest of destinations) {
    const idUrl = `${SITE_URL}/destinations/${dest.slug}`;
    const enUrl = `${SITE_URL}/en/destinations/${dest.slug}`;
    const alternates: HreflangEntry[] = [
      { locale: "id", url: idUrl },
      { locale: "en", url: enUrl },
    ];

    entries.push({
      url: idUrl,
      lastmod: dest.updatedAt,
      changefreq: "weekly",
      priority: 0.8,
      alternates,
    });
    entries.push({
      url: enUrl,
      lastmod: dest.updatedAt,
      changefreq: "weekly",
      priority: 0.8,
      alternates,
    });
  }

  // Blog article entries
  const articleById = new Map<string, { slug: string; language: string }>();
  for (const article of articles) {
    articleById.set(article.id, { slug: article.slug, language: article.language });
  }

  for (const article of articles) {
    const prefix = article.language === "en" ? "/en" : "";
    const articleUrl = `${SITE_URL}${prefix}/blog/${article.slug}`;
    const alternates: HreflangEntry[] = [
      { locale: article.language, url: articleUrl },
    ];

    if (article.pairedArticleId) {
      const paired = articleById.get(article.pairedArticleId);
      if (paired) {
        const pairedPrefix = paired.language === "en" ? "/en" : "";
        const pairedUrl = `${SITE_URL}${pairedPrefix}/blog/${paired.slug}`;
        alternates.push({ locale: paired.language as Locale, url: pairedUrl });
      }
    }

    entries.push({
      url: articleUrl,
      lastmod: article.updatedAt,
      changefreq: "monthly",
      priority: 0.6,
      alternates,
    });
  }

  return entries;
}

// --- Property Tests ---

describe("Property 12: Sitemap completeness with hreflang", () => {
  it("every destination has entries for both languages (id and en)", () => {
    fc.assert(
      fc.property(destinationsArb, articlesArb, (destinations, articles) => {
        const entries = buildSitemapEntries(destinations, articles);
        const xml = generateSitemap(entries);

        for (const dest of destinations) {
          const idUrl = `${SITE_URL}/destinations/${dest.slug}`;
          const enUrl = `${SITE_URL}/en/destinations/${dest.slug}`;
          expect(xml).toContain(`<loc>${idUrl}</loc>`);
          expect(xml).toContain(`<loc>${enUrl}</loc>`);
        }
      })
    );
  });

  it("every blog article has an entry in the sitemap", () => {
    fc.assert(
      fc.property(destinationsArb, articlesArb, (destinations, articles) => {
        const entries = buildSitemapEntries(destinations, articles);
        const xml = generateSitemap(entries);

        for (const article of articles) {
          const prefix = article.language === "en" ? "/en" : "";
          const articleUrl = `${SITE_URL}${prefix}/blog/${article.slug}`;
          expect(xml).toContain(`<loc>${articleUrl}</loc>`);
        }
      })
    );
  });

  it("each destination entry has hreflang annotations for both locales", () => {
    fc.assert(
      fc.property(destinationsArb, articlesArb, (destinations, articles) => {
        const entries = buildSitemapEntries(destinations, articles);
        const xml = generateSitemap(entries);

        for (const dest of destinations) {
          const idUrl = `${SITE_URL}/destinations/${dest.slug}`;
          const enUrl = `${SITE_URL}/en/destinations/${dest.slug}`;

          // Check hreflang annotations exist for both locales
          expect(xml).toContain(`hreflang="id" href="${idUrl}"`);
          expect(xml).toContain(`hreflang="en" href="${enUrl}"`);
        }
      })
    );
  });

  it("the XML contains the correct number of <url> entries", () => {
    fc.assert(
      fc.property(destinationsArb, articlesArb, (destinations, articles) => {
        const entries = buildSitemapEntries(destinations, articles);
        const xml = generateSitemap(entries);

        // Expected: 2 (homepage) + 2 per destination + 1 per article
        const expectedCount = 2 + destinations.length * 2 + articles.length;
        const urlMatches = xml.match(/<url>/g) || [];
        expect(urlMatches.length).toBe(expectedCount);
      })
    );
  });

  it("all URLs use the correct prefix pattern", () => {
    fc.assert(
      fc.property(destinationsArb, articlesArb, (destinations, articles) => {
        const entries = buildSitemapEntries(destinations, articles);
        const xml = generateSitemap(entries);

        // Extract all <loc> URLs from the XML
        const locMatches = xml.match(/<loc>(.*?)<\/loc>/g) || [];
        const urls = locMatches.map((m) => m.replace(/<\/?loc>/g, ""));

        for (const url of urls) {
          // All URLs must start with the site URL
          expect(url.startsWith(SITE_URL)).toBe(true);

          // English pages must have /en/ prefix
          if (url.includes("/en/")) {
            expect(url).toMatch(
              new RegExp(`^${SITE_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/en(/|$)`)
            );
          }
        }
      })
    );
  });
});
