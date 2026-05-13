import type { APIRoute } from "astro";
import { validateSession } from "../../../lib/auth/session";
import { generateContent } from "../../../lib/ai/content-generator";
import type { GenerationRequest } from "../../../lib/ai/content-generator";
import { getDB, getEnvVar } from "../../../lib/db/connection";
import { sanitize } from "../../../lib/content/sanitizer";
import { createArticle } from "../../../lib/db/blog";

/**
 * POST /api/blog/generate
 * Triggers AI content generation for a blog article draft.
 * Requires authenticated session.
 *
 * Request body:
 * {
 *   topic: string (required)
 *   keywords?: string[]
 *   destinationId?: string
 *   targetLanguage: "id" | "en" (required)
 * }
 *
 * Returns the generated article draft (not saved to DB — admin reviews first).
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
  const validationErrors = validateGenerateBody(body);
  if (validationErrors) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid generation request",
          details: validationErrors,
        },
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Get API keys from environment
  const exaApiKey = getEnvVar("EXA_API_KEY");
  const deepseekApiKey = getEnvVar("DEEPSEEK_API_KEY");

  if (!deepseekApiKey) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "CONFIGURATION_ERROR",
          message: "DeepSeek API key is not configured",
        },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // Build generation request
  const generationRequest: GenerationRequest = {
    topic: body.topic.trim(),
    keywords: body.keywords || [],
    destinationId: body.destinationId || undefined,
    targetLanguage: body.targetLanguage,
  };

  // Execute content generation pipeline
  try {
    const result = await generateContent(generationRequest, {
      exaApiKey: exaApiKey || "",
      deepseekApiKey,
    });

    if (!result.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "GENERATION_FAILED",
            message: result.error || "Content generation failed",
          },
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Sanitize AI-generated content before persisting
    const sanitizedContent = sanitize(result.article.content);

    // Persist draft to D1
    let persistedArticle;
    try {
      persistedArticle = await createArticle(db, {
        ...result.article,
        content: sanitizedContent,
        status: "draft",
      });
    } catch {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "PERSIST_FAILED",
            message: "Failed to persist generated article to database",
          },
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: persistedArticle }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";

    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: `Content generation failed: ${message}`,
        },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

/**
 * Validates the request body for blog generation.
 * Returns a details object with field-level errors, or null if valid.
 */
function validateGenerateBody(
  body: any
): Record<string, string[]> | null {
  const errors: Record<string, string[]> = {};

  if (!body.topic || typeof body.topic !== "string" || !body.topic.trim()) {
    errors.topic = ["topic is required"];
  }

  if (!body.targetLanguage || !["id", "en"].includes(body.targetLanguage)) {
    errors.targetLanguage = [
      "targetLanguage is required and must be 'id' or 'en'",
    ];
  }

  if (body.keywords !== undefined && !Array.isArray(body.keywords)) {
    errors.keywords = ["keywords must be an array of strings"];
  }

  if (
    body.destinationId !== undefined &&
    typeof body.destinationId !== "string"
  ) {
    errors.destinationId = ["destinationId must be a string"];
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
