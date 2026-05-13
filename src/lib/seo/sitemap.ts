/**
 * Sitemap XML generation with hreflang support.
 * Generates a sitemap.xml string from an array of SitemapEntry objects,
 * including xhtml:link hreflang annotations for multilingual pages.
 */

import type { HreflangEntry } from "../types";

export interface SitemapEntry {
  url: string;
  lastmod: string;
  changefreq: "daily" | "weekly" | "monthly";
  priority: number;
  alternates: HreflangEntry[];
}

/**
 * Generates a complete sitemap.xml string from an array of SitemapEntry objects.
 * Each entry includes xhtml:link rel="alternate" hreflang annotations for
 * cross-referencing alternate language versions.
 */
export function generateSitemap(entries: SitemapEntry[]): string {
  const urlEntries = entries.map((entry) => {
    const alternateLinks = entry.alternates
      .map(
        (alt) =>
          `    <xhtml:link rel="alternate" hreflang="${alt.locale}" href="${escapeXml(alt.url)}" />`
      )
      .join("\n");

    return `  <url>
    <loc>${escapeXml(entry.url)}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority.toFixed(1)}</priority>
${alternateLinks}
  </url>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urlEntries.join("\n")}
</urlset>`;
}

/**
 * Escapes special XML characters in a string.
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
