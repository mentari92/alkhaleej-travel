import type { APIRoute } from "astro";
import { validateSession } from "../../../lib/auth/session";
import {
  getArticleById,
  updateArticle,
  deleteArticle,
} from "../../../lib/db/blog";
import type { UpdateArticleInput } from "../../../lib/db/blog";
import { getDB } from "../../../lib/db/connection";
import { sanitize } from "../../../lib/content/sanitizer";

/**
 * GET /api/blog/[id]
 * Returns a single blog article by ID.
 */
export const GET: APIRoute = async ({ params }) => {
  const db = getDB();
  const { id } = params;

  if (!id) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "MISSING_ID",
          message: "Article ID is required",
        },
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const article = await getArticleById(db, id);

    if (!article) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: `Article not found: ${id}`,
          },
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: article }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch article",
        },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

/**
 * PUT /api/blog/[id]
 * Updates an existing blog article. Requires authenticated session.
 */
export const PUT: APIRoute = async ({ params, request, cookies }) => {
  const db = getDB();
  const { id } = params;

  if (!id) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "MISSING_ID",
          message: "Article ID is required",
        },
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

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

  // Validate fields if provided
  const validationErrors = validateUpdateArticleBody(body);
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
    // Check article exists
    const existing = await getArticleById(db, id);
    if (!existing) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: `Article not found: ${id}`,
          },
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const input: UpdateArticleInput = {};

    if (body.title !== undefined) input.title = body.title;
    if (body.excerpt !== undefined) input.excerpt = body.excerpt;
    if (body.content !== undefined) input.content = sanitize(body.content);
    if (body.language !== undefined) input.language = body.language;
    if (body.thumbnailUrl !== undefined) input.thumbnailUrl = body.thumbnailUrl;
    if (body.metaDescription !== undefined) input.metaDescription = body.metaDescription;
    if (body.ogImage !== undefined) input.ogImage = body.ogImage;
    if (body.relatedDestinationIds !== undefined) input.relatedDestinationIds = body.relatedDestinationIds;
    if (body.pairedArticleId !== undefined) input.pairedArticleId = body.pairedArticleId;
    if (body.status !== undefined) input.status = body.status;
    if (body.publishedAt !== undefined) input.publishedAt = body.publishedAt;

    const article = await updateArticle(db, id, input);

    return new Response(
      JSON.stringify({ success: true, data: article }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to update article",
        },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

/**
 * DELETE /api/blog/[id]
 * Deletes a blog article. Requires authenticated session.
 */
export const DELETE: APIRoute = async ({ params, cookies }) => {
  const db = getDB();
  const { id } = params;

  if (!id) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "MISSING_ID",
          message: "Article ID is required",
        },
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

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

  try {
    // Check article exists
    const existing = await getArticleById(db, id);
    if (!existing) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: `Article not found: ${id}`,
          },
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    await deleteArticle(db, id);

    return new Response(
      JSON.stringify({ success: true, data: { id } }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to delete article",
        },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

/**
 * Validates the request body for updating a blog article.
 * Returns a details object with field-level errors, or null if valid.
 */
function validateUpdateArticleBody(
  body: any
): Record<string, string[]> | null {
  const errors: Record<string, string[]> = {};

  // Validate language if provided
  if (body.language !== undefined && !["id", "en"].includes(body.language)) {
    errors.language = ["language must be 'id' or 'en'"];
  }

  // Validate status if provided
  if (body.status !== undefined && !["published", "draft"].includes(body.status)) {
    errors.status = ["status must be 'published' or 'draft'"];
  }

  // Validate string fields are not empty if provided
  if (body.title !== undefined && (typeof body.title !== "string" || !body.title.trim())) {
    errors.title = ["title must be a non-empty string"];
  }
  if (body.excerpt !== undefined && (typeof body.excerpt !== "string" || !body.excerpt.trim())) {
    errors.excerpt = ["excerpt must be a non-empty string"];
  }
  if (body.content !== undefined && (typeof body.content !== "string" || !body.content.trim())) {
    errors.content = ["content must be a non-empty string"];
  }
  if (body.metaDescription !== undefined && (typeof body.metaDescription !== "string" || !body.metaDescription.trim())) {
    errors.metaDescription = ["metaDescription must be a non-empty string"];
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
