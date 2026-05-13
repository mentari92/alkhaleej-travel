import type { APIRoute } from "astro";
import { createSession } from "../../../lib/auth/session";
import { verifyPassword, hashPassword } from "../../../lib/auth/password";
import { getDB } from "../../../lib/db/connection";
import {
  extractClientIP,
  isLockedOut,
  recordFailedAttempt,
  resetAttempts,
} from "../../../lib/auth/rate-limiter";

/**
 * Dummy hash used for timing-attack prevention when a user is not found.
 * Running verifyPassword against this hash ensures the response time for
 * "user not found" is in the same order of magnitude as "password mismatch".
 */
const DUMMY_HASH =
  "pbkdf2-sha256$i=100000$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000";

async function dummyVerify() {
  await verifyPassword("dummy", DUMMY_HASH);
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const db = getDB();

  // --- Rate limiting (Requirements 9.1, 9.3, 9.4) ---
  const clientIP = extractClientIP(request);
  const lockout = await isLockedOut(db, clientIP);

  if (lockout.locked) {
    const retryAfterSeconds = lockout.retryAfterSeconds;
    const mins = Math.ceil(retryAfterSeconds / 60);
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: `Terlalu banyak percobaan. Coba lagi dalam ${mins} menit.`,
        },
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfterSeconds),
        },
      }
    );
  }

  // Parse request body
  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "INVALID_BODY",
          message: "Request body must be valid JSON",
        },
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { username, password } = body;

  // Validate required fields
  if (!username || !password) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "MISSING_FIELDS",
          message: "Username and password are required",
          details: {
            ...(!username && { username: ["Username is required"] }),
            ...(!password && { password: ["Password is required"] }),
          },
        },
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Look up user by username
  const user = await db
    .prepare("SELECT id, username, password_hash FROM admin_users WHERE username = ?")
    .bind(username)
    .first<{ id: string; username: string; password_hash: string }>();

  if (!user) {
    // Perform dummy verify to prevent timing attacks (Requirement 9.7)
    await dummyVerify();
    // Record failed attempt for rate limiting (Requirement 9.6)
    await recordFailedAttempt(db, clientIP);
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid credentials",
        },
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // Verify password
  const { verified, needsRehash } = await verifyPassword(password, user.password_hash);

  if (!verified) {
    // Record failed attempt for rate limiting (Requirement 9.6)
    await recordFailedAttempt(db, clientIP);
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid credentials",
        },
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // Reset rate limit counter on successful login (Requirement 9.5)
  await resetAttempts(db, clientIP);

  // Rehash legacy passwords on successful login (Requirement 8.6)
  if (needsRehash) {
    const newHash = await hashPassword(password);
    await db
      .prepare("UPDATE admin_users SET password_hash = ? WHERE id = ?")
      .bind(newHash, user.id)
      .run();
  }

  // Create session
  const session = await createSession(db, user.id);

  // Set session cookie
  cookies.set("session_id", session.id, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    expires: new Date(session.expiresAt),
  });

  return new Response(
    JSON.stringify({
      success: true,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
