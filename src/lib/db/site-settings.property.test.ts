import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import {
  getSiteSettings,
  updateSiteSettings,
  clearSettingsCache,
  type SiteSettings,
} from "./site-settings";
import { SiteSettingsDefaults } from "@/lib/site-settings/defaults";
import type { SiteSettingsRow } from "./schema";

/**
 * Property 12: Site settings patch invariant
 * **Validates: Requirements 10.11, 10.12, 10.13**
 *
 * After `updateSiteSettings(db, P)`, `getSiteSettings(db)` returns `S'` where:
 * - Patched keys equal `P[k]`
 * - Unpatched keys equal original `S[k]`
 *
 * Property 13: Site settings update idempotence
 * **Validates: Requirements 10.11, 10.12, 10.13**
 *
 * Calling `updateSiteSettings(db, P)` twice produces identical state.
 */

// ---------------------------------------------------------------------------
// In-memory D1 mock
// ---------------------------------------------------------------------------

/**
 * Creates a fully in-memory mock D1Database that simulates the exact SQL
 * operations used by site-settings.ts:
 *   - SELECT * FROM site_settings WHERE id = 1  (via .first())
 *   - INSERT OR REPLACE INTO site_settings (id, ...) VALUES (1, ...)  (via .bind().run())
 *
 * The mock stores a single SiteSettingsRow internally and updates it on each
 * INSERT OR REPLACE call, mirroring real D1 behaviour.
 */
function createInMemoryD1(initialRow?: SiteSettingsRow): D1Database {
  // Internal store — starts empty (no row) unless an initial row is provided
  let storedRow: SiteSettingsRow | null = initialRow ?? null;

  /**
   * Builds a statement object for the given SQL and bound args.
   * The statement is reusable: calling .bind() returns a new statement
   * with the provided args captured in closure.
   */
  function buildStatement(sql: string, boundArgs: unknown[] = []) {
    return {
      bind(...args: unknown[]) {
        return buildStatement(sql, args);
      },

      // SELECT query — returns the stored row (or null)
      async first<T>(): Promise<T | null> {
        if (sql.includes("SELECT") && sql.includes("site_settings")) {
          return storedRow as T | null;
        }
        return null;
      },

      // INSERT OR REPLACE — capture all bound values and update storedRow
      async run() {
        if (
          sql.includes("INSERT OR REPLACE") &&
          sql.includes("site_settings")
        ) {
          // The INSERT binds values in this order (matching site-settings.ts):
          // 0:  brand_name_id
          // 1:  brand_name_en
          // 2:  tagline_id
          // 3:  tagline_en
          // 4:  logo_url
          // 5:  favicon_url
          // 6:  primary_whatsapp_number
          // 7:  support_email
          // 8:  address
          // 9:  social_instagram_url
          // 10: social_youtube_url
          // 11: social_facebook_url
          // 12: social_tiktok_url
          // 13: hero_image_url
          // 14: hero_title_id
          // 15: hero_title_en
          // 16: hero_subtitle_id
          // 17: hero_subtitle_en
          // 18: hero_cta_text_id
          // 19: hero_cta_text_en
          // 20: destinations_count_override
          // 21: destinations_count_auto  (0 or 1)
          // 22: partners_count
          // 23: happy_tourists_count
          // 24: average_rating
          // 25: default_og_image
          // 26: default_meta_description_template_id
          // 27: default_meta_description_template_en
          // 28: copyright_text
          // 29: footer_tagline_id
          // 30: footer_tagline_en
          // 31: gtm_container_id
          // 32: ga4_measurement_id
          // 33: custom_head_html
          // 34: updated_at
          storedRow = {
            id: 1,
            brand_name_id: boundArgs[0] as string,
            brand_name_en: boundArgs[1] as string,
            tagline_id: boundArgs[2] as string,
            tagline_en: boundArgs[3] as string,
            logo_url: boundArgs[4] as string | null,
            favicon_url: boundArgs[5] as string | null,
            primary_whatsapp_number: boundArgs[6] as string,
            support_email: boundArgs[7] as string,
            address: boundArgs[8] as string | null,
            social_instagram_url: boundArgs[9] as string | null,
            social_youtube_url: boundArgs[10] as string | null,
            social_facebook_url: boundArgs[11] as string | null,
            social_tiktok_url: boundArgs[12] as string | null,
            hero_image_url: boundArgs[13] as string,
            hero_title_id: boundArgs[14] as string,
            hero_title_en: boundArgs[15] as string,
            hero_subtitle_id: boundArgs[16] as string,
            hero_subtitle_en: boundArgs[17] as string,
            hero_cta_text_id: boundArgs[18] as string,
            hero_cta_text_en: boundArgs[19] as string,
            destinations_count_override: boundArgs[20] as number | null,
            destinations_count_auto: boundArgs[21] as number,
            partners_count: boundArgs[22] as number,
            happy_tourists_count: boundArgs[23] as number,
            average_rating: boundArgs[24] as number,
            default_og_image: boundArgs[25] as string | null,
            default_meta_description_template_id: boundArgs[26] as string,
            default_meta_description_template_en: boundArgs[27] as string,
            copyright_text: boundArgs[28] as string,
            footer_tagline_id: boundArgs[29] as string | null,
            footer_tagline_en: boundArgs[30] as string | null,
            gtm_container_id: boundArgs[31] as string | null,
            ga4_measurement_id: boundArgs[32] as string | null,
            custom_head_html: boundArgs[33] as string | null,
            updated_at: boundArgs[34] as string,
          };
        }
        return { meta: { changes: 1 } };
      },

      // Fallback for any other query shapes
      async all() {
        return { results: [] };
      },
    };
  }

  const db = {
    prepare(sql: string) {
      return buildStatement(sql);
    },

    // batch is not used by site-settings.ts
    async batch(_statements: unknown[]) {
      return [];
    },
  } as unknown as D1Database;

  return db;
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Non-empty string for required text fields */
const nonEmptyStr = fc
  .string({ minLength: 1, maxLength: 80 })
  .filter((s) => s.trim().length > 0);

/** Nullable string (null or non-empty) */
const nullableStr = fc.option(nonEmptyStr, { nil: null });

/** Non-negative integer */
const nonNegInt = fc.integer({ min: 0, max: 9999 });

/** Rating: 0–5 with one decimal */
const ratingArb = fc
  .integer({ min: 0, max: 50 })
  .map((n) => Math.round((n / 10) * 10) / 10);

/**
 * Generates a full SiteSettings patch (all fields except updatedAt).
 * This represents an arbitrary "initial state" written to the DB.
 */
const fullSettingsPatchArb: fc.Arbitrary<Omit<SiteSettings, "updatedAt">> =
  fc.record({
    brandNameId: nonEmptyStr,
    brandNameEn: nonEmptyStr,
    taglineId: nonEmptyStr,
    taglineEn: nonEmptyStr,
    logoUrl: nullableStr,
    faviconUrl: nullableStr,
    primaryWhatsappNumber: nonEmptyStr,
    supportEmail: nonEmptyStr,
    address: nullableStr,
    socialInstagramUrl: nullableStr,
    socialYoutubeUrl: nullableStr,
    socialFacebookUrl: nullableStr,
    socialTiktokUrl: nullableStr,
    heroImageUrl: nonEmptyStr,
    heroTitleId: nonEmptyStr,
    heroTitleEn: nonEmptyStr,
    heroSubtitleId: nonEmptyStr,
    heroSubtitleEn: nonEmptyStr,
    heroCtaTextId: nonEmptyStr,
    heroCtaTextEn: nonEmptyStr,
    destinationsCountOverride: fc.option(nonNegInt, { nil: null }),
    destinationsCountAuto: fc.boolean(),
    partnersCount: nonNegInt,
    happyTouristsCount: nonNegInt,
    averageRating: ratingArb,
    defaultOgImage: nullableStr,
    defaultMetaDescriptionTemplateId: nonEmptyStr,
    defaultMetaDescriptionTemplateEn: nonEmptyStr,
    copyrightText: nonEmptyStr,
    footerTaglineId: nullableStr,
    footerTaglineEn: nullableStr,
    gtmContainerId: nullableStr,
    ga4MeasurementId: nullableStr,
    customHeadHtml: nullableStr,
  });

/**
 * Generates a partial patch — a random subset of SiteSettings keys.
 * Simulates a real admin form that only sends dirty fields.
 */
const partialPatchArb: fc.Arbitrary<Partial<Omit<SiteSettings, "updatedAt">>> =
  fullSettingsPatchArb.chain((full) => {
    const keys = Object.keys(full) as Array<keyof typeof full>;
    return fc
      .subarray(keys, { minLength: 1, maxLength: keys.length })
      .map((selectedKeys) => {
        const patch: Partial<Omit<SiteSettings, "updatedAt">> = {};
        for (const k of selectedKeys) {
          (patch as Record<string, unknown>)[k] = full[k];
        }
        return patch;
      });
  });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Keys of SiteSettings that are patchable (all except updatedAt) */
const PATCHABLE_KEYS: Array<keyof Omit<SiteSettings, "updatedAt">> = [
  "brandNameId",
  "brandNameEn",
  "taglineId",
  "taglineEn",
  "logoUrl",
  "faviconUrl",
  "primaryWhatsappNumber",
  "supportEmail",
  "address",
  "socialInstagramUrl",
  "socialYoutubeUrl",
  "socialFacebookUrl",
  "socialTiktokUrl",
  "heroImageUrl",
  "heroTitleId",
  "heroTitleEn",
  "heroSubtitleId",
  "heroSubtitleEn",
  "heroCtaTextId",
  "heroCtaTextEn",
  "destinationsCountOverride",
  "destinationsCountAuto",
  "partnersCount",
  "happyTouristsCount",
  "averageRating",
  "defaultOgImage",
  "defaultMetaDescriptionTemplateId",
  "defaultMetaDescriptionTemplateEn",
  "copyrightText",
  "footerTaglineId",
  "footerTaglineEn",
  "gtmContainerId",
  "ga4MeasurementId",
  "customHeadHtml",
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Reset the module-level cache between every test run
  clearSettingsCache();
});

describe("Property 12: Site settings patch invariant", () => {
  it("patched keys in the result equal the values supplied in the patch", async () => {
    await fc.assert(
      fc.asyncProperty(
        fullSettingsPatchArb,
        partialPatchArb,
        async (initial, patch) => {
          const db = createInMemoryD1();
          clearSettingsCache();

          // Establish initial state
          await updateSiteSettings(db, initial);
          clearSettingsCache();

          // Apply partial patch
          const result = await updateSiteSettings(db, patch);

          // Every key present in the patch must equal the patch value
          for (const key of Object.keys(patch) as Array<
            keyof Omit<SiteSettings, "updatedAt">
          >) {
            expect(result[key]).toStrictEqual(
              (patch as Record<string, unknown>)[key]
            );
          }
        }
      )
    );
  });

  it("unpatched keys in the result equal the original values", async () => {
    await fc.assert(
      fc.asyncProperty(
        fullSettingsPatchArb,
        partialPatchArb,
        async (initial, patch) => {
          const db = createInMemoryD1();
          clearSettingsCache();

          // Establish initial state
          await updateSiteSettings(db, initial);
          clearSettingsCache();

          // Read original state before patch
          const originalState = await getSiteSettings(db);
          clearSettingsCache();

          // Apply partial patch
          const result = await updateSiteSettings(db, patch);

          // Keys NOT in the patch must retain their original values
          const patchedKeys = new Set(Object.keys(patch));
          for (const key of PATCHABLE_KEYS) {
            if (!patchedKeys.has(key)) {
              expect(result[key]).toStrictEqual(originalState[key]);
            }
          }
        }
      )
    );
  });

  it("getSiteSettings after updateSiteSettings reflects the patch", async () => {
    await fc.assert(
      fc.asyncProperty(
        fullSettingsPatchArb,
        partialPatchArb,
        async (initial, patch) => {
          const db = createInMemoryD1();
          clearSettingsCache();

          // Establish initial state
          await updateSiteSettings(db, initial);
          clearSettingsCache();

          // Apply patch
          await updateSiteSettings(db, patch);
          clearSettingsCache();

          // Read back via getSiteSettings
          const readBack = await getSiteSettings(db);

          // Patched keys must match
          for (const key of Object.keys(patch) as Array<
            keyof Omit<SiteSettings, "updatedAt">
          >) {
            expect(readBack[key]).toStrictEqual(
              (patch as Record<string, unknown>)[key]
            );
          }
        }
      )
    );
  });

  it("empty DB returns SiteSettingsDefaults before any update", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        const db = createInMemoryD1(); // no initial row
        clearSettingsCache();

        const result = await getSiteSettings(db);

        // Should equal defaults (excluding updatedAt which may differ)
        for (const key of PATCHABLE_KEYS) {
          expect(result[key]).toStrictEqual(
            (SiteSettingsDefaults as Record<string, unknown>)[key]
          );
        }
      })
    );
  });
});

describe("Property 13: Site settings update idempotence", () => {
  it("calling updateSiteSettings twice with the same patch produces identical state", async () => {
    await fc.assert(
      fc.asyncProperty(
        fullSettingsPatchArb,
        partialPatchArb,
        async (initial, patch) => {
          const db = createInMemoryD1();
          clearSettingsCache();

          // Establish initial state
          await updateSiteSettings(db, initial);
          clearSettingsCache();

          // First application of patch
          const firstResult = await updateSiteSettings(db, patch);
          clearSettingsCache();

          // Second application of the same patch
          const secondResult = await updateSiteSettings(db, patch);

          // All patchable keys must be identical between the two results
          for (const key of PATCHABLE_KEYS) {
            expect(secondResult[key]).toStrictEqual(firstResult[key]);
          }
        }
      )
    );
  });

  it("getSiteSettings after two identical patches returns the same values as after one patch", async () => {
    await fc.assert(
      fc.asyncProperty(
        fullSettingsPatchArb,
        partialPatchArb,
        async (initial, patch) => {
          const db = createInMemoryD1();
          clearSettingsCache();

          // Establish initial state
          await updateSiteSettings(db, initial);
          clearSettingsCache();

          // Apply patch once, read back
          await updateSiteSettings(db, patch);
          clearSettingsCache();
          const afterFirst = await getSiteSettings(db);
          clearSettingsCache();

          // Apply same patch again, read back
          await updateSiteSettings(db, patch);
          clearSettingsCache();
          const afterSecond = await getSiteSettings(db);

          for (const key of PATCHABLE_KEYS) {
            expect(afterSecond[key]).toStrictEqual(afterFirst[key]);
          }
        }
      )
    );
  });

  it("applying an empty patch leaves all settings unchanged", async () => {
    await fc.assert(
      fc.asyncProperty(fullSettingsPatchArb, async (initial) => {
        const db = createInMemoryD1();
        clearSettingsCache();

        // Establish initial state
        await updateSiteSettings(db, initial);
        clearSettingsCache();

        const before = await getSiteSettings(db);
        clearSettingsCache();

        // Apply empty patch
        await updateSiteSettings(db, {});
        clearSettingsCache();

        const after = await getSiteSettings(db);

        for (const key of PATCHABLE_KEYS) {
          expect(after[key]).toStrictEqual(before[key]);
        }
      })
    );
  });
});
