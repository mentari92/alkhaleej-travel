import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import type { BlogArticleRow } from "../../../lib/db/schema";
import type { BlogArticle } from "../../../lib/types";

/**
 * Property 1: Blog generate round-trip persistence
 * **Validates: Requirements 1.1, 1.2, 1.5, 1.6**
 *
 * For any valid blog generation request returning HTTP 201, `data.id` must
 * correspond to exactly one row in `blog_articles` with matching `title`,
 * `content`, `excerpt`, `metaDescription`, and `language`.
 */

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// Mock cloudflare:workers so connection.ts can be imported in Node test env
vi.mock("cloudflare:workers", () => ({
  env: {},
}));

// Mock the AI content generator — we control what it returns
vi.mock("../../../lib/ai/content-generator", () => ({
  generateContent: vi.fn(),
}));

// Mock session validation — always returns a valid session
vi.mock("../../../lib/auth/session", () => ({
  validateSession: vi.fn().mockResolvedValue({
    id: "test-session-id",
    adminId: "test-admin-id",
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  }),
}));

// Mock getDB and getEnvVar from connection
vi.mock("../../../lib/db/connection", () => ({
  getDB: vi.fn(),
  getEnvVar: vi.fn((key: string) => {
    if (key === "DEEPSEEK_API_KEY") return "test-deepseek-key";
    if (key === "EXA_API_KEY") return "test-exa-key";
    return undefined;
  }),
}));

// ---------------------------------------------------------------------------
// Imports after mocks are set up
// ---------------------------------------------------------------------------

import { POST } from "./generate";
import { generateContent } from "../../../lib/ai/content-generator";
import { getDB } from "../../../lib/db/connection";

// ---------------------------------------------------------------------------
// In-memory D1 mock for blog_articles
// ---------------------------------------------------------------------------

/**
 * Creates an in-memory mock D1Database that simulates the SQL operations
 * used by `createArticle` and `getArticleById` in `src/lib/db/blog.ts`.
 *
 * Supported operations:
 * - INSERT INTO blog_articles (via batch)
 * - INSERT INTO blog_destination_links (via batch)
 * - SELECT * FROM blog_articles WHERE id = ? (via .first())
 * - SELECT destination_id FROM blog_destination_links WHERE blog_id = ? (via .all())
 */
function createBlogMockDb() {
  const articleRows: BlogArticleRow[] = [];
  const destinationLinks: Array<{ blog_id: string; destination_id: string }> = [];

  function buildStatement(sql: string, boundArgs: unknown[] = []) {
    const sqlUpper = sql.trim().toUpperCase();

    const stmt = {
      bind(...args: unknown[]) {
        return buildStatement(sql, args);
      },

      async first<T = Record<string, unknown>>(): Promise<T | null> {
        if (sqlUpper.includes("SELECT * FROM BLOG_ARTICLES WHERE ID")) {
          const id = boundArgs[0] as string;
          const row = articleRows.find((r) => r.id === id);
          return (row ?? null) as T | null;
        }
        return null;
      },

      async run(): Promise<D1Result> {
        if (sqlUpper.includes("INSERT INTO BLOG_ARTICLES")) {
          articleRows.push({
            id: boundArgs[0] as string,
            slug: boundArgs[1] as string,
            language: boundArgs[2] as "id" | "en",
            title: boundArgs[3] as string,
            excerpt: boundArgs[4] as string,
            content: boundArgs[5] as string,
            thumbnail_url: (boundArgs[6] as string | null) ?? null,
            meta_description: boundArgs[7] as string,
            og_image: (boundArgs[8] as string | null) ?? null,
            paired_article_id: (boundArgs[9] as string | null) ?? null,
            status: boundArgs[10] as "published" | "draft",
            published_at: (boundArgs[11] as string | null) ?? null,
            created_at: boundArgs[12] as string,
            updated_at: boundArgs[13] as string,
          });
        } else if (sqlUpper.includes("INSERT INTO BLOG_DESTINATION_LINKS")) {
          destinationLinks.push({
            blog_id: boundArgs[0] as string,
            destination_id: boundArgs[1] as string,
          });
        }
        return {
          success: true,
          meta: {
            changes: 1,
            last_row_id: articleRows.length,
            changed_db: true,
            size_after: articleRows.length,
            rows_read: 0,
            rows_written: 1,
            duration: 0,
          },
          results: [],
        } as D1Result;
      },

      async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
        if (sqlUpper.includes("SELECT DESTINATION_ID FROM BLOG_DESTINATION_LINKS")) {
          const blogId = boundArgs[0] as string;
          const links = destinationLinks
            .filter((l) => l.blog_id === blogId)
            .map((l) => ({ destination_id: l.destination_id }));
          return {
            success: true,
            meta: {
              changes: 0,
              last_row_id: 0,
              changed_db: false,
              size_after: links.length,
              rows_read: links.length,
              rows_written: 0,
              duration: 0,
            },
            results: links as T[],
          };
        }
        return {
          success: true,
          meta: {
            changes: 0,
            last_row_id: 0,
            changed_db: false,
            size_after: 0,
            rows_read: 0,
            rows_written: 0,
            duration: 0,
          },
          results: [] as T[],
        };
      },

      async raw<T = unknown[]>(): Promise<T[]> {
        return [] as T[];
      },
    };

    return stmt as unknown as D1PreparedStatement;
  }

  const db = {
    prepare(sql: string) {
      return buildStatement(sql, []);
    },

    async batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
      const results: D1Result[] = [];
      for (const stmt of statements) {
        const result = await (stmt as unknown as { run(): Promise<D1Result> }).run();
        results.push(result);
      }
      return results;
    },

    async dump(): Promise<ArrayBuffer> {
      return new ArrayBuffer(0);
    },

    async exec(_query: string): Promise<D1ExecResult> {
      return { count: 0, duration: 0 };
    },

    // Expose internal state for assertions
    _articleRows: articleRows,
    _destinationLinks: destinationLinks,
  } as unknown as D1Database & {
    _articleRows: BlogArticleRow[];
    _destinationLinks: Array<{ blog_id: string; destination_id: string }>;
  };

  return db;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a minimal Request object for POST /api/blog/generate.
 */
function buildRequest(body: Record<string, unknown>): Request {
  return new Request("https://infotour.id/api/blog/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Builds a minimal Astro APIContext-like object with a session cookie.
 */
function buildContext(request: Request, db: D1Database) {
  // Wire the mock DB into getDB
  vi.mocked(getDB).mockReturnValue(db);

  return {
    request,
    cookies: {
      get: (_name: string) => ({ value: "test-session-id" }),
    },
  } as unknown as Parameters<typeof POST>[0];
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** Generates a non-empty string suitable for article text fields */
const nonEmptyStringArb = fc
  .string({ minLength: 1, maxLength: 100 })
  .filter((s) => s.trim().length > 0);

/** Generates a valid target language */
const languageArb = fc.constantFrom("id" as const, "en" as const);

/** Generates a valid article payload (what the AI would return) */
const articlePayloadArb = fc.record({
  title: nonEmptyStringArb,
  content: nonEmptyStringArb,
  excerpt: nonEmptyStringArb,
  metaDescription: nonEmptyStringArb,
  language: languageArb,
});

/** Generates a valid generate request body */
const generateRequestBodyArb = fc.record({
  topic: nonEmptyStringArb,
  targetLanguage: languageArb,
});

// ---------------------------------------------------------------------------
// Property 1: Blog generate round-trip persistence
// ---------------------------------------------------------------------------

describe("Property 1: Blog generate round-trip persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-apply the getEnvVar mock after clearAllMocks
    vi.mocked(getDB); // ensure mock is still registered
  });

  it(
    "for any valid generate request returning HTTP 201, data.id corresponds to exactly one row in blog_articles with matching fields",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          generateRequestBodyArb,
          articlePayloadArb,
          async (requestBody, articlePayload) => {
            // Fresh DB for each run
            const db = createBlogMockDb();
            vi.mocked(getDB).mockReturnValue(db);

            // Re-apply getEnvVar mock
            const { getEnvVar } = await import("../../../lib/db/connection");
            vi.mocked(getEnvVar).mockImplementation((key: string) => {
              if (key === "DEEPSEEK_API_KEY") return "test-deepseek-key";
              if (key === "EXA_API_KEY") return "test-exa-key";
              return undefined;
            });

            // Build the article that the AI generator will return
            const generatedArticle: BlogArticle = {
              id: crypto.randomUUID(), // will be replaced by createArticle
              slug: "",
              title: articlePayload.title,
              excerpt: articlePayload.excerpt,
              content: articlePayload.content,
              language: requestBody.targetLanguage,
              thumbnailUrl: "",
              metaDescription: articlePayload.metaDescription,
              ogImage: "",
              relatedDestinationIds: [],
              pairedArticleId: null,
              status: "draft",
              publishedAt: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            // Mock generateContent to return our controlled article
            vi.mocked(generateContent).mockResolvedValue({
              success: true,
              article: generatedArticle,
            });

            // Build and execute the request
            const request = buildRequest(requestBody);
            const context = buildContext(request, db);
            const response = await POST(context);

            // --- Assert HTTP 201 ---
            expect(response.status).toBe(201);

            // --- Parse response body ---
            const body = await response.json() as {
              success: boolean;
              data: BlogArticle;
            };
            expect(body.success).toBe(true);
            expect(body.data).toBeDefined();
            expect(body.data.id).toBeTruthy();

            const returnedId = body.data.id;

            // --- Assert exactly one row in DB with matching fields ---
            const matchingRows = db._articleRows.filter(
              (row) => row.id === returnedId
            );
            expect(matchingRows).toHaveLength(1);

            const row = matchingRows[0];

            // Title must match
            expect(row.title).toBe(articlePayload.title);

            // Excerpt must match
            expect(row.excerpt).toBe(articlePayload.excerpt);

            // Meta description must match
            expect(row.meta_description).toBe(articlePayload.metaDescription);

            // Language must match the request's targetLanguage
            expect(row.language).toBe(requestBody.targetLanguage);

            // Content: the endpoint sanitizes the AI content before persisting.
            // The sanitized content stored in DB must equal what was returned in the response.
            expect(row.content).toBe(body.data.content);

            // Status must be 'draft' (generate always creates drafts)
            expect(row.status).toBe("draft");
          }
        ),
        { numRuns: 50 }
      );
    }
  );

  it(
    "data.id in the response matches the id of the persisted row",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          generateRequestBodyArb,
          articlePayloadArb,
          async (requestBody, articlePayload) => {
            const db = createBlogMockDb();
            vi.mocked(getDB).mockReturnValue(db);

            const { getEnvVar } = await import("../../../lib/db/connection");
            vi.mocked(getEnvVar).mockImplementation((key: string) => {
              if (key === "DEEPSEEK_API_KEY") return "test-deepseek-key";
              return undefined;
            });

            const generatedArticle: BlogArticle = {
              id: crypto.randomUUID(),
              slug: "",
              title: articlePayload.title,
              excerpt: articlePayload.excerpt,
              content: articlePayload.content,
              language: requestBody.targetLanguage,
              thumbnailUrl: "",
              metaDescription: articlePayload.metaDescription,
              ogImage: "",
              relatedDestinationIds: [],
              pairedArticleId: null,
              status: "draft",
              publishedAt: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            vi.mocked(generateContent).mockResolvedValue({
              success: true,
              article: generatedArticle,
            });

            const request = buildRequest(requestBody);
            const context = buildContext(request, db);
            const response = await POST(context);

            expect(response.status).toBe(201);

            const body = await response.json() as {
              success: boolean;
              data: BlogArticle;
            };

            const returnedId = body.data.id;

            // The returned id must exist in the DB
            const rowExists = db._articleRows.some((r) => r.id === returnedId);
            expect(rowExists).toBe(true);

            // There must be exactly one row with that id (no duplicates)
            const rowCount = db._articleRows.filter(
              (r) => r.id === returnedId
            ).length;
            expect(rowCount).toBe(1);
          }
        ),
        { numRuns: 50 }
      );
    }
  );

  it(
    "each generate call creates exactly one new row in blog_articles",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          generateRequestBodyArb,
          articlePayloadArb,
          async (requestBody, articlePayload) => {
            const db = createBlogMockDb();
            vi.mocked(getDB).mockReturnValue(db);

            const { getEnvVar } = await import("../../../lib/db/connection");
            vi.mocked(getEnvVar).mockImplementation((key: string) => {
              if (key === "DEEPSEEK_API_KEY") return "test-deepseek-key";
              return undefined;
            });

            const generatedArticle: BlogArticle = {
              id: crypto.randomUUID(),
              slug: "",
              title: articlePayload.title,
              excerpt: articlePayload.excerpt,
              content: articlePayload.content,
              language: requestBody.targetLanguage,
              thumbnailUrl: "",
              metaDescription: articlePayload.metaDescription,
              ogImage: "",
              relatedDestinationIds: [],
              pairedArticleId: null,
              status: "draft",
              publishedAt: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            vi.mocked(generateContent).mockResolvedValue({
              success: true,
              article: generatedArticle,
            });

            const rowsBefore = db._articleRows.length;

            const request = buildRequest(requestBody);
            const context = buildContext(request, db);
            const response = await POST(context);

            expect(response.status).toBe(201);

            const rowsAfter = db._articleRows.length;
            expect(rowsAfter).toBe(rowsBefore + 1);
          }
        ),
        { numRuns: 50 }
      );
    }
  );
});
