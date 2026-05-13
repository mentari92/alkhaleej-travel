import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit tests for the destinations [id] API endpoint (GET, PUT, DELETE).
 */

vi.mock("../../../lib/auth/session", () => ({
  validateSession: vi.fn(),
}));

vi.mock("../../../lib/db/destinations", () => ({
  getDestinationById: vi.fn(),
  updateDestination: vi.fn(),
  deleteDestination: vi.fn(),
}));

import { GET, PUT, DELETE } from "./[id]";
import { validateSession } from "../../../lib/auth/session";
import {
  getDestinationById,
  updateDestination,
  deleteDestination,
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

const mockDestination = {
  id: "dest-1",
  slug: "pantai-kuta",
  title: { id: "Pantai Kuta", en: "Kuta Beach" },
  tagline: { id: "Pantai terindah", en: "Most beautiful beach" },
  heroImage: "https://example.com/hero.jpg",
  aboutText: { id: "Tentang", en: "About" },
  galleryImages: [],
  services: [],
  testimonials: [],
  faqEntries: [],
  whatsappNumber: "+6281234567890",
  status: "published" as const,
  createdAt: "2024-01-01 00:00:00",
  updatedAt: "2024-01-01 00:00:00",
};

describe("GET /api/destinations/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when id param is missing", async () => {
    const db = createMockDb();
    const context = {
      params: {},
      locals: { runtime: { env: { DB: db } } },
    } as any;

    const response = await GET(context);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("MISSING_ID");
  });

  it("returns 404 when destination not found", async () => {
    const db = createMockDb();
    vi.mocked(getDestinationById).mockResolvedValue(null);

    const context = {
      params: { id: "nonexistent" },
      locals: { runtime: { env: { DB: db } } },
    } as any;

    const response = await GET(context);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("NOT_FOUND");
  });

  it("returns 200 with destination data", async () => {
    const db = createMockDb();
    vi.mocked(getDestinationById).mockResolvedValue(mockDestination);

    const context = {
      params: { id: "dest-1" },
      locals: { runtime: { env: { DB: db } } },
    } as any;

    const response = await GET(context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(mockDestination);
  });

  it("returns 500 on database error", async () => {
    const db = createMockDb();
    vi.mocked(getDestinationById).mockRejectedValue(new Error("DB error"));

    const context = {
      params: { id: "dest-1" },
      locals: { runtime: { env: { DB: db } } },
    } as any;

    const response = await GET(context);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("INTERNAL_ERROR");
  });
});

describe("PUT /api/destinations/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no session cookie", async () => {
    const db = createMockDb();
    const cookies = createMockCookies();
    const context = {
      params: { id: "dest-1" },
      request: new Request("http://localhost/api/destinations/dest-1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: { id: "New", en: "New" } }),
      }),
      cookies,
      locals: { runtime: { env: { DB: db } } },
    } as any;

    const response = await PUT(context);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 when session is invalid", async () => {
    const db = createMockDb();
    const cookies = createMockCookies("invalid-session");
    vi.mocked(validateSession).mockResolvedValue(null);

    const context = {
      params: { id: "dest-1" },
      request: new Request("http://localhost/api/destinations/dest-1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: { id: "New", en: "New" } }),
      }),
      cookies,
      locals: { runtime: { env: { DB: db } } },
    } as any;

    const response = await PUT(context);
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
      params: { id: "dest-1" },
      request: new Request("http://localhost/api/destinations/dest-1", {
        method: "PUT",
        body: "not json",
      }),
      cookies,
      locals: { runtime: { env: { DB: db } } },
    } as any;

    const response = await PUT(context);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("INVALID_BODY");
  });

  it("returns 400 when bilingual field has only one language", async () => {
    const db = createMockDb();
    const cookies = createMockCookies("valid-session");
    vi.mocked(validateSession).mockResolvedValue({
      id: "valid-session",
      adminId: "admin-1",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    const context = {
      params: { id: "dest-1" },
      request: new Request("http://localhost/api/destinations/dest-1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: { id: "Only ID" } }),
      }),
      cookies,
      locals: { runtime: { env: { DB: db } } },
    } as any;

    const response = await PUT(context);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("VALIDATION_ERROR");
    expect(data.error.details.title).toBeDefined();
  });

  it("returns 404 when destination does not exist", async () => {
    const db = createMockDb();
    const cookies = createMockCookies("valid-session");
    vi.mocked(validateSession).mockResolvedValue({
      id: "valid-session",
      adminId: "admin-1",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
    vi.mocked(getDestinationById).mockResolvedValue(null);

    const context = {
      params: { id: "nonexistent" },
      request: new Request("http://localhost/api/destinations/nonexistent", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: { id: "New", en: "New" } }),
      }),
      cookies,
      locals: { runtime: { env: { DB: db } } },
    } as any;

    const response = await PUT(context);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("NOT_FOUND");
  });

  it("returns 200 and updates destination on valid input", async () => {
    const db = createMockDb();
    const cookies = createMockCookies("valid-session");
    vi.mocked(validateSession).mockResolvedValue({
      id: "valid-session",
      adminId: "admin-1",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
    vi.mocked(getDestinationById).mockResolvedValue(mockDestination);

    const updatedDestination = {
      ...mockDestination,
      title: { id: "Pantai Baru", en: "New Beach" },
    };
    vi.mocked(updateDestination).mockResolvedValue(updatedDestination);

    const context = {
      params: { id: "dest-1" },
      request: new Request("http://localhost/api/destinations/dest-1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: { id: "Pantai Baru", en: "New Beach" } }),
      }),
      cookies,
      locals: { runtime: { env: { DB: db } } },
    } as any;

    const response = await PUT(context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.title).toEqual({ id: "Pantai Baru", en: "New Beach" });
    expect(updateDestination).toHaveBeenCalledWith(db, "dest-1", {
      title: { id: "Pantai Baru", en: "New Beach" },
    });
  });

  it("returns 400 when status is invalid", async () => {
    const db = createMockDb();
    const cookies = createMockCookies("valid-session");
    vi.mocked(validateSession).mockResolvedValue({
      id: "valid-session",
      adminId: "admin-1",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    const context = {
      params: { id: "dest-1" },
      request: new Request("http://localhost/api/destinations/dest-1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "invalid" }),
      }),
      cookies,
      locals: { runtime: { env: { DB: db } } },
    } as any;

    const response = await PUT(context);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.details.status).toBeDefined();
  });
});

describe("DELETE /api/destinations/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no session cookie", async () => {
    const db = createMockDb();
    const cookies = createMockCookies();
    const context = {
      params: { id: "dest-1" },
      cookies,
      locals: { runtime: { env: { DB: db } } },
    } as any;

    const response = await DELETE(context);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 when session is invalid", async () => {
    const db = createMockDb();
    const cookies = createMockCookies("invalid-session");
    vi.mocked(validateSession).mockResolvedValue(null);

    const context = {
      params: { id: "dest-1" },
      cookies,
      locals: { runtime: { env: { DB: db } } },
    } as any;

    const response = await DELETE(context);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 404 when destination does not exist", async () => {
    const db = createMockDb();
    const cookies = createMockCookies("valid-session");
    vi.mocked(validateSession).mockResolvedValue({
      id: "valid-session",
      adminId: "admin-1",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
    vi.mocked(getDestinationById).mockResolvedValue(null);

    const context = {
      params: { id: "nonexistent" },
      cookies,
      locals: { runtime: { env: { DB: db } } },
    } as any;

    const response = await DELETE(context);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("NOT_FOUND");
  });

  it("returns 200 and deletes destination", async () => {
    const db = createMockDb();
    const cookies = createMockCookies("valid-session");
    vi.mocked(validateSession).mockResolvedValue({
      id: "valid-session",
      adminId: "admin-1",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
    vi.mocked(getDestinationById).mockResolvedValue(mockDestination);
    vi.mocked(deleteDestination).mockResolvedValue(undefined);

    const context = {
      params: { id: "dest-1" },
      cookies,
      locals: { runtime: { env: { DB: db } } },
    } as any;

    const response = await DELETE(context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual({ id: "dest-1" });
    expect(deleteDestination).toHaveBeenCalledWith(db, "dest-1");
  });

  it("returns 500 on database error during deletion", async () => {
    const db = createMockDb();
    const cookies = createMockCookies("valid-session");
    vi.mocked(validateSession).mockResolvedValue({
      id: "valid-session",
      adminId: "admin-1",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
    vi.mocked(getDestinationById).mockResolvedValue(mockDestination);
    vi.mocked(deleteDestination).mockRejectedValue(new Error("DB error"));

    const context = {
      params: { id: "dest-1" },
      cookies,
      locals: { runtime: { env: { DB: db } } },
    } as any;

    const response = await DELETE(context);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("INTERNAL_ERROR");
  });
});
