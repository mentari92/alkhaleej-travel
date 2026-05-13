-- Migration: 0001_initial_schema
-- Description: Initial database schema for Alkhaleej Travelindo Utama
-- Hajj & Umrah travel website
-- Bilingual fields use _id (Bahasa Indonesia) and _en (English) suffixes

-- Packages table (Haji Reguler, Haji Furoda, Umrah, dll)
CREATE TABLE packages (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title_id TEXT NOT NULL,
  title_en TEXT NOT NULL,
  tagline_id TEXT NOT NULL,
  tagline_en TEXT NOT NULL,
  hero_image TEXT NOT NULL,
  package_type TEXT NOT NULL CHECK(package_type IN ('haji_mujamalah', 'umrah', 'umrah_plus', 'tour_muslim')),
  about_text_id TEXT NOT NULL,
  about_text_en TEXT NOT NULL,
  whatsapp_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('published', 'draft')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Gallery images (bilingual alt text)
CREATE TABLE gallery_images (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt_id TEXT NOT NULL,
  alt_en TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Package tiers/pricing (bilingual name, description, features)
-- e.g., Paket Silver, Gold, Platinum
CREATE TABLE package_tiers (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  name_id TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_id TEXT NOT NULL,
  description_en TEXT NOT NULL,
  price TEXT NOT NULL,
  duration_id TEXT NOT NULL,
  duration_en TEXT NOT NULL,
  hotel_rating TEXT,
  airline TEXT,
  features_id TEXT NOT NULL DEFAULT '[]',
  features_en TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Departure schedules
CREATE TABLE departure_schedules (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  departure_date TEXT NOT NULL,
  return_date TEXT,
  departure_city_id TEXT NOT NULL,
  departure_city_en TEXT NOT NULL,
  available_seats INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'full', 'closed')),
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Testimonials (bilingual content)
CREATE TABLE testimonials (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  content_id TEXT NOT NULL,
  content_en TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
  origin_city TEXT,
  year TEXT
);

-- FAQ entries (bilingual question and answer)
CREATE TABLE faq_entries (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  question_en TEXT NOT NULL,
  answer_id TEXT NOT NULL,
  answer_en TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Blog articles (single language per article, paired via paired_article_id)
CREATE TABLE blog_articles (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  language TEXT NOT NULL CHECK(language IN ('id', 'en')),
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  content TEXT NOT NULL,
  thumbnail_url TEXT,
  meta_description TEXT NOT NULL,
  og_image TEXT,
  paired_article_id TEXT REFERENCES blog_articles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('published', 'draft')),
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Blog-package relationships
CREATE TABLE blog_package_links (
  blog_id TEXT NOT NULL REFERENCES blog_articles(id) ON DELETE CASCADE,
  package_id TEXT NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  PRIMARY KEY (blog_id, package_id)
);

-- Admin sessions
CREATE TABLE admin_sessions (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Admin users (single admin)
CREATE TABLE admin_users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL
);

-- Indexes
CREATE INDEX idx_packages_status ON packages(status);
CREATE INDEX idx_packages_slug ON packages(slug);
CREATE INDEX idx_packages_type ON packages(package_type);
CREATE INDEX idx_departure_schedules_package ON departure_schedules(package_id);
CREATE INDEX idx_departure_schedules_date ON departure_schedules(departure_date);
CREATE INDEX idx_blog_articles_status ON blog_articles(status);
CREATE INDEX idx_blog_articles_slug ON blog_articles(slug);
CREATE INDEX idx_blog_articles_language ON blog_articles(language);
CREATE INDEX idx_blog_articles_paired ON blog_articles(paired_article_id);
CREATE INDEX idx_admin_sessions_expires ON admin_sessions(expires_at);
