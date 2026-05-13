import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { createDestination } from "./destinations";
import type { CreateDestinationInput } from "./destinations";
import type {
  DestinationRow,
  GalleryImageRow,
  ServicePackageRow,
  TestimonialRow,
  FaqEntryRow,
} from "./schema";

/**
 * Property 5: Destination creation round-trip (bilingual)
 * **Validates: Requirements 5.2**
 *
 * For any valid bilingual destination data submitted through the creation endpoint,
 * reading back the destination by its ID SHALL return data equivalent to what was
 * submitted in both languages.
 */

// --- Arbitraries ---

/** Generates a non-empty string suitable for bilingual text fields */
const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0);

/** Generates a LocalizedString with both id and en fields */
const localizedStringArb = fc.record({
  id: nonEmptyStringArb,
  en: nonEmptyStringArb,
});

/** Generates a valid URL string */
const urlArb = fc.webUrl();

/** Generates a valid WhatsApp number (digits, 10-15 chars) */
const whatsappNumberArb = fc.stringMatching(/^62[0-9]{9,13}$/);

/** Generates a gallery image with bilingual alt text */
const galleryImageArb = fc.record({
  url: urlArb,
  alt: localizedStringArb,
  order: fc.nat({ max: 100 }),
});

/** Generates a bilingual feature (LocalizedString) */
const featureArb = localizedStringArb;

/** Generates a service package with bilingual fields */
const servicePackageArb = fc.record({
  id: fc.uuid(),
  name: localizedStringArb,
  description: localizedStringArb,
  price: fc.stringMatching(/^[0-9]{1,10}$/),
  features: fc.array(featureArb, { minLength: 0, maxLength: 3 }),
});

/** Generates a testimonial with bilingual content */
const testimonialArb = fc.record({
  id: fc.uuid(),
  author: nonEmptyStringArb,
  content: localizedStringArb,
  rating: fc.integer({ min: 1, max: 5 }),
});

/** Generates a FAQ entry with bilingual question and answer */
const faqEntryArb = fc.record({
  id: fc.uuid(),
  question: localizedStringArb,
  answer: localizedStringArb,
  order: fc.nat({ max: 100 }),
});

/** Generates a complete CreateDestinationInput with bilingual fields */
const createDestinationInputArb: fc.Arbitrary<CreateDestinationInput> = fc.record({
  title: localizedStringArb,
  tagline: localizedStringArb,
  heroImage: urlArb,
  aboutText: localizedStringArb,
  galleryImages: fc.array(galleryImageArb, { minLength: 0, maxLength: 2 }),
  services: fc.array(servicePackageArb, { minLength: 0, maxLength: 2 }),
  testimonials: fc.array(testimonialArb, { minLength: 0, maxLength: 2 }),
  faqEntries: fc.array(faqEntryArb, { minLength: 0, maxLength: 2 }),
  whatsappNumber: whatsappNumberArb,
  status: fc.constantFrom("published" as const, "draft" as const),
});

// --- Mock D1 that captures writes and returns them on reads ---

/**
 * Creates a mock D1Database that intercepts all prepare/bind calls to capture
 * INSERT data, then returns the captured data when getDestinationById is called
 * after creation. This simulates the full round-trip behavior.
 */
function createInterceptingMockDb() {
  let destinationRow: DestinationRow | null = null;
  const galleryRows: GalleryImageRow[] = [];
  const serviceRows: ServicePackageRow[] = [];
  const testimonialRows: TestimonialRow[] = [];
  const faqRows: FaqEntryRow[] = [];
  let batchCallCount = 0;

  // Each prepare().bind() call returns a "statement" object that gets collected
  // into the batch array. We capture the data at bind time.
  const db = {
    prepare: (sql: string) => {
      return {
        bind: (...args: unknown[]) => {
          // Capture INSERT data from bind arguments
          if (sql.includes("INSERT INTO destinations")) {
            destinationRow = {
              id: args[0] as string,
              slug: args[1] as string,
              title_id: args[2] as string,
              title_en: args[3] as string,
              tagline_id: args[4] as string,
              tagline_en: args[5] as string,
              hero_image: args[6] as string,
              about_text_id: args[7] as string,
              about_text_en: args[8] as string,
              whatsapp_number: args[9] as string,
              status: args[10] as "published" | "draft",
              created_at: args[11] as string,
              updated_at: args[12] as string,
            };
          } else if (sql.includes("INSERT INTO gallery_images")) {
            galleryRows.push({
              id: args[0] as string,
              destination_id: args[1] as string,
              url: args[2] as string,
              alt_id: args[3] as string,
              alt_en: args[4] as string,
              sort_order: args[5] as number,
            });
          } else if (sql.includes("INSERT INTO service_packages")) {
            serviceRows.push({
              id: args[0] as string,
              destination_id: args[1] as string,
              name_id: args[2] as string,
              name_en: args[3] as string,
              description_id: args[4] as string,
              description_en: args[5] as string,
              price: args[6] as string,
              features_id: args[7] as string,
              features_en: args[8] as string,
            });
          } else if (sql.includes("INSERT INTO testimonials")) {
            testimonialRows.push({
              id: args[0] as string,
              destination_id: args[1] as string,
              author: args[2] as string,
              content_id: args[3] as string,
              content_en: args[4] as string,
              rating: args[5] as number,
            });
          } else if (sql.includes("INSERT INTO faq_entries")) {
            faqRows.push({
              id: args[0] as string,
              destination_id: args[1] as string,
              question_id: args[2] as string,
              question_en: args[3] as string,
              answer_id: args[4] as string,
              answer_en: args[5] as string,
              sort_order: args[6] as number,
            });
          }

          // Return a prepared statement mock (used as batch item or for direct queries)
          const stmt = {
            first: async <T>(): Promise<T | null> => {
              if (sql.includes("SELECT * FROM destinations WHERE id")) {
                return destinationRow as T | null;
              }
              return null;
            },
            run: async () => ({ meta: { changes: 1 } }),
            all: async () => ({ results: [] }),
          };
          return stmt;
        },
        // For queries without bind (shouldn't happen in our case but just in case)
        first: async <T>(): Promise<T | null> => null,
        run: async () => ({ meta: { changes: 0 } }),
        all: async () => ({ results: [] }),
      };
    },
    batch: async (_statements: unknown[]) => {
      batchCallCount++;

      if (batchCallCount === 1) {
        // First batch: the INSERT statements from createDestination
        // Data was already captured via bind() calls above
        return [];
      }

      // Second batch: loadRelatedRecords for getDestinationById
      return [
        { results: galleryRows },
        { results: serviceRows },
        { results: testimonialRows },
        { results: faqRows },
      ];
    },
  } as unknown as D1Database;

  return { db };
}

describe("Property 5: Destination creation round-trip (bilingual)", () => {
  it("bilingual title fields are preserved through create → read round-trip", async () => {
    await fc.assert(
      fc.asyncProperty(createDestinationInputArb, async (input) => {
        const { db } = createInterceptingMockDb();
        const result = await createDestination(db, input);

        expect(result.title.id).toBe(input.title.id);
        expect(result.title.en).toBe(input.title.en);
      })
    );
  });

  it("bilingual tagline fields are preserved through create → read round-trip", async () => {
    await fc.assert(
      fc.asyncProperty(createDestinationInputArb, async (input) => {
        const { db } = createInterceptingMockDb();
        const result = await createDestination(db, input);

        expect(result.tagline.id).toBe(input.tagline.id);
        expect(result.tagline.en).toBe(input.tagline.en);
      })
    );
  });

  it("bilingual aboutText fields are preserved through create → read round-trip", async () => {
    await fc.assert(
      fc.asyncProperty(createDestinationInputArb, async (input) => {
        const { db } = createInterceptingMockDb();
        const result = await createDestination(db, input);

        expect(result.aboutText.id).toBe(input.aboutText.id);
        expect(result.aboutText.en).toBe(input.aboutText.en);
      })
    );
  });

  it("gallery images preserve bilingual alt text through round-trip", async () => {
    await fc.assert(
      fc.asyncProperty(createDestinationInputArb, async (input) => {
        const { db } = createInterceptingMockDb();
        const result = await createDestination(db, input);

        expect(result.galleryImages).toHaveLength(input.galleryImages.length);
        for (let i = 0; i < input.galleryImages.length; i++) {
          expect(result.galleryImages[i].alt.id).toBe(input.galleryImages[i].alt.id);
          expect(result.galleryImages[i].alt.en).toBe(input.galleryImages[i].alt.en);
          expect(result.galleryImages[i].url).toBe(input.galleryImages[i].url);
          expect(result.galleryImages[i].order).toBe(input.galleryImages[i].order);
        }
      })
    );
  });

  it("services preserve bilingual name, description, and features through round-trip", async () => {
    await fc.assert(
      fc.asyncProperty(createDestinationInputArb, async (input) => {
        const { db } = createInterceptingMockDb();
        const result = await createDestination(db, input);

        expect(result.services).toHaveLength(input.services.length);
        for (let i = 0; i < input.services.length; i++) {
          expect(result.services[i].name.id).toBe(input.services[i].name.id);
          expect(result.services[i].name.en).toBe(input.services[i].name.en);
          expect(result.services[i].description.id).toBe(input.services[i].description.id);
          expect(result.services[i].description.en).toBe(input.services[i].description.en);
          expect(result.services[i].price).toBe(input.services[i].price);

          // Features are stored as JSON arrays and mapped back
          expect(result.services[i].features).toHaveLength(input.services[i].features.length);
          for (let j = 0; j < input.services[i].features.length; j++) {
            expect(result.services[i].features[j].id).toBe(input.services[i].features[j].id);
            expect(result.services[i].features[j].en).toBe(input.services[i].features[j].en);
          }
        }
      })
    );
  });

  it("testimonials preserve bilingual content through round-trip", async () => {
    await fc.assert(
      fc.asyncProperty(createDestinationInputArb, async (input) => {
        const { db } = createInterceptingMockDb();
        const result = await createDestination(db, input);

        expect(result.testimonials).toHaveLength(input.testimonials.length);
        for (let i = 0; i < input.testimonials.length; i++) {
          expect(result.testimonials[i].content.id).toBe(input.testimonials[i].content.id);
          expect(result.testimonials[i].content.en).toBe(input.testimonials[i].content.en);
          expect(result.testimonials[i].author).toBe(input.testimonials[i].author);
          expect(result.testimonials[i].rating).toBe(input.testimonials[i].rating);
        }
      })
    );
  });

  it("FAQ entries preserve bilingual question and answer through round-trip", async () => {
    await fc.assert(
      fc.asyncProperty(createDestinationInputArb, async (input) => {
        const { db } = createInterceptingMockDb();
        const result = await createDestination(db, input);

        expect(result.faqEntries).toHaveLength(input.faqEntries.length);
        for (let i = 0; i < input.faqEntries.length; i++) {
          expect(result.faqEntries[i].question.id).toBe(input.faqEntries[i].question.id);
          expect(result.faqEntries[i].question.en).toBe(input.faqEntries[i].question.en);
          expect(result.faqEntries[i].answer.id).toBe(input.faqEntries[i].answer.id);
          expect(result.faqEntries[i].answer.en).toBe(input.faqEntries[i].answer.en);
          expect(result.faqEntries[i].order).toBe(input.faqEntries[i].order);
        }
      })
    );
  });

  it("non-bilingual fields (heroImage, whatsappNumber, status) are preserved", async () => {
    await fc.assert(
      fc.asyncProperty(createDestinationInputArb, async (input) => {
        const { db } = createInterceptingMockDb();
        const result = await createDestination(db, input);

        expect(result.heroImage).toBe(input.heroImage);
        expect(result.whatsappNumber).toBe(input.whatsappNumber);
        expect(result.status).toBe(input.status);
      })
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2 & 3: updateDestination — child collection preservation & idempotence
// ---------------------------------------------------------------------------

import { updateDestination } from "./destinations";
import type { UpdateDestinationInput } from "./destinations";

/**
 * Property 2: Destination update preserves untouched child collections
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.7**
 *
 * For any destination D with N children of type X, calling
 * `updateDestination(db, D.id, input)` where `input.X === undefined` must
 * result in the same N children remaining in the database after the call.
 *
 * Property 3: Destination update idempotence
 * **Validates: Requirements 2.8**
 *
 * For any destination D, calling `updateDestination(db, D.id, {})` twice in
 * succession must produce a database state identical to before either call
 * (except for `updated_at`).
 */

// ---------------------------------------------------------------------------
// In-memory D1 mock for updateDestination
// ---------------------------------------------------------------------------

/**
 * Represents the in-memory state of a destination and its child collections.
 */
interface DestinationState {
  row: DestinationRow;
  galleryImages: GalleryImageRow[];
  services: ServicePackageRow[];
  testimonials: TestimonialRow[];
  faqEntries: FaqEntryRow[];
}

/**
 * Creates a fully in-memory mock D1Database that simulates the SQL operations
 * used by `updateDestination` and `getDestinationById`:
 *
 * Reads:
 *   - SELECT * FROM destinations WHERE id = ?  (via .first())
 *   - batch([SELECT gallery_images, service_packages, testimonials, faq_entries])
 *
 * Writes (via batch):
 *   - UPDATE destinations SET ... WHERE id = ?
 *   - DELETE FROM gallery_images WHERE destination_id = ?
 *   - INSERT INTO gallery_images ...
 *   - DELETE FROM service_packages WHERE destination_id = ?
 *   - INSERT INTO service_packages ...
 *   - DELETE FROM testimonials WHERE destination_id = ?
 *   - INSERT INTO testimonials ...
 *   - DELETE FROM faq_entries WHERE destination_id = ?
 *   - INSERT INTO faq_entries ...
 */
function createUpdateMockDb(initialState: DestinationState): D1Database {
  // Mutable in-memory store
  const state: DestinationState = {
    row: { ...initialState.row },
    galleryImages: [...initialState.galleryImages],
    services: [...initialState.services],
    testimonials: [...initialState.testimonials],
    faqEntries: [...initialState.faqEntries],
  };

  /**
   * Processes a single prepared statement (SQL + bound args) against the
   * in-memory store. Returns a statement-like object.
   */
  function buildStatement(sql: string, boundArgs: unknown[] = []) {
    const stmt = {
      bind(...args: unknown[]) {
        return buildStatement(sql, args);
      },

      async first<T>(): Promise<T | null> {
        if (sql.includes("SELECT * FROM destinations WHERE id")) {
          const id = boundArgs[0] as string;
          if (state.row.id === id) {
            return { ...state.row } as T;
          }
          return null;
        }
        return null;
      },

      async run() {
        const sqlUpper = sql.toUpperCase();

        if (sqlUpper.includes("UPDATE DESTINATIONS SET")) {
          // Parse SET clause: args are [...values, id]
          // We need to update the stored row with the new values.
          // The UPDATE statement in destinations.ts builds a dynamic SET clause.
          // We detect which fields are being updated by inspecting the SQL.
          const id = boundArgs[boundArgs.length - 1] as string;
          if (state.row.id !== id) return { meta: { changes: 0 } };

          // Map SQL column names to bound arg positions
          // The SQL looks like: UPDATE destinations SET col1 = ?, col2 = ?, ..., updated_at = ? WHERE id = ?
          const setClause = sql.match(/SET\s+([\s\S]+?)\s+WHERE/i)?.[1] ?? "";
          const assignments = setClause.split(",").map((s) => s.trim());
          const newRow = { ...state.row };

          for (let i = 0; i < assignments.length; i++) {
            const colMatch = assignments[i].match(/^(\w+)\s*=/);
            if (!colMatch) continue;
            const col = colMatch[1].toLowerCase();
            const val = boundArgs[i];

            switch (col) {
              case "title_id": newRow.title_id = val as string; break;
              case "title_en": newRow.title_en = val as string; break;
              case "tagline_id": newRow.tagline_id = val as string; break;
              case "tagline_en": newRow.tagline_en = val as string; break;
              case "hero_image": newRow.hero_image = val as string; break;
              case "about_text_id": newRow.about_text_id = val as string; break;
              case "about_text_en": newRow.about_text_en = val as string; break;
              case "whatsapp_number": newRow.whatsapp_number = val as string; break;
              case "status": newRow.status = val as "published" | "draft"; break;
              case "updated_at": newRow.updated_at = val as string; break;
            }
          }
          state.row = newRow;
          return { meta: { changes: 1 } };
        }

        if (sqlUpper.includes("DELETE FROM GALLERY_IMAGES")) {
          state.galleryImages = [];
          return { meta: { changes: 1 } };
        }
        if (sqlUpper.includes("INSERT INTO GALLERY_IMAGES")) {
          state.galleryImages.push({
            id: boundArgs[0] as string,
            destination_id: boundArgs[1] as string,
            url: boundArgs[2] as string,
            alt_id: boundArgs[3] as string,
            alt_en: boundArgs[4] as string,
            sort_order: boundArgs[5] as number,
          });
          return { meta: { changes: 1 } };
        }

        if (sqlUpper.includes("DELETE FROM SERVICE_PACKAGES")) {
          state.services = [];
          return { meta: { changes: 1 } };
        }
        if (sqlUpper.includes("INSERT INTO SERVICE_PACKAGES")) {
          state.services.push({
            id: boundArgs[0] as string,
            destination_id: boundArgs[1] as string,
            name_id: boundArgs[2] as string,
            name_en: boundArgs[3] as string,
            description_id: boundArgs[4] as string,
            description_en: boundArgs[5] as string,
            price: boundArgs[6] as string,
            features_id: boundArgs[7] as string,
            features_en: boundArgs[8] as string,
          });
          return { meta: { changes: 1 } };
        }

        if (sqlUpper.includes("DELETE FROM TESTIMONIALS")) {
          state.testimonials = [];
          return { meta: { changes: 1 } };
        }
        if (sqlUpper.includes("INSERT INTO TESTIMONIALS")) {
          state.testimonials.push({
            id: boundArgs[0] as string,
            destination_id: boundArgs[1] as string,
            author: boundArgs[2] as string,
            content_id: boundArgs[3] as string,
            content_en: boundArgs[4] as string,
            rating: boundArgs[5] as number,
          });
          return { meta: { changes: 1 } };
        }

        if (sqlUpper.includes("DELETE FROM FAQ_ENTRIES")) {
          state.faqEntries = [];
          return { meta: { changes: 1 } };
        }
        if (sqlUpper.includes("INSERT INTO FAQ_ENTRIES")) {
          state.faqEntries.push({
            id: boundArgs[0] as string,
            destination_id: boundArgs[1] as string,
            question_id: boundArgs[2] as string,
            question_en: boundArgs[3] as string,
            answer_id: boundArgs[4] as string,
            answer_en: boundArgs[5] as string,
            sort_order: boundArgs[6] as number,
          });
          return { meta: { changes: 1 } };
        }

        return { meta: { changes: 0 } };
      },

      async all() {
        return { results: [] };
      },
    };
    return stmt;
  }

  const db = {
    prepare(sql: string) {
      return buildStatement(sql);
    },

    async batch(statements: ReturnType<typeof buildStatement>[]) {
      // Detect whether this is a read batch (loadRelatedRecords) or a write batch
      // loadRelatedRecords always sends exactly 4 SELECT statements
      // updateDestination sends a mix of UPDATE/DELETE/INSERT statements

      // Check if all statements are SELECT queries (read batch)
      // We do this by running each statement and collecting results
      const results = [];
      for (const stmt of statements) {
        // Each statement in the batch is already bound (has boundArgs captured)
        // We need to determine if it's a SELECT or a write
        // Since we can't inspect the SQL directly from the statement object,
        // we call run() for writes and all() for reads.
        // The trick: loadRelatedRecords uses .all() results, writes use .run()
        // We'll try to detect by calling all() — if it returns results it's a read
        const result = await (stmt as { all(): Promise<{ results: unknown[] }> }).all();
        results.push(result);
      }

      // For loadRelatedRecords, we need to return the actual child data
      // We detect this by checking if the batch has exactly 4 statements
      // (gallery_images, service_packages, testimonials, faq_entries)
      if (statements.length === 4) {
        // This is a loadRelatedRecords batch — return current state
        return [
          { results: [...state.galleryImages] },
          { results: [...state.services] },
          { results: [...state.testimonials] },
          { results: [...state.faqEntries] },
        ];
      }

      // For write batches, execute each statement
      for (const stmt of statements) {
        await (stmt as { run(): Promise<unknown> }).run();
      }

      return results;
    },

    // Expose state for assertions
    _state: state,
  } as unknown as D1Database & { _state: DestinationState };

  return db;
}

// ---------------------------------------------------------------------------
// Arbitraries for updateDestination tests
// ---------------------------------------------------------------------------

/** Generates a non-empty string suitable for text fields */
const updateNonEmptyStr = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => s.trim().length > 0);

/** Generates a LocalizedString */
const updateLocalizedStr = fc.record({
  id: updateNonEmptyStr,
  en: updateNonEmptyStr,
});

/** Generates a gallery image row */
const galleryImageRowArb: fc.Arbitrary<GalleryImageRow> = fc.record({
  id: fc.uuid(),
  destination_id: fc.constant("dest-1"),
  url: fc.webUrl(),
  alt_id: updateNonEmptyStr,
  alt_en: updateNonEmptyStr,
  sort_order: fc.nat({ max: 100 }),
});

/** Generates a service package row */
const servicePackageRowArb: fc.Arbitrary<ServicePackageRow> = fc.record({
  id: fc.uuid(),
  destination_id: fc.constant("dest-1"),
  name_id: updateNonEmptyStr,
  name_en: updateNonEmptyStr,
  description_id: updateNonEmptyStr,
  description_en: updateNonEmptyStr,
  price: fc.stringMatching(/^[0-9]{1,8}$/),
  features_id: fc.constant("[]"),
  features_en: fc.constant("[]"),
});

/** Generates a testimonial row */
const testimonialRowArb: fc.Arbitrary<TestimonialRow> = fc.record({
  id: fc.uuid(),
  destination_id: fc.constant("dest-1"),
  author: updateNonEmptyStr,
  content_id: updateNonEmptyStr,
  content_en: updateNonEmptyStr,
  rating: fc.integer({ min: 1, max: 5 }),
});

/** Generates a FAQ entry row */
const faqEntryRowArb: fc.Arbitrary<FaqEntryRow> = fc.record({
  id: fc.uuid(),
  destination_id: fc.constant("dest-1"),
  question_id: updateNonEmptyStr,
  question_en: updateNonEmptyStr,
  answer_id: updateNonEmptyStr,
  answer_en: updateNonEmptyStr,
  sort_order: fc.nat({ max: 100 }),
});

/** Generates a base DestinationRow */
const destinationRowArb: fc.Arbitrary<DestinationRow> = fc.record({
  id: fc.constant("dest-1"),
  slug: fc.constant("test-destination"),
  title_id: updateNonEmptyStr,
  title_en: updateNonEmptyStr,
  tagline_id: updateNonEmptyStr,
  tagline_en: updateNonEmptyStr,
  hero_image: fc.webUrl(),
  about_text_id: updateNonEmptyStr,
  about_text_en: updateNonEmptyStr,
  whatsapp_number: fc.stringMatching(/^62[0-9]{9,13}$/),
  status: fc.constantFrom("published" as const, "draft" as const),
  created_at: fc.constant("2024-01-01 00:00:00"),
  updated_at: fc.constant("2024-01-01 00:00:00"),
});

/** Generates a full DestinationState with arbitrary child collections */
const destinationStateArb: fc.Arbitrary<DestinationState> = fc
  .record({
    row: destinationRowArb,
    galleryImages: fc.array(galleryImageRowArb, { minLength: 0, maxLength: 3 }),
    services: fc.array(servicePackageRowArb, { minLength: 0, maxLength: 3 }),
    testimonials: fc.array(testimonialRowArb, { minLength: 0, maxLength: 3 }),
    faqEntries: fc.array(faqEntryRowArb, { minLength: 0, maxLength: 3 }),
  });

/**
 * Generates an UpdateDestinationInput that omits all child collection keys
 * (galleryImages, services, testimonials, faqEntries are all undefined).
 * Only scalar/bilingual fields may be present.
 */
const scalarOnlyUpdateArb: fc.Arbitrary<UpdateDestinationInput> = fc.record(
  {
    title: fc.option(updateLocalizedStr, { nil: undefined }),
    tagline: fc.option(updateLocalizedStr, { nil: undefined }),
    heroImage: fc.option(fc.webUrl(), { nil: undefined }),
    aboutText: fc.option(updateLocalizedStr, { nil: undefined }),
    whatsappNumber: fc.option(
      fc.stringMatching(/^62[0-9]{9,13}$/),
      { nil: undefined }
    ),
    status: fc.option(
      fc.constantFrom("published" as const, "draft" as const),
      { nil: undefined }
    ),
  },
  { requiredKeys: [] }
);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Property 2: Destination update preserves untouched child collections", () => {
  it("gallery images count is unchanged when input.galleryImages is undefined", async () => {
    await fc.assert(
      fc.asyncProperty(
        destinationStateArb,
        scalarOnlyUpdateArb,
        async (initialState, input) => {
          // Ensure galleryImages is not in the input
          const safeInput: UpdateDestinationInput = { ...input };
          delete (safeInput as Record<string, unknown>).galleryImages;

          const db = createUpdateMockDb(initialState) as D1Database & {
            _state: DestinationState;
          };
          const countBefore = initialState.galleryImages.length;

          await updateDestination(db, "dest-1", safeInput);

          const countAfter = (db as unknown as { _state: DestinationState })._state.galleryImages.length;
          expect(countAfter).toBe(countBefore);
        }
      )
    );
  });

  it("service packages count is unchanged when input.services is undefined", async () => {
    await fc.assert(
      fc.asyncProperty(
        destinationStateArb,
        scalarOnlyUpdateArb,
        async (initialState, input) => {
          const safeInput: UpdateDestinationInput = { ...input };
          delete (safeInput as Record<string, unknown>).services;

          const db = createUpdateMockDb(initialState) as D1Database & {
            _state: DestinationState;
          };
          const countBefore = initialState.services.length;

          await updateDestination(db, "dest-1", safeInput);

          const countAfter = (db as unknown as { _state: DestinationState })._state.services.length;
          expect(countAfter).toBe(countBefore);
        }
      )
    );
  });

  it("testimonials count is unchanged when input.testimonials is undefined", async () => {
    await fc.assert(
      fc.asyncProperty(
        destinationStateArb,
        scalarOnlyUpdateArb,
        async (initialState, input) => {
          const safeInput: UpdateDestinationInput = { ...input };
          delete (safeInput as Record<string, unknown>).testimonials;

          const db = createUpdateMockDb(initialState) as D1Database & {
            _state: DestinationState;
          };
          const countBefore = initialState.testimonials.length;

          await updateDestination(db, "dest-1", safeInput);

          const countAfter = (db as unknown as { _state: DestinationState })._state.testimonials.length;
          expect(countAfter).toBe(countBefore);
        }
      )
    );
  });

  it("FAQ entries count is unchanged when input.faqEntries is undefined", async () => {
    await fc.assert(
      fc.asyncProperty(
        destinationStateArb,
        scalarOnlyUpdateArb,
        async (initialState, input) => {
          const safeInput: UpdateDestinationInput = { ...input };
          delete (safeInput as Record<string, unknown>).faqEntries;

          const db = createUpdateMockDb(initialState) as D1Database & {
            _state: DestinationState;
          };
          const countBefore = initialState.faqEntries.length;

          await updateDestination(db, "dest-1", safeInput);

          const countAfter = (db as unknown as { _state: DestinationState })._state.faqEntries.length;
          expect(countAfter).toBe(countBefore);
        }
      )
    );
  });

  it("all child collection counts are unchanged when none are included in input", async () => {
    await fc.assert(
      fc.asyncProperty(destinationStateArb, async (initialState) => {
        const db = createUpdateMockDb(initialState) as D1Database & {
          _state: DestinationState;
        };

        // Empty update — no child collections
        await updateDestination(db, "dest-1", {});

        const s = (db as unknown as { _state: DestinationState })._state;
        expect(s.galleryImages.length).toBe(initialState.galleryImages.length);
        expect(s.services.length).toBe(initialState.services.length);
        expect(s.testimonials.length).toBe(initialState.testimonials.length);
        expect(s.faqEntries.length).toBe(initialState.faqEntries.length);
      })
    );
  });
});

describe("Property 3: Destination update idempotence", () => {
  it("calling updateDestination({}) twice leaves child collection counts identical to before", async () => {
    await fc.assert(
      fc.asyncProperty(destinationStateArb, async (initialState) => {
        const db = createUpdateMockDb(initialState) as D1Database & {
          _state: DestinationState;
        };

        const countsBefore = {
          gallery: initialState.galleryImages.length,
          services: initialState.services.length,
          testimonials: initialState.testimonials.length,
          faqEntries: initialState.faqEntries.length,
        };

        // First call
        await updateDestination(db, "dest-1", {});
        // Second call
        await updateDestination(db, "dest-1", {});

        const s = (db as unknown as { _state: DestinationState })._state;
        expect(s.galleryImages.length).toBe(countsBefore.gallery);
        expect(s.services.length).toBe(countsBefore.services);
        expect(s.testimonials.length).toBe(countsBefore.testimonials);
        expect(s.faqEntries.length).toBe(countsBefore.faqEntries);
      })
    );
  });

  it("calling updateDestination({}) twice leaves scalar destination fields identical to before", async () => {
    await fc.assert(
      fc.asyncProperty(destinationStateArb, async (initialState) => {
        const db = createUpdateMockDb(initialState) as D1Database & {
          _state: DestinationState;
        };

        const rowBefore = { ...initialState.row };

        // First call
        await updateDestination(db, "dest-1", {});
        // Second call
        await updateDestination(db, "dest-1", {});

        const s = (db as unknown as { _state: DestinationState })._state;
        // All fields except updated_at must be identical
        expect(s.row.title_id).toBe(rowBefore.title_id);
        expect(s.row.title_en).toBe(rowBefore.title_en);
        expect(s.row.tagline_id).toBe(rowBefore.tagline_id);
        expect(s.row.tagline_en).toBe(rowBefore.tagline_en);
        expect(s.row.hero_image).toBe(rowBefore.hero_image);
        expect(s.row.about_text_id).toBe(rowBefore.about_text_id);
        expect(s.row.about_text_en).toBe(rowBefore.about_text_en);
        expect(s.row.whatsapp_number).toBe(rowBefore.whatsapp_number);
        expect(s.row.status).toBe(rowBefore.status);
      })
    );
  });

  it("second updateDestination({}) result equals first result (except updated_at)", async () => {
    await fc.assert(
      fc.asyncProperty(destinationStateArb, async (initialState) => {
        const db = createUpdateMockDb(initialState);

        const firstResult = await updateDestination(db, "dest-1", {});
        const secondResult = await updateDestination(db, "dest-1", {});

        // All fields except updatedAt must be identical
        expect(secondResult.title).toStrictEqual(firstResult.title);
        expect(secondResult.tagline).toStrictEqual(firstResult.tagline);
        expect(secondResult.heroImage).toBe(firstResult.heroImage);
        expect(secondResult.aboutText).toStrictEqual(firstResult.aboutText);
        expect(secondResult.whatsappNumber).toBe(firstResult.whatsappNumber);
        expect(secondResult.status).toBe(firstResult.status);
        expect(secondResult.galleryImages.length).toBe(firstResult.galleryImages.length);
        expect(secondResult.services.length).toBe(firstResult.services.length);
        expect(secondResult.testimonials.length).toBe(firstResult.testimonials.length);
        expect(secondResult.faqEntries.length).toBe(firstResult.faqEntries.length);
      })
    );
  });
});

// ---------------------------------------------------------------------------
// Property 14: Destinations count reflects live data
// ---------------------------------------------------------------------------

import { deleteDestination, getDestinationsCount } from "./destinations";

/**
 * Property 14: Destinations count reflects live data
 * **Validates: Requirements 14.6**
 *
 * After `createDestination` with `status = 'published'`, `getDestinationsCount(db)`
 * increments by 1. After `deleteDestination`, it decrements by 1.
 */

/**
 * Creates an in-memory mock D1Database that tracks destination rows and supports:
 *   - createDestination (INSERT INTO destinations via batch, then SELECT by id)
 *   - deleteDestination (DELETE FROM destinations WHERE id = ?)
 *   - getDestinationsCount (SELECT COUNT(*) FROM destinations WHERE status = 'published')
 *
 * Key design: `prepare(sql)` returns a statement object whose `bind(...args)` captures
 * the bound arguments in a closure. Both the unbound `first()` (used by getDestinationsCount)
 * and the bound `first()` (used by getDestinationById) are handled correctly.
 */
function createCountMockDb(initialPublishedCount: number = 0) {
  // In-memory store: id -> status
  const destinations = new Map<string, "published" | "draft">();

  // Pre-populate with the requested number of published destinations
  for (let i = 0; i < initialPublishedCount; i++) {
    destinations.set(`pre-existing-${i}`, "published");
  }

  // Pending INSERT captured during bind() — committed when batch() is called
  let pendingInsert: { id: string; status: "published" | "draft" } | null = null;

  function buildStatement(sql: string, boundArgs: unknown[] = []) {
    const sqlUpper = sql.toUpperCase();

    const stmt = {
      bind(...args: unknown[]) {
        // Capture INSERT INTO destinations data at bind time
        if (sqlUpper.includes("INSERT INTO DESTINATIONS")) {
          // Bind order: id(0), slug(1), title_id(2), title_en(3), tagline_id(4),
          //   tagline_en(5), hero_image(6), about_text_id(7), about_text_en(8),
          //   whatsapp_number(9), status(10), created_at(11), updated_at(12)
          pendingInsert = {
            id: args[0] as string,
            status: args[10] as "published" | "draft",
          };
        }
        return buildStatement(sql, args);
      },

      async first<T>(): Promise<T | null> {
        // getDestinationsCount: SELECT COUNT(*) ... WHERE status = 'published' (no bind)
        if (sqlUpper.includes("SELECT COUNT(*)") && sqlUpper.includes("STATUS = 'PUBLISHED'")) {
          let count = 0;
          for (const s of destinations.values()) {
            if (s === "published") count++;
          }
          return { count } as T;
        }
        // getDestinationById: SELECT * FROM destinations WHERE id = ?
        if (sqlUpper.includes("SELECT * FROM DESTINATIONS WHERE ID")) {
          const id = boundArgs[0] as string;
          if (destinations.has(id)) {
            return {
              id,
              slug: `slug-${id}`,
              title_id: "t",
              title_en: "t",
              tagline_id: "t",
              tagline_en: "t",
              hero_image: "https://example.com/img.jpg",
              about_text_id: "t",
              about_text_en: "t",
              whatsapp_number: "6281200000000",
              status: destinations.get(id)!,
              created_at: "2024-01-01 00:00:00",
              updated_at: "2024-01-01 00:00:00",
            } as T;
          }
          return null;
        }
        return null;
      },

      async run() {
        // deleteDestination: DELETE FROM destinations WHERE id = ?
        if (sqlUpper.includes("DELETE FROM DESTINATIONS WHERE ID")) {
          const id = boundArgs[0] as string;
          destinations.delete(id);
        }
        return { meta: { changes: 1 } };
      },

      async all() {
        return { results: [] };
      },
    };
    return stmt;
  }

  const db = {
    prepare(sql: string) {
      return buildStatement(sql);
    },

    async batch(statements: unknown[]) {
      // Commit any pending INSERT captured during bind() calls above
      if (pendingInsert) {
        destinations.set(pendingInsert.id, pendingInsert.status);
        pendingInsert = null;
      }

      // Execute each statement (handles DELETE and other writes in the batch)
      for (const stmt of statements as Array<{ run(): Promise<unknown> }>) {
        await stmt.run();
      }

      // Return empty results for loadRelatedRecords (4 SELECT queries)
      return [
        { results: [] },
        { results: [] },
        { results: [] },
        { results: [] },
      ];
    },
  } as unknown as D1Database;

  return { db, destinations };
}

/** Generates a minimal published CreateDestinationInput */
const publishedDestinationInputArb: fc.Arbitrary<CreateDestinationInput> = fc.record({
  title: localizedStringArb,
  tagline: localizedStringArb,
  heroImage: urlArb,
  aboutText: localizedStringArb,
  galleryImages: fc.constant([]),
  services: fc.constant([]),
  testimonials: fc.constant([]),
  faqEntries: fc.constant([]),
  whatsappNumber: whatsappNumberArb,
  status: fc.constant("published" as const),
});

/** Generates a minimal draft CreateDestinationInput */
const draftDestinationInputArb: fc.Arbitrary<CreateDestinationInput> = fc.record({
  title: localizedStringArb,
  tagline: localizedStringArb,
  heroImage: urlArb,
  aboutText: localizedStringArb,
  galleryImages: fc.constant([]),
  services: fc.constant([]),
  testimonials: fc.constant([]),
  faqEntries: fc.constant([]),
  whatsappNumber: whatsappNumberArb,
  status: fc.constant("draft" as const),
});

describe("Property 14: Destinations count reflects live data", () => {
  it("getDestinationsCount increments by 1 after createDestination with status='published'", async () => {
    await fc.assert(
      fc.asyncProperty(
        publishedDestinationInputArb,
        fc.nat({ max: 5 }), // initial published count
        async (input, initialCount) => {
          const { db } = createCountMockDb(initialCount);

          const countBefore = await getDestinationsCount(db);
          expect(countBefore).toBe(initialCount);

          await createDestination(db, input);

          const countAfter = await getDestinationsCount(db);
          expect(countAfter).toBe(initialCount + 1);
        }
      )
    );
  });

  it("getDestinationsCount does NOT increment after createDestination with status='draft'", async () => {
    await fc.assert(
      fc.asyncProperty(
        draftDestinationInputArb,
        fc.nat({ max: 5 }),
        async (input, initialCount) => {
          const { db } = createCountMockDb(initialCount);

          const countBefore = await getDestinationsCount(db);
          await createDestination(db, input);
          const countAfter = await getDestinationsCount(db);

          expect(countAfter).toBe(countBefore);
        }
      )
    );
  });

  it("getDestinationsCount decrements by 1 after deleteDestination of a published destination", async () => {
    await fc.assert(
      fc.asyncProperty(
        publishedDestinationInputArb,
        fc.nat({ max: 5 }),
        async (input, initialCount) => {
          const { db } = createCountMockDb(initialCount);

          // Create a published destination first
          const created = await createDestination(db, input);
          const countAfterCreate = await getDestinationsCount(db);
          expect(countAfterCreate).toBe(initialCount + 1);

          // Delete it
          await deleteDestination(db, created.id);
          const countAfterDelete = await getDestinationsCount(db);
          expect(countAfterDelete).toBe(initialCount);
        }
      )
    );
  });
});
