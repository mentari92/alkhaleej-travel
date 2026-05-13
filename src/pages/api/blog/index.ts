import type { APIRoute } from "astro";
import { validateSession } from "../../../lib/auth/session";
import {
  listAllArticles,
  listPublishedArticles,
  createArticle,
} from "../../../lib/db/blog";
import type { CreateArticleInput } from "../../../lib/db/blog";
import type { Locale } from "../../../lib/i18n/config";
import { getDB } from "../../../lib/db/connection";
import { sanitize } from "../../../lib/content/sanitizer";

/**
 * GET /api/blog
 * Lists blog articles. Supports optional ?language=id|en filter.
 * With language filter: returns published articles in that language.
 * Without filter: returns all articles (admin use).
 */
export const GET: APIRoute = async ({ url }) => {
  const db = getDB();
  const language = url.searchParams.get("language");

  try {
    let articles;
    if (language === "id" || language === "en") {
      articles = await listPublishedArticles(db, language as Locale);
    } else {
      articles = await listAllArticles(db);
    }

    return new Response(
      JSON.stringify({ success: true, data: articles }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch articles",
        },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

/**
 * POST /api/blog
 * Creates a new blog article. Requires authenticated session.
 * Validates required fields: title, excerpt, content, language, metaDescription.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  const db = getDB();

  // Auth check
  const sessionId = cookies.get("session_id")?.value;
  if (!sessionId) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const session = await validateSession(db, sessionId);
  if (!session) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid or expired session",
        },
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // Parse request body
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "INVALID_BODY",
          message: "Request body must be valid JSON",
        },
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Validate required fields
  const validationErrors = validateCreateArticleBody(body);
  if (validationErrors) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid article data",
          details: validationErrors,
        },
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const input: CreateArticleInput = {
      title: body.title,
      excerpt: body.excerpt,
      content: sanitize(body.content),
      language: body.language,
      thumbnailUrl: body.thumbnailUrl || "",
      metaDescription: body.metaDescription,
      ogImage: body.ogImage || "",
      relatedDestinationIds: body.relatedDestinationIds || [],
      pairedArticleId: body.pairedArticleId || null,
      status: body.status || "draft",
      publishedAt: body.publishedAt || null,
    };

    const article = await createArticle(db, input);

    return new Response(
      JSON.stringify({ success: true, data: article }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to create article",
        },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

/**
 * Validates the request body for creating a blog article.
 * Returns a details object with field-level errors, or null if valid.
 */
function validateCreateArticleBody(
  body: any
): Record<string, string[]> | null {
  const errors: Record<string, string[]> = {};

  if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
    errors.title = ["title is required"];
  }
  if (!body.excerpt || typeof body.excerpt !== "string" || !body.excerpt.trim()) {
    errors.excerpt = ["excerpt is required"];
  }
  if (!body.content || typeof body.content !== "string" || !body.content.trim()) {
    errors.content = ["content is required"];
  }
  if (!body.language || !["id", "en"].includes(body.language)) {
    errors.language = ["language is required and must be 'id' or 'en'"];
  }
  if (!body.metaDescription || typeof body.metaDescription !== "string" || !body.metaDescription.trim()) {
    errors.metaDescription = ["metaDescription is required"];
  }

  // Validate status if provided
  if (body.status && !["published", "draft"].includes(body.status)) {
    errors.status = ["status must be 'published' or 'draft'"];
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
