# Implementation Plan: infotour-directory

## Overview

Build a full-stack bilingual tourism destination directory for Indonesia using Astro + Cloudflare. The platform supports Bahasa Indonesia (default) and English via URL path-based routing. Implementation proceeds from foundational infrastructure (database schema, i18n, project structure, auth) through public-facing pages (destinations, directory, blog) to admin features (CRUD, AI content generation). Each phase builds incrementally on the previous, with tests validating correctness properties from the design.

## Tasks

- [x] 1. Project setup and core infrastructure
  - [x] 1.1 Initialize Astro project with Cloudflare adapter and configure Tailwind CSS + shadcn/ui
    - Create Astro project with `@astrojs/cloudflare` adapter
    - Configure `tailwind.config.mjs` with mobile-first breakpoints
    - Set up shadcn/ui component primitives
    - Configure `wrangler.toml` for D1 binding and environment variables
    - Create `src/env.d.ts` with Cloudflare runtime type definitions
    - _Requirements: 10.1, 10.3_

  - [x] 1.2 Create D1 database schema and migration files (bilingual)
    - Write SQL migration file with all tables using `_id`/`_en` suffix pattern for bilingual fields: destinations, gallery_images, service_packages, testimonials, faq_entries, blog_articles (with language column + paired_article_id), blog_destination_links, admin_sessions, admin_users
    - Include all indexes defined in the design (including idx_blog_articles_language, idx_blog_articles_paired)
    - Create `src/lib/db/schema.ts` with TypeScript interfaces matching the D1 schema
    - _Requirements: 10.3, 5.2, 11.1_

  - [x] 1.3 Implement i18n configuration and utilities
    - Create `src/lib/i18n/config.ts` with Locale type, supported locales, default locale, URL prefix mapping
    - Create `src/lib/i18n/utils.ts` with `t()`, `getLocaleFromUrl()`, `getAlternateUrl()` helper functions
    - Create `src/lib/i18n/id.ts` with static UI strings in Bahasa Indonesia
    - Create `src/lib/i18n/en.ts` with static UI strings in English
    - _Requirements: 11.1, 11.2, 11.7_

  - [x] 1.4 Implement shared TypeScript interfaces and types
    - Create `src/lib/types.ts` with LocalizedString, Destination, BlogArticle, GalleryImage, ServicePackage, Testimonial, FaqEntry, Session, AuthResult, ApiError, HreflangEntry interfaces
    - Create `src/lib/db/destinations.ts` with CRUD function signatures
    - Create `src/lib/db/blog.ts` with CRUD function signatures
    - _Requirements: 5.2, 6.5, 11.5_

  - [x] 1.5 Create base layouts and shared UI components
    - Create `src/layouts/BaseLayout.astro` with SEO head slot, hreflang links, header, footer
    - Create `src/components/ui/Header.astro` with site navigation (localized labels)
    - Create `src/components/ui/Footer.astro` (localized)
    - Create `src/components/ui/MobileNav.astro` with hamburger menu for viewports < 768px
    - Create `src/components/ui/LanguageSwitcher.astro` that builds alternate URL and renders toggle
    - Ensure all interactive elements have 44x44px minimum tap targets
    - _Requirements: 9.1, 9.2, 11.3, 11.4, 11.9_

- [x] 2. Authentication system
  - [x] 2.1 Implement session management and auth utilities
    - Create `src/lib/auth/session.ts` with createSession, validateSession, revokeSession functions
    - Sessions stored in D1 admin_sessions table with expiry checking
    - Use crypto.randomUUID() for session IDs
    - _Requirements: 4.2, 4.4_

  - [x] 2.2 Implement Astro middleware for admin route protection
    - Create `src/middleware.ts` with onRequest handler
    - Redirect unauthenticated requests to `/admin/login` for all `/admin/*` routes except `/admin/login`
    - Handle Worker CPU limit errors with user-friendly 503 page
    - _Requirements: 4.1, 10.4_

  - [x] 2.3 Create login and logout API endpoints
    - Create `src/pages/api/auth/login.ts` (POST) with credential validation and session creation
    - Create `src/pages/api/auth/logout.ts` (POST) with session revocation
    - Hash passwords using Web Crypto API (PBKDF2)
    - Return appropriate error messages for invalid credentials
    - _Requirements: 4.2, 4.3, 4.4_

  - [x] 2.4 Create admin login page
    - Create `src/pages/admin/login.astro` with username/password form
    - Display inline error messages on invalid credentials
    - Redirect to `/admin` on successful login
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 2.5 Write property test for invalid credentials rejection
    - **Property 4: Invalid credentials rejection**
    - **Validates: Requirements 4.3**

- [x] 3. Checkpoint - Auth system verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Destination data layer and API (bilingual)
  - [x] 4.1 Implement destination CRUD operations in `src/lib/db/destinations.ts`
    - Implement createDestination: insert destination with bilingual fields + related records (gallery, services, testimonials, FAQ) in a transaction
    - Implement getDestinationBySlug, getDestinationById, listPublishedDestinations — all returning LocalizedString fields
    - Implement updateDestination: update destination + sync related records (both languages)
    - Implement updateDestinationStatus: toggle published/draft
    - Generate slugs from ID title using `src/lib/seo/slug.ts`
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 11.5_

  - [x] 4.2 Create destination API endpoints
    - Create `src/pages/api/destinations/index.ts` (GET: list all, POST: create with bilingual fields)
    - Create `src/pages/api/destinations/[id].ts` (GET, PUT, DELETE)
    - Validate request bodies including both language fields and return structured ApiError responses
    - Require authenticated session for all mutation endpoints
    - _Requirements: 5.2, 5.4, 5.5, 11.8_

  - [x] 4.3 Write property test for destination creation round-trip (bilingual)
    - **Property 5: Destination creation round-trip (bilingual)**
    - **Validates: Requirements 5.2**

  - [x] 4.4 Write property test for destination edit round-trip (bilingual)
    - **Property 6: Destination edit round-trip (bilingual)**
    - **Validates: Requirements 5.4**

  - [x] 4.5 Write property test for unpublished destination exclusion
    - **Property 7: Unpublished destination exclusion**
    - **Validates: Requirements 5.5, 11.5**

- [x] 5. SEO utilities and WhatsApp integration
  - [x] 5.1 Implement SEO utility functions with hreflang support
    - Create `src/lib/seo/slug.ts` with generateSlug function (lowercase, alphanumeric + hyphens, no leading/trailing/consecutive hyphens)
    - Create `src/lib/seo/meta.ts` with generateMetaTags function that includes hreflang entries for alternate language versions
    - _Requirements: 8.2, 6.5, 11.6_

  - [x] 5.2 Implement WhatsApp URL builder
    - Create `src/lib/whatsapp.ts` with buildWhatsAppUrl function
    - Format: `https://wa.me/{number}?text={encoded_message}` with destination name in message
    - _Requirements: 3.2_

  - [x] 5.3 Write property test for WhatsApp URL construction
    - **Property 3: WhatsApp URL construction**
    - **Validates: Requirements 3.2**

  - [x] 5.4 Write property test for blog URL slug generation
    - **Property 8: Blog URL slug generation**
    - **Validates: Requirements 6.5**

- [x] 6. Destination page components (bilingual)
  - [x] 6.1 Create destination section components
    - Create `src/components/destination/HeroSection.astro` with localized title, tagline, background image
    - Create `src/components/destination/AboutSection.astro` with localized content
    - Create `src/components/destination/GallerySection.astro` with lazy loading, optimized formats, localized alt text
    - Create `src/components/destination/ServicesSection.astro` with localized package names/descriptions
    - Create `src/components/destination/TestimonialsSection.astro` with localized testimonial content
    - Create `src/components/destination/HowToBookSection.astro` with inline WhatsApp CTA (localized labels)
    - Create `src/components/destination/FaqSection.astro` with localized Q&A
    - All components accept a `locale` prop and use `t()` for static strings
    - _Requirements: 1.1, 1.2, 8.5, 11.5_

  - [x] 6.2 Create section navigation and WhatsApp floating button
    - Create `src/components/destination/SectionNav.astro` with anchor links to all seven sections (localized labels)
    - Create `src/components/ui/WhatsAppButton.astro` as fixed floating button in bottom-right corner
    - Ensure smooth scroll behavior on anchor link clicks
    - _Requirements: 1.3, 3.1, 9.4_

  - [x] 6.3 Create destination page templates with SSG (both languages)
    - Create `src/pages/destinations/[slug].astro` with getStaticPaths querying published destinations (Bahasa Indonesia)
    - Create `src/pages/en/destinations/[slug].astro` with getStaticPaths (English)
    - Compose all section components in correct order: Hero, About, Gallery, Services, Testimonials, How to Book, FAQ
    - Include meta tags, Open Graph tags, canonical URL, and hreflang links in page head
    - Stack sections vertically on mobile with appropriate spacing
    - _Requirements: 1.1, 1.2, 1.4, 8.2, 9.3, 11.2, 11.5, 11.6_

  - [x] 6.4 Write property test for destination page section structure
    - **Property 1: Destination page section structure**
    - **Validates: Requirements 1.1, 1.2, 11.5**

  - [x] 6.5 Write property test for destination page meta tags with hreflang
    - **Property 11: Destination page meta tags with hreflang**
    - **Validates: Requirements 8.2, 11.6**

  - [x] 6.6 Write property test for image optimization attributes
    - **Property 13: Image optimization attributes**
    - **Validates: Requirements 8.5**

  - [x] 6.7 Write property test for language switcher navigation
    - **Property 14: Language switcher navigation**
    - **Validates: Requirements 11.3, 11.4**

  - [x] 6.8 Write property test for default language fallback
    - **Property 15: Default language fallback**
    - **Validates: Requirements 11.2, 11.7**

- [x] 7. Directory listing page (bilingual)
  - [x] 7.1 Create directory listing components and pages
    - Create `src/components/directory/DestinationCard.astro` with localized thumbnail alt, name, short description, and link
    - Create `src/components/directory/DestinationGrid.astro` with responsive grid (1-col mobile, multi-col desktop)
    - Create `src/pages/index.astro` as the directory listing page (Bahasa Indonesia)
    - Create `src/pages/en/index.astro` as the directory listing page (English)
    - _Requirements: 2.1, 2.2, 2.3, 11.2, 11.5_

  - [x] 7.2 Write property test for directory listing completeness
    - **Property 2: Directory listing completeness**
    - **Validates: Requirements 2.1, 2.2, 11.5**

- [x] 8. Checkpoint - Public destination pages verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Blog system (bilingual)
  - [x] 9.1 Implement blog data layer
    - Create `src/lib/db/blog.ts` with createArticle, getArticleBySlug, getArticleById, listPublishedArticles (filtered by language), updateArticle, publishArticle, pairArticles functions
    - Include blog_destination_links management for related destinations
    - Support paired_article_id for linking translations
    - _Requirements: 6.5, 7.1, 7.4, 11.10_

  - [x] 9.2 Create blog API endpoints
    - Create `src/pages/api/blog/index.ts` (GET: list with language filter, POST: create with language field)
    - Create `src/pages/api/blog/[id].ts` (GET, PUT, DELETE)
    - Require authenticated session for mutations
    - _Requirements: 6.4, 6.5, 11.10_

  - [x] 9.3 Create blog listing and article pages (both languages)
    - Create `src/components/blog/ArticleCard.astro` with title, excerpt, date, thumbnail
    - Create `src/components/blog/ArticleContent.astro` with proper heading hierarchy
    - Create `src/components/blog/RelatedDestinations.astro` for linking to related destinations
    - Create `src/pages/blog/index.astro` as blog listing page (ID articles only, SSG)
    - Create `src/pages/blog/[slug].astro` as article page with SEO metadata, OG tags, hreflang to paired article, JSON-LD (SSG)
    - Create `src/pages/en/blog/index.astro` as blog listing page (EN articles only, SSG)
    - Create `src/pages/en/blog/[slug].astro` as article page (EN, SSG)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 11.2, 11.5, 11.6, 11.10_

  - [x] 9.4 Write property test for blog listing completeness (per language)
    - **Property 9: Blog listing completeness (per language)**
    - **Validates: Requirements 7.1, 7.2, 11.10**

  - [x] 9.5 Write property test for article SEO metadata with hreflang
    - **Property 10: Article SEO metadata with hreflang**
    - **Validates: Requirements 7.3, 11.6**

- [x] 10. AI content generation (with language targeting)
  - [x] 10.1 Implement Exa.ai research client
    - Create `src/lib/ai/exa.ts` with searchTopic function
    - Accept topic/destination keywords, return structured research results
    - Handle API errors gracefully with typed error responses
    - _Requirements: 6.2_

  - [x] 10.2 Implement DeepSeek generation client
    - Create `src/lib/ai/deepseek.ts` with generateArticle function
    - Accept research context + topic + targetLanguage (Locale), return formatted blog article draft in specified language
    - Handle API errors and timeouts gracefully
    - _Requirements: 6.2, 6.1_

  - [x] 10.3 Implement content generation orchestrator
    - Create `src/lib/ai/content-generator.ts` orchestrating Exa research → DeepSeek generation pipeline
    - Accept GenerationRequest with targetLanguage field
    - Return GenerationResult with success/error states
    - Create `src/pages/api/blog/generate.ts` (POST) endpoint to trigger generation with language parameter
    - _Requirements: 6.1, 6.2, 6.6_

- [x] 11. Admin dashboard (bilingual content management)
  - [x] 11.1 Create admin layout and dashboard index
    - Create `src/layouts/AdminLayout.astro` with admin navigation sidebar
    - Create `src/pages/admin/index.astro` as dashboard overview (SSR)
    - _Requirements: 4.2, 5.3_

  - [x] 11.2 Create destination management pages (bilingual forms)
    - Create `src/pages/admin/destinations/index.astro` listing all destinations with edit/publish/unpublish actions
    - Create `src/pages/admin/destinations/new.astro` with bilingual destination creation form
    - Create `src/pages/admin/destinations/[id]/edit.astro` with bilingual destination edit form
    - Create `src/components/admin/DestinationForm.astro` shared form component with tab-based bilingual fields (ID tab / EN tab) for title, tagline, about, services, testimonials, FAQ
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 11.8_

  - [x] 11.3 Create blog management pages (with language selection)
    - Create `src/pages/admin/blog/index.astro` listing all blog articles (showing language badge) with edit/publish actions
    - Create `src/pages/admin/blog/generate.astro` with AI generation trigger UI including target language selector (ID/EN)
    - Create `src/pages/admin/blog/[id]/edit.astro` with blog draft editor
    - Create `src/components/admin/BlogEditor.astro` with rich text editing
    - Display generation errors with retry option
    - Add option to pair/link articles as translations of each other
    - _Requirements: 6.1, 6.3, 6.4, 6.6, 11.8, 11.10_

- [x] 12. Sitemap and final SEO integration (bilingual)
  - [x] 12.1 Implement sitemap generation with hreflang
    - Create `src/lib/seo/sitemap.ts` with generateSitemap function supporting hreflang annotations
    - Create `src/pages/sitemap.xml.ts` querying all published destinations and blog articles in both languages
    - Include proper lastmod, changefreq, priority values and `xhtml:link` hreflang entries for each URL
    - _Requirements: 8.3, 11.6_

  - [x] 12.2 Write property test for sitemap completeness with hreflang
    - **Property 12: Sitemap completeness with hreflang**
    - **Validates: Requirements 8.3, 11.6**

- [x] 13. Error handling and custom pages
  - [x] 13.1 Create custom error pages
    - Create `src/pages/404.astro` with user-friendly not-found page (bilingual based on URL prefix)
    - Implement 503 error page template for Worker CPU limit exceeded scenarios
    - Ensure error pages use BaseLayout and maintain site branding
    - _Requirements: 5.5, 10.4_

- [x] 14. Final checkpoint - Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- All public pages use SSG (getStaticPaths) for Lighthouse performance targets
- Admin pages use SSR via Cloudflare Workers
- The tech stack is TypeScript throughout (Astro + Cloudflare adapter)
- Bilingual content uses `_id`/`_en` column suffixes in D1 for destinations
- Blog articles are single-language per record, paired via `paired_article_id`
- Static UI strings are in `src/lib/i18n/{locale}.ts` translation files
- URL routing: `/` = Bahasa Indonesia (default), `/en/` = English

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "1.5"] },
    { "id": 2, "tasks": ["2.1", "5.1", "5.2"] },
    { "id": 3, "tasks": ["2.2", "2.3", "5.3", "5.4"] },
    { "id": 4, "tasks": ["2.4", "2.5", "4.1"] },
    { "id": 5, "tasks": ["4.2", "4.3", "4.4", "4.5"] },
    { "id": 6, "tasks": ["6.1", "6.2", "7.1"] },
    { "id": 7, "tasks": ["6.3", "6.4", "6.5", "6.6", "6.7", "6.8", "7.2"] },
    { "id": 8, "tasks": ["9.1"] },
    { "id": 9, "tasks": ["9.2", "9.3"] },
    { "id": 10, "tasks": ["9.4", "9.5", "10.1", "10.2"] },
    { "id": 11, "tasks": ["10.3", "11.1"] },
    { "id": 12, "tasks": ["11.2", "11.3"] },
    { "id": 13, "tasks": ["12.1", "13.1"] },
    { "id": 14, "tasks": ["12.2"] }
  ]
}
```
