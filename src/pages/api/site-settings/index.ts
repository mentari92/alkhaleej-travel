import type { APIRoute } from "astro";
import { validateSession } from "../../../lib/auth/session";
import { getSiteSettings, updateSiteSettings } from "../../../lib/db/site-settings";
import type { SiteSettings } from "../../../lib/db/site-settings";
import { getDB, getEnvVar } from "../../../lib/db/connection";

// ---------------------------------------------------------------------------
// Server-side validation rules (mirrors client-side, applied only to fields
// present in the patch)
// ---------------------------------------------------------------------------

const WHATSAPP_RE = /^62[0-9]{8,13}$/;
// Simplified RFC 5322 email regex
const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
const GTM_RE = /^GTM-[A-Z0-9]{4,10}$/;
const GA4_RE = /^G-[A-Z0-9]{6,12}$/;

// Approved analytics hosts for customHeadHtml <script src="..."> tags
const APPROVED_ANALYTICS_HOSTS = [
  "googletagmanager.com",
  "google-analytics.com",
  "clarity.ms",
  "hotjar.com",
];

/**
 * Validates the customHeadHtml field.
 * Only allows:
 *   - <script src="..."> tags where the src host is in the approved list
 *   - <noscript> tags
 * Returns true if valid, false otherwise.
 */
function isValidCustomHeadHtml(html: string): boolean {
  if (!html || html.trim() === "") return true;

  // Strip whitespace and check each tag
  const trimmed = html.trim();

  // Match all tags in the string
  const tagPattern = /<([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g;
  let match: RegExpExecArray | null;
  const allowedTagNames = new Set(["script", "noscript"]);

  // Check for any tags that are not script or noscript
  while ((match = tagPattern.exec(trimmed)) !== null) {
    const tagName = match[1].toLowerCase();
    if (!allowedTagNames.has(tagName)) {
      return false;
    }
  }

  // For script tags, verify src is from an approved host
  const scriptPattern = /<script\s[^>]*src\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let scriptMatch: RegExpExecArray | null;
  while ((scriptMatch = scriptPattern.exec(trimmed)) !== null) {
    const src = scriptMatch[1];
    try {
      const url = new URL(src);
      const host = url.hostname;
      const isApproved = APPROVED_ANALYTICS_HOSTS.some(
        (approved) => host === approved || host.endsWith("." + approved)
      );
      if (!isApproved) {
        return false;
      }
    } catch {
      // Invalid URL in src
      return false;
    }
  }

  // Check for inline script tags (script without src) — not allowed
  const inlineScriptPattern = /<script(?!\s[^>]*src\s*=)[^>]*>/gi;
  if (inlineScriptPattern.test(trimmed)) {
    return false;
  }

  return true;
}

/**
 * Validates a partial SiteSettings patch.
 * Returns a details object with field-level errors, or null if valid.
 */
function validatePatch(
  patch: Partial<Omit<SiteSettings, "updatedAt">>
): Record<string, string[]> | null {
  const errors: Record<string, string[]> = {};

  if (patch.primaryWhatsappNumber !== undefined) {
    if (!WHATSAPP_RE.test(patch.primaryWhatsappNumber)) {
      errors.primaryWhatsappNumber = [
        "Must start with 62 followed by 8–13 digits",
      ];
    }
  }

  if (patch.supportEmail !== undefined) {
    if (!EMAIL_RE.test(patch.supportEmail)) {
      errors.supportEmail = ["Must be a valid email address"];
    }
  }

  if (patch.socialInstagramUrl !== undefined && patch.socialInstagramUrl !== null) {
    const url = patch.socialInstagramUrl;
    if (
      !url.startsWith("https://instagram.com") &&
      !url.startsWith("https://www.instagram.com")
    ) {
      errors.socialInstagramUrl = [
        "Must start with https://instagram.com or https://www.instagram.com",
      ];
    }
  }

  if (patch.socialYoutubeUrl !== undefined && patch.socialYoutubeUrl !== null) {
    const url = patch.socialYoutubeUrl;
    if (
      !url.startsWith("https://youtube.com") &&
      !url.startsWith("https://www.youtube.com") &&
      !url.startsWith("https://youtu.be")
    ) {
      errors.socialYoutubeUrl = [
        "Must start with https://youtube.com, https://www.youtube.com, or https://youtu.be",
      ];
    }
  }

  if (patch.socialFacebookUrl !== undefined && patch.socialFacebookUrl !== null) {
    const url = patch.socialFacebookUrl;
    if (
      !url.startsWith("https://facebook.com") &&
      !url.startsWith("https://www.facebook.com") &&
      !url.startsWith("https://fb.com")
    ) {
      errors.socialFacebookUrl = [
        "Must start with https://facebook.com, https://www.facebook.com, or https://fb.com",
      ];
    }
  }

  if (patch.socialTiktokUrl !== undefined && patch.socialTiktokUrl !== null) {
    const url = patch.socialTiktokUrl;
    if (
      !url.startsWith("https://tiktok.com") &&
      !url.startsWith("https://www.tiktok.com")
    ) {
      errors.socialTiktokUrl = [
        "Must start with https://tiktok.com or https://www.tiktok.com",
      ];
    }
  }

  if (patch.gtmContainerId !== undefined && patch.gtmContainerId !== null) {
    if (!GTM_RE.test(patch.gtmContainerId)) {
      errors.gtmContainerId = ["Must match pattern GTM-XXXX (4–10 alphanumeric chars)"];
    }
  }

  if (patch.ga4MeasurementId !== undefined && patch.ga4MeasurementId !== null) {
    if (!GA4_RE.test(patch.ga4MeasurementId)) {
      errors.ga4MeasurementId = ["Must match pattern G-XXXXXX (6–12 alphanumeric chars)"];
    }
  }

  if (patch.customHeadHtml !== undefined && patch.customHeadHtml !== null) {
    if (!isValidCustomHeadHtml(patch.customHeadHtml)) {
      errors.customHeadHtml = [
        "Only <script src> from approved analytics hosts and <noscript> tags are allowed",
      ];
    }
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

// ---------------------------------------------------------------------------
// CSRF origin check
// ---------------------------------------------------------------------------

/**
 * Checks the Origin or Referer header against the SITE_URL env var.
 * Returns true if the request origin matches, false otherwise.
 */
function checkCsrfOrigin(request: Request): boolean {
  const siteUrl = getEnvVar("SITE_URL");
  if (!siteUrl) {
    // If SITE_URL is not configured, we cannot validate — reject for safety
    return false;
  }

  let siteOrigin: string;
  try {
    siteOrigin = new URL(siteUrl).origin;
  } catch {
    return false;
  }

  // Check Origin header first
  const originHeader = request.headers.get("Origin");
  if (originHeader) {
    return originHeader === siteOrigin;
  }

  // Fall back to Referer header
  const refererHeader = request.headers.get("Referer");
  if (refererHeader) {
    try {
      const refererOrigin = new URL(refererHeader).origin;
      return refererOrigin === siteOrigin;
    } catch {
      return false;
    }
  }

  // Neither header present — reject
  return false;
}

// ---------------------------------------------------------------------------
// GET /api/site-settings
// ---------------------------------------------------------------------------

/**
 * GET /api/site-settings
 * Returns current site settings. No authentication required (public data for SSR).
 *
 * Response 200: { success: true, data: SiteSettings }
 * Response 500: { success: false, error: { code: "DB_ERROR", message: "..." } }
 */
export const GET: APIRoute = async () => {
  const db = getDB();

  try {
    const settings = await getSiteSettings(db);
    return new Response(JSON.stringify({ success: true, data: settings }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch site settings";
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: "DB_ERROR", message },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

// ---------------------------------------------------------------------------
// PUT /api/site-settings
// ---------------------------------------------------------------------------

/**
 * PUT /api/site-settings
 * Updates site settings. Requires authenticated session + CSRF origin check.
 *
 * Request body: Partial<SiteSettings> (only dirty fields)
 *
 * Response 200: { success: true, data: SiteSettings }
 * Response 401: { success: false, error: { code: "UNAUTHORIZED", message: "..." } }
 * Response 403: { success: false, error: { code: "CSRF_ORIGIN_MISMATCH", message: "..." } }
 * Response 422: { success: false, error: { code: "VALIDATION_ERROR", message: "...", details: { field: string[] } } }
 */
export const PUT: APIRoute = async ({ request, cookies }) => {
  const db = getDB();

  // 1. Session authentication
  const sessionId = cookies.get("session_id")?.value;
  if (!sessionId) {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const session = await validateSession(db, sessionId);
  if (!session) {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Invalid or expired session" },
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // 2. CSRF origin check
  if (!checkCsrfOrigin(request)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "CSRF_ORIGIN_MISMATCH",
          message: "Request origin does not match the expected site URL",
        },
      }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  // 3. Parse request body
  let body: unknown;
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

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "INVALID_BODY",
          message: "Request body must be a JSON object",
        },
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const patch = body as Partial<Omit<SiteSettings, "updatedAt">>;

  // 4. Server-side validation (only fields present in the patch)
  const validationErrors = validatePatch(patch);
  if (validationErrors) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "One or more fields failed validation",
          details: validationErrors,
        },
      }),
      { status: 422, headers: { "Content-Type": "application/json" } }
    );
  }

  // 5. Persist and return updated settings
  try {
    const updated = await updateSiteSettings(db, patch);
    return new Response(JSON.stringify({ success: true, data: updated }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update site settings";
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: "DB_ERROR", message },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
