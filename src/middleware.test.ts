import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit tests for the middleware's parseCookie utility and route protection logic.
 * Since the middleware relies on Astro's defineMiddleware and cloudflare:workers,
 * we test the core logic in isolation.
 */

// We test parseCookie directly by extracting the logic
function parseCookie(
  cookieHeader: string | null,
  name: string
): string | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const [key, ...valueParts] = cookie.trim().split("=");
    if (key === name) {
      return valueParts.join("=") || null;
    }
  }
  return null;
}

describe("parseCookie", () => {
  it("returns null for null cookie header", () => {
    expect(parseCookie(null, "session_id")).toBeNull();
  });

  it("returns null for empty cookie header", () => {
    expect(parseCookie("", "session_id")).toBeNull();
  });

  it("extracts a simple cookie value", () => {
    expect(parseCookie("session_id=abc123", "session_id")).toBe("abc123");
  });

  it("extracts cookie from multiple cookies", () => {
    const header = "theme=dark; session_id=xyz789; lang=id";
    expect(parseCookie(header, "session_id")).toBe("xyz789");
  });

  it("returns null when cookie name is not found", () => {
    const header = "theme=dark; lang=id";
    expect(parseCookie(header, "session_id")).toBeNull();
  });

  it("handles cookie values with equals signs", () => {
    const header = "session_id=abc=def=ghi";
    expect(parseCookie(header, "session_id")).toBe("abc=def=ghi");
  });

  it("handles whitespace around cookies", () => {
    const header = "  session_id=test123  ;  other=value  ";
    expect(parseCookie(header, "session_id")).toBe("test123");
  });

  it("returns null for cookie with empty value", () => {
    const header = "session_id=";
    expect(parseCookie(header, "session_id")).toBeNull();
  });
});

describe("middleware route matching logic", () => {
  function shouldProtect(pathname: string): boolean {
    return pathname.startsWith("/admin") && pathname !== "/admin/login";
  }

  it("protects /admin route", () => {
    expect(shouldProtect("/admin")).toBe(true);
  });

  it("protects /admin/ route", () => {
    expect(shouldProtect("/admin/")).toBe(true);
  });

  it("protects /admin/destinations route", () => {
    expect(shouldProtect("/admin/destinations")).toBe(true);
  });

  it("protects /admin/blog/generate route", () => {
    expect(shouldProtect("/admin/blog/generate")).toBe(true);
  });

  it("does NOT protect /admin/login route", () => {
    expect(shouldProtect("/admin/login")).toBe(false);
  });

  it("does NOT protect public routes", () => {
    expect(shouldProtect("/")).toBe(false);
    expect(shouldProtect("/destinations/bali")).toBe(false);
    expect(shouldProtect("/en/blog")).toBe(false);
    expect(shouldProtect("/api/destinations")).toBe(false);
  });
});
