/**
 * Login rate limiter backed by the D1 `login_attempts` table.
 *
 * Tracks failed login attempts per IP address within a sliding time window.
 * After `maxAttempts` failures within `windowMs`, the IP is locked out for
 * `lockoutMs` milliseconds.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.8
 */

/** Configuration for the rate limiter. */
export interface RateLimiterConfig {
  /** Maximum number of failed attempts before lockout. Default: 5 */
  maxAttempts: number;
  /** Sliding window duration in milliseconds. Default: 15 minutes */
  windowMs: number;
  /** Lockout duration in milliseconds after threshold is reached. Default: 1 hour */
  lockoutMs: number;
}

/** Default rate limiter configuration. */
const DEFAULT_CONFIG: RateLimiterConfig = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,   // 15 minutes
  lockoutMs: 60 * 60 * 1000,  // 1 hour
};

/** Result returned by `isLockedOut`. */
export interface LockoutResult {
  /** Whether the IP is currently locked out. */
  locked: boolean;
  /** Seconds until the lockout expires. 0 when not locked. */
  retryAfterSeconds: number;
}

/**
 * Extracts the client IP address from the request headers.
 *
 * Priority order:
 * 1. `CF-Connecting-IP` (set by Cloudflare for real client IP)
 * 2. First token of `X-Forwarded-For` (proxy chain)
 * 3. `"unknown"` as a final fallback
 *
 * @param request - The incoming HTTP request
 * @returns The client IP string
 */
export function extractClientIP(request: Request): string {
  // Cloudflare sets this header to the real client IP
  const cfConnectingIP = request.headers.get("CF-Connecting-IP");
  if (cfConnectingIP && cfConnectingIP.trim()) {
    return cfConnectingIP.trim();
  }

  // X-Forwarded-For may contain a comma-separated list; take the first entry
  const xForwardedFor = request.headers.get("X-Forwarded-For");
  if (xForwardedFor && xForwardedFor.trim()) {
    const firstToken = xForwardedFor.split(",")[0].trim();
    if (firstToken) {
      return firstToken;
    }
  }

  return "unknown";
}

/**
 * Checks whether the given IP is currently locked out.
 *
 * Algorithm:
 * 1. Query the count and most-recent attempt timestamp within the window.
 * 2. If count >= maxAttempts, compute remaining lockout time from the last attempt.
 *    If the computed remaining time is positive, the IP is locked.
 * 3. Otherwise the IP is not locked.
 *
 * @param db - Cloudflare D1 database instance
 * @param ip - The client IP address
 * @param config - Optional rate limiter configuration (uses defaults if omitted)
 * @returns Lockout status and retry-after seconds
 */
export async function isLockedOut(
  db: D1Database,
  ip: string,
  config?: Partial<RateLimiterConfig>
): Promise<LockoutResult> {
  const cfg: RateLimiterConfig = { ...DEFAULT_CONFIG, ...config };

  // Convert windowMs to minutes for the SQLite datetime modifier
  const windowMinutes = Math.floor(cfg.windowMs / 60_000);

  const row = await db
    .prepare(
      `SELECT COUNT(*) as cnt, MAX(attempted_at) as last
       FROM login_attempts
       WHERE ip = ? AND attempted_at > datetime('now', '-${windowMinutes} minutes')`
    )
    .bind(ip)
    .first<{ cnt: number; last: string | null }>();

  const cnt = row?.cnt ?? 0;
  const last = row?.last ?? null;

  if (cnt >= cfg.maxAttempts && last !== null) {
    // Compute how many seconds remain in the lockout period
    const lastMs = new Date(last + "Z").getTime(); // SQLite datetime is UTC, add Z
    const nowMs = Date.now();
    const elapsedSeconds = (nowMs - lastMs) / 1000;
    const retryAfterSeconds = Math.ceil(cfg.lockoutMs / 1000 - elapsedSeconds);

    if (retryAfterSeconds > 0) {
      return { locked: true, retryAfterSeconds };
    }
  }

  return { locked: false, retryAfterSeconds: 0 };
}

/**
 * Records a failed login attempt for the given IP address.
 *
 * Inserts a new row into `login_attempts` with the current UTC timestamp.
 *
 * @param db - Cloudflare D1 database instance
 * @param ip - The client IP address
 */
export async function recordFailedAttempt(
  db: D1Database,
  ip: string
): Promise<void> {
  const id = crypto.randomUUID();

  await db
    .prepare(
      "INSERT INTO login_attempts (id, ip, attempted_at) VALUES (?, ?, datetime('now'))"
    )
    .bind(id, ip)
    .run();
}

/**
 * Resets (clears) all failed login attempts for the given IP address.
 *
 * Called after a successful login to allow the IP to attempt again
 * without carrying over previous failure counts.
 *
 * @param db - Cloudflare D1 database instance
 * @param ip - The client IP address
 */
export async function resetAttempts(
  db: D1Database,
  ip: string
): Promise<void> {
  await db
    .prepare("DELETE FROM login_attempts WHERE ip = ?")
    .bind(ip)
    .run();
}
