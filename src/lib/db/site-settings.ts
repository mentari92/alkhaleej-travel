/**
 * Site settings repository for Cloudflare D1.
 * Manages the single-row `site_settings` table (id = 1).
 * Includes module-level per-request memoization cache.
 */

import type { SiteSettingsRow } from "./schema";
import { SiteSettingsDefaults } from "@/lib/site-settings/defaults";

// --- Public Interface ---

export interface SiteSettings {
  // Branding
  brandNameId: string;
  brandNameEn: string;
  taglineId: string;
  taglineEn: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  // Contact
  primaryWhatsappNumber: string;
  supportEmail: string;
  address: string | null;
  socialInstagramUrl: string | null;
  socialYoutubeUrl: string | null;
  socialFacebookUrl: string | null;
  socialTiktokUrl: string | null;
  // Hero
  heroImageUrl: string;
  heroTitleId: string;
  heroTitleEn: string;
  heroSubtitleId: string;
  heroSubtitleEn: string;
  heroCtaTextId: string;
  heroCtaTextEn: string;
  // Stats
  destinationsCountOverride: number | null;
  destinationsCountAuto: boolean;
  partnersCount: number;
  happyTouristsCount: number;
  averageRating: number;
  // SEO
  defaultOgImage: string | null;
  defaultMetaDescriptionTemplateId: string;
  defaultMetaDescriptionTemplateEn: string;
  // Footer
  copyrightText: string;
  footerTaglineId: string | null;
  footerTaglineEn: string | null;
  // Analytics
  gtmContainerId: string | null;
  ga4MeasurementId: string | null;
  customHeadHtml: string | null;
  // Audit
  updatedAt: string;
}

// --- Module-level per-request memoization cache ---

let _cache: SiteSettings | null = null;

// --- Row-to-Model Mapper ---

function mapRow(row: SiteSettingsRow): SiteSettings {
  return {
    brandNameId: row.brand_name_id,
    brandNameEn: row.brand_name_en,
    taglineId: row.tagline_id,
    taglineEn: row.tagline_en,
    logoUrl: row.logo_url,
    faviconUrl: row.favicon_url,
    primaryWhatsappNumber: row.primary_whatsapp_number,
    supportEmail: row.support_email,
    address: row.address,
    socialInstagramUrl: row.social_instagram_url,
    socialYoutubeUrl: row.social_youtube_url,
    socialFacebookUrl: row.social_facebook_url,
    socialTiktokUrl: row.social_tiktok_url,
    heroImageUrl: row.hero_image_url,
    heroTitleId: row.hero_title_id,
    heroTitleEn: row.hero_title_en,
    heroSubtitleId: row.hero_subtitle_id,
    heroSubtitleEn: row.hero_subtitle_en,
    heroCtaTextId: row.hero_cta_text_id,
    heroCtaTextEn: row.hero_cta_text_en,
    destinationsCountOverride: row.destinations_count_override,
    destinationsCountAuto: row.destinations_count_auto === 1,
    partnersCount: row.partners_count,
    happyTouristsCount: row.happy_tourists_count,
    averageRating: row.average_rating,
    defaultOgImage: row.default_og_image,
    defaultMetaDescriptionTemplateId: row.default_meta_description_template_id,
    defaultMetaDescriptionTemplateEn: row.default_meta_description_template_en,
    copyrightText: row.copyright_text,
    footerTaglineId: row.footer_tagline_id,
    footerTaglineEn: row.footer_tagline_en,
    gtmContainerId: row.gtm_container_id,
    ga4MeasurementId: row.ga4_measurement_id,
    customHeadHtml: row.custom_head_html,
    updatedAt: row.updated_at,
  };
}

// --- Repository Functions ---

/**
 * Get the current site settings.
 *
 * Returns the module-level cache if already populated (memoized within the
 * same Worker invocation). Queries `site_settings WHERE id = 1`; if no row
 * exists, returns `SiteSettingsDefaults` without throwing.
 */
export async function getSiteSettings(db: D1Database): Promise<SiteSettings> {
  if (_cache !== null) {
    return _cache;
  }

  const row = await db
    .prepare("SELECT * FROM site_settings WHERE id = 1")
    .first<SiteSettingsRow>();

  const settings = row ? mapRow(row) : SiteSettingsDefaults;
  _cache = settings;
  return settings;
}

/**
 * Update site settings with a partial patch.
 *
 * 1. Fetches current state via `getSiteSettings`.
 * 2. Merges patch over current state (only defined keys override).
 * 3. Persists via `INSERT OR REPLACE INTO site_settings (id, ...) VALUES (1, ...)`.
 * 4. Clears `_cache`, then returns fresh state from DB.
 */
export async function updateSiteSettings(
  db: D1Database,
  patch: Partial<Omit<SiteSettings, "updatedAt">>
): Promise<SiteSettings> {
  const current = await getSiteSettings(db);
  const merged: Omit<SiteSettings, "updatedAt"> = {
    brandNameId: patch.brandNameId ?? current.brandNameId,
    brandNameEn: patch.brandNameEn ?? current.brandNameEn,
    taglineId: patch.taglineId ?? current.taglineId,
    taglineEn: patch.taglineEn ?? current.taglineEn,
    logoUrl: patch.logoUrl !== undefined ? patch.logoUrl : current.logoUrl,
    faviconUrl: patch.faviconUrl !== undefined ? patch.faviconUrl : current.faviconUrl,
    primaryWhatsappNumber: patch.primaryWhatsappNumber ?? current.primaryWhatsappNumber,
    supportEmail: patch.supportEmail ?? current.supportEmail,
    address: patch.address !== undefined ? patch.address : current.address,
    socialInstagramUrl:
      patch.socialInstagramUrl !== undefined
        ? patch.socialInstagramUrl
        : current.socialInstagramUrl,
    socialYoutubeUrl:
      patch.socialYoutubeUrl !== undefined
        ? patch.socialYoutubeUrl
        : current.socialYoutubeUrl,
    socialFacebookUrl:
      patch.socialFacebookUrl !== undefined
        ? patch.socialFacebookUrl
        : current.socialFacebookUrl,
    socialTiktokUrl:
      patch.socialTiktokUrl !== undefined
        ? patch.socialTiktokUrl
        : current.socialTiktokUrl,
    heroImageUrl: patch.heroImageUrl ?? current.heroImageUrl,
    heroTitleId: patch.heroTitleId ?? current.heroTitleId,
    heroTitleEn: patch.heroTitleEn ?? current.heroTitleEn,
    heroSubtitleId: patch.heroSubtitleId ?? current.heroSubtitleId,
    heroSubtitleEn: patch.heroSubtitleEn ?? current.heroSubtitleEn,
    heroCtaTextId: patch.heroCtaTextId ?? current.heroCtaTextId,
    heroCtaTextEn: patch.heroCtaTextEn ?? current.heroCtaTextEn,
    destinationsCountOverride:
      patch.destinationsCountOverride !== undefined
        ? patch.destinationsCountOverride
        : current.destinationsCountOverride,
    destinationsCountAuto:
      patch.destinationsCountAuto !== undefined
        ? patch.destinationsCountAuto
        : current.destinationsCountAuto,
    partnersCount: patch.partnersCount ?? current.partnersCount,
    happyTouristsCount: patch.happyTouristsCount ?? current.happyTouristsCount,
    averageRating: patch.averageRating ?? current.averageRating,
    defaultOgImage:
      patch.defaultOgImage !== undefined
        ? patch.defaultOgImage
        : current.defaultOgImage,
    defaultMetaDescriptionTemplateId:
      patch.defaultMetaDescriptionTemplateId ??
      current.defaultMetaDescriptionTemplateId,
    defaultMetaDescriptionTemplateEn:
      patch.defaultMetaDescriptionTemplateEn ??
      current.defaultMetaDescriptionTemplateEn,
    copyrightText: patch.copyrightText ?? current.copyrightText,
    footerTaglineId:
      patch.footerTaglineId !== undefined
        ? patch.footerTaglineId
        : current.footerTaglineId,
    footerTaglineEn:
      patch.footerTaglineEn !== undefined
        ? patch.footerTaglineEn
        : current.footerTaglineEn,
    gtmContainerId:
      patch.gtmContainerId !== undefined
        ? patch.gtmContainerId
        : current.gtmContainerId,
    ga4MeasurementId:
      patch.ga4MeasurementId !== undefined
        ? patch.ga4MeasurementId
        : current.ga4MeasurementId,
    customHeadHtml:
      patch.customHeadHtml !== undefined
        ? patch.customHeadHtml
        : current.customHeadHtml,
  };

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);

  await db
    .prepare(
      `INSERT OR REPLACE INTO site_settings (
        id,
        brand_name_id, brand_name_en,
        tagline_id, tagline_en,
        logo_url, favicon_url,
        primary_whatsapp_number, support_email, address,
        social_instagram_url, social_youtube_url, social_facebook_url, social_tiktok_url,
        hero_image_url,
        hero_title_id, hero_title_en,
        hero_subtitle_id, hero_subtitle_en,
        hero_cta_text_id, hero_cta_text_en,
        destinations_count_override, destinations_count_auto,
        partners_count, happy_tourists_count, average_rating,
        default_og_image,
        default_meta_description_template_id, default_meta_description_template_en,
        copyright_text, footer_tagline_id, footer_tagline_en,
        gtm_container_id, ga4_measurement_id, custom_head_html,
        updated_at
      ) VALUES (
        1,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?,
        ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?
      )`
    )
    .bind(
      merged.brandNameId,
      merged.brandNameEn,
      merged.taglineId,
      merged.taglineEn,
      merged.logoUrl,
      merged.faviconUrl,
      merged.primaryWhatsappNumber,
      merged.supportEmail,
      merged.address,
      merged.socialInstagramUrl,
      merged.socialYoutubeUrl,
      merged.socialFacebookUrl,
      merged.socialTiktokUrl,
      merged.heroImageUrl,
      merged.heroTitleId,
      merged.heroTitleEn,
      merged.heroSubtitleId,
      merged.heroSubtitleEn,
      merged.heroCtaTextId,
      merged.heroCtaTextEn,
      merged.destinationsCountOverride,
      merged.destinationsCountAuto ? 1 : 0,
      merged.partnersCount,
      merged.happyTouristsCount,
      merged.averageRating,
      merged.defaultOgImage,
      merged.defaultMetaDescriptionTemplateId,
      merged.defaultMetaDescriptionTemplateEn,
      merged.copyrightText,
      merged.footerTaglineId,
      merged.footerTaglineEn,
      merged.gtmContainerId,
      merged.ga4MeasurementId,
      merged.customHeadHtml,
      now
    )
    .run();

  // Clear cache so the next read fetches fresh data from DB
  _cache = null;
  return getSiteSettings(db);
}

/**
 * Clear the module-level settings cache.
 * Intended for use in tests to reset state between test cases.
 */
export function clearSettingsCache(): void {
  _cache = null;
}
