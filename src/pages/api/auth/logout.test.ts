import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit tests for the logout API endpoint.
 *
 * Tests session revocation and cookie clearing.
 */

vi.mock("../../../lib/auth/session", () => ({
  revokeSession: vi.fn(),
}));

import { POST } from "./logout";
import { revokeSession } from "../../../lib/auth/session";

function createMockDb() {
  const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
  const mockBind = vi.fn().mockReturnValue({ run: mockRun });
  const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
  return { db: { prepare: mockPrepare } as unknown as D1Database };
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

function createContext(db: any, cookies: any) {
  return {
    request: new Request("http://localhost/api/auth/logout", {
      method: "POST",
    }),
    cookies,
    locals: { runtime: { env: { DB: db } } },
  } as any;
}

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("revokes session and clears cookie when session exists", async () => {
    const { db } = createMockDb();
    const cookies = createMockCookies("session-abc");
    const context = createContext(db, cookies);

    const response = await POST(context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(revokeSession).toHaveBeenCalledWith(db, "session-abc");
    expect(cookies.delete).toHaveBeenCalledWith("session_id", { path: "/" });
  });

  it("returns success and clears cookie even when no session exists (idempotent)", async () => {
    const { db } = createMockDb();
    const cookies = createMockCookies(); // no session
    const context = createContext(db, cookies);

    const response = await POST(context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(revokeSession).not.toHaveBeenCalled();
    expect(cookies.delete).toHaveBeenCalledWith("session_id", { path: "/" });
  });
});
