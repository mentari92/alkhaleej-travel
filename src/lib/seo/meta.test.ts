import { describe, it, expect } from "vitest";
import { generateMetaTags } from "./meta";
import type { Destination, BlogArticle } from "../types";

const mockDestination: Destination = {
  id: "dest-1",
  slug: "bali-kintamani",
  title: { id: "Bali Kintamani", en: "Bali Kintamani" },
  tagline: { id: "Keindahan alam Bali", en: "The beauty of Bali nature" },
  heroImage: "https://images.example.com/bali-hero.jpg",
  aboutText: { id: "Tentang Bali", en: "About Bali" },
  galleryImages: [],
  services: [],
  testimonials: [],
  faqEntries: [],
  whatsappNumber: "6281234567890",
  status: "published",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const mockBlogArticle: BlogArticle = {
  id: "blog-1",
  slug: "exploring-bali",
  title: "Exploring Bali: A Complete Guide",
  excerpt: "Discover the best of Bali",
  content: "<p>Full article content...</p>",
  language: "en",
  thumbnailUrl: "https://images.example.com/bali-thumb.jpg",
  metaDescription: "A comprehensive guide to exploring Bali, Indonesia",
  ogImage: "https://images.example.com/bali-og.jpg",
  relatedDestinationIds: ["dest-1"],
  pairedArticleId: "blog-2",
  status: "published",
  publishedAt: "2024-01-15T00:00:00Z",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-15T00:00:00Z",
};

describe("generateMetaTags() - Destination", () => {
  it("generates correct meta tags for ID locale", () => {
    const meta = generateMetaTags(mockDestination, "id");

    expect(meta.title).toBe("Bali Kintamani");
    expect(meta.description).toBe("Keindahan alam Bali");
    expect(meta.canonicalUrl).toBe(
      "https://infotour.id/destinations/bali-kintamani"
    );
    expect(meta.ogTitle).toBe("Bali Kintamani");
    expect(meta.ogDescription).toBe("Keindahan alam Bali");
    expect(meta.ogImage).toBe("https://images.example.com/bali-hero.jpg");
    expect(meta.ogType).toBe("website");
  });

  it("generates correct meta tags for EN locale", () => {
    const meta = generateMetaTags(mockDestination, "en");

    expect(meta.title).toBe("Bali Kintamani");
    expect(meta.description).toBe("The beauty of Bali nature");
    expect(meta.canonicalUrl).toBe(
      "https://infotour.id/en/destinations/bali-kintamani"
    );
    expect(meta.ogTitle).toBe("Bali Kintamani");
    expect(meta.ogDescription).toBe("The beauty of Bali nature");
  });

  it("includes hreflang entries for both locales", () => {
    const meta = generateMetaTags(mockDestination, "id");

    expect(meta.hreflang).toHaveLength(2);
    expect(meta.hreflang).toContainEqual({
      locale: "id",
      url: "https://infotour.id/destinations/bali-kintamani",
    });
    expect(meta.hreflang).toContainEqual({
      locale: "en",
      url: "https://infotour.id/en/destinations/bali-kintamani",
    });
  });

  it("generates hreflang entries regardless of active locale", () => {
    const metaId = generateMetaTags(mockDestination, "id");
    const metaEn = generateMetaTags(mockDestination, "en");

    // Both should have the same hreflang entries
    expect(metaId.hreflang).toEqual(metaEn.hreflang);
  });
});

describe("generateMetaTags() - BlogArticle", () => {
  it("generates correct meta tags for a blog article", () => {
    const meta = generateMetaTags(mockBlogArticle, "en");

    expect(meta.title).toBe("Exploring Bali: A Complete Guide");
    expect(meta.description).toBe(
      "A comprehensive guide to exploring Bali, Indonesia"
    );
    expect(meta.canonicalUrl).toBe(
      "https://infotour.id/en/blog/exploring-bali"
    );
    expect(meta.ogTitle).toBe("Exploring Bali: A Complete Guide");
    expect(meta.ogDescription).toBe(
      "A comprehensive guide to exploring Bali, Indonesia"
    );
    expect(meta.ogImage).toBe("https://images.example.com/bali-og.jpg");
    expect(meta.ogType).toBe("article");
  });

  it("includes hreflang for paired article", () => {
    const meta = generateMetaTags(mockBlogArticle, "en");

    expect(meta.hreflang).toHaveLength(2);
    expect(meta.hreflang).toContainEqual({
      locale: "en",
      url: "https://infotour.id/en/blog/exploring-bali",
    });
    expect(meta.hreflang).toContainEqual({
      locale: "id",
      url: "https://infotour.id/blog/exploring-bali",
    });
  });

  it("only includes self hreflang when no paired article exists", () => {
    const articleWithoutPair: BlogArticle = {
      ...mockBlogArticle,
      pairedArticleId: null,
    };
    const meta = generateMetaTags(articleWithoutPair, "en");

    expect(meta.hreflang).toHaveLength(1);
    expect(meta.hreflang[0]).toEqual({
      locale: "en",
      url: "https://infotour.id/en/blog/exploring-bali",
    });
  });

  it("generates correct canonical URL for ID locale blog", () => {
    const idArticle: BlogArticle = {
      ...mockBlogArticle,
      language: "id",
      slug: "menjelajahi-bali",
    };
    const meta = generateMetaTags(idArticle, "id");

    expect(meta.canonicalUrl).toBe(
      "https://infotour.id/blog/menjelajahi-bali"
    );
  });
});
