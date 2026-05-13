import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { generateMetaTags } from "./meta";
import type { Destination } from "../types";
import type { Locale } from "../i18n/config";
import { i18nConfig } from "../i18n/config";

/**
 * Property 11: Destination page meta tags with hreflang
 * **Validates: Requirements 8.2, 11.6**
 *
 * For any published destination and for any supported locale, the rendered
 * destination page SHALL include a meta title, meta description, Open Graph
 * tags, canonical URL, and hreflang link elements referencing the alternate
 * language version.
 */
describe("Property 11: Destination page meta tags with hreflang", () => {
  // Generator for LocalizedString
  const localizedStringArb = fc
    .tuple(
      fc.string({ minLength: 1, maxLength: 100 }),
      fc.string({ minLength: 1, maxLength: 100 })
    )
    .map(([id, en]) => ({ id, en }));

  // Generator for a valid slug (lowercase alphanumeric + hyphens)
  const slugArb = fc
    .stringMatching(/^[a-z][a-z0-9-]{0,30}[a-z0-9]$/)
    .filter((s) => !s.includes("--"));

  // Generator for a valid URL string
  const urlArb = fc
    .tuple(
      fc.constantFrom("https://", "http://"),
      fc.stringMatching(/^[a-z]{3,10}\.[a-z]{2,4}$/),
      fc.stringMatching(/^\/[a-z0-9-]{1,20}\.(jpg|png|webp)$/)
    )
    .map(([protocol, domain, path]) => `${protocol}${domain}${path}`);

  // Generator for a valid Destination object with status "published"
  const destinationArb: fc.Arbitrary<Destination> = fc
    .tuple(
      fc.uuid(),
      slugArb,
      localizedStringArb, // title
      localizedStringArb, // tagline
      urlArb, // heroImage
      localizedStringArb, // aboutText
      fc.stringMatching(/^\+?[0-9]{8,15}$/) // whatsappNumber
    )
    .map(([id, slug, title, tagline, heroImage, aboutText, whatsappNumber]) => ({
      id,
      slug,
      title,
      tagline,
      heroImage,
      aboutText,
      galleryImages: [],
      services: [],
      testimonials: [],
      faqEntries: [],
      whatsappNumber,
      status: "published" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

  // Generator for supported locales
  const localeArb: fc.Arbitrary<Locale> = fc.constantFrom(
    ...i18nConfig.locales
  );

  it("meta title is non-empty", () => {
    fc.assert(
      fc.property(destinationArb, localeArb, (destination, locale) => {
        const meta = generateMetaTags(destination, locale);
        expect(meta.title.length).toBeGreaterThan(0);
      })
    );
  });

  it("meta description is non-empty", () => {
    fc.assert(
      fc.property(destinationArb, localeArb, (destination, locale) => {
        const meta = generateMetaTags(destination, locale);
        expect(meta.description.length).toBeGreaterThan(0);
      })
    );
  });

  it("canonical URL is non-empty", () => {
    fc.assert(
      fc.property(destinationArb, localeArb, (destination, locale) => {
        const meta = generateMetaTags(destination, locale);
        expect(meta.canonicalUrl.length).toBeGreaterThan(0);
      })
    );
  });

  it("ogTitle is non-empty", () => {
    fc.assert(
      fc.property(destinationArb, localeArb, (destination, locale) => {
        const meta = generateMetaTags(destination, locale);
        expect(meta.ogTitle.length).toBeGreaterThan(0);
      })
    );
  });

  it("ogDescription is non-empty", () => {
    fc.assert(
      fc.property(destinationArb, localeArb, (destination, locale) => {
        const meta = generateMetaTags(destination, locale);
        expect(meta.ogDescription.length).toBeGreaterThan(0);
      })
    );
  });

  it("hreflang array has entries for both supported locales", () => {
    fc.assert(
      fc.property(destinationArb, localeArb, (destination, locale) => {
        const meta = generateMetaTags(destination, locale);
        const hreflangLocales = meta.hreflang.map((entry) => entry.locale);
        for (const supportedLocale of i18nConfig.locales) {
          expect(hreflangLocales).toContain(supportedLocale);
        }
      })
    );
  });

  it("hreflang URLs contain the correct language prefix", () => {
    fc.assert(
      fc.property(destinationArb, localeArb, (destination, locale) => {
        const meta = generateMetaTags(destination, locale);
        for (const entry of meta.hreflang) {
          const expectedPrefix = i18nConfig.urlPrefix[entry.locale];
          if (expectedPrefix === "") {
            // For default locale (id), URL should contain /destinations/ without /en/ prefix
            expect(entry.url).toContain(`/destinations/${destination.slug}`);
            expect(entry.url).not.toMatch(/\/en\/destinations\//);
          } else {
            // For non-default locale (en), URL should contain the prefix
            expect(entry.url).toContain(
              `${expectedPrefix}/destinations/${destination.slug}`
            );
          }
        }
      })
    );
  });

  it("canonical URL matches the current locale's prefix pattern", () => {
    fc.assert(
      fc.property(destinationArb, localeArb, (destination, locale) => {
        const meta = generateMetaTags(destination, locale);
        const expectedPrefix = i18nConfig.urlPrefix[locale];
        expect(meta.canonicalUrl).toContain(
          `${expectedPrefix}/destinations/${destination.slug}`
        );
        // For "id" locale, canonical should NOT have /en/ prefix
        if (locale === "id") {
          expect(meta.canonicalUrl).not.toMatch(/\/en\/destinations\//);
        }
        // For "en" locale, canonical should have /en/ prefix
        if (locale === "en") {
          expect(meta.canonicalUrl).toContain("/en/destinations/");
        }
      })
    );
  });
});
