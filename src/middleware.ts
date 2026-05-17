/**
 * Astro middleware for admin route protection and error handling.
 *
 * - Redirects unauthenticated requests to /admin/login for all /admin/* routes
 * - Handles Worker CPU limit errors with a user-friendly 503 page
 * - Stores validated session on context.locals for admin pages
 */

import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import { validateSession } from "./lib/auth/session";
import { getSiteSettings } from "./lib/db/site-settings";
import { SiteSettingsDefaults } from "./lib/site-settings/defaults";
import type { Session } from "./lib/types";

/**
 * Renders a user-friendly 503 error page with site branding.
 * Detects locale from the request URL to show bilingual content.
 * Accepts optional brandName and supportEmail for dynamic branding;
 * falls back to SiteSettingsDefaults values when not provided.
 * Validates: Requirements 6.5, 10.4, 12.8
 */
function renderErrorPage(
  pathname: string,
  brandName: string = SiteSettingsDefaults.brandNameId,
  supportEmail: string = SiteSettingsDefaults.supportEmail
): string {
  const isEnglish = pathname === "/en" || pathname.startsWith("/en/");
  const lang = isEnglish ? "en" : "id";
  const homeHref = isEnglish ? "/en/" : "/";

  const content = isEnglish
    ? {
        title: `Service Unavailable - ${brandName}`,
        heading: "503",
        subheading: "Service Temporarily Unavailable",
        message:
          "Sorry, the service is experiencing a temporary issue. Please try again in a few moments.",
        support: `If the problem persists, contact us at ${supportEmail}.`,
        homeLink: "Back to Home",
      }
    : {
        title: `Layanan Tidak Tersedia - ${brandName}`,
        heading: "503",
        subheading: "Layanan Tidak Tersedia Sementara",
        message:
          "Maaf, layanan sedang mengalami gangguan sementara. Silakan coba lagi dalam beberapa saat.",
        support: `Jika masalah berlanjut, hubungi kami di ${supportEmail}.`,
        homeLink: "Kembali ke Beranda",
      };

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${content.title}</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background-color: #f9fafb;
      color: #374151;
    }
    .container {
      text-align: center;
      padding: 2rem;
      max-width: 480px;
    }
    .brand {
      font-size: 1.125rem;
      font-weight: 700;
      color: #111827;
      text-decoration: none;
      margin-bottom: 2rem;
      display: block;
    }
    .code {
      font-size: 3.75rem;
      font-weight: 700;
      color: #2563eb;
      margin-bottom: 1rem;
    }
    h1 {
      font-size: 1.5rem;
      margin-bottom: 1rem;
      color: #111827;
    }
    p {
      margin-bottom: 1.5rem;
      line-height: 1.6;
    }
    .support {
      font-size: 0.875rem;
      color: #6b7280;
      margin-bottom: 1.5rem;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 0.375rem;
      background-color: #2563eb;
      padding: 0.75rem 1.5rem;
      font-size: 0.875rem;
      font-weight: 500;
      color: #ffffff;
      text-decoration: none;
      transition: background-color 0.2s;
      min-height: 44px;
    }
    .btn:hover {
      background-color: #1d4ed8;
    }
  </style>
</head>
<body>
  <div class="container">
    <a href="${homeHref}" class="brand">${brandName}</a>
    <p class="code">${content.heading}</p>
    <h1>${content.subheading}</h1>
    <p>${content.message}</p>
    <p class="support">${content.support}</p>
    <a href="${homeHref}" class="btn">${content.homeLink}</a>
  </div>
</body>
</html>`;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // Admin route protection: protect all /admin/* routes except /admin/login
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const cookieHeader = context.request.headers.get("cookie");
    const sessionId = parseCookie(cookieHeader, "session_id");

    if (!sessionId) {
      return context.redirect("/admin/login");
    }

    const db = (env as any).DB as D1Database;
    const session = await validateSession(db, sessionId);

    if (!session) {
      return context.redirect("/admin/login");
    }

    // Store validated session on locals for admin pages to access
    (context.locals as App.Locals & { session: Session }).session = session;
  }

  try {
    return await next();
  } catch (error: unknown) {
    // Handle Worker CPU limit errors with a user-friendly 503 page
    if (
      error instanceof Error &&
      (error.name === "WorkerCpuLimitError" ||
        error.message.includes("CPU") ||
        error.message.includes("Worker exceeded"))
    ) {
      // Attempt to read site_settings for branding; fall back to defaults on failure
      let brandName = SiteSettingsDefaults.brandNameId;
      let supportEmail = SiteSettingsDefaults.supportEmail;
      try {
        const db = (env as any).DB as D1Database;
        const settings = await getSiteSettings(db);
        brandName = pathname.startsWith("/en/") || pathname === "/en"
          ? settings.brandNameEn
          : settings.brandNameId;
        supportEmail = settings.supportEmail;
      } catch {
        // DB unavailable — use defaults already set above
      }

      return new Response(
        renderErrorPage(pathname, brandName, supportEmail),
        {
          status: 503,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }
      );
    }
    throw error;
  }
});

/**
 * Parses a specific cookie value from the Cookie header string.
 */
function parseCookie(
  cookieHeader: string | null,
  name: string
): string | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const [key, ...valueParts] = cookie.trim().split("=");
    if (key === name) {
      return valueParts.join("=") || null;
    }
  }
  return null;
}
