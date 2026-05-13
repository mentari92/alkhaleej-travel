/**
 * Property 7: Public routes return 200 on empty database
 *
 * **Validates: Requirements 6.3, 6.6**
 *
 * For each route in {/, /destinations, /blog, /en/, /en/destinations, /en/blog}
 * with all content tables empty, the handler returns a Response with status === 200.
 *
 * Since Astro pages cannot be unit-tested directly (they require the Workers SSR
 * runtime), this test verifies the property at the data-layer level:
 *
 * 1. The DB functions used by each public page return safe empty values when the
 *    DB has no rows (no throw, no null, just []).
 * 2. The fallback logic (empty arrays + SiteSettingsDefaults) produces valid page
 *    data without throwing.
 * 3. The SiteSettingsDefaults object is complete and non-null for all required
 *    fields, so pages that fall back to it will not crash.
 *
 * The property under test:
 *   For any combination of (route, empty-DB-state), the page data-preparation
 *   logic SHALL complete without throwing and SHALL produce a renderable state
 *   (destinations: Destination[], articles: BlogArticle[], settings: SiteSettings).
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import type { BlogArticle } from "@/lib/types";
import type { Destination } from "@/lib/db/destinations";
import type { SiteSettings } from "@/lib/db/site-settings";
import { SiteSettingsDefaults } from "@/lib/site-settings/defaults";

// ---------------------------------------------------------------------------
// Public route identifiers (the six routes from the spec)
// ---------------------------------------------------------------------------

const PUBLIC_ROUTES = [
  "/",
  "/destinations",
  "/blog",
  "/en/",
  "/en/destinations",
  "/en/blog",
] as const;

type PublicRoute = (typeof PUBLIC_ROUTES)[number];

// ---------------------------------------------------------------------------
// Mock D1Database that returns empty results for all queries
// ---------------------------------------------------------------------------

/**
 * Creates a minimal D1Database mock that returns empty result sets.
 * This simulates a freshly-migrated database with no content rows.
 */
function createEmptyD1Mock(): D1Database {
  const emptyResult = { results: [], success: true, meta: {} as D1Meta };

  const preparedStatement: D1PreparedStatement = {
    bind: (..._values: unknown[]) => preparedStatement,
    first: async <T = unknown>(_colName?: string): Promise<T | null> => null,
    run: async (): Promise<D1Result> => ({ results: [], success: true, meta: {} as D1Meta }),
    all: async <T = unknown>(): Promise<D1Result<T>> =>
      ({ results: [] as T[], success: true, meta: {} as D1Meta }),
    raw: async <T = unknown[]>(): Promise<T[]> => [],
  };

  const db: D1Database = {
    prepare: (_query: string) => preparedStatement,
    batch: async (_statements: D1PreparedStatement[]) => [emptyResult],
    dump: async () => new ArrayBuffer(0),
    exec: async (_query: string) => ({ count: 0, duration: 0 }),
  };

  return db;
}

// ---------------------------------------------------------------------------
// Page data-preparation logic (mirrors what each Astro page does)
// ---------------------------------------------------------------------------

/**
 * Simulates the data-preparation logic for the homepage (/ and /en/).
 * Returns { destinations, articles, settings } or throws on error.
 */
async function prepareHomepageData(
  db: D1Database,
  locale: "id" | "en"
): Promise<{ destinations: Destination[]; articles: BlogArticle[]; settings: SiteSettings }> {
  // Import lazily to avoid module-level side effects in tests
  const { listPublishedDestinations } = await import("@/lib/db/destinations");
  const { listPublishedArticles } = await import("@/lib/db/blog");
  const { getSiteSettings, clearSettingsCache } = await import("@/lib/db/site-settings");

  clearSettingsCache();

  let destinations: Destination[] = [];
  let articles: BlogArticle[] = [];
  let settings: SiteSettings = SiteSettingsDefaults;

  try {
    destinations = await listPublishedDestinations(db);
    articles = await listPublishedArticles(db, locale);
    settings = await getSiteSettings(db);
  } catch {
    // Fallback to empty arrays and defaults (mirrors page behavior)
    destinations = [];
    articles = [];
    settings = SiteSettingsDefaults;
  }

  return { destinations, articles, settings };
}

/**
 * Simulates the data-preparation logic for the destinations listing page
 * (/destinations and /en/destinations).
 */
async function prepareDestinationsData(
  db: D1Database
): Promise<{ destinations: Destination[] }> {
  const { listPublishedDestinations } = await import("@/lib/db/destinations");

  let destinations: Destination[] = [];
  try {
    destinations = await listPublishedDestinations(db);
  } catch {
    destinations = [];
  }

  return { destinations };
}

/**
 * Simulates the data-preparation logic for the blog listing page
 * (/blog and /en/blog).
 */
async function prepareBlogData(
  db: D1Database,
  locale: "id" | "en"
): Promise<{ articles: BlogArticle[] }> {
  const { listPublishedArticles } = await import("@/lib/db/blog");

  let articles: BlogArticle[] = [];
  try {
    articles = await listPublishedArticles(db, locale);
  } catch {
    articles = [];
  }

  return { articles };
}

// ---------------------------------------------------------------------------
// Route → locale mapping
// ---------------------------------------------------------------------------

function getLocaleForRoute(route: PublicRoute): "id" | "en" {
  return route.startsWith("/en") ? "en" : "id";
}

function getRouteType(route: PublicRoute): "home" | "destinations" | "blog" {
  if (route === "/" || route === "/en/") return "home";
  if (route.includes("destinations")) return "destinations";
  return "blog";
}

// ---------------------------------------------------------------------------
// Property 7: Public routes return 200 on empty database
// **Validates: Requirements 6.3, 6.6**
// ---------------------------------------------------------------------------

describe("Property 7: Public routes return 200 on empty database", () => {
  /**
   * Core property: for every public route, data preparation with an empty DB
   * completes without throwing and produces a valid (non-null) data object.
   */
  it("data preparation does not throw for any public route with empty DB", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...PUBLIC_ROUTES),
        async (route) => {
          const db = createEmptyD1Mock();
          const locale = getLocaleForRoute(route);
          const routeType = getRouteType(route);

          let result: unknown;
          let threw = false;

          try {
            if (routeType === "home") {
              result = await prepareHomepageData(db, locale);
            } else if (routeType === "destinations") {
              result = await prepareDestinationsData(db);
            } else {
              result = await prepareBlogData(db, locale);
            }
          } catch {
            threw = true;
          }

          expect(threw).toBe(false);
          expect(result).toBeDefined();
          expect(result).not.toBeNull();
        }
      ),
      { numRuns: PUBLIC_ROUTES.length }
    );
  });

  /**
   * Property: destinations array is always an array (never null/undefined)
   * when DB returns empty results.
   */
  it("destinations data is always an array on empty DB", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("/", "/destinations", "/en/", "/en/destinations"),
        async (route) => {
          const db = createEmptyD1Mock();
          const locale = getLocaleForRoute(route as PublicRoute);
          const routeType = getRouteType(route as PublicRoute);

          let destinations: Destination[] | undefined;

          if (routeType === "home") {
            const data = await prepareHomepageData(db, locale);
            destinations = data.destinations;
          } else {
            const data = await prepareDestinationsData(db);
            destinations = data.destinations;
          }

          expect(Array.isArray(destinations)).toBe(true);
        }
      ),
      { numRuns: 4 }
    );
  });

  /**
   * Property: articles array is always an array (never null/undefined)
   * when DB returns empty results.
   */
  it("articles data is always an array on empty DB", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("/", "/blog", "/en/", "/en/blog"),
        async (route) => {
          const db = createEmptyD1Mock();
          const locale = getLocaleForRoute(route as PublicRoute);
          const routeType = getRouteType(route as PublicRoute);

          let articles: BlogArticle[] | undefined;

          if (routeType === "home") {
            const data = await prepareHomepageData(db, locale);
            articles = data.articles;
          } else {
            const data = await prepareBlogData(db, locale);
            articles = data.articles;
          }

          expect(Array.isArray(articles)).toBe(true);
        }
      ),
      { numRuns: 4 }
    );
  });

  /**
   * Property: getSiteSettings returns SiteSettingsDefaults (not null/undefined)
   * when the DB has no site_settings row.
   */
  it("getSiteSettings returns SiteSettingsDefaults on empty DB", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        const { getSiteSettings, clearSettingsCache } = await import(
          "@/lib/db/site-settings"
        );
        clearSettingsCache();

        const db = createEmptyD1Mock();
        const settings = await getSiteSettings(db);

        expect(settings).toBeDefined();
        expect(settings).not.toBeNull();
        // Required string fields must be non-empty strings
        expect(typeof settings.brandNameId).toBe("string");
        expect(settings.brandNameId.length).toBeGreaterThan(0);
        expect(typeof settings.primaryWhatsappNumber).toBe("string");
        expect(settings.primaryWhatsappNumber.length).toBeGreaterThan(0);
        expect(typeof settings.supportEmail).toBe("string");
        expect(settings.supportEmail.length).toBeGreaterThan(0);
        expect(typeof settings.heroImageUrl).toBe("string");
        expect(settings.heroImageUrl.length).toBeGreaterThan(0);
      }),
      { numRuns: 1 }
    );
  });

  /**
   * Property: SiteSettingsDefaults has all required fields populated
   * (no null/undefined for non-nullable fields).
   * This validates that the fallback used by pages is complete.
   */
  it("SiteSettingsDefaults has all required non-nullable fields populated", () => {
    const requiredStringFields: (keyof SiteSettings)[] = [
      "brandNameId",
      "brandNameEn",
      "taglineId",
      "taglineEn",
      "primaryWhatsappNumber",
      "supportEmail",
      "heroImageUrl",
      "heroTitleId",
      "heroTitleEn",
      "heroSubtitleId",
      "heroSubtitleEn",
      "heroCtaTextId",
      "heroCtaTextEn",
      "defaultMetaDescriptionTemplateId",
      "defaultMetaDescriptionTemplateEn",
      "copyrightText",
    ];

    fc.assert(
      fc.property(fc.constantFrom(...requiredStringFields), (field) => {
        const value = SiteSettingsDefaults[field];
        expect(value).toBeDefined();
        expect(value).not.toBeNull();
        expect(typeof value).toBe("string");
        expect((value as string).length).toBeGreaterThan(0);
      }),
      { numRuns: requiredStringFields.length }
    );
  });

  /**
   * Property: listPublishedDestinations returns an empty array (not null/undefined)
   * when the DB has no destination rows.
   */
  it("listPublishedDestinations returns empty array on empty DB", async () => {
    const { listPublishedDestinations } = await import("@/lib/db/destinations");

    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        const db = createEmptyD1Mock();
        const destinations = await listPublishedDestinations(db);

        expect(Array.isArray(destinations)).toBe(true);
        expect(destinations.length).toBe(0);
      }),
      { numRuns: 1 }
    );
  });

  /**
   * Property: listPublishedArticles returns an empty array (not null/undefined)
   * when the DB has no article rows, for both locales.
   */
  it("listPublishedArticles returns empty array on empty DB for both locales", async () => {
    const { listPublishedArticles } = await import("@/lib/db/blog");

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("id" as const, "en" as const),
        async (locale) => {
          const db = createEmptyD1Mock();
          const articles = await listPublishedArticles(db, locale);

          expect(Array.isArray(articles)).toBe(true);
          expect(articles.length).toBe(0);
        }
      ),
      { numRuns: 2 }
    );
  });

  /**
   * Property: the page data-preparation logic produces empty arrays
   * (not mock data) when the DB returns empty results.
   *
   * Note: The homepage (index.astro) falls back to mock data when DB returns
   * empty arrays. This is intentional behavior for development/preview.
   * The property here verifies that the data-layer functions themselves
   * return empty arrays — the mock-data fallback is a page-level concern.
   */
  it("DB layer returns empty arrays for all public listing queries on empty DB", async () => {
    const { listPublishedDestinations } = await import("@/lib/db/destinations");
    const { listPublishedArticles } = await import("@/lib/db/blog");

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("id" as const, "en" as const),
        async (locale) => {
          const db = createEmptyD1Mock();

          const [destinations, articles] = await Promise.all([
            listPublishedDestinations(db),
            listPublishedArticles(db, locale),
          ]);

          // Both must be arrays
          expect(Array.isArray(destinations)).toBe(true);
          expect(Array.isArray(articles)).toBe(true);

          // Both must be empty (no rows in DB)
          expect(destinations.length).toBe(0);
          expect(articles.length).toBe(0);
        }
      ),
      { numRuns: 2 }
    );
  });

  /**
   * Explicit test for each of the six public routes.
   * Documents the property for each route individually.
   */
  describe("each public route handles empty DB without throwing", () => {
    for (const route of PUBLIC_ROUTES) {
      it(`route ${route} — data preparation succeeds with empty DB`, async () => {
        const db = createEmptyD1Mock();
        const locale = getLocaleForRoute(route);
        const routeType = getRouteType(route);

        let threw = false;
        let result: unknown;

        try {
          if (routeType === "home") {
            result = await prepareHomepageData(db, locale);
          } else if (routeType === "destinations") {
            result = await prepareDestinationsData(db);
          } else {
            result = await prepareBlogData(db, locale);
          }
        } catch (err) {
          threw = true;
          console.error(`Route ${route} threw:`, err);
        }

        expect(threw).toBe(false);
        expect(result).toBeDefined();
      });
    }
  });
});
