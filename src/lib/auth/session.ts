/**
 * Session management utilities for admin authentication.
 *
 * Sessions are stored in the D1 admin_sessions table with expiry checking.
 * Uses crypto.randomUUID() for generating session IDs.
 */

import type { Session } from "../types";

/** Default session duration: 24 hours in milliseconds */
const DEFAULT_SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

/**
 * Creates a new session for the given admin user.
 *
 * @param db - Cloudflare D1 database instance
 * @param adminId - The admin user ID to create a session for
 * @param durationMs - Session duration in milliseconds (default: 24 hours)
 * @returns The created Session object
 */
export async function createSession(
  db: D1Database,
  adminId: string,
  durationMs: number = DEFAULT_SESSION_DURATION_MS
): Promise<Session> {
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + durationMs).toISOString();

  await db
    .prepare(
      "INSERT INTO admin_sessions (id, admin_id, expires_at) VALUES (?, ?, ?)"
    )
    .bind(id, adminId, expiresAt)
    .run();

  return { id, adminId, expiresAt };
}

/**
 * Validates a session by checking if it exists and hasn't expired.
 *
 * @param db - Cloudflare D1 database instance
 * @param sessionId - The session ID to validate
 * @returns The Session object if valid, or null if invalid/expired
 */
export async function validateSession(
  db: D1Database,
  sessionId: string
): Promise<Session | null> {
  const row = await db
    .prepare("SELECT id, admin_id, expires_at FROM admin_sessions WHERE id = ?")
    .bind(sessionId)
    .first<{ id: string; admin_id: string; expires_at: string }>();

  if (!row) {
    return null;
  }

  // Check if the session has expired
  const now = new Date();
  const expiresAt = new Date(row.expires_at);

  if (now >= expiresAt) {
    // Clean up expired session
    await db
      .prepare("DELETE FROM admin_sessions WHERE id = ?")
      .bind(sessionId)
      .run();
    return null;
  }

  return {
    id: row.id,
    adminId: row.admin_id,
    expiresAt: row.expires_at,
  };
}

/**
 * Revokes (deletes) a session from the database.
 *
 * @param db - Cloudflare D1 database instance
 * @param sessionId - The session ID to revoke
 */
export async function revokeSession(
  db: D1Database,
  sessionId: string
): Promise<void> {
  await db
    .prepare("DELETE FROM admin_sessions WHERE id = ?")
    .bind(sessionId)
    .run();
}

/**
 * Cleans up all expired sessions from the database.
 * Can be called periodically to keep the sessions table clean.
 *
 * @param db - Cloudflare D1 database instance
 * @returns The number of expired sessions removed
 */
export async function cleanExpiredSessions(
  db: D1Database
): Promise<number> {
  const now = new Date().toISOString();
  const result = await db
    .prepare("DELETE FROM admin_sessions WHERE expires_at <= ?")
    .bind(now)
    .run();

  return result.meta.changes ?? 0;
}
