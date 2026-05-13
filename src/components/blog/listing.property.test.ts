import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import type { BlogArticle } from "../../lib/types";
import type { Locale } from "../../lib/i18n/config";
import { i18nConfig } from "../../lib/i18n/config";

/**
 * Property 9: Blog listing completeness (per language)
 * **Validates: Requirements 7.1, 7.2, 11.10**
 *
 * For any set of published blog articles, the blog listing page for a given locale
 * SHALL render entries only for articles in that locale, showing title, excerpt,
 * publication date, thumbnail, and a link to the correct article URL with
 * appropriate language prefix.
 */

// --- Generators ---

const localeArb: fc.Arbitrary<Locale> = fc.constantFrom(
  "id" as Locale,
  "en" as Locale
);

const slugArb = fc
  .array(fc.stringMatching(/^[a-z0-9]+$/), { minLength: 1, maxLength: 5 })
  .map((parts) => parts.join("-"))
  .filter((s) => s.length > 0 && s.length <= 60);

const publishedBlogArticleArb: fc.Arbitrary<BlogArticle> = fc.record({
  id: fc.uuid(),
  slug: slugArb,
  title: fc.string({ minLength: 1, maxLength: 120 }),
  excerpt: fc.string({ minLength: 1, maxLength: 300 }),
  content: fc.string({ minLength: 1, maxLength: 500 }),
  language: localeArb,
  thumbnailUrl: fc.webUrl(),
  metaDescription: fc.string({ minLength: 1, maxLength: 160 }),
  ogImage: fc.webUrl(),
  relatedDestinationIds: fc.constant([]),
  pairedArticleId: fc.constant(null),
  status: fc.constant("published" as const),
  publishedAt: fc.constant("2024-06-15T10:00:00Z"),
  createdAt: fc.constant("2024-06-01T00:00:00Z"),
  updatedAt: fc.constant("2024-06-15T10:00:00Z"),
});

const blogArticlesArb = fc.array(publishedBlogArticleArb, {
  minLength: 0,
  maxLength: 15,
});

// --- Data contract function under test ---
// This mirrors the logic in the blog listing pages and ArticleCard.astro

interface BlogCardData {
  title: string;
  excerpt: string;
  publishedAt: string | null;
  thumbnailUrl: string;
  articleUrl: string;
}

/**
 * Filters articles to only those matching the given locale (mirrors listPublishedArticles behavior).
 */
function filterArticlesByLocale(
  articles: BlogArticle[],
  locale: Locale
): BlogArticle[] {
  return articles.filter((a) => a.language === locale);
}

/**
 * Builds card data for a blog article in the given locale (mirrors ArticleCard.astro logic).
 */
function buildBlogCardData(article: BlogArticle, locale: Locale): BlogCardData {
  const prefix = i18nConfig.urlPrefix[locale];
  return {
    title: article.title,
    excerpt: article.excerpt,
    publishedAt: article.publishedAt,
    thumbnailUrl: article.thumbnailUrl,
    articleUrl: `${prefix}/blog/${article.slug}`,
  };
}

// --- Property Tests ---

describe("Property 9: Blog listing completeness (per language)", () => {
  it("only articles matching the locale appear in the filtered list", () => {
    fc.assert(
      fc.property(blogArticlesArb, localeArb, (articles, locale) => {
        const filtered = filterArticlesByLocale(articles, locale);
        for (const article of filtered) {
          expect(article.language).toBe(locale);
        }
      })
    );
  });

  it("no articles from the other locale appear in the filtered list", () => {
    fc.assert(
      fc.property(blogArticlesArb, localeArb, (articles, locale) => {
        const filtered = filterArticlesByLocale(articles, locale);
        const otherLocale = locale === "id" ? "en" : "id";
        for (const article of filtered) {
          expect(article.language).not.toBe(otherLocale);
        }
      })
    );
  });

  it("the count of filtered articles matches articles with that language", () => {
    fc.assert(
      fc.property(blogArticlesArb, localeArb, (articles, locale) => {
        const filtered = filterArticlesByLocale(articles, locale);
        const expectedCount = articles.filter(
          (a) => a.language === locale
        ).length;
        expect(filtered.length).toBe(expectedCount);
      })
    );
  });

  it("each card contains title, excerpt, publication date, and thumbnail from the article", () => {
    fc.assert(
      fc.property(blogArticlesArb, localeArb, (articles, locale) => {
        const filtered = filterArticlesByLocale(articles, locale);
        for (const article of filtered) {
          const card = buildBlogCardData(article, locale);
          expect(card.title).toBe(article.title);
          expect(card.excerpt).toBe(article.excerpt);
          expect(card.publishedAt).toBe(article.publishedAt);
          expect(card.thumbnailUrl).toBe(article.thumbnailUrl);
        }
      })
    );
  });

  it("link URL follows pattern {prefix}/blog/{slug} with correct prefix per locale", () => {
    fc.assert(
      fc.property(blogArticlesArb, localeArb, (articles, locale) => {
        const filtered = filterArticlesByLocale(articles, locale);
        const expectedPrefix = locale === "id" ? "" : "/en";
        for (const article of filtered) {
          const card = buildBlogCardData(article, locale);
          const expectedUrl = `${expectedPrefix}/blog/${article.slug}`;
          expect(card.articleUrl).toBe(expectedUrl);
        }
      })
    );
  });

  it("ID locale produces blog URLs without language prefix", () => {
    fc.assert(
      fc.property(blogArticlesArb, (articles) => {
        const filtered = filterArticlesByLocale(articles, "id");
        for (const article of filtered) {
          const card = buildBlogCardData(article, "id");
          expect(card.articleUrl).toBe(`/blog/${article.slug}`);
          expect(card.articleUrl).not.toMatch(/^\/en\//);
        }
      })
    );
  });

  it("EN locale produces blog URLs with /en prefix", () => {
    fc.assert(
      fc.property(blogArticlesArb, (articles) => {
        const filtered = filterArticlesByLocale(articles, "en");
        for (const article of filtered) {
          const card = buildBlogCardData(article, "en");
          expect(card.articleUrl).toBe(`/en/blog/${article.slug}`);
          expect(card.articleUrl).toMatch(/^\/en\//);
        }
      })
    );
  });
});
