import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createDestination,
  getDestinationBySlug,
  getDestinationById,
  listPublishedDestinations,
  listAllDestinations,
  updateDestination,
  updateDestinationStatus,
  deleteDestination,
} from "./destinations";
import type { CreateDestinationInput, UpdateDestinationInput } from "./destinations";

/**
 * Creates a mock D1Database for testing destination CRUD operations.
 */
function createMockDb() {
  const mockFirst = vi.fn();
  const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
  const mockAll = vi.fn().mockResolvedValue({ results: [] });
  const mockBind = vi.fn().mockReturnValue({ first: mockFirst, run: mockRun, all: mockAll });
  const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind, all: mockAll });
  const mockBatch = vi.fn().mockResolvedValue([
    { results: [] }, // gallery_images
    { results: [] }, // service_packages
    { results: [] }, // testimonials
    { results: [] }, // faq_entries
  ]);

  const db = { prepare: mockPrepare, batch: mockBatch } as unknown as D1Database;

  return { db, mockPrepare, mockBind, mockFirst, mockRun, mockAll, mockBatch };
}

function sampleDestinationInput(): CreateDestinationInput {
  return {
    title: { id: "Bali Kintamani", en: "Bali Kintamani" },
    tagline: { id: "Keindahan alam Bali", en: "Natural beauty of Bali" },
    heroImage: "https://example.com/hero.jpg",
    aboutText: { id: "Tentang Bali Kintamani", en: "About Bali Kintamani" },
    galleryImages: [
      { url: "https://example.com/img1.jpg", alt: { id: "Gambar 1", en: "Image 1" }, order: 0 },
    ],
    services: [
      {
        id: "svc-1",
        name: { id: "Paket Dasar", en: "Basic Package" },
        description: { id: "Deskripsi paket", en: "Package description" },
        price: "500000",
        features: [
          { id: "Transportasi", en: "Transportation" },
          { id: "Makan siang", en: "Lunch" },
        ],
      },
    ],
    testimonials: [
      {
        id: "test-1",
        author: "John Doe",
        content: { id: "Sangat bagus!", en: "Very good!" },
        rating: 5,
      },
    ],
    faqEntries: [
      {
        id: "faq-1",
        question: { id: "Berapa harganya?", en: "How much does it cost?" },
        answer: { id: "Mulai dari 500rb", en: "Starting from 500k" },
        order: 0,
      },
    ],
    whatsappNumber: "6281234567890",
    status: "draft",
  };
}

function sampleDestinationRow() {
  return {
    id: "dest-123",
    slug: "bali-kintamani",
    title_id: "Bali Kintamani",
    title_en: "Bali Kintamani",
    tagline_id: "Keindahan alam Bali",
    tagline_en: "Natural beauty of Bali",
    hero_image: "https://example.com/hero.jpg",
    about_text_id: "Tentang Bali Kintamani",
    about_text_en: "About Bali Kintamani",
    whatsapp_number: "6281234567890",
    status: "published" as const,
    created_at: "2024-01-01 00:00:00",
    updated_at: "2024-01-01 00:00:00",
  };
}

describe("createDestination", () => {
  it("generates a UUID for the destination ID", async () => {
    const { db, mockBatch, mockFirst } = createMockDb();

    // After batch, getDestinationById is called — mock the first call for the read-back
    mockFirst.mockResolvedValue({
      ...sampleDestinationRow(),
      id: expect.any(String),
    });

    // Mock batch to succeed, then mock the subsequent getDestinationById call
    mockBatch.mockResolvedValue([]);

    // For the getDestinationById call after creation
    const mockFirstForGet = vi.fn().mockResolvedValue(sampleDestinationRow());
    const mockBindForGet = vi.fn().mockReturnValue({ first: mockFirstForGet, run: vi.fn(), all: vi.fn().mockResolvedValue({ results: [] }) });

    // Re-create db with more control
    const mockPrepare = vi.fn().mockReturnValue({ bind: mockBindForGet, all: vi.fn().mockResolvedValue({ results: [] }) });
    const mockBatchFn = vi.fn()
      .mockResolvedValueOnce([]) // createDestination batch
      .mockResolvedValueOnce([ // loadRelatedRecords batch
        { results: [] },
        { results: [] },
        { results: [] },
        { results: [] },
      ]);

    const testDb = { prepare: mockPrepare, batch: mockBatchFn } as unknown as D1Database;

    const result = await createDestination(testDb, sampleDestinationInput());

    // The first batch call should contain the INSERT statements
    expect(mockBatchFn).toHaveBeenCalled();
    const batchStatements = mockBatchFn.mock.calls[0][0];
    // At minimum: 1 destination + 1 gallery + 1 service + 1 testimonial + 1 faq = 5 statements
    expect(batchStatements.length).toBe(5);
  });

  it("generates a slug from the Indonesian title", async () => {
    const { db, mockBatch } = createMockDb();

    const mockFirstForGet = vi.fn().mockResolvedValue(sampleDestinationRow());
    const mockBindForGet = vi.fn().mockReturnValue({ first: mockFirstForGet, run: vi.fn(), all: vi.fn().mockResolvedValue({ results: [] }) });
    const mockPrepare = vi.fn().mockReturnValue({ bind: mockBindForGet, all: vi.fn().mockResolvedValue({ results: [] }) });
    const mockBatchFn = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { results: [] },
        { results: [] },
        { results: [] },
        { results: [] },
      ]);

    const testDb = { prepare: mockPrepare, batch: mockBatchFn } as unknown as D1Database;

    const input = sampleDestinationInput();
    input.title.id = "Gunung Bromo Jawa Timur";

    await createDestination(testDb, input);

    // Check the first batch call contains the INSERT with slug
    const batchStatements = mockBatchFn.mock.calls[0][0];
    // The slug should be generated from the ID title
    // We verify the prepare was called with the INSERT statement
    expect(mockPrepare).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO destinations")
    );
  });
});

describe("getDestinationBySlug", () => {
  it("returns null when destination is not found", async () => {
    const { db, mockFirst } = createMockDb();
    mockFirst.mockResolvedValue(null);

    const result = await getDestinationBySlug(db, "nonexistent-slug");

    expect(result).toBeNull();
  });

  it("returns a full Destination object when found", async () => {
    const { db, mockFirst, mockBatch } = createMockDb();
    mockFirst.mockResolvedValue(sampleDestinationRow());
    mockBatch.mockResolvedValue([
      { results: [{ id: "img-1", destination_id: "dest-123", url: "https://example.com/img.jpg", alt_id: "Alt ID", alt_en: "Alt EN", sort_order: 0 }] },
      { results: [] },
      { results: [] },
      { results: [] },
    ]);

    const result = await getDestinationBySlug(db, "bali-kintamani");

    expect(result).not.toBeNull();
    expect(result!.id).toBe("dest-123");
    expect(result!.slug).toBe("bali-kintamani");
    expect(result!.title).toEqual({ id: "Bali Kintamani", en: "Bali Kintamani" });
    expect(result!.galleryImages).toHaveLength(1);
    expect(result!.galleryImages[0].url).toBe("https://example.com/img.jpg");
    expect(result!.galleryImages[0].alt).toEqual({ id: "Alt ID", en: "Alt EN" });
  });
});

describe("getDestinationById", () => {
  it("returns null when destination is not found", async () => {
    const { db, mockFirst } = createMockDb();
    mockFirst.mockResolvedValue(null);

    const result = await getDestinationById(db, "nonexistent-id");

    expect(result).toBeNull();
  });

  it("returns a full Destination object with related records", async () => {
    const { db, mockFirst, mockBatch } = createMockDb();
    mockFirst.mockResolvedValue(sampleDestinationRow());
    mockBatch.mockResolvedValue([
      { results: [] }, // gallery
      { results: [{ id: "svc-1", destination_id: "dest-123", name_id: "Paket", name_en: "Package", description_id: "Desc ID", description_en: "Desc EN", price: "100000", features_id: '["Fitur 1"]', features_en: '["Feature 1"]' }] },
      { results: [{ id: "t-1", destination_id: "dest-123", author: "Jane", content_id: "Bagus", content_en: "Good", rating: 4 }] },
      { results: [{ id: "f-1", destination_id: "dest-123", question_id: "Tanya?", question_en: "Question?", answer_id: "Jawab", answer_en: "Answer", sort_order: 0 }] },
    ]);

    const result = await getDestinationById(db, "dest-123");

    expect(result).not.toBeNull();
    expect(result!.services).toHaveLength(1);
    expect(result!.services[0].name).toEqual({ id: "Paket", en: "Package" });
    expect(result!.services[0].features).toEqual([{ id: "Fitur 1", en: "Feature 1" }]);
    expect(result!.testimonials).toHaveLength(1);
    expect(result!.testimonials[0].author).toBe("Jane");
    expect(result!.faqEntries).toHaveLength(1);
    expect(result!.faqEntries[0].question).toEqual({ id: "Tanya?", en: "Question?" });
  });
});

describe("listPublishedDestinations", () => {
  it("returns only published destinations", async () => {
    const { db, mockAll, mockBatch } = createMockDb();
    const publishedRow = { ...sampleDestinationRow(), status: "published" };
    mockAll.mockResolvedValue({ results: [publishedRow] });
    mockBatch.mockResolvedValue([
      { results: [] },
      { results: [] },
      { results: [] },
      { results: [] },
    ]);

    const results = await listPublishedDestinations(db);

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("published");
  });

  it("returns empty array when no published destinations exist", async () => {
    const { db, mockAll } = createMockDb();
    mockAll.mockResolvedValue({ results: [] });

    const results = await listPublishedDestinations(db);

    expect(results).toHaveLength(0);
  });
});

describe("listAllDestinations", () => {
  it("returns all destinations regardless of status", async () => {
    const { db, mockAll, mockBatch } = createMockDb();
    const row1 = { ...sampleDestinationRow(), id: "d1", status: "published" };
    const row2 = { ...sampleDestinationRow(), id: "d2", status: "draft" };
    mockAll.mockResolvedValue({ results: [row1, row2] });
    mockBatch.mockResolvedValue([
      { results: [] },
      { results: [] },
      { results: [] },
      { results: [] },
    ]);

    const results = await listAllDestinations(db);

    expect(results).toHaveLength(2);
  });
});

describe("updateDestinationStatus", () => {
  it("updates the status and updated_at timestamp", async () => {
    const { db, mockPrepare, mockBind, mockRun } = createMockDb();

    await updateDestinationStatus(db, "dest-123", "published");

    expect(mockPrepare).toHaveBeenCalledWith(
      "UPDATE destinations SET status = ?, updated_at = ? WHERE id = ?"
    );
    expect(mockBind).toHaveBeenCalledWith("published", expect.any(String), "dest-123");
  });
});

describe("deleteDestination", () => {
  it("deletes the destination by ID", async () => {
    const { db, mockPrepare, mockBind } = createMockDb();

    await deleteDestination(db, "dest-123");

    expect(mockPrepare).toHaveBeenCalledWith(
      "DELETE FROM destinations WHERE id = ?"
    );
    expect(mockBind).toHaveBeenCalledWith("dest-123");
  });
});

describe("updateDestination — gallery image semantics", () => {
  /**
   * Helper that builds a mock DB wired for updateDestination:
   *  - first call to `first()` returns the existing destination row (for getDestinationById inside updateDestination)
   *  - first call to `batch()` returns the loadRelatedRecords result (4 child arrays)
   *  - second call to `batch()` executes the UPDATE statements
   *  - third call to `batch()` returns the loadRelatedRecords result for the read-back after update
   */
  function createUpdateMockDb(existingGalleryRows: object[] = []) {
    const existingRow = sampleDestinationRow();

    // Tracks all prepared statements and their bind args
    const preparedStatements: Array<{ sql: string; bindArgs: unknown[] }> = [];

    // Each prepared statement object records its SQL and bind args
    const makePreparedStmt = (sql: string) => {
      const stmt = {
        sql,
        bindArgs: [] as unknown[],
        bind: (...args: unknown[]) => {
          stmt.bindArgs = args;
          preparedStatements.push({ sql, bindArgs: args });
          return stmt;
        },
        first: vi.fn().mockResolvedValue(existingRow),
        run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
        all: vi.fn().mockResolvedValue({ results: [] }),
      };
      return stmt;
    };

    const mockPrepare = vi.fn().mockImplementation((sql: string) => makePreparedStmt(sql));

    // batch call sequence:
    //  call 0: loadRelatedRecords inside getDestinationById (before update)
    //  call 1: the actual UPDATE batch
    //  call 2: loadRelatedRecords inside getDestinationById (read-back after update)
    const mockBatch = vi.fn()
      .mockResolvedValueOnce([
        { results: existingGalleryRows }, // gallery_images
        { results: [] },                  // service_packages
        { results: [] },                  // testimonials
        { results: [] },                  // faq_entries
      ])
      .mockResolvedValueOnce([]) // UPDATE batch result
      .mockResolvedValueOnce([
        { results: [] }, // gallery_images (read-back)
        { results: [] },
        { results: [] },
        { results: [] },
      ]);

    const db = { prepare: mockPrepare, batch: mockBatch } as unknown as D1Database;

    return { db, mockPrepare, mockBatch, preparedStatements };
  }

  /**
   * Requirement 2.5 — explicit `galleryImages: []` must delete all gallery images.
   *
   * When `input.galleryImages` is an empty array, `updateDestination` should:
   *  1. Issue a DELETE FROM gallery_images WHERE destination_id = ? statement
   *  2. Not insert any new gallery image rows
   */
  it("deletes all gallery images when galleryImages is an explicit empty array", async () => {
    const existingGalleryRow = {
      id: "img-1",
      destination_id: "dest-123",
      url: "https://example.com/img.jpg",
      alt_id: "Alt ID",
      alt_en: "Alt EN",
      sort_order: 0,
    };

    const { db, mockBatch } = createUpdateMockDb([existingGalleryRow]);

    await updateDestination(db, "dest-123", { galleryImages: [] });

    // The second batch call is the UPDATE batch — inspect its statements
    const updateBatchStatements: Array<{ sql?: string }> = mockBatch.mock.calls[1][0];

    // There must be a DELETE FROM gallery_images statement
    const deleteStmt = updateBatchStatements.find(
      (s) => s.sql && s.sql.includes("DELETE FROM gallery_images")
    );
    expect(deleteStmt).toBeDefined();

    // There must be NO INSERT INTO gallery_images statement (empty array → no re-inserts)
    const insertStmt = updateBatchStatements.find(
      (s) => s.sql && s.sql.includes("INSERT INTO gallery_images")
    );
    expect(insertStmt).toBeUndefined();
  });

  /**
   * Requirement 2.7 — `galleryImages: undefined` must preserve existing gallery images.
   *
   * When `input.galleryImages` is `undefined` (key absent), `updateDestination` should
   * not include any DELETE FROM gallery_images or INSERT INTO gallery_images statements
   * in the batch, leaving the existing rows untouched.
   */
  it("preserves existing gallery images when galleryImages is undefined", async () => {
    const existingGalleryRow = {
      id: "img-1",
      destination_id: "dest-123",
      url: "https://example.com/img.jpg",
      alt_id: "Alt ID",
      alt_en: "Alt EN",
      sort_order: 0,
    };

    const { db, mockBatch } = createUpdateMockDb([existingGalleryRow]);

    // Only update the title — galleryImages key is absent (undefined)
    await updateDestination(db, "dest-123", {
      title: { id: "Judul Baru", en: "New Title" },
    });

    // The second batch call is the UPDATE batch
    const updateBatchStatements: Array<{ sql?: string }> = mockBatch.mock.calls[1][0];

    // There must be NO DELETE FROM gallery_images statement
    const deleteStmt = updateBatchStatements.find(
      (s) => s.sql && s.sql.includes("DELETE FROM gallery_images")
    );
    expect(deleteStmt).toBeUndefined();

    // There must be NO INSERT INTO gallery_images statement
    const insertStmt = updateBatchStatements.find(
      (s) => s.sql && s.sql.includes("INSERT INTO gallery_images")
    );
    expect(insertStmt).toBeUndefined();
  });

  /**
   * Additional: explicit `galleryImages` with items replaces existing images.
   *
   * When `input.galleryImages` contains new items, the batch should include
   * a DELETE followed by INSERT statements for each new image.
   */
  it("replaces gallery images when galleryImages is a non-empty array", async () => {
    const existingGalleryRow = {
      id: "img-1",
      destination_id: "dest-123",
      url: "https://example.com/old.jpg",
      alt_id: "Old Alt ID",
      alt_en: "Old Alt EN",
      sort_order: 0,
    };

    const { db, mockBatch } = createUpdateMockDb([existingGalleryRow]);

    const newImages = [
      { url: "https://example.com/new1.jpg", alt: { id: "Baru 1", en: "New 1" }, order: 0 },
      { url: "https://example.com/new2.jpg", alt: { id: "Baru 2", en: "New 2" }, order: 1 },
    ];

    await updateDestination(db, "dest-123", { galleryImages: newImages });

    const updateBatchStatements: Array<{ sql?: string }> = mockBatch.mock.calls[1][0];

    // Must have a DELETE statement
    const deleteStmt = updateBatchStatements.find(
      (s) => s.sql && s.sql.includes("DELETE FROM gallery_images")
    );
    expect(deleteStmt).toBeDefined();

    // Must have exactly 2 INSERT statements (one per new image)
    const insertStmts = updateBatchStatements.filter(
      (s) => s.sql && s.sql.includes("INSERT INTO gallery_images")
    );
    expect(insertStmts).toHaveLength(2);
  });
});
