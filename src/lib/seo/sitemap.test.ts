import { describe, it, expect } from "vitest";
import { generateSitemap, type SitemapEntry } from "./sitemap";

describe("generateSitemap()", () => {
  it("generates valid XML with urlset and xhtml namespace", () => {
    const entries: SitemapEntry[] = [];
    const xml = generateSitemap(entries);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
  });

  it("generates correct URL entry with all fields", () => {
    const entries: SitemapEntry[] = [
      {
        url: "https://infotour.id/destinations/bali",
        lastmod: "2024-06-15",
        changefreq: "weekly",
        priority: 0.8,
        alternates: [
          { locale: "id", url: "https://infotour.id/destinations/bali" },
          { locale: "en", url: "https://infotour.id/en/destinations/bali" },
        ],
      },
    ];

    const xml = generateSitemap(entries);

    expect(xml).toContain("<loc>https://infotour.id/destinations/bali</loc>");
    expect(xml).toContain("<lastmod>2024-06-15</lastmod>");
    expect(xml).toContain("<changefreq>weekly</changefreq>");
    expect(xml).toContain("<priority>0.8</priority>");
  });

  it("includes xhtml:link hreflang annotations for alternates", () => {
    const entries: SitemapEntry[] = [
      {
        url: "https://infotour.id/destinations/bali",
        lastmod: "2024-06-15",
        changefreq: "weekly",
        priority: 0.8,
        alternates: [
          { locale: "id", url: "https://infotour.id/destinations/bali" },
          { locale: "en", url: "https://infotour.id/en/destinations/bali" },
        ],
      },
    ];

    const xml = generateSitemap(entries);

    expect(xml).toContain(
      '<xhtml:link rel="alternate" hreflang="id" href="https://infotour.id/destinations/bali" />'
    );
    expect(xml).toContain(
      '<xhtml:link rel="alternate" hreflang="en" href="https://infotour.id/en/destinations/bali" />'
    );
  });

  it("generates multiple URL entries", () => {
    const entries: SitemapEntry[] = [
      {
        url: "https://infotour.id",
        lastmod: "2024-06-15",
        changefreq: "weekly",
        priority: 1.0,
        alternates: [
          { locale: "id", url: "https://infotour.id" },
          { locale: "en", url: "https://infotour.id/en" },
        ],
      },
      {
        url: "https://infotour.id/en",
        lastmod: "2024-06-15",
        changefreq: "weekly",
        priority: 1.0,
        alternates: [
          { locale: "id", url: "https://infotour.id" },
          { locale: "en", url: "https://infotour.id/en" },
        ],
      },
      {
        url: "https://infotour.id/blog/exploring-bali",
        lastmod: "2024-05-01",
        changefreq: "monthly",
        priority: 0.6,
        alternates: [
          { locale: "id", url: "https://infotour.id/blog/exploring-bali" },
        ],
      },
    ];

    const xml = generateSitemap(entries);

    // Count <url> entries
    const urlMatches = xml.match(/<url>/g);
    expect(urlMatches).toHaveLength(3);
  });

  it("escapes special XML characters in URLs", () => {
    const entries: SitemapEntry[] = [
      {
        url: "https://infotour.id/destinations/bali&lombok",
        lastmod: "2024-06-15",
        changefreq: "weekly",
        priority: 0.8,
        alternates: [
          { locale: "id", url: "https://infotour.id/destinations/bali&lombok" },
        ],
      },
    ];

    const xml = generateSitemap(entries);

    expect(xml).toContain("&amp;");
    expect(xml).not.toContain("bali&lombok");
  });

  it("formats priority with one decimal place", () => {
    const entries: SitemapEntry[] = [
      {
        url: "https://infotour.id",
        lastmod: "2024-06-15",
        changefreq: "weekly",
        priority: 1.0,
        alternates: [],
      },
    ];

    const xml = generateSitemap(entries);

    expect(xml).toContain("<priority>1.0</priority>");
  });

  it("handles entries with no alternates", () => {
    const entries: SitemapEntry[] = [
      {
        url: "https://infotour.id/blog/solo-article",
        lastmod: "2024-06-15",
        changefreq: "monthly",
        priority: 0.6,
        alternates: [],
      },
    ];

    const xml = generateSitemap(entries);

    expect(xml).toContain("<loc>https://infotour.id/blog/solo-article</loc>");
    expect(xml).not.toContain("xhtml:link");
  });
});
