# Design Document: infotour-directory

## Architecture Overview

The infotour-directory system follows a hybrid static/dynamic architecture using Astro's SSG (Static Site Generation) for public pages and SSR (Server-Side Rendering) via Cloudflare Workers for the admin dashboard and API routes. The platform supports bilingual content (Bahasa Indonesia as default, English as secondary) using URL path-based language routing.

```
┌─────────────────────────────────────────────────────────┐
│                   Cloudflare Pages                        │
├─────────────────────────────────────────────────────────┤
│  Static Assets (SSG)         │  Workers (SSR/API)        │
│  ─────────────────────       │  ─────────────────────    │
│  • /destinations/{slug}  (ID)│  • /admin/* routes        │
│  • /en/destinations/{slug}   │  • /api/* endpoints       │
│  • / (directory listing ID)  │  • Auth middleware        │
│  • /en/ (directory EN)       │  • Content generation     │
│  • /blog/{slug} (ID)         │                           │
│  • /en/blog/{slug} (EN)      │                           │
│  • sitemap.xml               │                           │
└──────────────────────────────┴───────────────────────────┘
                                        │
                                        ▼
                              ┌─────────────────┐
                              │  Cloudflare D1   │
                              │  (SQLite)        │
                              └─────────────────┘
                                        │
                              ┌─────────┴─────────┐
                              ▼                   ▼
                     ┌──────────────┐    ┌──────────────┐
                     │  Exa.ai API  │    │ DeepSeek API │
                     │  (Research)  │    │ (Generation) │
                     └──────────────┘    └──────────────┘
```

### Rendering Strategy

- **Public pages** (destinations, directory, blog): Pre-rendered at build time in both languages via `astro build`. Rebuilt on content changes via Cloudflare Pages deploy hooks.
- **Admin pages** (`/admin/*`): Server-side rendered on each request via Cloudflare Workers. Admin UI is in Bahasa Indonesia only.
- **API routes** (`/api/*`): Handled by Cloudflare Workers for CRUD operations and AI content generation.

### Bilingual URL Routing Strategy

| Language | URL Pattern | Example |
|----------|-------------|---------|
| Bahasa Indonesia (default) | `/{path}` | `/destinations/bali-kintamani` |
| English | `/en/{path}` | `/en/destinations/bali-kintamani` |

- Root path `/` serves Bahasa Indonesia content (no prefix needed)
- `/en/` prefix serves English content
- All public pages generate both language versions at build time
- Each page includes `<link rel="alternate" hreflang="...">` pointing to the other language version

## Components

### 1. Page Components (Astro)

```
src/
├── pages/
│   ├── index.astro                         # Directory listing (ID)
│   ├── en/
│   │   ├── index.astro                     # Directory listing (EN)
│   │   ├── destinations/
│   │   │   └── [slug].astro                # Destination page (EN, SSG)
│   │   └── blog/
│   │       ├── index.astro                 # Blog listing (EN)
│   │       └── [slug].astro                # Blog article (EN, SSG)
│   ├── destinations/
│   │   └── [slug].astro                    # Destination page (ID, SSG)
│   ├── blog/
│   │   ├── index.astro                     # Blog listing (ID)
│   │   └── [slug].astro                    # Blog article (ID, SSG)
│   ├── admin/
│   │   ├── index.astro                     # Admin dashboard (SSR)
│   │   ├── login.astro                     # Login page (SSR)
│   │   ├── destinations/
│   │   │   ├── index.astro                 # Destination management list
│   │   │   ├── new.astro                   # Create destination form (bilingual)
│   │   │   └── [id]/edit.astro             # Edit destination form (bilingual)
│   │   └── blog/
│   │       ├── index.astro                 # Blog management list
│   │       ├── generate.astro              # AI generation trigger (with lang select)
│   │       └── [id]/edit.astro             # Edit blog draft
│   ├── sitemap.xml.ts                      # Dynamic sitemap with hreflang
│   └── 404.astro                           # Custom error page
├── components/
│   ├── destination/
│   │   ├── HeroSection.astro
│   │   ├── AboutSection.astro
│   │   ├── GallerySection.astro
│   │   ├── ServicesSection.astro
│   │   ├── TestimonialsSection.astro
│   │   ├── HowToBookSection.astro
│   │   ├── FaqSection.astro
│   │   └── SectionNav.astro
│   ├── blog/
│   │   ├── ArticleCard.astro
│   │   ├── ArticleContent.astro
│   │   └── RelatedDestinations.astro
│   ├── directory/
│   │   ├── DestinationCard.astro
│   │   └── DestinationGrid.astro
│   ├── ui/
│   │   ├── WhatsAppButton.astro
│   │   ├── LanguageSwitcher.astro          # Language toggle (ID/EN)
│   │   ├── MobileNav.astro
│   │   ├── Header.astro
│   │   └── Footer.astro
│   └── admin/
│       ├── DestinationForm.astro           # Bilingual form with tabs
│       ├── BlogEditor.astro
│       └── AdminLayout.astro
├── layouts/
│   ├── BaseLayout.astro                    # Public layout with SEO + hreflang
│   └── AdminLayout.astro                   # Admin layout with auth check
├── lib/
│   ├── db/
│   │   ├── schema.ts                       # D1 table definitions
│   │   ├── destinations.ts                 # Destination CRUD operations
│   │   └── blog.ts                         # Blog CRUD operations
│   ├── auth/
│   │   ├── session.ts                      # Session management
│   │   └── middleware.ts                   # Auth middleware
│   ├── ai/
│   │   ├── exa.ts                          # Exa.ai research client
│   │   ├── deepseek.ts                     # DeepSeek generation client
│   │   └── content-generator.ts            # Orchestrates research + generation
│   ├── i18n/
│   │   ├── config.ts                       # Language config & supported locales
│   │   ├── utils.ts                        # getLocale, getAlternateUrl, t() helper
│   │   ├── id.ts                           # Static UI strings (Bahasa Indonesia)
│   │   └── en.ts                           # Static UI strings (English)
│   ├── seo/
│   │   ├── meta.ts                         # Meta tag + hreflang generation
│   │   ├── sitemap.ts                      # Sitemap XML with hreflang
│   │   └── slug.ts                         # URL slug generation
│   └── whatsapp.ts                         # WhatsApp URL builder
└── middleware.ts                            # Astro middleware (auth guard)
```

### 2. API Routes

```
src/pages/api/
├── auth/
│   ├── login.ts                       # POST: authenticate admin
│   └── logout.ts                      # POST: revoke session
├── destinations/
│   ├── index.ts                       # GET: list, POST: create (bilingual)
│   └── [id].ts                        # GET, PUT, DELETE: single destination
├── blog/
│   ├── index.ts                       # GET: list, POST: create
│   ├── [id].ts                        # GET, PUT, DELETE: single article
│   └── generate.ts                    # POST: trigger AI generation (with lang param)
└── sitemap/
    └── rebuild.ts                     # POST: trigger sitemap rebuild
```

## Interfaces

### i18n Types

```typescript
type Locale = "id" | "en";

interface LocalizedString {
  id: string;  // Bahasa Indonesia
  en: string;  // English
}

interface I18nConfig {
  defaultLocale: Locale;
  locales: Locale[];
  urlPrefix: Record<Locale, string>; // { id: "", en: "/en" }
}

// Helper to get localized value
function t(localized: LocalizedString, locale: Locale): string;

// Get current locale from URL path
function getLocaleFromUrl(url: URL): Locale;

// Build alternate URL for hreflang
function getAlternateUrl(currentUrl: URL, targetLocale: Locale): string;
```

### Destination Data Interface

```typescript
interface Destination {
  id: string;
  slug: string;
  title: LocalizedString;
  tagline: LocalizedString;
  heroImage: string;
  aboutText: LocalizedString;
  galleryImages: GalleryImage[];
  services: ServicePackage[];
  testimonials: Testimonial[];
  faqEntries: FaqEntry[];
  whatsappNumber: string;
  status: "published" | "draft";
  createdAt: string;
  updatedAt: string;
}

interface GalleryImage {
  url: string;
  alt: LocalizedString;
  order: number;
}

interface ServicePackage {
  id: string;
  name: LocalizedString;
  description: LocalizedString;
  price: string;
  features: LocalizedString[];
}

interface Testimonial {
  id: string;
  author: string;
  content: LocalizedString;
  rating: number;
}

interface FaqEntry {
  id: string;
  question: LocalizedString;
  answer: LocalizedString;
  order: number;
}
```

### Blog Article Interface

```typescript
interface BlogArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  language: Locale;                    // Which language this article is in
  thumbnailUrl: string;
  metaDescription: string;
  ogImage: string;
  relatedDestinationIds: string[];
  pairedArticleId: string | null;      // ID of the same article in other language
  status: "published" | "draft";
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### Auth Interfaces

```typescript
interface LoginRequest {
  username: string;
  password: string;
}

interface Session {
  id: string;
  adminId: string;
  expiresAt: string;
}

interface AuthResult {
  success: boolean;
  session?: Session;
  error?: string;
}
```

### Content Generation Interface

```typescript
interface GenerationRequest {
  topic: string;
  destinationId?: string;
  keywords?: string[];
  targetLanguage: Locale;              // Generate in ID or EN
}

interface GenerationResult {
  success: boolean;
  article?: BlogArticle;
  error?: string;
}

interface ExaResearchResult {
  sources: Array<{
    title: string;
    url: string;
    content: string;
  }>;
}
```

### WhatsApp URL Builder

```typescript
interface WhatsAppConfig {
  phoneNumber: string;
  destinationName: string;
  messageTemplate?: string;
}

function buildWhatsAppUrl(config: WhatsAppConfig): string;
```

### SEO Utilities

```typescript
interface MetaTags {
  title: string;
  description: string;
  canonicalUrl: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogType: string;
  hreflang: HreflangEntry[];
}

interface HreflangEntry {
  locale: Locale;
  url: string;
}

interface SitemapEntry {
  url: string;
  lastmod: string;
  changefreq: "daily" | "weekly" | "monthly";
  priority: number;
  alternates: HreflangEntry[];
}

function generateSlug(title: string): string;
function generateMetaTags(data: Destination | BlogArticle, locale: Locale): MetaTags;
function generateSitemap(entries: SitemapEntry[]): string;
```

## Data Models (Cloudflare D1 Schema)

```sql
-- Destinations table (bilingual fields use _id and _en suffixes)
CREATE TABLE destinations (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title_id TEXT NOT NULL,
  title_en TEXT NOT NULL,
  tagline_id TEXT NOT NULL,
  tagline_en TEXT NOT NULL,
  hero_image TEXT NOT NULL,
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
  destination_id TEXT NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt_id TEXT NOT NULL,
  alt_en TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Service packages (bilingual name, description, features)
CREATE TABLE service_packages (
  id TEXT PRIMARY KEY,
  destination_id TEXT NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  name_id TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_id TEXT NOT NULL,
  description_en TEXT NOT NULL,
  price TEXT NOT NULL,
  features_id TEXT NOT NULL DEFAULT '[]',
  features_en TEXT NOT NULL DEFAULT '[]'
);

-- Testimonials (bilingual content)
CREATE TABLE testimonials (
  id TEXT PRIMARY KEY,
  destination_id TEXT NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  content_id TEXT NOT NULL,
  content_en TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5)
);

-- FAQ entries (bilingual question and answer)
CREATE TABLE faq_entries (
  id TEXT PRIMARY KEY,
  destination_id TEXT NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
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

-- Blog-destination relationships
CREATE TABLE blog_destination_links (
  blog_id TEXT NOT NULL REFERENCES blog_articles(id) ON DELETE CASCADE,
  destination_id TEXT NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  PRIMARY KEY (blog_id, destination_id)
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
CREATE INDEX idx_destinations_status ON destinations(status);
CREATE INDEX idx_destinations_slug ON destinations(slug);
CREATE INDEX idx_blog_articles_status ON blog_articles(status);
CREATE INDEX idx_blog_articles_slug ON blog_articles(slug);
CREATE INDEX idx_blog_articles_language ON blog_articles(language);
CREATE INDEX idx_blog_articles_paired ON blog_articles(paired_article_id);
CREATE INDEX idx_admin_sessions_expires ON admin_sessions(expires_at);
```

## Bilingual Implementation Strategy

### Static UI Strings

Static UI text (navigation labels, button text, section headings) is stored in translation files:

```typescript
// src/lib/i18n/id.ts
export const id = {
  nav: { home: "Beranda", destinations: "Destinasi", blog: "Blog" },
  destination: {
    heroBook: "Pesan Sekarang",
    aboutTitle: "Tentang",
    galleryTitle: "Galeri Foto",
    servicesTitle: "Paket & Layanan",
    testimonialsTitle: "Testimoni",
    howToBookTitle: "Cara Pemesanan",
    faqTitle: "Pertanyaan Umum",
  },
  common: { readMore: "Baca Selengkapnya", switchLang: "English" },
};

// src/lib/i18n/en.ts
export const en = {
  nav: { home: "Home", destinations: "Destinations", blog: "Blog" },
  destination: {
    heroBook: "Book Now",
    aboutTitle: "About",
    galleryTitle: "Photo Gallery",
    servicesTitle: "Packages & Services",
    testimonialsTitle: "Testimonials",
    howToBookTitle: "How to Book",
    faqTitle: "FAQ",
  },
  common: { readMore: "Read More", switchLang: "Bahasa Indonesia" },
};
```

### Dynamic Content (from D1)

Destination content uses `_id` / `_en` column suffixes. The data layer maps these to `LocalizedString` objects, and components select the correct language based on the current locale.

### Blog Articles

Blog articles are stored as single-language documents. Two articles can be "paired" via `paired_article_id` to indicate they are translations of each other. This allows articles to exist in only one language (Req 11.10).

### Language Switcher Behavior

The `LanguageSwitcher` component:
1. Detects current locale from URL path
2. Builds the alternate URL (same slug, different prefix)
3. Renders a link/button to switch
4. For blog articles without a paired translation, the switcher links to the blog listing in the other language

## Error Handling

### Error Categories

| Category | HTTP Status | Handling Strategy |
|----------|-------------|-------------------|
| Not Found (unpublished/missing destination) | 404 | Custom 404.astro page |
| Authentication Required | 302 | Redirect to /admin/login |
| Invalid Credentials | 401 | Error message on login form |
| Validation Error (form input) | 400 | Inline field errors on form |
| AI Generation Failure | 500 | Error message in admin UI with retry option |
| D1 Database Error | 500 | User-friendly error page |
| Worker CPU Limit Exceeded | 503 | Custom error page with retry suggestion |

### Error Response Format (API)

```typescript
interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}
```

### Middleware Error Handling

```typescript
// src/middleware.ts
export const onRequest: MiddlewareHandler = async (context, next) => {
  const { pathname } = context.url;

  // Admin route protection
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const session = await validateSession(context);
    if (!session) {
      return context.redirect("/admin/login");
    }
  }

  try {
    return await next();
  } catch (error) {
    if (error instanceof WorkerCpuLimitError) {
      return new Response(renderErrorPage("Service temporarily unavailable"), {
        status: 503,
        headers: { "Content-Type": "text/html" },
      });
    }
    throw error;
  }
};
```

## Key Design Decisions

1. **Static-first rendering**: All public pages are pre-rendered at build time in both languages for maximum performance on Cloudflare Pages CDN.

2. **Path-based i18n routing**: Root path `/` serves Bahasa Indonesia (default), `/en/` prefix serves English. No cookie/header-based detection — simple, SEO-friendly, cacheable.

3. **Column-suffix bilingual storage**: Destination fields use `_id`/`_en` suffixes in D1 rather than a separate translations table. Simpler queries, no JOINs needed, stays within D1 free tier limits.

4. **Single-language blog articles**: Blog articles are stored per-language and optionally paired. This supports the requirement that articles may exist in only one language.

5. **Single D1 database**: All structured data lives in one D1 database to stay within free tier limits.

6. **Session-based auth**: Simple cookie-based sessions stored in D1. No external auth provider needed for a single-admin system.

7. **Slug-based routing**: Destinations and blog articles use URL slugs derived from titles for SEO-friendly URLs. Same slug used across both languages.

8. **WhatsApp deep links**: Use `https://wa.me/{number}?text={encoded_message}` format for cross-platform compatibility.

9. **Build-time sitemap with hreflang**: Sitemap includes all published pages in both languages with `xhtml:link` hreflang annotations.

10. **AI pipeline with language targeting**: Exa.ai handles research, DeepSeek generates content in the specified target language. Admin selects target language before generation.

## Correctness Properties

### Property 1: Destination page section structure

*For any* valid destination data and *for any* supported locale, the rendered destination page SHALL contain all seven sections (Hero, About, Gallery, Services/Packages, Testimonials, How to Book, FAQ) in that exact order, with content displayed in the active locale.

**Validates: Requirements 1.1, 1.2, 11.5**

### Property 2: Directory listing completeness

*For any* set of published destinations and *for any* supported locale, the directory listing page SHALL render an entry for each published destination containing its localized thumbnail alt, name, short description, and a link to the correct destination page URL with appropriate language prefix.

**Validates: Requirements 2.1, 2.2, 11.5**

### Property 3: WhatsApp URL construction

*For any* destination name and WhatsApp number, the generated WhatsApp URL SHALL be a valid `https://wa.me/{number}?text={encoded_message}` URL where the encoded message contains the destination name.

**Validates: Requirements 3.2**

### Property 4: Invalid credentials rejection

*For any* credential pair that does not match a stored admin user, the login endpoint SHALL return an error response without creating a session.

**Validates: Requirements 4.3**

### Property 5: Destination creation round-trip (bilingual)

*For any* valid bilingual destination data submitted through the creation endpoint, reading back the destination by its ID SHALL return data equivalent to what was submitted in both languages.

**Validates: Requirements 5.2**

### Property 6: Destination edit round-trip (bilingual)

*For any* existing destination and valid bilingual edit payload, applying the edit and reading back the destination SHALL return data reflecting the applied changes in both languages.

**Validates: Requirements 5.4**

### Property 7: Unpublished destination exclusion

*For any* set of destinations with mixed publish states, the public directory listing in any language SHALL contain only destinations with status "published", and requesting the URL of an unpublished destination in any language SHALL return a 404 response.

**Validates: Requirements 5.5, 11.5**

### Property 8: Blog URL slug generation

*For any* blog article title, the generated slug SHALL be lowercase, contain only alphanumeric characters and hyphens, not start or end with a hyphen, and not contain consecutive hyphens.

**Validates: Requirements 6.5**

### Property 9: Blog listing completeness (per language)

*For any* set of published blog articles, the blog listing page for a given locale SHALL render entries only for articles in that locale, showing title, excerpt, publication date, thumbnail, and a link to the correct article URL with appropriate language prefix.

**Validates: Requirements 7.1, 7.2, 11.10**

### Property 10: Article SEO metadata with hreflang

*For any* published blog article that has a paired translation, the rendered article page SHALL include hreflang link elements pointing to the paired article URL in the alternate language.

**Validates: Requirements 7.3, 11.6**

### Property 11: Destination page meta tags with hreflang

*For any* published destination and *for any* supported locale, the rendered destination page SHALL include a meta title, meta description, Open Graph tags, canonical URL, and hreflang link elements referencing the alternate language version.

**Validates: Requirements 8.2, 11.6**

### Property 12: Sitemap completeness with hreflang

*For any* set of published destinations and published blog articles, the generated sitemap.xml SHALL contain URL entries for every published page in both languages, with `xhtml:link` hreflang annotations linking alternate language versions.

**Validates: Requirements 8.3, 11.6**

### Property 13: Image optimization attributes

*For any* destination with gallery images, all gallery images rendered below the fold SHALL have the `loading="lazy"` attribute and use an optimized image format (WebP or AVIF with fallback).

**Validates: Requirements 8.5**

### Property 14: Language switcher navigation

*For any* public page in locale L, the Language_Switcher SHALL render a link to the equivalent page in the alternate locale, preserving the current page context (same destination or article).

**Validates: Requirements 11.3, 11.4**

### Property 15: Default language fallback

*For any* URL without a language prefix, the system SHALL serve content in Bahasa Indonesia (the default language).

**Validates: Requirements 11.2, 11.7**
