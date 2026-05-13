import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { hashPassword, verifyPassword } from "./password";

/**
 * Property 8: Password hash round-trip correctness
 * **Validates: Requirements 8.8**
 *
 * For any non-empty password string `p`:
 * - `verifyPassword(p, await hashPassword(p))` returns `{ verified: true }`
 * - `verifyPassword(p + 'x', await hashPassword(p))` returns `{ verified: false }`
 */

/**
 * Property 9: Password hash uniqueness
 * **Validates: Requirements 8.9**
 *
 * `hashPassword(p)` called twice produces two different strings (due to random salt).
 */

// --- Generators ---

/**
 * Generates non-empty password strings with a variety of characters.
 * Constrained to reasonable lengths to keep test runtime manageable
 * (PBKDF2 with 100k iterations is intentionally slow).
 */
const nonEmptyPasswordArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 64 })
  .filter((s) => s.length > 0);

// --- Property Tests ---

describe("Property 8: Password hash round-trip correctness", () => {
  it("verifyPassword(p, hashPassword(p)) returns { verified: true } for any non-empty password", async () => {
    await fc.assert(
      fc.asyncProperty(nonEmptyPasswordArb, async (password) => {
        const hash = await hashPassword(password);
        const result = await verifyPassword(password, hash);
        expect(result.verified).toBe(true);
      }),
      { numRuns: 5 }
    );
  });

  it("verifyPassword(p + 'x', hashPassword(p)) returns { verified: false } for any non-empty password", async () => {
    await fc.assert(
      fc.asyncProperty(nonEmptyPasswordArb, async (password) => {
        const hash = await hashPassword(password);
        const result = await verifyPassword(password + "x", hash);
        expect(result.verified).toBe(false);
      }),
      { numRuns: 5 }
    );
  });

  it("needsRehash is false for freshly hashed passwords (versioned format)", async () => {
    await fc.assert(
      fc.asyncProperty(nonEmptyPasswordArb, async (password) => {
        const hash = await hashPassword(password);
        const result = await verifyPassword(password, hash);
        expect(result.needsRehash).toBe(false);
      }),
      { numRuns: 5 }
    );
  });
});

describe("Property 9: Password hash uniqueness", () => {
  it("hashPassword(p) called twice produces two different strings", async () => {
    await fc.assert(
      fc.asyncProperty(nonEmptyPasswordArb, async (password) => {
        const hash1 = await hashPassword(password);
        const hash2 = await hashPassword(password);
        expect(hash1).not.toBe(hash2);
      }),
      { numRuns: 5 }
    );
  });

  it("each hash uses the versioned format with a unique salt segment", async () => {
    await fc.assert(
      fc.asyncProperty(nonEmptyPasswordArb, async (password) => {
        const hash1 = await hashPassword(password);
        const hash2 = await hashPassword(password);

        // Both should be versioned format: pbkdf2-sha256$i=100000$<salt>$<hash>
        expect(hash1).toMatch(/^pbkdf2-sha256\$i=\d+\$[0-9a-f]+\$[0-9a-f]+$/);
        expect(hash2).toMatch(/^pbkdf2-sha256\$i=\d+\$[0-9a-f]+\$[0-9a-f]+$/);

        // Salt segments (index 2) should differ
        const salt1 = hash1.split("$")[2];
        const salt2 = hash2.split("$")[2];
        expect(salt1).not.toBe(salt2);
      }),
      { numRuns: 5 }
    );
  });
});
