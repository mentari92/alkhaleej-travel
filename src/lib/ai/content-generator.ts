/**
 * Content generation orchestrator.
 * Orchestrates the Exa.ai research → DeepSeek generation pipeline
 * to produce SEO-optimized blog article drafts in the target language.
 */

import type { Locale } from "../i18n/config";
import type { BlogArticle } from "../types";
import { searchTopic } from "./exa";
import { generateArticle } from "./deepseek";
import type { GeneratedArticle } from "./deepseek";

/**
 * Request parameters for content generation.
 */
export interface GenerationRequest {
  topic: string;
  destinationId?: string;
  keywords?: string[];
  targetLanguage: Locale;
}

/**
 * Result of the content generation pipeline.
 */
export interface GenerationResult {
  success: boolean;
  article?: BlogArticle;
  error?: string;
}

/**
 * API keys required by the content generation pipeline.
 */
export interface GenerationApiKeys {
  exaApiKey: string;
  deepseekApiKey: string;
}

/**
 * Formats Exa research sources into a context string for DeepSeek.
 */
function formatResearchContext(
  sources: Array<{ title: string; url: string; content: string }>
): string {
  if (sources.length === 0) {
    return "No additional research context available.";
  }

  return sources
    .map(
      (source, index) =>
        `Source ${index + 1}: ${source.title}\nURL: ${source.url}\n${source.content}`
    )
    .join("\n\n---\n\n");
}

/**
 * Converts a GeneratedArticle from DeepSeek into a BlogArticle draft.
 */
function toBlogArticleDraft(
  generated: GeneratedArticle,
  targetLanguage: Locale,
  relatedDestinationIds: string[]
): BlogArticle {
  return {
    id: crypto.randomUUID(),
    slug: "",
    title: generated.title,
    excerpt: generated.excerpt,
    content: generated.content,
    language: targetLanguage,
    thumbnailUrl: "",
    metaDescription: generated.metaDescription,
    ogImage: "",
    relatedDestinationIds,
    pairedArticleId: null,
    status: "draft",
    publishedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Orchestrates the content generation pipeline:
 * 1. Research the topic using Exa.ai
 * 2. Generate an article using DeepSeek with the research context
 * 3. Return the generated article draft
 *
 * If Exa research fails, the pipeline gracefully degrades by generating
 * with just the topic (no research context).
 * If DeepSeek generation fails, the error is returned.
 *
 * @param request - The generation request with topic, keywords, and target language
 * @param apiKeys - API keys for Exa.ai and DeepSeek
 * @returns A GenerationResult with the article draft or an error
 */
export async function generateContent(
  request: GenerationRequest,
  apiKeys: GenerationApiKeys
): Promise<GenerationResult> {
  const { topic, destinationId, keywords = [], targetLanguage } = request;
  const { exaApiKey, deepseekApiKey } = apiKeys;

  if (!topic.trim()) {
    return {
      success: false,
      error: "Topic is required for content generation",
    };
  }

  // Step 1: Research the topic using Exa.ai (graceful degradation on failure)
  let researchContext = "";

  const exaResult = await searchTopic(topic, keywords, exaApiKey);

  if (exaResult.success) {
    researchContext = formatResearchContext(exaResult.sources);
  } else {
    // Graceful degradation: proceed without research context
    researchContext =
      "No research context available. Generate based on general knowledge about the topic.";
  }

  // Step 2: Generate the article using DeepSeek
  const deepseekResult = await generateArticle({
    topic,
    researchContext,
    targetLanguage,
    apiKey: deepseekApiKey,
  });

  if (!deepseekResult.success) {
    return {
      success: false,
      error: deepseekResult.error ?? "Article generation failed",
    };
  }

  if (!deepseekResult.article) {
    return {
      success: false,
      error: "Article generation returned no content",
    };
  }

  // Step 3: Convert to BlogArticle draft
  const relatedDestinationIds = destinationId ? [destinationId] : [];
  const article = toBlogArticleDraft(
    deepseekResult.article,
    targetLanguage,
    relatedDestinationIds
  );

  return {
    success: true,
    article,
  };
}
