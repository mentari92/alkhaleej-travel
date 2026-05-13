import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { sanitize } from "./sanitizer";

/**
 * Property tests for the HTML content sanitizer.
 *
 * Feature: production-readiness-foundation
 * **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.6, 5.8, 5.9, 5.10**
 */

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** oEmbed-whitelisted iframe src URLs */
const OEMBED_HOSTS = [
  "youtube.com",
  "www.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "player.vimeo.com",
] as const;

/** Whitelisted tags (excluding iframe, which needs special src handling) */
const SAFE_INLINE_TAGS = [
  "p", "br", "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "strong", "em", "b", "i", "u", "s",
  "blockquote", "code", "pre",
  "figure", "figcaption",
  "hr",
] as const;

/** Whitelisted tags that can wrap content */
const SAFE_CONTAINER_TAGS = [
  "p", "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "strong", "em", "b", "i", "u", "s",
  "blockquote", "code", "pre",
  "figure", "figcaption",
] as const;

/** Safe text content (no HTML special chars that would confuse the parser) */
const safeTextArb = fc.string({ minLength: 0, maxLength: 50 }).map((s) =>
  s.replace(/[<>&"']/g, "")
);

/** Generates a safe whitelisted iframe element */
const safeIframeArb: fc.Arbitrary<string> = fc
  .constantFrom(...OEMBED_HOSTS)
  .chain((host) =>
    fc
      .string({ minLength: 1, maxLength: 20 })
      .map((path) => `<iframe src="https://${host}/${path.replace(/[<>"]/g, "")}"></iframe>`)
  );

/** Generates a safe <a> element with a non-dangerous href */
const safeAnchorArb: fc.Arbitrary<string> = fc
  .webUrl()
  .filter((url) => {
    const lower = url.toLowerCase();
    return (
      !lower.startsWith("javascript:") &&
      !lower.startsWith("vbscript:") &&
      !lower.startsWith("data:")
    );
  })
  .map((url) => `<a href="${url}">link</a>`);

/** Generates a safe <img> element with an https src */
const safeImgArb: fc.Arbitrary<string> = fc
  .webUrl()
  .map((url) => `<img src="${url}">`);

/** Generates a single safe HTML element (whitelisted tag with safe content) */
const safeElementArb: fc.Arbitrary<string> = fc.oneof(
  // Simple container tags with text content
  fc
    .record({
      tag: fc.constantFrom(...SAFE_CONTAINER_TAGS),
      text: safeTextArb,
    })
    .map(({ tag, text }) => `<${tag}>${text}</${tag}>`),
  // Void tags
  fc.constant("<br>"),
  fc.constant("<hr>"),
  // Safe anchor
  safeAnchorArb,
  // Safe image
  safeImgArb,
  // Safe iframe
  safeIframeArb
);

/** Generates a safe HTML string composed of 1–5 safe elements */
const safeHtmlArb: fc.Arbitrary<string> = fc
  .array(safeElementArb, { minLength: 1, maxLength: 5 })
  .map((parts) => parts.join(""));

// ---------------------------------------------------------------------------
// Property 4: HTML sanitizer idempotence
// **Validates: Requirements 5.8**
// ---------------------------------------------------------------------------

describe("Property 4: HTML sanitizer idempotence", () => {
  it("sanitize(sanitize(x)) === sanitize(x) for any string x", () => {
    fc.assert(
      fc.property(fc.string(), (html) => {
        const once = sanitize(html);
        const twice = sanitize(once);
        expect(twice).toBe(once);
      }),
      { numRuns: 200 }
    );
  });

  it("idempotence holds for strings containing HTML-like content", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string(),
          fc.webUrl(),
          fc.emailAddress(),
          fc.constant("<script>alert(1)</script>"),
          fc.constant('<img onerror="alert(1)" src="x">'),
          fc.constant('<a href="javascript:void(0)">click</a>'),
          fc.constant('<iframe src="https://evil.com"></iframe>'),
          fc.constant("<p>Hello <b>world</b></p>"),
          fc.constant("")
        ),
        (html) => {
          const once = sanitize(html);
          const twice = sanitize(once);
          expect(twice).toBe(once);
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 5: HTML sanitizer safety invariant
// **Validates: Requirements 5.3, 5.4, 5.5, 5.6, 5.9**
// ---------------------------------------------------------------------------

describe("Property 5: HTML sanitizer safety invariant", () => {
  it("sanitize(x) must not contain <script (case-insensitive)", () => {
    fc.assert(
      fc.property(fc.string(), (html) => {
        const result = sanitize(html);
        expect(result.toLowerCase()).not.toContain("<script");
      }),
      { numRuns: 200 }
    );
  });

  it("sanitize(x) must not contain javascript: in attribute values", () => {
    fc.assert(
      fc.property(fc.string(), (html) => {
        const result = sanitize(html);
        // Check that no attribute value contains javascript:
        // We look for the pattern attr="...javascript:..." or attr='...javascript:...'
        const attrValuePattern = /(?:href|src|action|data-[a-z-]+)\s*=\s*["'][^"']*javascript:/i;
        expect(attrValuePattern.test(result)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it("sanitize(x) must not contain on[a-z] attribute names (event handlers)", () => {
    fc.assert(
      fc.property(fc.string(), (html) => {
        const result = sanitize(html);
        // Match on* attributes: space/tab before "on" followed by letters and "="
        const onAttrPattern = /\bon[a-z]+\s*=/i;
        expect(onAttrPattern.test(result)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it("sanitize(x) must not contain <iframe with non-whitelisted src host", () => {
    fc.assert(
      fc.property(fc.string(), (html) => {
        const result = sanitize(html);
        // Extract all iframe src attributes from the result
        const iframeSrcPattern = /<iframe[^>]*\bsrc\s*=\s*["']([^"']*)["'][^>]*>/gi;
        let match: RegExpExecArray | null;
        while ((match = iframeSrcPattern.exec(result)) !== null) {
          const src = match[1];
          try {
            const url = new URL(src);
            const allowedHosts = new Set([
              "youtube.com",
              "www.youtube.com",
              "youtube-nocookie.com",
              "www.youtube-nocookie.com",
              "player.vimeo.com",
            ]);
            expect(allowedHosts.has(url.hostname)).toBe(true);
          } catch {
            // If src is not a valid URL, the iframe should not be in the output
            // (sanitizer removes iframes with invalid src)
            expect(false).toBe(true); // iframe with invalid src should not appear
          }
        }
      }),
      { numRuns: 200 }
    );
  });

  it("safety invariant holds for adversarial XSS payloads", () => {
    const xssPayloads = [
      "<script>alert(1)</script>",
      "<SCRIPT>alert(1)</SCRIPT>",
      '<img onerror="alert(1)" src="x">',
      '<img ONERROR="alert(1)" src="x">',
      '<a href="javascript:alert(1)">click</a>',
      '<a href="JAVASCRIPT:alert(1)">click</a>',
      '<a href="javascript&#58;alert(1)">click</a>',
      '<iframe src="https://evil.com/xss"></iframe>',
      '<iframe src="https://attacker.example/steal"></iframe>',
      '<div onclick="alert(1)">click</div>',
      '<p onmouseover="alert(1)">hover</p>',
      '<img src="data:text/html,<script>alert(1)</script>">',
      "<style>body{background:url(javascript:alert(1))}</style>",
      "<object data='javascript:alert(1)'></object>",
      "<embed src='javascript:alert(1)'>",
      "<form action='javascript:alert(1)'><input type='submit'></form>",
    ];

    fc.assert(
      fc.property(fc.constantFrom(...xssPayloads), (payload) => {
        const result = sanitize(payload);
        expect(result.toLowerCase()).not.toContain("<script");
        const onAttrPattern = /\bon[a-z]+\s*=/i;
        expect(onAttrPattern.test(result)).toBe(false);
        // No javascript: in attribute values
        const jsAttrPattern = /(?:href|src|action)\s*=\s*["'][^"']*javascript:/i;
        expect(jsAttrPattern.test(result)).toBe(false);
      }),
      { numRuns: xssPayloads.length }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6: HTML sanitizer whitelist preservation
// **Validates: Requirements 5.2, 5.10**
// ---------------------------------------------------------------------------

describe("Property 6: HTML sanitizer whitelist preservation", () => {
  it("safe HTML composed only of whitelisted tags is preserved (tags not removed)", () => {
    fc.assert(
      fc.property(safeHtmlArb, (html) => {
        const result = sanitize(html);
        // The result must be non-empty when input is non-empty
        // (safe content should not be stripped entirely)
        // We verify that whitelisted tags present in input appear in output
        const tagPattern = /<([a-z][a-z0-9]*)/gi;
        let match: RegExpExecArray | null;
        const inputTags = new Set<string>();
        while ((match = tagPattern.exec(html)) !== null) {
          inputTags.add(match[1].toLowerCase());
        }

        const outputTags = new Set<string>();
        const outputTagPattern = /<([a-z][a-z0-9]*)/gi;
        while ((match = outputTagPattern.exec(result)) !== null) {
          outputTags.add(match[1].toLowerCase());
        }

        // Every tag in the input (which is safe/whitelisted) should appear in output
        for (const tag of inputTags) {
          expect(outputTags.has(tag)).toBe(true);
        }
      }),
      { numRuns: 200 }
    );
  });

  it("safe container tags with text content preserve the text", () => {
    fc.assert(
      fc.property(
        fc.record({
          tag: fc.constantFrom(...SAFE_CONTAINER_TAGS),
          text: safeTextArb.filter((t) => t.length > 0),
        }),
        ({ tag, text }) => {
          const html = `<${tag}>${text}</${tag}>`;
          const result = sanitize(html);
          // The tag should be preserved
          expect(result).toContain(`<${tag}>`);
          expect(result).toContain(`</${tag}>`);
          // The text content should be preserved
          expect(result).toContain(text);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("safe iframe with whitelisted src is preserved", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...OEMBED_HOSTS).chain((host) =>
          fc
            .string({ minLength: 1, maxLength: 30 })
            .filter((p) => !p.includes('"') && !p.includes("<") && !p.includes(">"))
            .map((path) => ({
              host,
              src: `https://${host}/${path}`,
            }))
        ),
        ({ src }) => {
          const html = `<iframe src="${src}"></iframe>`;
          const result = sanitize(html);
          // The iframe should be preserved (not stripped)
          expect(result).toContain("<iframe");
          expect(result).toContain("</iframe>");
        }
      ),
      { numRuns: 200 }
    );
  });

  it("safe anchor with https href is preserved", () => {
    fc.assert(
      fc.property(
        fc
          .webUrl()
          .filter((url) => {
            const lower = url.toLowerCase();
            return (
              !lower.startsWith("javascript:") &&
              !lower.startsWith("vbscript:") &&
              !lower.startsWith("data:")
            );
          }),
        (url) => {
          const html = `<a href="${url}">link text</a>`;
          const result = sanitize(html);
          expect(result).toContain("<a");
          expect(result).toContain("</a>");
        }
      ),
      { numRuns: 200 }
    );
  });

  it("safe img with https src is preserved", () => {
    fc.assert(
      fc.property(
        fc
          .webUrl()
          .filter((url) => {
            const lower = url.toLowerCase();
            return (
              !lower.startsWith("javascript:") &&
              !lower.startsWith("vbscript:") &&
              !lower.startsWith("data:")
            );
          }),
        (url) => {
          const html = `<img src="${url}">`;
          const result = sanitize(html);
          expect(result).toContain("<img");
        }
      ),
      { numRuns: 200 }
    );
  });
});
