import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("hashPassword", () => {
  it("returns a string in the versioned format pbkdf2-sha256$i=100000$salt$hash", async () => {
    const result = await hashPassword("mypassword");

    expect(result).toMatch(/^pbkdf2-sha256\$i=100000\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
  });

  it("produces different hashes for the same password (random salt)", async () => {
    const hash1 = await hashPassword("samepassword");
    const hash2 = await hashPassword("samepassword");

    expect(hash1).not.toBe(hash2);
  });

  it("produces only hex characters in salt and hash parts", async () => {
    const result = await hashPassword("testpass");
    const parts = result.split("$");
    // parts: ["pbkdf2-sha256", "i=100000", "<salt_hex>", "<hash_hex>"]
    expect(parts).toHaveLength(4);
    expect(parts[2]).toMatch(/^[0-9a-f]+$/);
    expect(parts[3]).toMatch(/^[0-9a-f]+$/);
    // Salt is 16 bytes = 32 hex chars
    expect(parts[2]!.length).toBe(32);
    // Hash is 256 bits = 32 bytes = 64 hex chars
    expect(parts[3]!.length).toBe(64);
  });
});

describe("verifyPassword — versioned format", () => {
  it("returns { verified: true, needsRehash: false } for a correct password", async () => {
    const storedHash = await hashPassword("correctpassword");
    const result = await verifyPassword("correctpassword", storedHash);

    expect(result.verified).toBe(true);
    expect(result.needsRehash).toBe(false);
  });

  it("returns { verified: false } for an incorrect password", async () => {
    const storedHash = await hashPassword("correctpassword");
    const result = await verifyPassword("wrongpassword", storedHash);

    expect(result.verified).toBe(false);
  });

  it("returns { verified: false } for an empty password against a valid hash", async () => {
    const storedHash = await hashPassword("realpassword");
    const result = await verifyPassword("", storedHash);

    expect(result.verified).toBe(false);
  });

  it("handles unicode passwords correctly", async () => {
    const storedHash = await hashPassword("пароль123");
    const result = await verifyPassword("пароль123", storedHash);

    expect(result.verified).toBe(true);
  });

  it("is case-sensitive", async () => {
    const storedHash = await hashPassword("Password");
    const result = await verifyPassword("password", storedHash);

    expect(result.verified).toBe(false);
  });
});

describe("verifyPassword — legacy format (salt:hash)", () => {
  it("returns { verified: true, needsRehash: true } for a correct password against legacy hash", async () => {
    // Build a legacy hash manually using the same PBKDF2 parameters
    const { subtle } = crypto;
    const encoder = new TextEncoder();
    const saltBytes = new Uint8Array(16).fill(0xab); // deterministic salt for test
    const keyMaterial = await subtle.importKey(
      "raw",
      encoder.encode("legacypassword"),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const derivedBits = await subtle.deriveBits(
      { name: "PBKDF2", salt: saltBytes, iterations: 100_000, hash: "SHA-256" },
      keyMaterial,
      256
    );
    const toHex = (buf: ArrayBuffer) =>
      Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    const saltHex = toHex(saltBytes.buffer);
    const hashHex = toHex(derivedBits);
    const legacyHash = `${saltHex}:${hashHex}`;

    const result = await verifyPassword("legacypassword", legacyHash);

    expect(result.verified).toBe(true);
    expect(result.needsRehash).toBe(true);
  });

  it("returns { verified: false, needsRehash: false } for wrong password against legacy hash", async () => {
    // Use a plausible-looking legacy hash (32-hex:64-hex) with wrong content
    const fakeLegacyHash = "a".repeat(32) + ":" + "b".repeat(64);
    const result = await verifyPassword("anypassword", fakeLegacyHash);

    expect(result.verified).toBe(false);
    expect(result.needsRehash).toBe(false);
  });
});

describe("verifyPassword — unknown / malformed format", () => {
  it("returns { verified: false, needsRehash: false } for a malformed stored hash (no colon, no $)", async () => {
    const result = await verifyPassword("password", "invalidhashformat");

    expect(result.verified).toBe(false);
    expect(result.needsRehash).toBe(false);
  });

  it("returns { verified: false, needsRehash: false } for an empty stored hash", async () => {
    const result = await verifyPassword("password", "");

    expect(result.verified).toBe(false);
    expect(result.needsRehash).toBe(false);
  });

  it("returns { verified: false, needsRehash: false } for a versioned hash with wrong algo", async () => {
    const result = await verifyPassword("password", "argon2id$t=3$aabbccdd$eeff0011");

    expect(result.verified).toBe(false);
    expect(result.needsRehash).toBe(false);
  });
});
