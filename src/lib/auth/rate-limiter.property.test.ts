import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  isLockedOut,
  recordFailedAttempt,
  resetAttempts,
  type RateLimiterConfig,
} from "./rate-limiter";

/**
 * Property 10: Rate limiter threshold
 * **Validates: Requirements 9.3, 9.9**
 *
 * For any IP address string `ip` with a clean state (no prior attempts),
 * calling `recordFailedAttempt(db, ip)` exactly 5 times within the 15-minute
 * window must make `isLockedOut(db, ip)` return `{ locked: true }`.
 * Calling it exactly 4 times must make `isLockedOut(db, ip)` return `{ locked: false }`.
 *
 * Property 11: Rate limiter reset
 * **Validates: Requirements 9.10**
 *
 * For any IP address string `ip` that is currently locked out,
 * calling `resetAttempts(db, ip)` must make `isLockedOut(db, ip)` return `{ locked: false }`.
 */

// ---------------------------------------------------------------------------
// In-memory D1 mock
// ---------------------------------------------------------------------------

/**
 * Represents a single row in the `login_attempts` table.
 */
interface LoginAttemptRow {
  id: string;
  ip: string;
  attempted_at: string; // ISO-like datetime string (UTC, no Z suffix — matches SQLite format)
}

/**
 * Creates an in-memory mock of the D1Database that simulates the
 * `login_attempts` table behaviour used by the rate limiter.
 *
 * The mock supports:
 * - `SELECT COUNT(*) as cnt, MAX(attempted_at) as last FROM login_attempts WHERE ip = ? AND attempted_at > datetime('now', '-N minutes')`
 * - `INSERT INTO login_attempts (id, ip, attempted_at) VALUES (?, ?, datetime('now'))`
 * - `DELETE FROM login_attempts WHERE ip = ?`
 *
 * All timestamps are stored as UTC strings in the format `YYYY-MM-DD HH:MM:SS`
 * (matching SQLite's `datetime('now')` output) so that the rate-limiter's
 * `new Date(last + "Z")` parsing works correctly.
 */
function createMockD1(): D1Database {
  const rows: LoginAttemptRow[] = [];

  /** Returns current UTC time as a SQLite-compatible datetime string. */
  function nowSqlite(): string {
    return new Date().toISOString().replace("T", " ").slice(0, 19);
  }

  /**
   * Parses the window modifier from a query like:
   *   `datetime('now', '-15 minutes')`
   * Returns the number of minutes as a positive integer.
   */
  function parseWindowMinutes(sql: string): number {
    const match = sql.match(/-(\d+)\s+minutes/i);
    return match ? parseInt(match[1], 10) : 15;
  }

  /**
   * Minimal statement builder that handles the three SQL patterns used by
   * the rate limiter.
   */
  function buildStatement(sql: string, bindings: unknown[]): D1PreparedStatement {
    const trimmed = sql.trim().toUpperCase();

    return {
      bind(...args: unknown[]) {
        return buildStatement(sql, args);
      },

      async first<T = Record<string, unknown>>(): Promise<T | null> {
        if (trimmed.startsWith("SELECT COUNT(*)")) {
          const ip = bindings[0] as string;
          const windowMinutes = parseWindowMinutes(sql);
          const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);

          const matching = rows.filter((r) => {
            if (r.ip !== ip) return false;
            const rowTime = new Date(r.attempted_at + "Z");
            return rowTime > cutoff;
          });

          const cnt = matching.length;
          const last =
            cnt > 0
              ? matching.reduce((max, r) =>
                  r.attempted_at > max.attempted_at ? r : max
                ).attempted_at
              : null;

          return { cnt, last } as unknown as T;
        }
        return null;
      },

      async run(): Promise<D1Result> {
        if (trimmed.startsWith("INSERT INTO LOGIN_ATTEMPTS")) {
          const [id, ip] = bindings as [string, string];
          rows.push({ id, ip, attempted_at: nowSqlite() });
        } else if (trimmed.startsWith("DELETE FROM LOGIN_ATTEMPTS")) {
          const ip = bindings[0] as string;
          const before = rows.length;
          let i = rows.length - 1;
          while (i >= 0) {
            if (rows[i].ip === ip) rows.splice(i, 1);
            i--;
          }
          const after = rows.length;
          return {
            success: true,
            meta: {
              changes: before - after,
              last_row_id: 0,
              changed_db: true,
              size_after: after,
              rows_read: before,
              rows_written: before - after,
              duration: 0,
            },
            results: [],
          } as D1Result;
        }
        return {
          success: true,
          meta: {
            changes: 1,
            last_row_id: rows.length,
            changed_db: true,
            size_after: rows.length,
            rows_read: 0,
            rows_written: 1,
            duration: 0,
          },
          results: [],
        } as D1Result;
      },

      async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
        return {
          success: true,
          meta: {
            changes: 0,
            last_row_id: 0,
            changed_db: false,
            size_after: rows.length,
            rows_read: rows.length,
            rows_written: 0,
            duration: 0,
          },
          results: [] as T[],
        };
      },

      async raw<T = unknown[]>(): Promise<T[]> {
        return [] as T[];
      },
    } as unknown as D1PreparedStatement;
  }

  return {
    prepare(sql: string) {
      return buildStatement(sql, []);
    },
    // The following methods are part of the D1Database interface but are not
    // used by the rate limiter — provide minimal stubs to satisfy the type.
    async batch<T = Record<string, unknown>>(
      _statements: D1PreparedStatement[]
    ): Promise<D1Result<T>[]> {
      return [];
    },
    async dump(): Promise<ArrayBuffer> {
      return new ArrayBuffer(0);
    },
    async exec(_query: string): Promise<D1ExecResult> {
      return { count: 0, duration: 0 };
    },
  } as unknown as D1Database;
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/**
 * Generates valid-looking IPv4 address strings.
 * Using fc.ipV4() directly to match the design's recommended generator.
 */
const ipV4Arb: fc.Arbitrary<string> = fc.ipV4();

/**
 * Generates valid-looking IPv6 address strings.
 */
const ipV6Arb: fc.Arbitrary<string> = fc.ipV6();

/**
 * Combines IPv4 and IPv6 generators.
 */
const ipArb: fc.Arbitrary<string> = fc.oneof(ipV4Arb, ipV6Arb);

/**
 * A tight config that keeps the lockout window very short so tests don't
 * need to manipulate real time. The window is 15 minutes (default) and
 * lockout is 1 hour (default) — we use the defaults to test real behaviour.
 */
const testConfig: RateLimiterConfig = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
  lockoutMs: 60 * 60 * 1000,
};

// ---------------------------------------------------------------------------
// Property 10: Rate limiter threshold
// ---------------------------------------------------------------------------

describe("Property 10: Rate limiter threshold", () => {
  it(
    "5 recordFailedAttempt calls → isLockedOut returns { locked: true }",
    async () => {
      await fc.assert(
        fc.asyncProperty(ipArb, async (ip) => {
          const db = createMockD1();

          // Record exactly 5 failed attempts
          for (let i = 0; i < 5; i++) {
            await recordFailedAttempt(db, ip);
          }

          const result = await isLockedOut(db, ip, testConfig);
          expect(result.locked).toBe(true);
          expect(result.retryAfterSeconds).toBeGreaterThan(0);
        }),
        { numRuns: 50 }
      );
    }
  );

  it(
    "4 recordFailedAttempt calls → isLockedOut returns { locked: false }",
    async () => {
      await fc.assert(
        fc.asyncProperty(ipArb, async (ip) => {
          const db = createMockD1();

          // Record exactly 4 failed attempts (one below threshold)
          for (let i = 0; i < 4; i++) {
            await recordFailedAttempt(db, ip);
          }

          const result = await isLockedOut(db, ip, testConfig);
          expect(result.locked).toBe(false);
          expect(result.retryAfterSeconds).toBe(0);
        }),
        { numRuns: 50 }
      );
    }
  );

  it(
    "attempts for one IP do not affect lockout status of a different IP",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          ipV4Arb,
          ipV4Arb,
          async (ip1, ip2) => {
            // Ensure the two IPs are distinct
            fc.pre(ip1 !== ip2);

            const db = createMockD1();

            // Lock out ip1
            for (let i = 0; i < 5; i++) {
              await recordFailedAttempt(db, ip1);
            }

            // ip2 should remain unlocked
            const result = await isLockedOut(db, ip2, testConfig);
            expect(result.locked).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// Property 11: Rate limiter reset
// ---------------------------------------------------------------------------

describe("Property 11: Rate limiter reset", () => {
  it(
    "resetAttempts on a locked IP makes isLockedOut return { locked: false }",
    async () => {
      await fc.assert(
        fc.asyncProperty(ipArb, async (ip) => {
          const db = createMockD1();

          // First lock the IP
          for (let i = 0; i < 5; i++) {
            await recordFailedAttempt(db, ip);
          }

          // Confirm it is locked
          const lockedResult = await isLockedOut(db, ip, testConfig);
          expect(lockedResult.locked).toBe(true);

          // Reset and verify it is no longer locked
          await resetAttempts(db, ip);
          const afterReset = await isLockedOut(db, ip, testConfig);
          expect(afterReset.locked).toBe(false);
          expect(afterReset.retryAfterSeconds).toBe(0);
        }),
        { numRuns: 50 }
      );
    }
  );

  it(
    "resetAttempts on a clean IP (no attempts) keeps isLockedOut as { locked: false }",
    async () => {
      await fc.assert(
        fc.asyncProperty(ipArb, async (ip) => {
          const db = createMockD1();

          // Reset with no prior attempts — should be a no-op
          await resetAttempts(db, ip);
          const result = await isLockedOut(db, ip, testConfig);
          expect(result.locked).toBe(false);
        }),
        { numRuns: 50 }
      );
    }
  );

  it(
    "resetAttempts only clears attempts for the target IP, not others",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          ipV4Arb,
          ipV4Arb,
          async (ip1, ip2) => {
            fc.pre(ip1 !== ip2);

            const db = createMockD1();

            // Lock both IPs
            for (let i = 0; i < 5; i++) {
              await recordFailedAttempt(db, ip1);
              await recordFailedAttempt(db, ip2);
            }

            // Reset only ip1
            await resetAttempts(db, ip1);

            // ip1 should be unlocked
            const ip1Result = await isLockedOut(db, ip1, testConfig);
            expect(ip1Result.locked).toBe(false);

            // ip2 should still be locked
            const ip2Result = await isLockedOut(db, ip2, testConfig);
            expect(ip2Result.locked).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    }
  );
});
