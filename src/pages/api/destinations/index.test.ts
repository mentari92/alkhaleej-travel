import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit tests for the destinations index API endpoint (GET list, POST create).
 */

vi.mock("../../../lib/auth/session", () => ({
  validateSession: vi.fn(),
}));

vi.mock("../../../lib/db/destinations", () => ({
  listAllDestinations: vi.fn(),
  listPublishedDestinations: vi.fn(),
  createDestination: vi.fn(),
}));

import { GET, POST } from "./index";
import { validateSession } from "../../../lib/auth/session";
import {
  listAllDestinations,
  listPublishedDestinations,
  createDestination,
} from "../../../lib/db/destinations";

function createMockDb() {
  return {} as unknown as D1Database;
}

function createMockCookies(sessionId?: string) {
  return {
    get: vi.fn((name: string) => {
      if (name === "session_id" && sessionId) {
        return { value: sessionId };
      }
      return undefined;
    }),
    set: vi.fn(),
    delete: vi.fn(),
  };
}

function createGetContext(db: any, queryParams = "") {
  return {
    url: new URL(`http://localhost/api/destinations${queryParams}`),
    locals: { runtime: { env: { DB: db } } },
  } as any;
}

function createPostContext(body: any, db: any, cookies: any) {
  return {
    request: new Request("http://localhost/api/destinations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    cookies,
    locals: { runtime: { env: { DB: db } } },
  } as any;
}

const validDestinationBody = {
  title: { id: "Pantai Kuta", en: "Kuta Beach" },
  tagline: { id: "Pantai terindah", en: "Most beautiful beach" },
  heroImage: "https://example.com/hero.jpg",
  aboutText: { id: "Tentang pantai", en: "About the beach" },
  whatsappNumber: "+6281234567890",
  status: "draft",
  galleryImages: [],
  services: [],
  testimonials: [],
  faqEntries: [],
};

describe("GET /api/destinations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all destinations when no status filter", async () => {
    const db = createMockDb();
    const mockDestinations = [{ id: "1", title: { id: "Test", en: "Test" } }];
    vi.mocked(listAllDestinations).mockResolvedValue(mockDestinations as any);

    const context = createGetContext(db);
    const response = await GET(context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(mockDestinations);
    expect(listAllDestinations).toHaveBeenCalledWith(db);
  });

  it("returns only published destinations when status=published", async () => {
    const db = createMockDb();
    const mockDestinations = [{ id: "1", status: "published" }];
    vi.mocked(listPublishedDestinations).mockResolvedValue(mockDestinations as any);

    const context = createGetContext(db, "?status=published");
    const response = await GET(context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(mockDestinations);
    expect(listPublishedDestinations).toHaveBeenCalledWith(db);
  });

  it("returns 500 on database error", async () => {
    const db = createMockDb();
    vi.mocked(listAllDestinations).mockRejectedValue(new Error("DB error"));

    const context = createGetContext(db);
    const response = await GET(context);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("INTERNAL_ERROR");
  });
});

describe("POST /api/destinations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no session cookie", async () => {
    const db = createMockDb();
    const cookies = createMockCookies();
    const context = createPostContext(validDestinationBody, db, cookies);

    const response = await POST(context);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 when session is invalid", async () => {
    const db = createMockDb();
    const cookies = createMockCookies("invalid-session");
    vi.mocked(validateSession).mockResolvedValue(null);
    const context = createPostContext(validDestinationBody, db, cookies);

    const response = await POST(context);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 400 when body is not valid JSON", async () => {
    const db = createMockDb();
    const cookies = createMockCookies("valid-session");
    vi.mocked(validateSession).mockResolvedValue({
      id: "valid-session",
      adminId: "admin-1",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    const context = {
      request: new Request("http://localhost/api/destinations", {
        method: "POST",
        body: "not json",
      }),
      cookies,
      locals: { runtime: { env: { DB: db } } },
    } as any;

    const response = await POST(context);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("INVALID_BODY");
  });

  it("returns 400 when bilingual title fields are missing", async () => {
    const db = createMockDb();
    const cookies = createMockCookies("valid-session");
    vi.mocked(validateSession).mockResolvedValue({
      id: "valid-session",
      adminId: "admin-1",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    const body = { ...validDestinationBody, title: { id: "Only ID" } };
    const context = createPostContext(body, db, cookies);

    const response = await POST(context);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("VALIDATION_ERROR");
    expect(data.error.details.title).toBeDefined();
  });

  it("returns 400 when required fields are missing", async () => {
    const db = createMockDb();
    const cookies = createMockCookies("valid-session");
    vi.mocked(validateSession).mockResolvedValue({
      id: "valid-session",
      adminId: "admin-1",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    const body = { title: { id: "T", en: "T" } };
    const context = createPostContext(body, db, cookies);

    const response = await POST(context);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("VALIDATION_ERROR");
    expect(data.error.details.tagline).toBeDefined();
    expect(data.error.details.aboutText).toBeDefined();
    expect(data.error.details.heroImage).toBeDefined();
    expect(data.error.details.whatsappNumber).toBeDefined();
  });

  it("returns 201 and creates destination on valid input", async () => {
    const db = createMockDb();
    const cookies = createMockCookies("valid-session");
    vi.mocked(validateSession).mockResolvedValue({
      id: "valid-session",
      adminId: "admin-1",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    const createdDestination = {
      id: "new-id",
      slug: "pantai-kuta",
      ...validDestinationBody,
      createdAt: "2024-01-01 00:00:00",
      updatedAt: "2024-01-01 00:00:00",
    };
    vi.mocked(createDestination).mockResolvedValue(createdDestination as any);

    const context = createPostContext(validDestinationBody, db, cookies);
    const response = await POST(context);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(createdDestination);
    expect(createDestination).toHaveBeenCalledWith(db, expect.objectContaining({
      title: validDestinationBody.title,
      tagline: validDestinationBody.tagline,
      heroImage: validDestinationBody.heroImage,
      aboutText: validDestinationBody.aboutText,
      whatsappNumber: validDestinationBody.whatsappNumber,
      status: "draft",
    }));
  });

  it("returns 400 when status is invalid", async () => {
    const db = createMockDb();
    const cookies = createMockCookies("valid-session");
    vi.mocked(validateSession).mockResolvedValue({
      id: "valid-session",
      adminId: "admin-1",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    const body = { ...validDestinationBody, status: "invalid" };
    const context = createPostContext(body, db, cookies);

    const response = await POST(context);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.details.status).toBeDefined();
  });

  it("returns 500 on database error during creation", async () => {
    const db = createMockDb();
    const cookies = createMockCookies("valid-session");
    vi.mocked(validateSession).mockResolvedValue({
      id: "valid-session",
      adminId: "admin-1",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
    vi.mocked(createDestination).mockRejectedValue(new Error("DB error"));

    const context = createPostContext(validDestinationBody, db, cookies);
    const response = await POST(context);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("INTERNAL_ERROR");
  });
});
