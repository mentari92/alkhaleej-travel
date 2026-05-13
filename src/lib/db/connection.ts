/**
 * Database connection helper.
 * Uses the Astro v6 + @astrojs/cloudflare pattern:
 * `import { env } from "cloudflare:workers"`
 *
 * This module must be run within a Cloudflare Workers context
 * (either via wrangler dev or production deployment).
 */

import { env } from "cloudflare:workers";

/**
 * Gets the D1 database binding from Cloudflare Workers environment.
 */
export function getDB(): D1Database {
  return (env as any).DB as D1Database;
}

/**
 * Gets an environment variable from Cloudflare Workers environment.
 */
export function getEnvVar(key: string): string | undefined {
  return (env as any)[key] as string | undefined;
}
