/**
 * URL slug generation utility.
 * Converts titles into SEO-friendly URL slugs.
 */

/**
 * Generates a URL-safe slug from a title string.
 *
 * Rules:
 * - Convert to lowercase
 * - Replace non-alphanumeric characters with hyphens
 * - Remove leading/trailing hyphens
 * - Collapse consecutive hyphens into a single hyphen
 * - Result contains only [a-z0-9-]
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .replace(/-{2,}/g, "-");
}
