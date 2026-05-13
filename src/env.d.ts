/// <reference path="../.astro/types.d.ts" />

type D1Database = import('@cloudflare/workers-types').D1Database;
type KVNamespace = import('@cloudflare/workers-types').KVNamespace;

/**
 * Cloudflare environment bindings accessed via `Astro.locals.runtime.env` (in .astro pages)
 * or `locals.runtime.env` (in API routes).
 * Use the helper: `import { getDB } from "@/lib/db/connection";`
 */
interface CloudflareEnv {
  /** Cloudflare D1 database for structured data storage */
  DB: D1Database;
  /** KV namespace for session storage */
  SESSION: KVNamespace;
  /** Site URL for canonical links and SEO */
  SITE_URL: string;
  /** Default locale (id or en) */
  DEFAULT_LOCALE: string;
  /** Hashed admin password for authentication */
  ADMIN_PASSWORD_HASH?: string;
  /** Exa.ai API key for research */
  EXA_API_KEY?: string;
  /** DeepSeek API key for content generation */
  DEEPSEEK_API_KEY?: string;
  /** Secret for session token signing */
  SESSION_SECRET?: string;
}

declare module "cloudflare:workers" {
  const env: CloudflareEnv;
}

declare namespace App {
  interface Locals {
    /** Cloudflare execution context */
    cfContext: import('@cloudflare/workers-types').ExecutionContext;
    /** Validated admin session (set by middleware for /admin/* routes) */
    session?: import('./lib/types').Session;
  }
}
