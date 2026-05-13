/**
 * D1 Database Schema TypeScript Interfaces
 * PT Alkhaleej Travelindo Utama — Hajj & Umrah Travel
 *
 * These interfaces match the Cloudflare D1 (SQLite) schema defined in
 * migrations/0001_initial_schema.sql. Bilingual fields use _id (Bahasa Indonesia)
 * and _en (English) suffixes.
 */

/** Package status options */
export type PackageStatus = "published" | "draft";

/** Package type options */
export type PackageType = "haji_mujamalah" | "umrah" | "umrah_plus" | "tour_muslim";

/** Blog article language options */
export type ArticleLanguage = "id" | "en";

/** Blog article status options */
export type ArticleStatus = "published" | "draft";

/** Departure schedule status */
export type ScheduleStatus = "open" | "full" | "closed";

/** Packages table row */
export interface PackageRow {
  id: string;
  slug: string;
  title_id: string;
  title_en: string;
  tagline_id: string;
  tagline_en: string;
  hero_image: string;
  package_type: PackageType;
  about_text_id: string;
  about_text_en: string;
  whatsapp_number: string;
  status: PackageStatus;
  created_at: string;
  updated_at: string;
}

/** Gallery images table row */
export interface GalleryImageRow {
  id: string;
  package_id: string;
  url: string;
  alt_id: string;
  alt_en: string;
  sort_order: number;
}

/** Package tiers table row */
export interface PackageTierRow {
  id: string;
  package_id: string;
  name_id: string;
  name_en: string;
  description_id: string;
  description_en: string;
  price: string;
  duration_id: string;
  duration_en: string;
  hotel_rating: string | null;
  airline: string | null;
  /** JSON array of features in Bahasa Indonesia */
  features_id: string;
  /** JSON array of features in English */
  features_en: string;
  sort_order: number;
}

/** Departure schedules table row */
export interface DepartureScheduleRow {
  id: string;
  package_id: string;
  departure_date: string;
  return_date: string | null;
  departure_city_id: string;
  departure_city_en: string;
  available_seats: number;
  status: ScheduleStatus;
  notes: string | null;
  sort_order: number;
}

/** Testimonials table row */
export interface TestimonialRow {
  id: string;
  package_id: string;
  author: string;
  content_id: string;
  content_en: string;
  rating: number;
  origin_city: string | null;
  year: string | null;
}

/** FAQ entries table row */
export interface FaqEntryRow {
  id: string;
  package_id: string;
  question_id: string;
  question_en: string;
  answer_id: string;
  answer_en: string;
  sort_order: number;
}

/** Blog articles table row */
export interface BlogArticleRow {
  id: string;
  slug: string;
  language: ArticleLanguage;
  title: string;
  excerpt: string;
  content: string;
  thumbnail_url: string | null;
  meta_description: string;
  og_image: string | null;
  paired_article_id: string | null;
  status: ArticleStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Blog-package link table row (composite primary key) */
export interface BlogPackageLinkRow {
  blog_id: string;
  package_id: string;
}

/** Admin sessions table row */
export interface AdminSessionRow {
  id: string;
  admin_id: string;
  expires_at: string;
  created_at: string;
}

/** Admin users table row */
export interface AdminUserRow {
  id: string;
  username: string;
  password_hash: string;
}

/** Site settings table row (single-row table, id always = 1) */
export interface SiteSettingsRow {
  id: number;
  brand_name_id: string;
  brand_name_en: string;
  tagline_id: string;
  tagline_en: string;
  logo_url: string | null;
  favicon_url: string | null;
  primary_whatsapp_number: string;
  support_email: string;
  address: string | null;
  social_instagram_url: string | null;
  social_youtube_url: string | null;
  social_facebook_url: string | null;
  social_tiktok_url: string | null;
  hero_image_url: string;
  hero_title_id: string;
  hero_title_en: string;
  hero_subtitle_id: string;
  hero_subtitle_en: string;
  hero_cta_text_id: string;
  hero_cta_text_en: string;
  packages_count_override: number | null;
  packages_count_auto: number;
  happy_jamaah_count: number;
  average_rating: number;
  years_experience: number;
  default_og_image: string | null;
  default_meta_description_template_id: string;
  default_meta_description_template_en: string;
  copyright_text: string;
  footer_tagline_id: string | null;
  footer_tagline_en: string | null;
  gtm_container_id: string | null;
  ga4_measurement_id: string | null;
  custom_head_html: string | null;
  updated_at: string;
}

/** Login attempts table row (used for rate limiting) */
export interface LoginAttemptRow {
  id: string;
  ip: string;
  attempted_at: string;
}

/** Database table names for type-safe queries */
export type TableName =
  | "packages"
  | "gallery_images"
  | "package_tiers"
  | "departure_schedules"
  | "testimonials"
  | "faq_entries"
  | "blog_articles"
  | "blog_package_links"
  | "admin_sessions"
  | "admin_users"
  | "site_settings"
  | "login_attempts";
