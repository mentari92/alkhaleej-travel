import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchTopic } from "./exa";

describe("searchTopic", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns an error when API key is empty", async () => {
    const result = await searchTopic("Bali tourism", ["beach", "temple"], "");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_API_KEY");
      expect(result.error.message).toContain("required");
    }
  });

  it("returns structured sources on successful API response", async () => {
    const mockResponse = {
      results: [
        {
          title: "Bali Travel Guide",
          url: "https://example.com/bali",
          text: "Bali is a beautiful island in Indonesia.",
        },
        {
          title: "Top Temples in Bali",
          url: "https://example.com/temples",
          text: "Bali has many ancient temples worth visiting.",
        },
      ],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      })
    );

    const result = await searchTopic(
      "Bali tourism",
      ["beach", "temple"],
      "test-api-key",
      2
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.sources).toHaveLength(2);
      expect(result.sources[0]).toEqual({
        title: "Bali Travel Guide",
        url: "https://example.com/bali",
        content: "Bali is a beautiful island in Indonesia.",
      });
      expect(result.sources[1]).toEqual({
        title: "Top Temples in Bali",
        url: "https://example.com/temples",
        content: "Bali has many ancient temples worth visiting.",
      });
    }
  });

  it("sends correct request to Exa.ai API", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ results: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await searchTopic("Raja Ampat diving", ["coral", "marine"], "my-key", 3);

    expect(mockFetch).toHaveBeenCalledWith("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "my-key",
      },
      body: JSON.stringify({
        query: "Raja Ampat diving coral marine",
        numResults: 3,
        type: "auto",
        contents: { text: true },
      }),
    });
  });

  it("returns RATE_LIMIT error on 429 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: () => Promise.resolve({ error: "rate limited" }),
      })
    );

    const result = await searchTopic("topic", [], "test-key");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("RATE_LIMIT");
      expect(result.error.statusCode).toBe(429);
    }
  });

  it("returns INVALID_API_KEY error on 401 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: "unauthorized" }),
      })
    );

    const result = await searchTopic("topic", [], "bad-key");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_API_KEY");
      expect(result.error.statusCode).toBe(401);
    }
  });

  it("returns INVALID_API_KEY error on 403 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error: "forbidden" }),
      })
    );

    const result = await searchTopic("topic", [], "bad-key");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_API_KEY");
      expect(result.error.statusCode).toBe(403);
    }
  });

  it("returns API_ERROR on other non-ok responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: "internal error" }),
      })
    );

    const result = await searchTopic("topic", [], "test-key");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("API_ERROR");
      expect(result.error.statusCode).toBe(500);
      expect(result.error.message).toContain("500");
    }
  });

  it("returns NETWORK_ERROR when fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network timeout"))
    );

    const result = await searchTopic("topic", [], "test-key");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("NETWORK_ERROR");
      expect(result.error.message).toContain("Network timeout");
    }
  });

  it("handles missing fields in API response gracefully", async () => {
    const mockResponse = {
      results: [
        { title: "Partial Result" },
        { url: "https://example.com/no-title" },
        {},
      ],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      })
    );

    const result = await searchTopic("topic", [], "test-key");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.sources).toHaveLength(3);
      expect(result.sources[0]).toEqual({
        title: "Partial Result",
        url: "",
        content: "",
      });
      expect(result.sources[1]).toEqual({
        title: "",
        url: "https://example.com/no-title",
        content: "",
      });
      expect(result.sources[2]).toEqual({
        title: "",
        url: "",
        content: "",
      });
    }
  });

  it("handles empty results array from API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ results: [] }),
      })
    );

    const result = await searchTopic("obscure topic", [], "test-key");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.sources).toHaveLength(0);
    }
  });

  it("uses default numResults of 5 when not specified", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ results: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await searchTopic("topic", ["keyword"], "test-key");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.numResults).toBe(5);
  });

  it("combines topic and keywords into a single query string", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ results: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await searchTopic("Komodo Island", ["diving", "snorkeling", "boat"], "key");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.query).toBe("Komodo Island diving snorkeling boat");
  });
});
