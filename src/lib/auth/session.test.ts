import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSession, validateSession, revokeSession, cleanExpiredSessions } from "./session";

/**
 * Creates a mock D1Database for testing.
 */
function createMockDb() {
  const mockFirst = vi.fn();
  const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 0 } });
  const mockBind = vi.fn().mockReturnValue({ first: mockFirst, run: mockRun });
  const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });

  const db = { prepare: mockPrepare } as unknown as D1Database;

  return { db, mockPrepare, mockBind, mockFirst, mockRun };
}

describe("createSession", () => {
  it("inserts a session into the database and returns a Session object", async () => {
    const { db, mockPrepare, mockBind, mockRun } = createMockDb();
    mockRun.mockResolvedValue({ meta: { changes: 1 } });

    const session = await createSession(db, "admin-123");

    expect(mockPrepare).toHaveBeenCalledWith(
      "INSERT INTO admin_sessions (id, admin_id, expires_at) VALUES (?, ?, ?)"
    );
    expect(mockBind).toHaveBeenCalledWith(
      expect.any(String),
      "admin-123",
      expect.any(String)
    );
    expect(session.id).toBeDefined();
    expect(session.adminId).toBe("admin-123");
    expect(session.expiresAt).toBeDefined();
  });

  it("generates a UUID for the session ID", async () => {
    const { db } = createMockDb();

    const session = await createSession(db, "admin-123");

    // UUID v4 format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    expect(session.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it("sets expiry to 24 hours from now by default", async () => {
    const { db } = createMockDb();
    const before = Date.now();

    const session = await createSession(db, "admin-123");

    const after = Date.now();
    const expiresAt = new Date(session.expiresAt).getTime();
    const expectedMin = before + 24 * 60 * 60 * 1000;
    const expectedMax = after + 24 * 60 * 60 * 1000;

    expect(expiresAt).toBeGreaterThanOrEqual(expectedMin);
    expect(expiresAt).toBeLessThanOrEqual(expectedMax);
  });

  it("supports custom session duration", async () => {
    const { db } = createMockDb();
    const oneHourMs = 60 * 60 * 1000;
    const before = Date.now();

    const session = await createSession(db, "admin-123", oneHourMs);

    const expiresAt = new Date(session.expiresAt).getTime();
    const expectedMin = before + oneHourMs;
    const expectedMax = Date.now() + oneHourMs;

    expect(expiresAt).toBeGreaterThanOrEqual(expectedMin);
    expect(expiresAt).toBeLessThanOrEqual(expectedMax);
  });
});

describe("validateSession", () => {
  it("returns the session when it exists and has not expired", async () => {
    const { db, mockFirst } = createMockDb();
    const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    mockFirst.mockResolvedValue({
      id: "session-abc",
      admin_id: "admin-123",
      expires_at: futureDate,
    });

    const session = await validateSession(db, "session-abc");

    expect(session).toEqual({
      id: "session-abc",
      adminId: "admin-123",
      expiresAt: futureDate,
    });
  });

  it("returns null when the session does not exist", async () => {
    const { db, mockFirst } = createMockDb();
    mockFirst.mockResolvedValue(null);

    const session = await validateSession(db, "nonexistent");

    expect(session).toBeNull();
  });

  it("returns null and deletes the session when it has expired", async () => {
    const { db, mockFirst, mockRun, mockPrepare } = createMockDb();
    const pastDate = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    mockFirst.mockResolvedValue({
      id: "session-expired",
      admin_id: "admin-123",
      expires_at: pastDate,
    });

    const session = await validateSession(db, "session-expired");

    expect(session).toBeNull();
    // Should have called DELETE to clean up the expired session
    expect(mockPrepare).toHaveBeenCalledWith(
      "DELETE FROM admin_sessions WHERE id = ?"
    );
  });
});

describe("revokeSession", () => {
  it("deletes the session from the database", async () => {
    const { db, mockPrepare, mockBind } = createMockDb();

    await revokeSession(db, "session-to-revoke");

    expect(mockPrepare).toHaveBeenCalledWith(
      "DELETE FROM admin_sessions WHERE id = ?"
    );
    expect(mockBind).toHaveBeenCalledWith("session-to-revoke");
  });
});

describe("cleanExpiredSessions", () => {
  it("deletes all expired sessions and returns the count", async () => {
    const { db, mockRun } = createMockDb();
    mockRun.mockResolvedValue({ meta: { changes: 3 } });

    const count = await cleanExpiredSessions(db);

    expect(count).toBe(3);
  });

  it("returns 0 when no sessions are expired", async () => {
    const { db, mockRun } = createMockDb();
    mockRun.mockResolvedValue({ meta: { changes: 0 } });

    const count = await cleanExpiredSessions(db);

    expect(count).toBe(0);
  });
});
