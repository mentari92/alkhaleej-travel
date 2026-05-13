import type { APIRoute } from "astro";
import { validateSession } from "../../../lib/auth/session";
import {
  listAllDestinations,
  listPublishedDestinations,
  createDestination,
} from "../../../lib/db/destinations";
import type { CreateDestinationInput } from "../../../lib/db/destinations";
import { getDB } from "../../../lib/db/connection";

/**
 * GET /api/destinations
 * Lists destinations. Supports optional ?status=published|draft filter.
 * Returns all destinations by default (admin use).
 */
export const GET: APIRoute = async ({ url }) => {
  const db = getDB();
  const status = url.searchParams.get("status");

  try {
    let destinations;
    if (status === "published") {
      destinations = await listPublishedDestinations(db);
    } else {
      destinations = await listAllDestinations(db);
    }

    return new Response(
      JSON.stringify({ success: true, data: destinations }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch destinations",
        },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

/**
 * POST /api/destinations
 * Creates a new destination. Requires authenticated session.
 * Validates bilingual fields are present.
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

  // Validate required bilingual fields
  const validationErrors = validateCreateDestinationBody(body);
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
    const input: CreateDestinationInput = {
      title: { id: body.title.id, en: body.title.en },
      tagline: { id: body.tagline.id, en: body.tagline.en },
      heroImage: body.heroImage,
      aboutText: { id: body.aboutText.id, en: body.aboutText.en },
      galleryImages: body.galleryImages || [],
      services: body.services || [],
      testimonials: body.testimonials || [],
      faqEntries: body.faqEntries || [],
      whatsappNumber: body.whatsappNumber,
      status: body.status || "draft",
    };

    const destination = await createDestination(db, input);

    return new Response(
      JSON.stringify({ success: true, data: destination }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to create destination",
        },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

/**
 * Validates the request body for creating a destination.
 * Returns a details object with field-level errors, or null if valid.
 */
function validateCreateDestinationBody(
  body: any
): Record<string, string[]> | null {
  const errors: Record<string, string[]> = {};

  // Validate bilingual string fields
  if (!body.title || !body.title.id || !body.title.en) {
    errors.title = ["Both title.id and title.en are required"];
  }
  if (!body.tagline || !body.tagline.id || !body.tagline.en) {
    errors.tagline = ["Both tagline.id and tagline.en are required"];
  }
  if (!body.aboutText || !body.aboutText.id || !body.aboutText.en) {
    errors.aboutText = ["Both aboutText.id and aboutText.en are required"];
  }

  // Validate non-bilingual required fields
  if (!body.heroImage) {
    errors.heroImage = ["heroImage is required"];
  }
  if (!body.whatsappNumber) {
    errors.whatsappNumber = ["whatsappNumber is required"];
  }

  // Validate status if provided
  if (body.status && !["published", "draft"].includes(body.status)) {
    errors.status = ["status must be 'published' or 'draft'"];
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
