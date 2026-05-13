/**
 * Blog articles repository for Cloudflare D1.
 * Manages CRUD operations for blog_articles table.
 */

import type { BlogArticleRow } from "./schema";
import type { Locale } from "@/lib/i18n/config";

// --- Types ---

export interface BlogArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  language: Locale;
  thumbnailUrl: string;
  metaDescription: string;
  ogImage: string;
  relatedDestinationIds: string[];
  relatedPackageIds: string[];
  pairedArticleId: string | null;
  status: "published" | "draft";
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- Row mapping ---

function mapRow(row: BlogArticleRow, relatedPackageIds: string[] = []): BlogArticle {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    content: row.content,
    language: row.language as Locale,
    thumbnailUrl: row.thumbnail_url ?? "",
    metaDescription: row.meta_description,
    ogImage: row.og_image ?? "",
    relatedDestinationIds: relatedPackageIds,
    relatedPackageIds,
    pairedArticleId: row.paired_article_id,
    status: row.status as "published" | "draft",
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// --- Helper: load related package IDs ---

async function loadRelatedPackageIds(
  db: D1Database,
  blogId: string
): Promise<string[]> {
  try {
    const { results } = await db
      .prepare("SELECT package_id FROM blog_package_links WHERE blog_id = ?")
      .bind(blogId)
      .all<{ package_id: string }>();
    return results.map((r) => r.package_id);
  } catch {
    return [];
  }
}

// --- CRUD ---

/**
 * List all published articles for a given locale.
 */
export async function listPublishedArticles(
  db: D1Database,
  locale: Locale
): Promise<BlogArticle[]> {
  const { results } = await db
    .prepare(
      "SELECT * FROM blog_articles WHERE status = 'published' AND language = ? ORDER BY published_at DESC, created_at DESC"
    )
    .bind(locale)
    .all<BlogArticleRow>();

  const articles: BlogArticle[] = [];
  for (const row of results) {
    const relatedPackageIds = await loadRelatedPackageIds(db, row.id);
    articles.push(mapRow(row, relatedPackageIds));
  }
  return articles;
}

/**
 * List all articles regardless of status or language.
 */
export async function listAllArticles(
  db: D1Database
): Promise<BlogArticle[]> {
  const { results } = await db
    .prepare("SELECT * FROM blog_articles ORDER BY created_at DESC")
    .all<BlogArticleRow>();

  const articles: BlogArticle[] = [];
  for (const row of results) {
    const relatedPackageIds = await loadRelatedPackageIds(db, row.id);
    articles.push(mapRow(row, relatedPackageIds));
  }
  return articles;
}

/**
 * Get an article by its slug.
 */
export async function getArticleBySlug(
  db: D1Database,
  slug: string
): Promise<BlogArticle | null> {
  const row = await db
    .prepare("SELECT * FROM blog_articles WHERE slug = ?")
    .bind(slug)
    .first<BlogArticleRow>();

  if (!row) return null;

  const relatedPackageIds = await loadRelatedPackageIds(db, row.id);
  return mapRow(row, relatedPackageIds);
}

/**
 * Get an article by its ID.
 */
export async function getArticleById(
  db: D1Database,
  id: string
): Promise<BlogArticle | null> {
  const row = await db
    .prepare("SELECT * FROM blog_articles WHERE id = ?")
    .bind(id)
    .first<BlogArticleRow>();

  if (!row) return null;

  const relatedPackageIds = await loadRelatedPackageIds(db, id);
  return mapRow(row, relatedPackageIds);
}

/**
 * Create a new blog article.
 */
export async function createArticle(
  db: D1Database,
  input: {
    slug: string;
    title: string;
    excerpt: string;
    content: string;
    language: Locale;
    thumbnailUrl?: string;
    metaDescription: string;
    ogImage?: string;
    relatedPackageIds?: string[];
    pairedArticleId?: string | null;
    status: "published" | "draft";
  }
): Promise<BlogArticle> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const publishedAt = input.status === "published" ? now : null;

  await db
    .prepare(
      `INSERT INTO blog_articles (id, slug, language, title, excerpt, content, thumbnail_url, meta_description, og_image, paired_article_id, status, published_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      input.slug,
      input.language,
      input.title,
      input.excerpt,
      input.content,
      input.thumbnailUrl ?? null,
      input.metaDescription,
      input.ogImage ?? null,
      input.pairedArticleId ?? null,
      input.status,
      publishedAt,
      now,
      now
    )
    .run();

  // Insert blog-package links
  if (input.relatedPackageIds && input.relatedPackageIds.length > 0) {
    const linkStatements = input.relatedPackageIds.map((pkgId) =>
      db
        .prepare("INSERT INTO blog_package_links (blog_id, package_id) VALUES (?, ?)")
        .bind(id, pkgId)
    );
    await db.batch(linkStatements);
  }

  return (await getArticleById(db, id))!;
}

/**
 * Update an existing blog article.
 */
export async function updateArticle(
  db: D1Database,
  id: string,
  input: {
    slug?: string;
    title?: string;
    excerpt?: string;
    content?: string;
    thumbnailUrl?: string;
    metaDescription?: string;
    ogImage?: string;
    relatedPackageIds?: string[];
    pairedArticleId?: string | null;
    status?: "published" | "draft";
  }
): Promise<BlogArticle> {
  const existing = await getArticleById(db, id);
  if (!existing) {
    throw new Error(`Article ${id} not found`);
  }

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const setClauses: string[] = [];
  const bindArgs: unknown[] = [];

  if (input.slug !== undefined) {
    setClauses.push("slug = ?");
    bindArgs.push(input.slug);
  }
  if (input.title !== undefined) {
    setClauses.push("title = ?");
    bindArgs.push(input.title);
  }
  if (input.excerpt !== undefined) {
    setClauses.push("excerpt = ?");
    bindArgs.push(input.excerpt);
  }
  if (input.content !== undefined) {
    setClauses.push("content = ?");
    bindArgs.push(input.content);
  }
  if (input.thumbnailUrl !== undefined) {
    setClauses.push("thumbnail_url = ?");
    bindArgs.push(input.thumbnailUrl);
  }
  if (input.metaDescription !== undefined) {
    setClauses.push("meta_description = ?");
    bindArgs.push(input.metaDescription);
  }
  if (input.ogImage !== undefined) {
    setClauses.push("og_image = ?");
    bindArgs.push(input.ogImage);
  }
  if (input.pairedArticleId !== undefined) {
    setClauses.push("paired_article_id = ?");
    bindArgs.push(input.pairedArticleId);
  }
  if (input.status !== undefined) {
    setClauses.push("status = ?");
    bindArgs.push(input.status);
    // If publishing for the first time, set published_at
    if (input.status === "published" && !existing.publishedAt) {
      setClauses.push("published_at = ?");
      bindArgs.push(now);
    }
  }

  setClauses.push("updated_at = ?");
  bindArgs.push(now);

  await db
    .prepare(`UPDATE blog_articles SET ${setClauses.join(", ")} WHERE id = ?`)
    .bind(...bindArgs, id)
    .run();

  // Update blog-package links if provided
  if (input.relatedPackageIds !== undefined) {
    await db
      .prepare("DELETE FROM blog_package_links WHERE blog_id = ?")
      .bind(id)
      .run();

    if (input.relatedPackageIds.length > 0) {
      const linkStatements = input.relatedPackageIds.map((pkgId) =>
        db
          .prepare("INSERT INTO blog_package_links (blog_id, package_id) VALUES (?, ?)")
          .bind(id, pkgId)
      );
      await db.batch(linkStatements);
    }
  }

  return (await getArticleById(db, id))!;
}

/**
 * Delete a blog article by ID.
 */
export async function deleteArticle(
  db: D1Database,
  id: string
): Promise<void> {
  await db
    .prepare("DELETE FROM blog_articles WHERE id = ?")
    .bind(id)
    .run();
}
