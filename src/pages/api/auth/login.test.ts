import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit tests for the login API endpoint.
 *
 * Tests credential validation, session creation, and error handling.
 */

// Mock the auth modules
vi.mock("../../../lib/auth/session", () => ({
  createSession: vi.fn(),
}));

vi.mock("../../../lib/auth/password", () => ({
  verifyPassword: vi.fn(),
}));

import { POST } from "./login";
import { createSession } from "../../../lib/auth/session";
import { verifyPassword } from "../../../lib/auth/password";

function createMockDb() {
  const mockFirst = vi.fn();
  const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
  const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
  return { db: { prepare: mockPrepare } as unknown as D1Database, mockFirst };
}

function createMockCookies() {
  const cookies = new Map<string, { value: string; options: any }>();
  return {
    get: vi.fn((name: string) => {
      const entry = cookies.get(name);
      return entry ? { value: entry.value } : undefined;
    }),
    set: vi.fn((name: string, value: string, options: any) => {
      cookies.set(name, { value, options });
    }),
    delete: vi.fn(),
  };
}

function createContext(body: any, db: any, cookies: any) {
  return {
    request: new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    cookies,
    locals: { runtime: { env: { DB: db } } },
  } as any;
}

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when request body is not valid JSON", async () => {
    const { db } = createMockDb();
    const cookies = createMockCookies();
    const context = {
      request: new Request("http://localhost/api/auth/login", {
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

  it("returns 400 when username is missing", async () => {
    const { db } = createMockDb();
    const cookies = createMockCookies();
    const context = createContext({ password: "pass123" }, db, cookies);

    const response = await POST(context);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("MISSING_FIELDS");
    expect(data.error.details.username).toBeDefined();
  });

  it("returns 400 when password is missing", async () => {
    const { db } = createMockDb();
    const cookies = createMockCookies();
    const context = createContext({ username: "admin" }, db, cookies);

    const response = await POST(context);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("MISSING_FIELDS");
    expect(data.error.details.password).toBeDefined();
  });

  it("returns 400 when both username and password are missing", async () => {
    const { db } = createMockDb();
    const cookies = createMockCookies();
    const context = createContext({}, db, cookies);

    const response = await POST(context);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("MISSING_FIELDS");
  });

  it("returns 401 when user is not found", async () => {
    const { db, mockFirst } = createMockDb();
    mockFirst.mockResolvedValue(null);
    const cookies = createMockCookies();
    const context = createContext({ username: "unknown", password: "pass123" }, db, cookies);

    const response = await POST(context);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("INVALID_CREDENTIALS");
    expect(data.error.message).toBe("Invalid credentials");
  });

  it("returns 401 when password is incorrect", async () => {
    const { db, mockFirst } = createMockDb();
    mockFirst.mockResolvedValue({
      id: "admin-1",
      username: "admin",
      password_hash: "salt:hash",
    });
    vi.mocked(verifyPassword).mockResolvedValue({ verified: false, needsRehash: false });
    const cookies = createMockCookies();
    const context = createContext({ username: "admin", password: "wrong" }, db, cookies);

    const response = await POST(context);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("INVALID_CREDENTIALS");
    expect(data.error.message).toBe("Invalid credentials");
  });

  it("returns 200 and sets session cookie on valid credentials", async () => {
    const { db, mockFirst } = createMockDb();
    mockFirst.mockResolvedValue({
      id: "admin-1",
      username: "admin",
      password_hash: "salt:hash",
    });
    vi.mocked(verifyPassword).mockResolvedValue({ verified: true, needsRehash: false });
    vi.mocked(createSession).mockResolvedValue({
      id: "session-123",
      adminId: "admin-1",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
    const cookies = createMockCookies();
    const context = createContext({ username: "admin", password: "correct" }, db, cookies);

    const response = await POST(context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(cookies.set).toHaveBeenCalledWith(
      "session_id",
      "session-123",
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        path: "/",
      })
    );
  });

  it("creates session with the correct admin ID", async () => {
    const { db, mockFirst } = createMockDb();
    mockFirst.mockResolvedValue({
      id: "admin-42",
      username: "admin",
      password_hash: "salt:hash",
    });
    vi.mocked(verifyPassword).mockResolvedValue({ verified: true, needsRehash: false });
    vi.mocked(createSession).mockResolvedValue({
      id: "session-456",
      adminId: "admin-42",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
    const cookies = createMockCookies();
    const context = createContext({ username: "admin", password: "correct" }, db, cookies);

    await POST(context);

    expect(createSession).toHaveBeenCalledWith(db, "admin-42");
  });
});
