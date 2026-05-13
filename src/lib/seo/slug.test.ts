import { describe, it, expect } from "vitest";
import { generateSlug } from "./slug";

describe("generateSlug()", () => {
  it("converts a simple title to lowercase slug", () => {
    expect(generateSlug("Hello World")).toBe("hello-world");
  });

  it("replaces non-alphanumeric characters with hyphens", () => {
    expect(generateSlug("Bali & Kintamani Tour!")).toBe("bali-kintamani-tour");
  });

  it("removes leading hyphens", () => {
    expect(generateSlug("---leading")).toBe("leading");
  });

  it("removes trailing hyphens", () => {
    expect(generateSlug("trailing---")).toBe("trailing");
  });

  it("collapses consecutive hyphens into a single hyphen", () => {
    expect(generateSlug("hello---world")).toBe("hello-world");
  });

  it("handles mixed case and special characters", () => {
    expect(generateSlug("Pantai Kuta (Bali) - Indonesia")).toBe(
      "pantai-kuta-bali-indonesia"
    );
  });

  it("handles numbers in the title", () => {
    expect(generateSlug("Top 10 Destinations")).toBe("top-10-destinations");
  });

  it("returns empty string for empty input", () => {
    expect(generateSlug("")).toBe("");
  });

  it("handles title with only special characters", () => {
    expect(generateSlug("!@#$%^&*()")).toBe("");
  });

  it("preserves existing hyphens between words", () => {
    expect(generateSlug("bali-kintamani")).toBe("bali-kintamani");
  });

  it("handles unicode/non-latin characters by replacing them", () => {
    expect(generateSlug("Gunung Agung 火山")).toBe("gunung-agung");
  });
});
