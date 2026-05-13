/**
 * Password hashing utilities using Web Crypto API (PBKDF2).
 *
 * Compatible with Cloudflare Workers runtime which supports
 * the Web Crypto API but not Node.js crypto module.
 *
 * Hash format (versioned): `pbkdf2-sha256$i=100000$<salt_hex>$<hash_hex>`
 * Hash format (legacy):    `<32-hex-salt>:<64-hex-hash>`
 */

/** Number of PBKDF2 iterations for key derivation */
const PBKDF2_ITERATIONS = 100_000;

/** Length of the derived key in bits */
const KEY_LENGTH_BITS = 256;

/** Length of the salt in bytes */
const SALT_LENGTH_BYTES = 16;

/** Hash algorithm used with PBKDF2 */
const HASH_ALGORITHM = "SHA-256";

/** Versioned hash prefix */
const VERSIONED_PREFIX = "pbkdf2-sha256";

/** Legacy hash pattern: 32-hex-salt:64-hex-hash */
const LEGACY_HASH_PATTERN = /^[0-9a-f]{32}:[0-9a-f]{64}$/;

/**
 * Converts an ArrayBuffer to a hex string.
 */
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Converts a hex string to a Uint8Array.
 */
function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Derives PBKDF2 bits from a password and salt.
 */
async function derivePbkdf2(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  return crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: HASH_ALGORITHM,
    },
    keyMaterial,
    KEY_LENGTH_BITS
  );
}

/**
 * Constant-time comparison of two hex strings.
 * Returns true if they are equal.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Hashes a password using PBKDF2 with a random salt.
 *
 * Always produces the versioned format:
 * `pbkdf2-sha256$i=100000$<salt_hex>$<hash_hex>`
 *
 * @param password - The plaintext password to hash
 * @returns A versioned hash string
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
  const derivedBits = await derivePbkdf2(password, salt, PBKDF2_ITERATIONS);

  const saltHex = bufferToHex(salt.buffer);
  const hashHex = bufferToHex(derivedBits);

  return `${VERSIONED_PREFIX}$i=${PBKDF2_ITERATIONS}$${saltHex}$${hashHex}`;
}

/**
 * Result of a password verification.
 */
export interface VerifyResult {
  /** Whether the password matched the stored hash */
  verified: boolean;
  /** Whether the hash should be rehashed using the current format */
  needsRehash: boolean;
}

/**
 * Verifies a password against a stored hash.
 *
 * Supports two formats:
 * - Versioned: `pbkdf2-sha256$i=100000$<salt_hex>$<hash_hex>`
 * - Legacy:    `<32-hex-salt>:<64-hex-hash>` (sets needsRehash: true on success)
 *
 * Uses constant-time comparison to prevent timing attacks.
 *
 * @param password - The plaintext password to verify
 * @param storedHash - The stored hash string (versioned or legacy format)
 * @returns Object with `verified` and `needsRehash` flags
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<VerifyResult> {
  // Versioned format: contains '$' separators
  if (storedHash.includes("$")) {
    return verifyVersioned(password, storedHash);
  }

  // Legacy format: 32-hex-salt:64-hex-hash
  if (LEGACY_HASH_PATTERN.test(storedHash)) {
    return verifyLegacy(password, storedHash);
  }

  // Unknown format
  return { verified: false, needsRehash: false };
}

/**
 * Verifies a password against a versioned hash string.
 * Format: `{algo}$i={iterations}${salt_hex}${hash_hex}`
 */
async function verifyVersioned(
  password: string,
  storedHash: string
): Promise<VerifyResult> {
  const parts = storedHash.split("$");
  // Expected: ["pbkdf2-sha256", "i=100000", "<salt_hex>", "<hash_hex>"]
  if (parts.length !== 4) {
    return { verified: false, needsRehash: false };
  }

  const [algo, params, saltHex, expectedHashHex] = parts;

  if (algo !== VERSIONED_PREFIX) {
    return { verified: false, needsRehash: false };
  }

  // Parse iterations from params string (e.g. "i=100000")
  const iterMatch = params.match(/^i=(\d+)$/);
  if (!iterMatch) {
    return { verified: false, needsRehash: false };
  }
  const iterations = parseInt(iterMatch[1], 10);

  if (!saltHex || !expectedHashHex) {
    return { verified: false, needsRehash: false };
  }

  const salt = hexToBuffer(saltHex);
  const derivedBits = await derivePbkdf2(password, salt, iterations);
  const actualHashHex = bufferToHex(derivedBits);

  const verified = constantTimeEqual(actualHashHex, expectedHashHex);

  // Rehash if iterations differ from current standard
  const needsRehash = verified && iterations !== PBKDF2_ITERATIONS;

  return { verified, needsRehash };
}

/**
 * Verifies a password against a legacy hash string.
 * Format: `{32-hex-salt}:{64-hex-hash}`
 * Treats as pbkdf2-sha256 with 100_000 iterations.
 */
async function verifyLegacy(
  password: string,
  storedHash: string
): Promise<VerifyResult> {
  const [saltHex, expectedHashHex] = storedHash.split(":");

  if (!saltHex || !expectedHashHex) {
    return { verified: false, needsRehash: false };
  }

  const salt = hexToBuffer(saltHex);
  const derivedBits = await derivePbkdf2(password, salt, PBKDF2_ITERATIONS);
  const actualHashHex = bufferToHex(derivedBits);

  const verified = constantTimeEqual(actualHashHex, expectedHashHex);

  // Legacy hashes always need rehash on successful verification
  return { verified, needsRehash: verified };
}
