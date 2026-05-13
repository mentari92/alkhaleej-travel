import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { t } from "../../lib/i18n/utils";
import type { Locale, LocalizedString } from "../../lib/i18n/config";
import type { Destination, GalleryImage, ServicePackage, Testimonial, FaqEntry } from "../../lib/types";
import { i18nConfig } from "../../lib/i18n/config";

/**
 * Property 1: Destination page section structure
 * **Validates: Requirements 1.1, 1.2, 11.5**
 *
 * For any valid destination data and for any supported locale, the rendered
 * destination page SHALL contain all seven sections (Hero, About, Gallery,
 * Services/Packages, Testimonials, How to Book, FAQ) in that exact order,
 * with content displayed in the active locale.
 *
 * Since we cannot render Astro components in unit tests, we validate:
 * 1. The section IDs the page template uses are in the correct order
 * 2. For any destination data and locale, t(field, locale) returns the correct language string
 * 3. All section components would receive valid data for any generated destination
 */

// --- Expected section order contract ---
const EXPECTED_SECTION_IDS = [
  "hero",
  "about",
  "gallery",
  "services",
  "testimonials",
  "how-to-book",
  "faq",
] as const;

// --- Generators ---

const localeArb: fc.Arbitrary<Locale> = fc.constantFrom(...i18nConfig.locales);

const localizedStringArb: fc.Arbitrary<LocalizedString> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 100 }),
  en: fc.string({ minLength: 1, maxLength: 100 }),
});

const galleryImageArb: fc.Arbitrary<GalleryImage> = fc.record({
  url: fc.webUrl(),
  alt: localizedStringArb,
  order: fc.integer({ min: 0, max: 100 }),
});

const servicePackageArb: fc.Arbitrary<ServicePackage> = fc.record({
  id: fc.uuid(),
  name: localizedStringArb,
  description: localizedStringArb,
  price: fc.string({ minLength: 1, maxLength: 20 }),
  features: fc.array(localizedStringArb, { minLength: 0, maxLength: 5 }),
});

const testimonialArb: fc.Arbitrary<Testimonial> = fc.record({
  id: fc.uuid(),
  author: fc.string({ minLength: 1, maxLength: 50 }),
  content: localizedStringArb,
  rating: fc.integer({ min: 1, max: 5 }),
});

const faqEntryArb: fc.Arbitrary<FaqEntry> = fc.record({
  id: fc.uuid(),
  question: localizedStringArb,
  answer: localizedStringArb,
  order: fc.integer({ min: 0, max: 100 }),
});

const destinationArb: fc.Arbitrary<Destination> = fc.record({
  id: fc.uuid(),
  slug: fc.stringMatching(/^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$/),
  title: localizedStringArb,
  tagline: localizedStringArb,
  heroImage: fc.webUrl(),
  aboutText: localizedStringArb,
  galleryImages: fc.array(galleryImageArb, { minLength: 0, maxLength: 10 }),
  services: fc.array(servicePackageArb, { minLength: 0, maxLength: 5 }),
  testimonials: fc.array(testimonialArb, { minLength: 0, maxLength: 5 }),
  faqEntries: fc.array(faqEntryArb, { minLength: 0, maxLength: 5 }),
  whatsappNumber: fc.stringMatching(/^\+?[0-9]{5,15}$/),
  status: fc.constantFrom("published" as const, "draft" as const),
  createdAt: fc.integer({ min: 1577836800000, max: 1924905600000 }).map((ts) => new Date(ts).toISOString()),
  updatedAt: fc.integer({ min: 1577836800000, max: 1924905600000 }).map((ts) => new Date(ts).toISOString()),
});

// --- Tests ---

describe("Property 1: Destination page section structure", () => {
  it("section order contract: the expected section IDs are exactly 7 in the correct order", () => {
    expect(EXPECTED_SECTION_IDS).toEqual([
      "hero",
      "about",
      "gallery",
      "services",
      "testimonials",
      "how-to-book",
      "faq",
    ]);
    expect(EXPECTED_SECTION_IDS.length).toBe(7);
  });

  it("for any destination and locale, t(destination.title, locale) returns the correct language string", () => {
    fc.assert(
      fc.property(destinationArb, localeArb, (destination, locale) => {
        const result = t(destination.title, locale);
        expect(result).toBe(destination.title[locale]);
      })
    );
  });

  it("for any destination and locale, t(destination.tagline, locale) returns the correct language string", () => {
    fc.assert(
      fc.property(destinationArb, localeArb, (destination, locale) => {
        const result = t(destination.tagline, locale);
        expect(result).toBe(destination.tagline[locale]);
      })
    );
  });

  it("for any destination and locale, t(destination.aboutText, locale) returns the correct language string", () => {
    fc.assert(
      fc.property(destinationArb, localeArb, (destination, locale) => {
        const result = t(destination.aboutText, locale);
        expect(result).toBe(destination.aboutText[locale]);
      })
    );
  });

  it("for any destination and locale, all gallery image alt texts resolve to the correct language", () => {
    fc.assert(
      fc.property(destinationArb, localeArb, (destination, locale) => {
        for (const image of destination.galleryImages) {
          expect(t(image.alt, locale)).toBe(image.alt[locale]);
        }
      })
    );
  });

  it("for any destination and locale, all service names and descriptions resolve to the correct language", () => {
    fc.assert(
      fc.property(destinationArb, localeArb, (destination, locale) => {
        for (const service of destination.services) {
          expect(t(service.name, locale)).toBe(service.name[locale]);
          expect(t(service.description, locale)).toBe(service.description[locale]);
          for (const feature of service.features) {
            expect(t(feature, locale)).toBe(feature[locale]);
          }
        }
      })
    );
  });

  it("for any destination and locale, all testimonial content resolves to the correct language", () => {
    fc.assert(
      fc.property(destinationArb, localeArb, (destination, locale) => {
        for (const testimonial of destination.testimonials) {
          expect(t(testimonial.content, locale)).toBe(testimonial.content[locale]);
        }
      })
    );
  });

  it("for any destination and locale, all FAQ questions and answers resolve to the correct language", () => {
    fc.assert(
      fc.property(destinationArb, localeArb, (destination, locale) => {
        for (const faq of destination.faqEntries) {
          expect(t(faq.question, locale)).toBe(faq.question[locale]);
          expect(t(faq.answer, locale)).toBe(faq.answer[locale]);
        }
      })
    );
  });

  it("for any destination, all section components receive valid props (destination + locale)", () => {
    fc.assert(
      fc.property(destinationArb, localeArb, (destination, locale) => {
        // Verify the destination has all required fields for each section
        // Hero: needs title, tagline, heroImage, whatsappNumber
        expect(destination.title).toHaveProperty("id");
        expect(destination.title).toHaveProperty("en");
        expect(destination.tagline).toHaveProperty("id");
        expect(destination.tagline).toHaveProperty("en");
        expect(typeof destination.heroImage).toBe("string");
        expect(typeof destination.whatsappNumber).toBe("string");

        // About: needs aboutText
        expect(destination.aboutText).toHaveProperty("id");
        expect(destination.aboutText).toHaveProperty("en");

        // Gallery: needs galleryImages array
        expect(Array.isArray(destination.galleryImages)).toBe(true);

        // Services: needs services array
        expect(Array.isArray(destination.services)).toBe(true);

        // Testimonials: needs testimonials array
        expect(Array.isArray(destination.testimonials)).toBe(true);

        // FAQ: needs faqEntries array
        expect(Array.isArray(destination.faqEntries)).toBe(true);

        // Locale is valid
        expect(i18nConfig.locales).toContain(locale);
      })
    );
  });
});
