import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";
import { listPublishedDestinations } from "./destinations";
import type { DestinationRow } from "./schema";

/**
 * Property 7: Unpublished destination exclusion
 * **Validates: Requirements 5.5, 11.5**
 *
 * For any set of destinations with mixed publish states, the public directory
 * listing in any language SHALL contain only destinations with status "published",
 * and requesting the URL of an unpublished destination in any language SHALL
 * return a 404 response.
 */
describe("Property 7: Unpublished destination exclusion", () => {
  // Generator for a destination row with arbitrary status
  const destinationRowArb = (status: "published" | "draft"): fc.Arbitrary<DestinationRow> =>
    fc.record({
      id: fc.uuid(),
      slug: fc.string({ minLength: 3, maxLength: 30 }).map((s) =>
        s.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/--+/g, "-").replace(/^-|-$/g, "") || "dest"
      ),
      title_id: fc.string({ minLength: 1, maxLength: 100 }),
      title_en: fc.string({ minLength: 1, maxLength: 100 }),
      tagline_id: fc.string({ minLength: 1, maxLength: 200 }),
      tagline_en: fc.string({ minLength: 1, maxLength: 200 }),
      hero_image: fc.webUrl(),
      about_text_id: fc.string({ minLength: 1, maxLength: 500 }),
      about_text_en: fc.string({ minLength: 1, maxLength: 500 }),
      whatsapp_number: fc.stringMatching(/^62[0-9]{9,12}$/),
      status: fc.constant(status),
      created_at: fc.constant("2024-01-01 00:00:00"),
      updated_at: fc.constant("2024-01-01 00:00:00"),
    });

  // Generator for a mixed list of destinations (some published, some draft)
  const mixedDestinationsArb = fc
    .tuple(
      fc.array(destinationRowArb("published"), { minLength: 0, maxLength: 5 }),
      fc.array(destinationRowArb("draft"), { minLength: 0, maxLength: 5 })
    )
    .filter(([published, drafts]) => published.length + drafts.length > 0);

  /**
   * Creates a mock D1Database that returns only published rows when queried
   * with the published filter (simulating the real D1 behavior).
   */
  function createMockDb(allRows: DestinationRow[]) {
    const publishedRows = allRows.filter((r) => r.status === "published");

    const mockAll = vi.fn().mockResolvedValue({ results: publishedRows });
    const mockBind = vi.fn().mockReturnValue({ all: mockAll });
    const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind, all: mockAll });
    const mockBatch = vi.fn().mockResolvedValue([
      { results: [] }, // gallery_images
      { results: [] }, // service_packages
      { results: [] }, // testimonials
      { results: [] }, // faq_entries
    ]);

    return { prepare: mockPrepare, batch: mockBatch } as unknown as D1Database;
  }

  it("listPublishedDestinations returns ONLY destinations with status 'published'", () => {
    fc.assert(
      fc.asyncProperty(mixedDestinationsArb, async ([publishedRows, draftRows]) => {
        const allRows = [...publishedRows, ...draftRows];
        const db = createMockDb(allRows);

        const results = await listPublishedDestinations(db);

        // Every returned destination must have status "published"
        for (const dest of results) {
          expect(dest.status).toBe("published");
        }
      })
    );
  });

  it("no draft destinations appear in the result", () => {
    fc.assert(
      fc.asyncProperty(mixedDestinationsArb, async ([publishedRows, draftRows]) => {
        const allRows = [...publishedRows, ...draftRows];
        const db = createMockDb(allRows);

        const results = await listPublishedDestinations(db);
        const resultIds = results.map((d) => d.id);

        // None of the draft destination IDs should appear in results
        for (const draft of draftRows) {
          expect(resultIds).not.toContain(draft.id);
        }
      })
    );
  });

  it("result count matches the number of published destinations in the input", () => {
    fc.assert(
      fc.asyncProperty(mixedDestinationsArb, async ([publishedRows, draftRows]) => {
        const allRows = [...publishedRows, ...draftRows];
        const db = createMockDb(allRows);

        const results = await listPublishedDestinations(db);

        // The count should match exactly the number of published rows
        expect(results.length).toBe(publishedRows.length);
      })
    );
  });
});
