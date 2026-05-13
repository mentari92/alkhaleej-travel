/**
 * Seed script to create an admin user in the local D1 database.
 * 
 * Usage: node scripts/seed-admin.mjs
 * 
 * Then run the output SQL with:
 *   npx wrangler d1 execute infotour-db --local --command="<SQL>"
 */

const password = "admin123";
const username = "admin";
const id = "admin-001";

// PBKDF2 hashing (same as src/lib/auth/password.ts)
const encoder = new TextEncoder();
const salt = crypto.getRandomValues(new Uint8Array(16));

const keyMaterial = await crypto.subtle.importKey(
  "raw",
  encoder.encode(password),
  "PBKDF2",
  false,
  ["deriveBits"]
);

const derivedBits = await crypto.subtle.deriveBits(
  {
    name: "PBKDF2",
    salt,
    iterations: 100000,
    hash: "SHA-256",
  },
  keyMaterial,
  256
);

const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, "0")).join("");
const hashHex = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, "0")).join("");
const passwordHash = `${saltHex}:${hashHex}`;

const sql = `INSERT OR REPLACE INTO admin_users (id, username, password_hash) VALUES ('${id}', '${username}', '${passwordHash}');`;

console.log("=== Admin User Seed ===");
console.log(`Username: ${username}`);
console.log(`Password: ${password}`);
console.log("");
console.log("Run this command to seed the database:");
console.log("");
console.log(`npx wrangler d1 execute infotour-db --local --command="${sql}"`);
console.log("");
console.log("Or copy the SQL:");
console.log(sql);
