# Implementation Plan: Production Readiness Foundation

## Overview

This plan converts the design into incremental coding tasks. Work is split into two tracks that can partially overlap:

- **Track A — P0 Bug Fixes** (Requirements 1–9): sanitizer, rate limiter, password versioning, destination form fix, blog generate persistence, delete UI, dependency/config fixes.
- **Track B — Site Settings SSOT** (Requirements 10–16): migration, repository, API, admin settings page, frontend integration.

Each task builds on the previous ones and ends with all pieces wired together.

---

## Tasks

- [x] 1. Fix dependency versions and deploy configuration
  - Update `package.json`: set `typescript` to `^5.6.0`, `lucide-react` to the latest stable `0.4xx.x` series, and verify `astro` resolves on npm; downgrade to Astro 5.x LTS if Astro 6 is not yet published
  - Regenerate `package-lock.json` by running `npm install` after version corrections
  - Update `wrangler.toml`: replace any `placeholder-replace-with-actual-id` value in `database_id` with a valid UUID v4 (or a documented placeholder that matches the UUID regex pattern for CI validation)
  - Add a `## Deployment` section to `README.md` documenting the five-step deploy sequence and the four required `wrangler secret put` calls
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 2. Implement HTML content sanitizer
  - [x] 2.1 Create `src/lib/content/sanitizer.ts`
    - Implement `sanitize(html: string): string` using `node-html-parser` (pure JS, Workers-compatible)
    - Implement `isAllowedTag`, `sanitizeAttributes`, `isAllowedIframeSrc`, `hasDangerousScheme` as internal helpers
    - Enforce tag whitelist: `p, br, h1–h6, ul, ol, li, strong, em, b, i, u, s, a, img, blockquote, code, pre, table, thead, tbody, tr, th, td, figure, figcaption, hr, iframe`
    - Strip blocked tags with their content: `script, style, object, embed, form, input, link, meta`
    - Remove all `on*` attributes; remove `href`/`src` with `javascript:`, `vbscript:`, or `data:` schemes (allow `data:image/*` on `<img src>`)
    - Allow `<iframe>` only when `src` host is in oEmbed whitelist; otherwise remove the entire element
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 2.2 Write property tests for sanitizer
    - **Property 4: HTML sanitizer idempotence** — `sanitize(sanitize(x)) === sanitize(x)` for any string `x`
    - **Property 5: HTML sanitizer safety invariant** — `sanitize(x)` must not contain `<script`, `javascript:` in attributes, `on[a-z]` attribute names, or non-whitelisted `<iframe>` src hosts
    - **Property 6: HTML sanitizer whitelist preservation** — safe HTML composed only of whitelisted tags is preserved
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.6, 5.8, 5.9, 5.10**
    - Test file: `src/lib/content/sanitizer.property.test.ts`

  - [x] 2.3 Write unit tests for sanitizer
    - Test specific XSS payloads: `<script>alert(1)</script>`, `<img onerror="...">`, `<a href="javascript:...">`, `<iframe src="https://evil.com">`, `data:text/html` in href
    - Test oEmbed whitelist: YouTube and Vimeo iframes pass; arbitrary hosts are stripped
    - _Requirements: 5.3, 5.4, 5.5, 5.6_

- [x] 3. Integrate sanitizer into blog API and article renderer
  - [x] 3.1 Modify `src/pages/api/blog/generate.ts` to persist draft to D1
    - After successful AI generation, call `sanitize(result.article.content)` on the generated content
    - Call `createArticle(db, { ...result.article, content: sanitizedContent, status: 'draft' })` before returning
    - If `createArticle` throws, return HTTP 500 with `{ code: 'PERSIST_FAILED' }` and no article content in the body
    - On success, return HTTP 201 with the persisted article object (including `id` from DB)
    - _Requirements: 1.1, 1.2, 1.3, 5.1_

  - [x] 3.2 Write property test for blog generate round-trip persistence
    - **Property 1: Blog generate round-trip persistence** — for any valid generate request returning HTTP 201, `data.id` must correspond to exactly one row in `blog_articles` with matching `title`, `content`, `excerpt`, `metaDescription`, and `language`
    - **Validates: Requirements 1.1, 1.2, 1.5, 1.6**
    - Test file: `src/pages/api/blog/generate.property.test.ts`

  - [x] 3.3 Modify `src/pages/api/blog/index.ts` and `src/pages/api/blog/[id].ts` to sanitize on write
    - Call `sanitize(input.content)` in `POST /api/blog` and `PUT /api/blog/{id}` before writing to D1
    - _Requirements: 5.1_

  - [x] 3.4 Modify `src/components/blog/ArticleContent.astro` to sanitize on render
    - Import `sanitize` from `@/lib/content/sanitizer`
    - Compute `const safeContent = sanitize(article.content)` and use `set:html={safeContent}` (defense in depth)
    - _Requirements: 5.7_

- [x] 4. Fix destination update to preserve untouched child collections
  - [x] 4.1 Modify `src/components/admin/DestinationForm.astro` (or its React island) to track touched tabs
    - Add `touchedTabs: Set<string>` state initialized to an empty set
    - Mark a tab as touched when the admin opens and modifies it in the current edit session
    - Build the PUT body including `galleryImages`, `services`, `testimonials`, `faqEntries` only when the corresponding tab is in `touchedTabs`
    - _Requirements: 2.6_

  - [x] 4.2 Write property tests for destination update child collection preservation
    - **Property 2: Destination update preserves untouched child collections** — `updateDestination(db, id, input)` with `input.X === undefined` must leave the count of children of type `X` unchanged
    - **Property 3: Destination update idempotence** — `updateDestination(db, id, {})` called twice produces state identical to before either call (except `updated_at`)
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.7, 2.8**
    - Test file: `src/lib/db/destinations.property.test.ts`

  - [x] 4.3 Write unit tests for destination repository semantics
    - Test that explicit `galleryImages: []` deletes all images
    - Test that `galleryImages: undefined` preserves existing images
    - _Requirements: 2.5, 2.7_

- [x] 5. Implement versioned password hashing and login hardening
  - [x] 5.1 Modify `src/lib/auth/password.ts` to support versioned hash format
    - Update `hashPassword(password: string): Promise<string>` to always produce `pbkdf2-sha256$i=100000$<salt_hex>$<hash_hex>` format using `crypto.subtle` (WebCrypto only, no `node:crypto`)
    - Update `verifyPassword(password, storedHash)` to return `{ verified: boolean; needsRehash: boolean }`:
      - If `storedHash` contains `$` → parse versioned format and verify
      - If `storedHash` matches legacy pattern `^[0-9a-f]{32}:[0-9a-f]{64}$` → verify as `pbkdf2-sha256$i=100000`, set `needsRehash: true`
      - Otherwise return `{ verified: false, needsRehash: false }`
    - Keep constant-time comparison for hash verification
    - _Requirements: 8.1, 8.2, 8.4, 8.5, 8.7_

  - [x] 5.2 Write property tests for password hashing
    - **Property 8: Password hash round-trip correctness** — `verifyPassword(p, await hashPassword(p))` returns `{ verified: true }` and `verifyPassword(p + 'x', await hashPassword(p))` returns `{ verified: false }` for any non-empty `p`
    - **Property 9: Password hash uniqueness** — `hashPassword(p)` called twice produces two different strings
    - **Validates: Requirements 8.8, 8.9**
    - Test file: `src/lib/auth/password.property.test.ts`

  - [x] 5.3 Modify `src/pages/api/auth/login.ts` to rehash legacy passwords on successful login
    - After `verifyPassword` returns `{ verified: true, needsRehash: true }`, rehash the password and update `admin_users.password_hash` in the same D1 batch as session creation
    - _Requirements: 8.6_

- [x] 6. Implement login rate limiter
  - [x] 6.1 Create `migrations/0004_site_settings.sql` (partial — login_attempts table only for now)
    - Add `CREATE TABLE IF NOT EXISTS login_attempts` with `id TEXT PRIMARY KEY`, `ip TEXT NOT NULL`, `attempted_at TEXT NOT NULL DEFAULT (datetime('now'))`
    - Add `CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON login_attempts(ip, attempted_at)`
    - _Requirements: 9.2_

  - [x] 6.2 Create `src/lib/auth/rate-limiter.ts`
    - Implement `extractClientIP(request: Request): string` — priority: `CF-Connecting-IP` → first token of `X-Forwarded-For` → `"unknown"`
    - Implement `isLockedOut(db, ip, config?)` using the window query on `login_attempts`
    - Implement `recordFailedAttempt(db, ip)` — INSERT into `login_attempts`
    - Implement `resetAttempts(db, ip)` — DELETE from `login_attempts` WHERE ip = ?
    - Export `RateLimiterConfig` interface with defaults: `maxAttempts: 5`, `windowMs: 15 * 60 * 1000`, `lockoutMs: 60 * 60 * 1000`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.8_

  - [x] 6.3 Write property tests for rate limiter
    - **Property 10: Rate limiter threshold** — 5 `recordFailedAttempt` calls within window → `isLockedOut` returns `{ locked: true }`; 4 calls → `{ locked: false }`
    - **Property 11: Rate limiter reset** — `resetAttempts` on a locked IP makes `isLockedOut` return `{ locked: false }`
    - **Validates: Requirements 9.3, 9.9, 9.10**
    - Test file: `src/lib/auth/rate-limiter.property.test.ts`

  - [x] 6.4 Integrate rate limiter into `src/pages/api/auth/login.ts`
    - Call `extractClientIP` and `isLockedOut` at the top of the handler; return HTTP 429 with `Retry-After` header and `RATE_LIMITED` body if locked
    - On user-not-found: call `dummyVerify()` + `recordFailedAttempt` + return 401 `INVALID_CREDENTIALS`
    - On password mismatch: call `recordFailedAttempt` + return 401 `INVALID_CREDENTIALS`
    - On success: call `resetAttempts` before creating session
    - _Requirements: 9.1, 9.3, 9.4, 9.5, 9.6, 9.7_

- [x] 7. Checkpoint — P0 bug fixes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement delete UI for destinations and blog articles
  - [x] 8.1 Add typed-slug delete dialog to `src/components/admin/` (shared `DeleteConfirmDialog` component)
    - Create a reusable dialog component that accepts `title`, `slug`, and `onConfirm` props
    - Render the item title and slug; require the admin to type the slug exactly before enabling the confirm button
    - Show loading state (disabled + spinner) on the confirm button while the DELETE request is in flight
    - Show Toast success ("Destinasi / Artikel berhasil dihapus") on success; remove the row from the list without full page reload
    - Show Toast error with server message on failure
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

  - [x] 8.2 Wire `DeleteConfirmDialog` into the admin destination list page
    - Add a "Hapus" button to each destination row in `src/pages/admin/destinations/index.astro` (or its React island)
    - On click, open `DeleteConfirmDialog` with the destination's title and slug
    - On confirm, send `DELETE /api/destinations/{id}` and handle response
    - _Requirements: 7.1, 7.3, 7.6, 7.7, 7.8_

  - [x] 8.3 Wire `DeleteConfirmDialog` into the admin blog list page
    - Add a "Hapus" button to each article row in `src/pages/admin/blog/index.astro` (or its React island)
    - For published articles: use typed-slug confirmation; for drafts: a simple Yes/No dialog is acceptable
    - On confirm, send `DELETE /api/blog/{id}` and handle response
    - _Requirements: 7.2, 7.4, 7.5, 7.6, 7.7, 7.8_

- [x] 9. Harden public pages against empty DB and runtime errors
  - [x] 9.1 Wrap all D1 calls in public page handlers with try/catch
    - In `src/pages/index.astro`, `src/pages/destinations/[slug].astro`, `src/pages/blog/[slug].astro`, and their `/en/` counterparts: wrap each DB call in try/catch; on error, fall back to empty arrays or `SiteSettingsDefaults`
    - Return HTTP 404 (not 500) when `getDestinationBySlug` or `getArticleBySlug` returns `null`
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 9.2 Update middleware error page to use site settings branding
    - Modify `src/middleware.ts` `renderErrorPage` to accept optional `brandName` and `supportEmail` parameters
    - Attempt to read `site_settings` before rendering the error page; on failure use `SiteSettingsDefaults`
    - _Requirements: 6.5, 12.8_

  - [x] 9.3 Write property test for public routes returning 200 on empty DB
    - **Property 7: Public routes return 200 on empty database** — for each route in `{/, /destinations, /blog, /en/, /en/destinations, /en/blog}` with all content tables empty, the handler returns `Response` with `status === 200`
    - **Validates: Requirements 6.3, 6.6**
    - Test file: `src/pages/public-routes.property.test.ts`

- [x] 10. Create `site_settings` migration and schema types
  - [x] 10.1 Complete `migrations/0004_site_settings.sql`
    - Add `CREATE TABLE IF NOT EXISTS site_settings` with all columns from the design (branding, contact, hero, stats, SEO, footer, analytics, audit)
    - Add `CHECK(id = 1)` constraint and `INSERT OR IGNORE INTO site_settings (id) VALUES (1)` seed row
    - Ensure the migration is additive (does not modify existing tables)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 13.1, 13.2, 13.3, 13.4_

  - [x] 10.2 Add `SiteSettingsRow` and `LoginAttemptRow` interfaces to `src/lib/db/schema.ts`
    - Add snake_case DB row interfaces matching the migration columns
    - _Requirements: 10.1_

- [x] 11. Implement site settings repository and defaults
  - [x] 11.1 Create `src/lib/site-settings/defaults.ts`
    - Export `SiteSettingsDefaults: SiteSettings` constant with all fallback values from the design
    - This file is the single source of truth for all hardcoded branding/contact strings
    - _Requirements: 12.9, 13.2_

  - [x] 11.2 Create `src/lib/db/site-settings.ts`
    - Export `SiteSettings` TypeScript interface (camelCase fields)
    - Implement `getSiteSettings(db)`: check module-level `_cache`; query `SELECT * FROM site_settings WHERE id = 1`; if no row, return `SiteSettingsDefaults`; map snake_case to camelCase; set `_cache`
    - Implement `updateSiteSettings(db, patch)`: get current state, merge patch, `INSERT OR REPLACE INTO site_settings (id, ...) VALUES (1, ...)`, clear `_cache`, return fresh state
    - Implement `clearSettingsCache()` for use in tests
    - _Requirements: 10.10, 10.11, 12.10_

  - [x] 11.3 Write property tests for site settings repository
    - **Property 12: Site settings patch invariant** — after `updateSiteSettings(db, P)`, `getSiteSettings(db)` returns `S'` where patched keys equal `P[k]` and unpatched keys equal original `S[k]`
    - **Property 13: Site settings update idempotence** — calling `updateSiteSettings(db, P)` twice produces identical state
    - **Validates: Requirements 10.11, 10.12, 10.13**
    - Test file: `src/lib/db/site-settings.property.test.ts`

  - [x] 11.4 Write unit tests for site settings repository
    - Test `getSiteSettings` on empty DB returns `SiteSettingsDefaults`
    - Test `updateSiteSettings` with a full patch round-trips correctly
    - Test migration idempotency: `SELECT COUNT(*) FROM site_settings` returns 1 after running migration twice
    - _Requirements: 13.5, 13.6_

- [x] 12. Implement site settings API endpoint
  - [x] 12.1 Create `src/pages/api/site-settings/index.ts`
    - Implement `GET /api/site-settings`: call `getSiteSettings(db)`, return `{ success: true, data: SiteSettings }`; on DB error return 500
    - Implement `PUT /api/site-settings`: validate session via `validateSession`; check `Origin`/`Referer` against `SITE_URL` env var (return 403 `CSRF_ORIGIN_MISMATCH` on mismatch); validate dirty fields with server-side regex rules from the design; call `updateSiteSettings(db, patch)`; return 200 with updated settings or 422 `VALIDATION_ERROR`
    - _Requirements: 11.4, 15.1, 15.4, 15.5_

- [x] 13. Implement admin settings page
  - [x] 13.1 Create `src/pages/admin/settings.astro`
    - Fetch current settings server-side via `getSiteSettings(db)` and pass as initial props to a React island `SettingsForm`
    - Protect the route with the existing session middleware
    - _Requirements: 11.1_

  - [x] 13.2 Create `src/components/admin/SettingsForm.tsx` React island
    - Implement five tabs: General, Contact, Homepage, SEO, Analytics — each containing the fields specified in the design
    - Implement `dirtyFields: Set<string>` state; on field change, add the key to `dirtyFields`; on submit, build PUT body from only dirty fields
    - Implement inline validation (on blur) for all fields: WhatsApp regex, email regex, social URL host checks, GTM/GA4 ID patterns, `custom_head_html` whitelist
    - Implement `destinations_count_auto` toggle that disables `destinations_count_override` input when active; show live count badge
    - Implement unsaved-changes guard: `window.addEventListener('beforeunload', handler)` + intercept internal `<a>` clicks
    - Show loading state on Save button; show Toast on success/error
    - _Requirements: 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10, 11.11, 11.12, 11.13, 14.3, 14.7, 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7_

  - [x] 13.3 Write property test for toast deduplication
    - **Property 15: Toast deduplication** — calling `showToast({ id, message })` twice in succession results in exactly one active entry in the toast queue with that `id`
    - **Validates: Requirements 16.8**
    - Test file: `src/components/admin/toast.property.test.ts`

- [x] 14. Integrate site settings into frontend components
  - [x] 14.1 Modify `src/layouts/BaseLayout.astro` to accept and use `settings` prop
    - Add `settings?: SiteSettings` prop (default to `SiteSettingsDefaults`)
    - Inject GTM snippet in `<head>` when `settings.gtmContainerId` is set
    - Inject GA4 `gtag.js` snippet when `settings.ga4MeasurementId` is set and `gtmContainerId` is not
    - Inject `settings.customHeadHtml` (after re-running whitelist validator) at end of `<head>`
    - Use `settings.brandName{locale}`, `settings.defaultOgImage`, `settings.defaultMetaDescriptionTemplate{locale}`, `settings.faviconUrl` for meta/OG/favicon
    - Pass `settings` to `<Footer>` and `<WhatsAppFAB>`
    - _Requirements: 12.4, 12.5, 12.6, 12.7_

  - [x] 14.2 Modify `src/components/ui/Footer.astro` to read all fields from `settings` prop
    - Remove all hardcoded contact/social/branding strings
    - Read `primaryWhatsappNumber`, `supportEmail`, `address`, `social*Url`, `copyrightText`, `brandName{locale}`, `footerTagline{locale}` from the `settings` prop
    - _Requirements: 12.1_

  - [x] 14.3 Modify `src/components/ui/WhatsAppFAB.astro` to read `primaryWhatsappNumber` from `settings` prop
    - Remove hardcoded default `6281200000000`
    - _Requirements: 12.2_

  - [x] 14.4 Modify `src/pages/index.astro` (and `src/pages/en/index.astro`) to fetch and pass settings
    - Call `const settings = await getSiteSettings(db).catch(() => SiteSettingsDefaults)` at the top
    - Pass `settings` to `<BaseLayout>`
    - Read `heroImageUrl`, `heroTitle{locale}`, `heroSubtitle{locale}`, `heroCtaText{locale}` from `settings` for the hero section
    - Implement stats display logic: if `destinationsCountAuto`, query live count; else use `destinationsCountOverride`; hide stat cards where value is 0 (except `averageRating`)
    - Read `partnersCount`, `happyTouristsCount`, `averageRating` from `settings`
    - _Requirements: 12.3, 14.1, 14.2, 14.4, 14.5_

  - [x] 14.5 Write property test for destinations count reflecting live data
    - **Property 14: Destinations count reflects live data** — after `createDestination` with `status = 'published'`, `getDestinationsCount(db)` increments by 1; after `deleteDestination`, it decrements by 1
    - **Validates: Requirements 14.6**
    - Test file: `src/lib/db/destinations.property.test.ts`

- [x] 15. Remove all hardcoded branding strings from `src/**`
  - Search `src/**` (excluding `src/lib/site-settings/defaults.ts`, seed migration files, and test files) for literal strings `6281200000000`, `halo@infotour.id`, and any other hardcoded WA numbers or contact info
  - Replace any remaining occurrences with references to `SiteSettingsDefaults` or the `settings` prop
  - _Requirements: 12.12_

- [x] 16. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at natural breaks
- Property tests validate universal correctness properties using `fast-check` (already in `devDependencies`)
- Unit tests validate specific examples and edge cases
- The design uses TypeScript throughout; all code examples should use TypeScript
- `node-html-parser` must be added to `dependencies` (not `devDependencies`) since it runs in the Workers bundle
- The `login_attempts` table is created in the same migration file (`0004_site_settings.sql`) as `site_settings`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["10.1", "10.2", "11.1"] },
    { "id": 1, "tasks": ["2.1", "5.1", "6.1", "11.2"] },
    { "id": 2, "tasks": ["2.2", "2.3", "4.1", "5.2", "6.2", "11.3", "11.4"] },
    { "id": 3, "tasks": ["3.1", "3.3", "3.4", "4.2", "4.3", "5.3", "6.3", "6.4", "12.1"] },
    { "id": 4, "tasks": ["3.2", "8.1", "9.1", "13.1"] },
    { "id": 5, "tasks": ["8.2", "8.3", "9.2", "9.3", "13.2", "14.1", "14.2", "14.3"] },
    { "id": 6, "tasks": ["13.3", "14.4"] },
    { "id": 7, "tasks": ["14.5", "15"] }
  ]
}
```
