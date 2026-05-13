/**
 * Dynamic sitemap.xml endpoint.
 * Queries D1 for all published destinations and blog articles,
 * generates sitemap entries with hreflang annotations for both languages.
 *
 * Validates: Requirements 8.3, 11.6
 */

import type { APIRoute } from "astro";
import type { DestinationRow, BlogArticleRow } from "../lib/db/schema";
import { generateSitemap, type SitemapEntry } from "../lib/seo/sitemap";
import type { HreflangEntry } from "../lib/types";
import { getDB } from "../lib/db/connection";

const SITE_URL = "https://infotour.id";

export const GET: APIRoute = async () => {
  const db = getDB();

  // Query all published destinations (only need slug and updated_at)
  const { results: destinations } = await db
    .prepare("SELECT slug, updated_at FROM destinations WHERE status = 'published'")
    .all<Pick<DestinationRow, "slug" | "updated_at">>();

  // Query all published blog articles (need id for paired article resolution)
  const { results: articles } = await db
    .prepare(
      "SELECT id, slug, language, updated_at, paired_article_id FROM blog_articles WHERE status = 'published'"
    )
    .all<Pick<BlogArticleRow, "id" | "slug" | "language" | "updated_at" | "paired_article_id">>();

  const entries: SitemapEntry[] = [];

  // --- Homepage entries (both languages) ---
  const now = new Date().toISOString().split("T")[0];
  entries.push({
    url: SITE_URL,
    lastmod: now,
    changefreq: "weekly",
    priority: 1.0,
    alternates: [
      { locale: "id", url: SITE_URL },
      { locale: "en", url: `${SITE_URL}/en` },
    ],
  });
  entries.push({
    url: `${SITE_URL}/en`,
    lastmod: now,
    changefreq: "weekly",
    priority: 1.0,
    alternates: [
      { locale: "id", url: SITE_URL },
      { locale: "en", url: `${SITE_URL}/en` },
    ],
  });

  // --- Destination entries (both languages per destination) ---
  for (const dest of destinations) {
    const lastmod = formatDate(dest.updated_at);
    const idUrl = `${SITE_URL}/destinations/${dest.slug}`;
    const enUrl = `${SITE_URL}/en/destinations/${dest.slug}`;

    const alternates: HreflangEntry[] = [
      { locale: "id", url: idUrl },
      { locale: "en", url: enUrl },
    ];

    // Indonesian version
    entries.push({
      url: idUrl,
      lastmod,
      changefreq: "weekly",
      priority: 0.8,
      alternates,
    });

    // English version
    entries.push({
      url: enUrl,
      lastmod,
      changefreq: "weekly",
      priority: 0.8,
      alternates,
    });
  }

  // --- Blog article entries ---
  // Build lookup: article id -> { slug, language } for paired article resolution
  const articleById = new Map<string, { slug: string; language: string }>();
  for (const article of articles) {
    articleById.set(article.id, { slug: article.slug, language: article.language });
  }

  for (const article of articles) {
    const lastmod = formatDate(article.updated_at);
    const prefix = article.language === "en" ? "/en" : "";
    const articleUrl = `${SITE_URL}${prefix}/blog/${article.slug}`;

    const alternates: HreflangEntry[] = [
      { locale: article.language as "id" | "en", url: articleUrl },
    ];

    // If this article has a paired translation, add hreflang to it
    if (article.paired_article_id) {
      const paired = articleById.get(article.paired_article_id);
      if (paired) {
        const pairedPrefix = paired.language === "en" ? "/en" : "";
        const pairedUrl = `${SITE_URL}${pairedPrefix}/blog/${paired.slug}`;
        alternates.push({
          locale: paired.language as "id" | "en",
          url: pairedUrl,
        });
      }
    }

    entries.push({
      url: articleUrl,
      lastmod,
      changefreq: "monthly",
      priority: 0.6,
      alternates,
    });
  }

  const xml = generateSitemap(entries);

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};

/**
 * Formats a D1 datetime string (e.g. "2024-01-15 10:30:00") to ISO date (YYYY-MM-DD).
 */
function formatDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split("T")[0];
  // D1 stores dates as "YYYY-MM-DD HH:MM:SS" or ISO format
  return dateStr.split(" ")[0].split("T")[0];
}
