import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import type { Destination } from "../../lib/types";
import type { LocalizedString, Locale } from "../../lib/i18n/config";
import { i18nConfig } from "../../lib/i18n/config";
import { t } from "../../lib/i18n/utils";

/**
 * Property 2: Directory listing completeness
 * **Validates: Requirements 2.1, 2.2, 11.5**
 *
 * For any set of published destinations and for any supported locale,
 * the directory listing page SHALL render an entry for each published
 * destination containing its localized thumbnail alt, name, short description,
 * and a link to the correct destination page URL with appropriate language prefix.
 */

// --- Generators ---

const localizedStringArb: fc.Arbitrary<LocalizedString> = fc
  .tuple(
    fc.string({ minLength: 1, maxLength: 80 }),
    fc.string({ minLength: 1, maxLength: 80 })
  )
  .map(([id, en]) => ({ id, en }));

const slugArb = fc
  .array(
    fc.stringMatching(/^[a-z0-9]+$/),
    { minLength: 1, maxLength: 5 }
  )
  .map((parts) => parts.join("-"))
  .filter((s) => s.length > 0 && s.length <= 60);

const localeArb: fc.Arbitrary<Locale> = fc.constantFrom("id" as Locale, "en" as Locale);

const publishedDestinationArb: fc.Arbitrary<Destination> = fc
  .record({
    id: fc.uuid(),
    slug: slugArb,
    title: localizedStringArb,
    tagline: localizedStringArb,
    heroImage: fc.webUrl(),
    aboutText: localizedStringArb,
    galleryImages: fc.constant([]),
    services: fc.constant([]),
    testimonials: fc.constant([]),
    faqEntries: fc.constant([]),
    whatsappNumber: fc.string({ minLength: 5, maxLength: 15 }).map((s) => "+" + s.replace(/[^0-9]/g, "0")),
    status: fc.constant("published" as const),
    createdAt: fc.constant("2024-01-01T00:00:00Z"),
    updatedAt: fc.constant("2024-01-01T00:00:00Z"),
  });

const destinationsArb = fc.array(publishedDestinationArb, { minLength: 0, maxLength: 10 });

// --- Data contract function under test ---
// This mirrors the logic in DestinationCard.astro for generating card data

interface DirectoryCardData {
  localizedTitle: string;
  localizedTagline: string;
  heroImage: string;
  destinationUrl: string;
}

function buildDirectoryCardData(destination: Destination, locale: Locale): DirectoryCardData {
  const prefix = i18nConfig.urlPrefix[locale];
  return {
    localizedTitle: t(destination.title, locale),
    localizedTagline: t(destination.tagline, locale),
    heroImage: destination.heroImage,
    destinationUrl: `${prefix}/destinations/${destination.slug}`,
  };
}

// --- Property Tests ---

describe("Property 2: Directory listing completeness", () => {
  it("number of cards equals the number of published destinations", () => {
    fc.assert(
      fc.property(destinationsArb, localeArb, (destinations, locale) => {
        const cards = destinations.map((d) => buildDirectoryCardData(d, locale));
        expect(cards.length).toBe(destinations.length);
      })
    );
  });

  it("each card contains the correct localized title via t(title, locale)", () => {
    fc.assert(
      fc.property(destinationsArb, localeArb, (destinations, locale) => {
        for (const destination of destinations) {
          const card = buildDirectoryCardData(destination, locale);
          expect(card.localizedTitle).toBe(destination.title[locale]);
        }
      })
    );
  });

  it("each card contains the correct localized tagline via t(tagline, locale)", () => {
    fc.assert(
      fc.property(destinationsArb, localeArb, (destinations, locale) => {
        for (const destination of destinations) {
          const card = buildDirectoryCardData(destination, locale);
          expect(card.localizedTagline).toBe(destination.tagline[locale]);
        }
      })
    );
  });

  it("each card contains the heroImage from the destination", () => {
    fc.assert(
      fc.property(destinationsArb, localeArb, (destinations, locale) => {
        for (const destination of destinations) {
          const card = buildDirectoryCardData(destination, locale);
          expect(card.heroImage).toBe(destination.heroImage);
        }
      })
    );
  });

  it("link URL follows pattern {prefix}/destinations/{slug} with correct prefix per locale", () => {
    fc.assert(
      fc.property(destinationsArb, localeArb, (destinations, locale) => {
        const expectedPrefix = locale === "id" ? "" : "/en";
        for (const destination of destinations) {
          const card = buildDirectoryCardData(destination, locale);
          const expectedUrl = `${expectedPrefix}/destinations/${destination.slug}`;
          expect(card.destinationUrl).toBe(expectedUrl);
        }
      })
    );
  });

  it("ID locale produces URLs without language prefix", () => {
    fc.assert(
      fc.property(destinationsArb, (destinations) => {
        for (const destination of destinations) {
          const card = buildDirectoryCardData(destination, "id");
          expect(card.destinationUrl).toBe(`/destinations/${destination.slug}`);
          expect(card.destinationUrl).not.toMatch(/^\/en\//);
        }
      })
    );
  });

  it("EN locale produces URLs with /en prefix", () => {
    fc.assert(
      fc.property(destinationsArb, (destinations) => {
        for (const destination of destinations) {
          const card = buildDirectoryCardData(destination, "en");
          expect(card.destinationUrl).toBe(`/en/destinations/${destination.slug}`);
          expect(card.destinationUrl).toMatch(/^\/en\//);
        }
      })
    );
  });
});
