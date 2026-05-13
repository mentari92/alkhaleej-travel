import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";

/**
 * Property 4: Invalid credentials rejection
 * **Validates: Requirements 4.3**
 *
 * For any credential pair that does not match a stored admin user, the login
 * endpoint SHALL return an error response without creating a session.
 */

// Mock the auth modules before importing the handler
vi.mock("../../../lib/auth/session", () => ({
  createSession: vi.fn(),
}));

vi.mock("../../../lib/auth/password", () => ({
  verifyPassword: vi.fn(),
}));

import { POST } from "./login";
import { createSession } from "../../../lib/auth/session";
import { verifyPassword } from "../../../lib/auth/password";

/**
 * Creates a mock D1Database that returns no user (user not found).
 */
function createMockDbNoUser() {
  const mockFirst = vi.fn().mockResolvedValue(null);
  const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
  const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });

  return { prepare: mockPrepare } as unknown as D1Database;
}

/**
 * Creates a mock D1Database that returns a user with the given password hash.
 */
function createMockDbWithUser(user: { id: string; username: string; password_hash: string }) {
  const mockFirst = vi.fn().mockResolvedValue(user);
  const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
  const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });

  return { prepare: mockPrepare } as unknown as D1Database;
}

/**
 * Creates a mock Astro API context with the given DB and tracks cookie operations.
 */
function createMockContext(db: D1Database) {
  const cookiesSet = vi.fn();
  const cookies = { set: cookiesSet, get: vi.fn(), delete: vi.fn(), has: vi.fn() };

  return {
    request: null as unknown as Request, // will be set per-test
    cookies,
    locals: { runtime: { env: { DB: db } } },
    cookiesSet,
  };
}

describe("Property 4: Invalid credentials rejection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Generators for arbitrary credentials
  const usernameArb = fc.string({ minLength: 1, maxLength: 100 });
  const passwordArb = fc.string({ minLength: 1, maxLength: 100 });

  describe("Scenario: User not found in database", () => {
    it("returns 401 status for any username/password when user does not exist", () => {
      fc.assert(
        fc.asyncProperty(usernameArb, passwordArb, async (username, password) => {
          const db = createMockDbNoUser();
          const ctx = createMockContext(db);
          ctx.request = new Request("http://localhost/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
          });

          const response = await POST({
            request: ctx.request,
            cookies: ctx.cookies,
            locals: ctx.locals,
          } as any);

          expect(response.status).toBe(401);
        }),
        { numRuns: 50 }
      );
    });

    it("returns success: false when user does not exist", () => {
      fc.assert(
        fc.asyncProperty(usernameArb, passwordArb, async (username, password) => {
          const db = createMockDbNoUser();
          const ctx = createMockContext(db);
          ctx.request = new Request("http://localhost/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
          });

          const response = await POST({
            request: ctx.request,
            cookies: ctx.cookies,
            locals: ctx.locals,
          } as any);

          const body = await response.json();
          expect(body.success).toBe(false);
          expect(body.error.code).toBe("INVALID_CREDENTIALS");
        }),
        { numRuns: 50 }
      );
    });

    it("does not set a session cookie when user does not exist", () => {
      fc.assert(
        fc.asyncProperty(usernameArb, passwordArb, async (username, password) => {
          const db = createMockDbNoUser();
          const ctx = createMockContext(db);
          ctx.request = new Request("http://localhost/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
          });

          await POST({
            request: ctx.request,
            cookies: ctx.cookies,
            locals: ctx.locals,
          } as any);

          expect(ctx.cookiesSet).not.toHaveBeenCalled();
        }),
        { numRuns: 50 }
      );
    });

    it("does not create a session when user does not exist", () => {
      fc.assert(
        fc.asyncProperty(usernameArb, passwordArb, async (username, password) => {
          const db = createMockDbNoUser();
          const ctx = createMockContext(db);
          ctx.request = new Request("http://localhost/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
          });

          await POST({
            request: ctx.request,
            cookies: ctx.cookies,
            locals: ctx.locals,
          } as any);

          expect(createSession).not.toHaveBeenCalled();
        }),
        { numRuns: 50 }
      );
    });
  });

  describe("Scenario: User exists but password does not match", () => {
    const existingUser = {
      id: "admin-001",
      username: "admin",
      password_hash: "somesalt:somehash",
    };

    beforeEach(() => {
      vi.mocked(verifyPassword).mockResolvedValue({ verified: false, needsRehash: false });
    });

    it("returns 401 status when password verification fails", () => {
      fc.assert(
        fc.asyncProperty(passwordArb, async (password) => {
          const db = createMockDbWithUser(existingUser);
          const ctx = createMockContext(db);
          ctx.request = new Request("http://localhost/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: existingUser.username, password }),
          });

          const response = await POST({
            request: ctx.request,
            cookies: ctx.cookies,
            locals: ctx.locals,
          } as any);

          expect(response.status).toBe(401);
        }),
        { numRuns: 50 }
      );
    });

    it("returns success: false with INVALID_CREDENTIALS error when password is wrong", () => {
      fc.assert(
        fc.asyncProperty(passwordArb, async (password) => {
          const db = createMockDbWithUser(existingUser);
          const ctx = createMockContext(db);
          ctx.request = new Request("http://localhost/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: existingUser.username, password }),
          });

          const response = await POST({
            request: ctx.request,
            cookies: ctx.cookies,
            locals: ctx.locals,
          } as any);

          const body = await response.json();
          expect(body.success).toBe(false);
          expect(body.error.code).toBe("INVALID_CREDENTIALS");
          expect(body.error.message).toBe("Invalid credentials");
        }),
        { numRuns: 50 }
      );
    });

    it("does not set a session cookie when password is wrong", () => {
      fc.assert(
        fc.asyncProperty(passwordArb, async (password) => {
          const db = createMockDbWithUser(existingUser);
          const ctx = createMockContext(db);
          ctx.request = new Request("http://localhost/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: existingUser.username, password }),
          });

          await POST({
            request: ctx.request,
            cookies: ctx.cookies,
            locals: ctx.locals,
          } as any);

          expect(ctx.cookiesSet).not.toHaveBeenCalled();
        }),
        { numRuns: 50 }
      );
    });

    it("does not create a session when password is wrong", () => {
      fc.assert(
        fc.asyncProperty(passwordArb, async (password) => {
          const db = createMockDbWithUser(existingUser);
          const ctx = createMockContext(db);
          ctx.request = new Request("http://localhost/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: existingUser.username, password }),
          });

          await POST({
            request: ctx.request,
            cookies: ctx.cookies,
            locals: ctx.locals,
          } as any);

          expect(createSession).not.toHaveBeenCalled();
        }),
        { numRuns: 50 }
      );
    });
  });
});
