import type { APIRoute } from "astro";
import { validateSession } from "../../../lib/auth/session";
import {
  getDestinationById,
  updateDestination,
  deleteDestination,
} from "../../../lib/db/destinations";
import type { UpdateDestinationInput } from "../../../lib/db/destinations";
import { getDB } from "../../../lib/db/connection";

/**
 * GET /api/destinations/[id]
 * Returns a single destination by ID.
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
          message: "Destination ID is required",
        },
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const destination = await getDestinationById(db, id);

    if (!destination) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: `Destination not found: ${id}`,
          },
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: destination }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch destination",
        },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

/**
 * PUT /api/destinations/[id]
 * Updates an existing destination. Requires authenticated session.
 * Validates bilingual fields when provided.
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
          message: "Destination ID is required",
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

  // Validate bilingual fields if provided
  const validationErrors = validateUpdateDestinationBody(body);
  if (validationErrors) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid destination data",
          details: validationErrors,
        },
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // Check destination exists
    const existing = await getDestinationById(db, id);
    if (!existing) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: `Destination not found: ${id}`,
          },
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const input: UpdateDestinationInput = {};

    if (body.title) input.title = { id: body.title.id, en: body.title.en };
    if (body.tagline) input.tagline = { id: body.tagline.id, en: body.tagline.en };
    if (body.heroImage !== undefined) input.heroImage = body.heroImage;
    if (body.aboutText) input.aboutText = { id: body.aboutText.id, en: body.aboutText.en };
    if (body.galleryImages !== undefined) input.galleryImages = body.galleryImages;
    if (body.services !== undefined) input.services = body.services;
    if (body.testimonials !== undefined) input.testimonials = body.testimonials;
    if (body.faqEntries !== undefined) input.faqEntries = body.faqEntries;
    if (body.whatsappNumber !== undefined) input.whatsappNumber = body.whatsappNumber;
    if (body.status !== undefined) input.status = body.status;

    const destination = await updateDestination(db, id, input);

    return new Response(
      JSON.stringify({ success: true, data: destination }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to update destination",
        },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

/**
 * DELETE /api/destinations/[id]
 * Deletes a destination. Requires authenticated session.
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
          message: "Destination ID is required",
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
    // Check destination exists
    const existing = await getDestinationById(db, id);
    if (!existing) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: `Destination not found: ${id}`,
          },
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    await deleteDestination(db, id);

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
          message: "Failed to delete destination",
        },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

/**
 * Validates the request body for updating a destination.
 * Bilingual fields must have both .id and .en when provided.
 * Returns a details object with field-level errors, or null if valid.
 */
function validateUpdateDestinationBody(
  body: any
): Record<string, string[]> | null {
  const errors: Record<string, string[]> = {};

  // Validate bilingual fields only if provided
  if (body.title !== undefined) {
    if (!body.title || !body.title.id || !body.title.en) {
      errors.title = ["Both title.id and title.en are required"];
    }
  }
  if (body.tagline !== undefined) {
    if (!body.tagline || !body.tagline.id || !body.tagline.en) {
      errors.tagline = ["Both tagline.id and tagline.en are required"];
    }
  }
  if (body.aboutText !== undefined) {
    if (!body.aboutText || !body.aboutText.id || !body.aboutText.en) {
      errors.aboutText = ["Both aboutText.id and aboutText.en are required"];
    }
  }

  // Validate status if provided
  if (body.status !== undefined && !["published", "draft"].includes(body.status)) {
    errors.status = ["status must be 'published' or 'draft'"];
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
