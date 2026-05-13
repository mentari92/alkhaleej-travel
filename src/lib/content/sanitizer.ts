import { parse, HTMLElement, Node, NodeType } from "node-html-parser";

// ---------------------------------------------------------------------------
// Tag whitelists
// ---------------------------------------------------------------------------

const ALLOWED_TAGS = new Set([
  "p", "br",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "strong", "em", "b", "i", "u", "s",
  "a", "img",
  "blockquote", "code", "pre",
  "table", "thead", "tbody", "tr", "th", "td",
  "figure", "figcaption",
  "hr",
  "iframe",
]);

/**
 * Tags whose entire subtree (including content) must be stripped from output.
 */
const BLOCKED_TAGS = new Set([
  "script", "style", "object", "embed",
  "form", "input", "link", "meta",
]);

// ---------------------------------------------------------------------------
// oEmbed host whitelist for <iframe src>
// ---------------------------------------------------------------------------

const OEMBED_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "player.vimeo.com",
]);

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when the tag name is in the allowed whitelist.
 */
function isAllowedTag(tagName: string): boolean {
  return ALLOWED_TAGS.has(tagName.toLowerCase());
}

/**
 * Returns true when the URL scheme is dangerous.
 * Allows `data:image/*` as a special case for <img src>.
 */
function hasDangerousScheme(value: string, allowDataImage = false): boolean {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.startsWith("javascript:")) return true;
  if (trimmed.startsWith("vbscript:")) return true;
  if (trimmed.startsWith("data:")) {
    if (allowDataImage && trimmed.startsWith("data:image/")) return false;
    return true;
  }
  return false;
}

/**
 * Returns true when the iframe src host is in the oEmbed whitelist.
 */
function isAllowedIframeSrc(src: string): boolean {
  try {
    const url = new URL(src);
    return OEMBED_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Filters the attributes of a given element, removing:
 * - All `on*` event-handler attributes
 * - `href` / `src` with dangerous schemes (with the data:image/* exception for <img src>)
 * - For <iframe>: the entire element is handled at the caller level; here we just
 *   pass through the src if it is allowed.
 */
function sanitizeAttributes(
  tagName: string,
  attrs: Record<string, string>
): Record<string, string> {
  const tag = tagName.toLowerCase();
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(attrs)) {
    const attrLower = key.toLowerCase();

    // Strip all event-handler attributes
    if (/^on[a-z]/i.test(attrLower)) continue;

    // Strip dangerous href schemes
    if (attrLower === "href" && hasDangerousScheme(value)) continue;

    // Strip dangerous src schemes (allow data:image/* on <img>)
    if (attrLower === "src") {
      const allowDataImage = tag === "img";
      if (hasDangerousScheme(value, allowDataImage)) continue;
    }

    result[key] = value;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Core recursive walker
// ---------------------------------------------------------------------------

/**
 * Recursively walks a parsed node tree and returns a sanitized HTML string.
 */
function walkNode(node: Node): string {
  // Text nodes — return as-is (node-html-parser already handles entity encoding)
  if (node.nodeType === NodeType.TEXT_NODE) {
    return node.rawText;
  }

  // Only process element nodes beyond this point
  if (node.nodeType !== NodeType.ELEMENT_NODE) {
    return "";
  }

  const el = node as HTMLElement;
  const tagName = el.rawTagName?.toLowerCase() ?? "";

  // Blocked tags: strip the entire subtree (tag + content)
  if (BLOCKED_TAGS.has(tagName)) {
    return "";
  }

  // Recurse into children first (needed for both allowed and unknown tags)
  const childOutput = el.childNodes.map(walkNode).join("");

  // Unknown / not-whitelisted tags: drop the tag but keep the text content
  if (!isAllowedTag(tagName)) {
    return childOutput;
  }

  // <iframe>: allow only when src host is in the oEmbed whitelist
  if (tagName === "iframe") {
    const src = el.getAttribute("src") ?? "";
    if (!isAllowedIframeSrc(src)) {
      return ""; // Remove the entire element
    }
  }

  // Build sanitized attribute string
  const rawAttrs = el.attributes as Record<string, string>;
  const safeAttrs = sanitizeAttributes(tagName, rawAttrs);
  const attrStr = Object.entries(safeAttrs)
    .map(([k, v]) => `${k}="${escapeAttr(v)}"`)
    .join(" ");

  // Void elements (self-closing)
  const VOID_TAGS = new Set(["br", "hr", "img"]);
  if (VOID_TAGS.has(tagName)) {
    return attrStr ? `<${tagName} ${attrStr}>` : `<${tagName}>`;
  }

  const openTag = attrStr ? `<${tagName} ${attrStr}>` : `<${tagName}>`;
  return `${openTag}${childOutput}</${tagName}>`;
}

/**
 * Escapes double-quote characters inside attribute values.
 */
function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sanitizes an HTML string using a whitelist-based approach.
 *
 * - Strips blocked tags (script, style, object, embed, form, input, link, meta)
 *   along with their entire content.
 * - Removes all `on*` event-handler attributes.
 * - Removes `href`/`src` with `javascript:`, `vbscript:`, or `data:` schemes
 *   (exception: `data:image/*` is allowed on `<img src>`).
 * - Allows `<iframe>` only when the `src` host is in the oEmbed whitelist;
 *   otherwise removes the entire element.
 * - Unknown tags are stripped but their text content is preserved.
 *
 * This function is idempotent: `sanitize(sanitize(x)) === sanitize(x)`.
 *
 * Compatible with the Cloudflare Workers V8 runtime (no DOM, no Node.js APIs).
 */
export function sanitize(html: string): string {
  if (!html) return "";

  const root = parse(html, {
    lowerCaseTagName: false,
    comment: false,
    blockTextElements: {
      script: false,
      style: false,
      pre: true,
      code: true,
    },
  });

  return root.childNodes.map(walkNode).join("");
}
