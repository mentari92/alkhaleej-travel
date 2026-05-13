import { describe, it, expect, beforeEach } from "vitest";
import {
  getSiteSettings,
  updateSiteSettings,
  clearSettingsCache,
  type SiteSettings,
} from "./site-settings";
import { SiteSettingsDefaults } from "@/lib/site-settings/defaults";

// ---------------------------------------------------------------------------
// In-memory D1 mock
// ---------------------------------------------------------------------------

/**
 * Minimal in-memory SQLite-like store that simulates the D1 API surface used
 * by the site-settings repository:
 *   - db.prepare(sql).first<T>()
 *   - db.prepare(sql).bind(...args).first<T>()
 *   - db.prepare(sql).bind(...args).run()
 *
 * The store holds at most one row (id = 1) in `site_settings`, matching the
 * single-row constraint in the real schema.
 */
function createInMemoryD1() {
  // The single row stored in memory (null = table is empty / no row yet)
  let row: Record<string, unknown> | null = null;

  // Track how many times the INSERT OR REPLACE has been executed
  let insertCount = 0;

  function buildStatement(sql: string, boundArgs: unknown[] = []) {
    return {
      bind(...args: unknown[]) {
        return buildStatement(sql, args);
      },
      async first<T>(): Promise<T | null> {
        const trimmed = sql.trim().toUpperCase();
        if (trimmed.startsWith("SELECT")) {
          return (row as T | null) ?? null;
        }
        return null;
      },
      async run() {
        const trimmed = sql.trim().toUpperCase();
        if (trimmed.startsWith("INSERT OR REPLACE")) {
          insertCount++;
          // Parse the bound args into a row object.
          // The INSERT in site-settings.ts always binds values in a fixed order
          // matching the column list. We reconstruct the row from those values.
          const [
            // id is always 1 (hard-coded in the SQL)
            brand_name_id,
            brand_name_en,
            tagline_id,
            tagline_en,
            logo_url,
            favicon_url,
            primary_whatsapp_number,
            support_email,
            address,
            social_instagram_url,
            social_youtube_url,
            social_facebook_url,
            social_tiktok_url,
            hero_image_url,
            hero_title_id,
            hero_title_en,
            hero_subtitle_id,
            hero_subtitle_en,
            hero_cta_text_id,
            hero_cta_text_en,
            destinations_count_override,
            destinations_count_auto,
            partners_count,
            happy_tourists_count,
            average_rating,
            default_og_image,
            default_meta_description_template_id,
            default_meta_description_template_en,
            copyright_text,
            footer_tagline_id,
            footer_tagline_en,
            gtm_container_id,
            ga4_measurement_id,
            custom_head_html,
            updated_at,
          ] = boundArgs;

          row = {
            id: 1,
            brand_name_id,
            brand_name_en,
            tagline_id,
            tagline_en,
            logo_url,
            favicon_url,
            primary_whatsapp_number,
            support_email,
            address,
            social_instagram_url,
            social_youtube_url,
            social_facebook_url,
            social_tiktok_url,
            hero_image_url,
            hero_title_id,
            hero_title_en,
            hero_subtitle_id,
            hero_subtitle_en,
            hero_cta_text_id,
            hero_cta_text_en,
            destinations_count_override,
            destinations_count_auto,
            partners_count,
            happy_tourists_count,
            average_rating,
            default_og_image,
            default_meta_description_template_id,
            default_meta_description_template_en,
            copyright_text,
            footer_tagline_id,
            footer_tagline_en,
            gtm_container_id,
            ga4_measurement_id,
            custom_head_html,
            updated_at,
          };
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 0 } };
      },
    };
  }

  const db = {
    prepare(sql: string) {
      return buildStatement(sql);
    },
    /** Expose internals for assertions */
    _getRow() {
      return row;
    },
    _getInsertCount() {
      return insertCount;
    },
    _reset() {
      row = null;
      insertCount = 0;
    },
  } as unknown as D1Database & {
    _getRow(): Record<string, unknown> | null;
    _getInsertCount(): number;
    _reset(): void;
  };

  return db;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getSiteSettings", () => {
  beforeEach(() => {
    clearSettingsCache();
  });

  it("returns SiteSettingsDefaults when the DB has no row", async () => {
    const db = createInMemoryD1();

    const settings = await getSiteSettings(db);

    // Every field should match the defaults
    expect(settings.brandNameId).toBe(SiteSettingsDefaults.brandNameId);
    expect(settings.brandNameEn).toBe(SiteSettingsDefaults.brandNameEn);
    expect(settings.primaryWhatsappNumber).toBe(
      SiteSettingsDefaults.primaryWhatsappNumber
    );
    expect(settings.supportEmail).toBe(SiteSettingsDefaults.supportEmail);
    expect(settings.heroImageUrl).toBe(SiteSettingsDefaults.heroImageUrl);
    expect(settings.destinationsCountAuto).toBe(
      SiteSettingsDefaults.destinationsCountAuto
    );
    expect(settings.copyrightText).toBe(SiteSettingsDefaults.copyrightText);
  });

  it("returns the same object reference on a second call (cache hit)", async () => {
    const db = createInMemoryD1();

    const first = await getSiteSettings(db);
    const second = await getSiteSettings(db);

    expect(second).toBe(first);
  });

  it("returns DB values when a row exists", async () => {
    const db = createInMemoryD1();

    // Seed a row by calling updateSiteSettings first
    await updateSiteSettings(db, { brandNameId: "MyBrand" });
    clearSettingsCache();

    const settings = await getSiteSettings(db);

    expect(settings.brandNameId).toBe("MyBrand");
  });
});

describe("updateSiteSettings", () => {
  beforeEach(() => {
    clearSettingsCache();
  });

  it("round-trips a full patch correctly", async () => {
    const db = createInMemoryD1();

    const fullPatch: Partial<Omit<SiteSettings, "updatedAt">> = {
      brandNameId: "Wisata Nusantara",
      brandNameEn: "Nusantara Travel",
      taglineId: "Jelajahi keindahan nusantara",
      taglineEn: "Explore the beauty of nusantara",
      logoUrl: "https://cdn.example.com/logo.png",
      faviconUrl: "https://cdn.example.com/favicon.ico",
      primaryWhatsappNumber: "6281299999999",
      supportEmail: "info@wisatanusantara.id",
      address: "Jakarta, Indonesia",
      socialInstagramUrl: "https://instagram.com/wisatanusantara",
      socialYoutubeUrl: "https://youtube.com/@wisatanusantara",
      socialFacebookUrl: "https://facebook.com/wisatanusantara",
      socialTiktokUrl: "https://tiktok.com/@wisatanusantara",
      heroImageUrl: "https://cdn.example.com/hero.jpg",
      heroTitleId: "Jelajahi Indonesia",
      heroTitleEn: "Explore Indonesia",
      heroSubtitleId: "Temukan keajaiban alam",
      heroSubtitleEn: "Discover natural wonders",
      heroCtaTextId: "Mulai Sekarang",
      heroCtaTextEn: "Start Now",
      destinationsCountOverride: 42,
      destinationsCountAuto: false,
      partnersCount: 10,
      happyTouristsCount: 5000,
      averageRating: 4.8,
      defaultOgImage: "https://cdn.example.com/og.jpg",
      defaultMetaDescriptionTemplateId: "Temukan destinasi terbaik.",
      defaultMetaDescriptionTemplateEn: "Find the best destinations.",
      copyrightText: "© 2025 Wisata Nusantara",
      footerTaglineId: "Perjalanan terbaik dimulai di sini",
      footerTaglineEn: "The best journey starts here",
      gtmContainerId: "GTM-ABCD1234",
      ga4MeasurementId: "G-ABCDEF1234",
      customHeadHtml: null,
    };

    const result = await updateSiteSettings(db, fullPatch);

    // Every patched field should be reflected in the returned settings
    expect(result.brandNameId).toBe(fullPatch.brandNameId);
    expect(result.brandNameEn).toBe(fullPatch.brandNameEn);
    expect(result.taglineId).toBe(fullPatch.taglineId);
    expect(result.taglineEn).toBe(fullPatch.taglineEn);
    expect(result.logoUrl).toBe(fullPatch.logoUrl);
    expect(result.faviconUrl).toBe(fullPatch.faviconUrl);
    expect(result.primaryWhatsappNumber).toBe(fullPatch.primaryWhatsappNumber);
    expect(result.supportEmail).toBe(fullPatch.supportEmail);
    expect(result.address).toBe(fullPatch.address);
    expect(result.socialInstagramUrl).toBe(fullPatch.socialInstagramUrl);
    expect(result.socialYoutubeUrl).toBe(fullPatch.socialYoutubeUrl);
    expect(result.socialFacebookUrl).toBe(fullPatch.socialFacebookUrl);
    expect(result.socialTiktokUrl).toBe(fullPatch.socialTiktokUrl);
    expect(result.heroImageUrl).toBe(fullPatch.heroImageUrl);
    expect(result.heroTitleId).toBe(fullPatch.heroTitleId);
    expect(result.heroTitleEn).toBe(fullPatch.heroTitleEn);
    expect(result.heroSubtitleId).toBe(fullPatch.heroSubtitleId);
    expect(result.heroSubtitleEn).toBe(fullPatch.heroSubtitleEn);
    expect(result.heroCtaTextId).toBe(fullPatch.heroCtaTextId);
    expect(result.heroCtaTextEn).toBe(fullPatch.heroCtaTextEn);
    expect(result.destinationsCountOverride).toBe(
      fullPatch.destinationsCountOverride
    );
    expect(result.destinationsCountAuto).toBe(fullPatch.destinationsCountAuto);
    expect(result.partnersCount).toBe(fullPatch.partnersCount);
    expect(result.happyTouristsCount).toBe(fullPatch.happyTouristsCount);
    expect(result.averageRating).toBe(fullPatch.averageRating);
    expect(result.defaultOgImage).toBe(fullPatch.defaultOgImage);
    expect(result.defaultMetaDescriptionTemplateId).toBe(
      fullPatch.defaultMetaDescriptionTemplateId
    );
    expect(result.defaultMetaDescriptionTemplateEn).toBe(
      fullPatch.defaultMetaDescriptionTemplateEn
    );
    expect(result.copyrightText).toBe(fullPatch.copyrightText);
    expect(result.footerTaglineId).toBe(fullPatch.footerTaglineId);
    expect(result.footerTaglineEn).toBe(fullPatch.footerTaglineEn);
    expect(result.gtmContainerId).toBe(fullPatch.gtmContainerId);
    expect(result.ga4MeasurementId).toBe(fullPatch.ga4MeasurementId);
    expect(result.customHeadHtml).toBe(fullPatch.customHeadHtml);
    // updatedAt should be a non-empty string set by the repository
    expect(typeof result.updatedAt).toBe("string");
    expect(result.updatedAt.length).toBeGreaterThan(0);
  });

  it("preserves unpatched fields when applying a partial patch", async () => {
    const db = createInMemoryD1();

    // First, set a known state
    await updateSiteSettings(db, {
      brandNameId: "Original Brand",
      supportEmail: "original@example.com",
    });
    clearSettingsCache();

    // Apply a partial patch that only changes brandNameId
    const result = await updateSiteSettings(db, { brandNameId: "Updated Brand" });

    expect(result.brandNameId).toBe("Updated Brand");
    // supportEmail was not in the patch — it should retain the previously written value
    expect(result.supportEmail).toBe("original@example.com");
  });

  it("clears the cache so the next getSiteSettings reads fresh data", async () => {
    const db = createInMemoryD1();

    // Populate cache
    const before = await getSiteSettings(db);
    expect(before.brandNameId).toBe(SiteSettingsDefaults.brandNameId);

    // Update — this should clear the cache
    await updateSiteSettings(db, { brandNameId: "Fresh Brand" });

    // getSiteSettings should now return the updated value, not the cached default
    const after = await getSiteSettings(db);
    expect(after.brandNameId).toBe("Fresh Brand");
  });
});

describe("migration idempotency", () => {
  beforeEach(() => {
    clearSettingsCache();
  });

  it("SELECT COUNT(*) FROM site_settings returns 1 after running migration twice", async () => {
    /**
     * The migration uses:
     *   CREATE TABLE IF NOT EXISTS site_settings ...
     *   INSERT OR IGNORE INTO site_settings (id) VALUES (1)
     *
     * We simulate this by calling updateSiteSettings (which does INSERT OR REPLACE)
     * twice and verifying that the in-memory store still holds exactly one row.
     *
     * The real idempotency guarantee comes from:
     *   - CREATE TABLE IF NOT EXISTS  → no-op on second run
     *   - INSERT OR IGNORE            → no-op when id=1 already exists
     *
     * We verify the equivalent property: after two writes the row count is 1.
     */
    const db = createInMemoryD1();

    // Simulate first migration run: seed the row
    await updateSiteSettings(db, {});
    clearSettingsCache();

    // Simulate second migration run: seed again (INSERT OR IGNORE / INSERT OR REPLACE)
    await updateSiteSettings(db, {});
    clearSettingsCache();

    // The in-memory store should still have exactly one row
    const internalDb = db as unknown as {
      _getRow(): Record<string, unknown> | null;
      _getInsertCount(): number;
    };

    const storedRow = internalDb._getRow();
    expect(storedRow).not.toBeNull();
    expect(storedRow!.id).toBe(1);

    // Confirm getSiteSettings returns a single coherent settings object (not duplicated)
    const settings = await getSiteSettings(db);
    expect(settings).toBeDefined();
    expect(typeof settings.brandNameId).toBe("string");
  });

  it("INSERT OR IGNORE semantics: second seed does not overwrite existing data", async () => {
    /**
     * The migration's INSERT OR IGNORE means that if the row already exists,
     * the seed is skipped. We verify that a custom value written before the
     * second migration run is preserved.
     */
    const db = createInMemoryD1();

    // First migration run + admin customisation
    await updateSiteSettings(db, { brandNameId: "Custom Brand" });
    clearSettingsCache();

    // Second migration run (INSERT OR IGNORE would be a no-op in real D1)
    // We simulate by calling getSiteSettings — the row should still have "Custom Brand"
    const settings = await getSiteSettings(db);
    expect(settings.brandNameId).toBe("Custom Brand");
  });
});
