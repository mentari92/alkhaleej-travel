# Requirements Document

## Introduction

infotour.id is a full-stack tourism destination directory for Indonesia. The platform serves as a collection of destination landing pages optimized for Google Ads, an SEO blog powered by AI-generated content, and an admin dashboard for content management. Users interact via WhatsApp for booking inquiries. The system is built with Astro + Cloudflare Adapter, styled with Tailwind CSS + shadcn/ui, backed by Cloudflare D1, and hosted on Cloudflare Pages + Workers (free tier). The platform supports bilingual content in Bahasa Indonesia (default) and English.

## Glossary

- **Directory**: The public-facing collection of tourism destination pages on infotour.id
- **Destination_Page**: A landing page for a specific tourism destination, structured with anchor-linked sections
- **Admin_Dashboard**: The authenticated admin interface accessible at the /admin route for managing content
- **Blog_System**: The SEO-optimized blog subsystem with AI-assisted content generation
- **WhatsApp_Button**: A floating or inline call-to-action element that opens WhatsApp with a pre-filled message
- **Content_Generator**: The AI subsystem using DeepSeek for content generation and Exa.ai for research/data
- **Admin**: An authenticated user with access to the Admin_Dashboard
- **Visitor**: A public user browsing the Directory or Blog without authentication
- **Language_Switcher**: A UI component available on all public pages that allows Visitors to switch between supported languages
- **Default_Language**: Bahasa Indonesia (ID), the primary language of the platform
- **Supported_Languages**: Bahasa Indonesia (ID) and English (EN)

## Requirements

### Requirement 1: Destination Page Structure

**User Story:** As a Visitor, I want to view a well-structured destination page, so that I can quickly find information about a tourism destination.

#### Acceptance Criteria

1. THE Destination_Page SHALL display a Hero section as the first visible content with a destination title, tagline, and background image.
2. THE Destination_Page SHALL include anchor-linked sections in the following order: Hero, About, Gallery, Services/Packages, Testimonials, How to Book, and FAQ.
3. WHEN a Visitor clicks an anchor link in the navigation, THE Destination_Page SHALL scroll to the corresponding section.
4. THE Destination_Page SHALL render with a mobile-first responsive layout using Tailwind CSS breakpoints.
5. THE Destination_Page SHALL achieve a Lighthouse performance score of 90 or above on mobile.

### Requirement 2: Destination Directory Listing

**User Story:** As a Visitor, I want to browse all available destinations, so that I can discover tourism options in Indonesia.

#### Acceptance Criteria

1. THE Directory SHALL display a listing of all published destinations with a thumbnail image, destination name, and short description for each entry in the active language.
2. WHEN a Visitor clicks a destination entry, THE Directory SHALL navigate to the corresponding Destination_Page in the active language.
3. THE Directory SHALL render destination listings in a responsive grid layout that adapts from single-column on mobile to multi-column on desktop.

### Requirement 3: WhatsApp Booking Contact

**User Story:** As a Visitor, I want to contact the tour operator via WhatsApp, so that I can inquire about or book a destination package.

#### Acceptance Criteria

1. THE Destination_Page SHALL display a WhatsApp_Button that remains visible during scrolling.
2. WHEN a Visitor taps the WhatsApp_Button, THE Destination_Page SHALL open WhatsApp with a pre-filled message containing the destination name.
3. THE Destination_Page SHALL display a WhatsApp contact call-to-action within the How to Book section.

### Requirement 4: Admin Authentication

**User Story:** As an Admin, I want to securely access the admin dashboard, so that only authorized users can manage content.

#### Acceptance Criteria

1. WHEN a Visitor navigates to the /admin route without valid authentication, THE Admin_Dashboard SHALL redirect to a login page.
2. WHEN an Admin submits valid credentials on the login page, THE Admin_Dashboard SHALL grant access to the dashboard interface.
3. IF an Admin submits invalid credentials, THEN THE Admin_Dashboard SHALL display an error message and remain on the login page.
4. WHEN an Admin clicks the logout action, THE Admin_Dashboard SHALL revoke the session and redirect to the login page.

### Requirement 5: Destination Content Management

**User Story:** As an Admin, I want to create and manage destination pages in both Bahasa Indonesia and English, so that I can keep the directory up to date for all visitors.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL provide a form to create a new destination with bilingual fields (Bahasa Indonesia and English) for title, tagline, about text, gallery image alt texts, services/packages, testimonials, FAQ entries, and a shared WhatsApp number.
2. WHEN an Admin submits a valid destination form, THE Admin_Dashboard SHALL save the destination with both language versions to the Cloudflare D1 database.
3. THE Admin_Dashboard SHALL display a list of all destinations with options to edit, publish, or unpublish each entry.
4. WHEN an Admin edits a destination and saves changes, THE Admin_Dashboard SHALL update the corresponding record in both language versions in the Cloudflare D1 database.
5. WHEN an Admin changes a destination status to unpublished, THE Directory SHALL exclude that destination from public listings in all languages and return a 404 response for its page URL in any language.

### Requirement 6: AI Blog Content Generation

**User Story:** As an Admin, I want to generate SEO-optimized blog articles using AI, so that I can drive organic traffic to the site with minimal manual writing effort.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL provide a trigger to generate a new blog article draft for a specified topic or destination with a target language selection (Bahasa Indonesia or English).
2. WHEN an Admin triggers blog generation, THE Content_Generator SHALL use Exa.ai to research the topic and DeepSeek to produce a draft article in the selected target language.
3. WHEN the Content_Generator completes generation, THE Admin_Dashboard SHALL display the draft article for Admin review and editing.
4. THE Admin_Dashboard SHALL allow an Admin to edit the generated draft before publishing.
5. WHEN an Admin publishes a blog article, THE Blog_System SHALL make the article publicly accessible at a SEO-friendly URL path under the appropriate language prefix.
6. IF the Content_Generator encounters an error during generation, THEN THE Admin_Dashboard SHALL display an error message describing the failure reason.

### Requirement 7: Blog Public Display

**User Story:** As a Visitor, I want to read blog articles about Indonesian tourism, so that I can learn about destinations and plan trips.

#### Acceptance Criteria

1. THE Blog_System SHALL display a blog listing page with published articles in the active language showing title, excerpt, publication date, and thumbnail.
2. WHEN a Visitor clicks a blog article entry, THE Blog_System SHALL navigate to the full article page in the active language.
3. THE Blog_System SHALL render each article page with proper heading hierarchy, meta description, Open Graph tags, hreflang tags for alternate language versions, and structured data for SEO.
4. THE Blog_System SHALL display related destination links within blog articles when relevant destinations exist.

### Requirement 8: SEO and Performance Optimization

**User Story:** As an Admin, I want the site to rank well in search engines and load fast, so that Google Ads landing pages convert effectively and organic traffic grows.

#### Acceptance Criteria

1. THE Directory SHALL generate static HTML pages at build time using Astro static site generation for all published destination pages in both Supported_Languages.
2. THE Destination_Page SHALL include meta title, meta description, Open Graph tags, canonical URL, and hreflang tags referencing the alternate language version in the page head.
3. THE Directory SHALL generate a sitemap.xml file containing all published destination pages and blog articles in both Supported_Languages with proper hreflang annotations.
4. THE Directory SHALL serve all pages with a Time to First Byte of 500ms or less on Cloudflare Pages.
5. THE Destination_Page SHALL use optimized image formats and lazy loading for gallery images below the fold.

### Requirement 9: Mobile-First Responsive Design

**User Story:** As a Visitor on a mobile device, I want the site to be easy to use on my phone, so that I can browse destinations and contact operators without friction.

#### Acceptance Criteria

1. THE Directory SHALL render all pages with touch-friendly tap targets of at least 44x44 pixels for interactive elements.
2. THE Directory SHALL display a mobile navigation menu that collapses into a hamburger icon on viewports below 768px width.
3. THE Destination_Page SHALL stack all sections vertically on mobile viewports with appropriate spacing between sections.
4. THE WhatsApp_Button SHALL be positioned as a fixed floating element in the bottom-right corner on mobile viewports.

### Requirement 10: Cloudflare Infrastructure

**User Story:** As an Admin, I want the application deployed on Cloudflare free tier, so that hosting costs remain zero while maintaining performance.

#### Acceptance Criteria

1. THE Directory SHALL deploy as a Cloudflare Pages project with the Astro Cloudflare adapter.
2. THE Admin_Dashboard SHALL execute server-side logic using Cloudflare Workers within the free tier request limits.
3. THE Directory SHALL store all structured data in a Cloudflare D1 database.
4. IF a Cloudflare Worker exceeds the free tier CPU time limit during a request, THEN THE Directory SHALL return a user-friendly error page instead of a raw error response.

### Requirement 11: Bilingual Support (Internationalization)

**User Story:** As a Visitor, I want to view the site in Bahasa Indonesia or English, so that I can browse content in my preferred language.

#### Acceptance Criteria

1. THE Directory SHALL support two languages: Bahasa Indonesia (ID) as the Default_Language and English (EN) as the secondary language.
2. THE Directory SHALL use URL path prefixes to indicate language, where the root path (/) serves content in Bahasa Indonesia and the /en/ prefix serves content in English.
3. THE Directory SHALL display a Language_Switcher component on all public pages that allows Visitors to switch between Bahasa Indonesia and English.
4. WHEN a Visitor selects a language via the Language_Switcher, THE Directory SHALL navigate to the equivalent page in the selected language while preserving the current page context.
5. THE Directory SHALL serve all public pages (destinations, directory listing, blog) in both Supported_Languages with language-specific content.
6. THE Directory SHALL include hreflang link elements in the HTML head of every public page referencing the alternate language version URL.
7. WHEN a Visitor accesses a page without a language prefix, THE Directory SHALL serve the page in Bahasa Indonesia as the Default_Language.
8. THE Admin_Dashboard SHALL provide bilingual content fields for all translatable content, allowing the Admin to enter content in both Bahasa Indonesia and English within a single editing interface.
9. THE Directory SHALL maintain consistent navigation structure and page layout across both language versions.
10. WHEN a blog article exists only in one language, THE Blog_System SHALL display that article only in the blog listing of the available language.
