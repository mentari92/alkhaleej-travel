/**
 * Unit tests for the DeepSeek generation client.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateArticle } from "./deepseek";
import type { GenerateArticleParams } from "./deepseek";

const validParams: GenerateArticleParams = {
  topic: "Best beaches in Bali",
  researchContext: "Bali has many beautiful beaches including Kuta, Seminyak, and Nusa Dua.",
  targetLanguage: "en",
  apiKey: "test-api-key-123",
};

const mockArticleResponse = {
  title: "Best Beaches in Bali: A Complete Guide",
  excerpt: "Discover the most stunning beaches in Bali, from Kuta to Nusa Dua.",
  content: "<h2>Introduction</h2><p>Bali is famous for its beaches.</p>",
  metaDescription: "Explore the best beaches in Bali with our comprehensive travel guide.",
};

function createMockResponse(body: unknown, status = 200, statusText = "OK") {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

describe("generateArticle", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when API key is empty", async () => {
    const result = await generateArticle({ ...validParams, apiKey: "" });

    expect(result.success).toBe(false);
    expect(result.error).toBe("DeepSeek API key is not configured");
  });

  it("returns error when topic is empty", async () => {
    const result = await generateArticle({ ...validParams, topic: "   " });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Topic is required for article generation");
  });

  it("successfully generates an article", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      createMockResponse({
        choices: [
          {
            message: {
              content: JSON.stringify(mockArticleResponse),
            },
          },
        ],
      })
    );
    vi.stubGlobal("fetch", mockFetch);

    const result = await generateArticle(validParams);

    expect(result.success).toBe(true);
    expect(result.article).toEqual(mockArticleResponse);
  });

  it("sends correct request to DeepSeek API", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      createMockResponse({
        choices: [
          {
            message: {
              content: JSON.stringify(mockArticleResponse),
            },
          },
        ],
      })
    );
    vi.stubGlobal("fetch", mockFetch);

    await generateArticle(validParams);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.deepseek.com/v1/chat/completions");
    expect(options.method).toBe("POST");
    expect(options.headers["Authorization"]).toBe("Bearer test-api-key-123");
    expect(options.headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(options.body);
    expect(body.model).toBe("deepseek-chat");
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[1].role).toBe("user");
    expect(body.messages[1].content).toContain("Best beaches in Bali");
  });

  it("includes target language in system prompt for Bahasa Indonesia", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      createMockResponse({
        choices: [
          {
            message: {
              content: JSON.stringify(mockArticleResponse),
            },
          },
        ],
      })
    );
    vi.stubGlobal("fetch", mockFetch);

    await generateArticle({ ...validParams, targetLanguage: "id" });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.messages[0].content).toContain("Bahasa Indonesia");
  });

  it("includes target language in system prompt for English", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      createMockResponse({
        choices: [
          {
            message: {
              content: JSON.stringify(mockArticleResponse),
            },
          },
        ],
      })
    );
    vi.stubGlobal("fetch", mockFetch);

    await generateArticle({ ...validParams, targetLanguage: "en" });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.messages[0].content).toContain("English");
  });

  it("handles API error responses", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      createMockResponse(
        { error: { message: "Rate limit exceeded" } },
        429,
        "Too Many Requests"
      )
    );
    vi.stubGlobal("fetch", mockFetch);

    const result = await generateArticle(validParams);

    expect(result.success).toBe(false);
    expect(result.error).toContain("DeepSeek API error (429)");
    expect(result.error).toContain("Too Many Requests");
  });

  it("handles empty response from API", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      createMockResponse({
        choices: [{ message: { content: "" } }],
      })
    );
    vi.stubGlobal("fetch", mockFetch);

    const result = await generateArticle(validParams);

    expect(result.success).toBe(false);
    expect(result.error).toBe("DeepSeek API returned an empty response");
  });

  it("handles missing choices in API response", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      createMockResponse({ choices: [] })
    );
    vi.stubGlobal("fetch", mockFetch);

    const result = await generateArticle(validParams);

    expect(result.success).toBe(false);
    expect(result.error).toBe("DeepSeek API returned an empty response");
  });

  it("handles network errors", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
    vi.stubGlobal("fetch", mockFetch);

    const result = await generateArticle(validParams);

    expect(result.success).toBe(false);
    expect(result.error).toContain("DeepSeek API request failed: Network error");
  });

  it("handles timeout errors", async () => {
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    const mockFetch = vi.fn().mockRejectedValue(abortError);
    vi.stubGlobal("fetch", mockFetch);

    const result = await generateArticle(validParams);

    expect(result.success).toBe(false);
    expect(result.error).toContain("timed out after 30 seconds");
  });

  it("handles malformed JSON in API response", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      createMockResponse({
        choices: [
          {
            message: {
              content: "This is not valid JSON at all",
            },
          },
        ],
      })
    );
    vi.stubGlobal("fetch", mockFetch);

    const result = await generateArticle(validParams);

    expect(result.success).toBe(false);
    expect(result.error).toContain("DeepSeek API request failed");
  });

  it("extracts JSON from markdown code fences in response", async () => {
    const wrappedResponse = "```json\n" + JSON.stringify(mockArticleResponse) + "\n```";
    const mockFetch = vi.fn().mockResolvedValue(
      createMockResponse({
        choices: [
          {
            message: {
              content: wrappedResponse,
            },
          },
        ],
      })
    );
    vi.stubGlobal("fetch", mockFetch);

    const result = await generateArticle(validParams);

    expect(result.success).toBe(true);
    expect(result.article).toEqual(mockArticleResponse);
  });

  it("handles response with missing required fields", async () => {
    const incompleteArticle = {
      title: "Some title",
      // missing excerpt, content, metaDescription
    };
    const mockFetch = vi.fn().mockResolvedValue(
      createMockResponse({
        choices: [
          {
            message: {
              content: JSON.stringify(incompleteArticle),
            },
          },
        ],
      })
    );
    vi.stubGlobal("fetch", mockFetch);

    const result = await generateArticle(validParams);

    expect(result.success).toBe(false);
    expect(result.error).toContain("missing required fields");
  });
});
