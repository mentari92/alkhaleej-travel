/**
 * DeepSeek AI generation client for blog article content.
 * Uses the DeepSeek API (OpenAI-compatible) to generate SEO-optimized
 * tourism blog articles in the specified target language.
 */

import type { Locale } from "../i18n/config";

/**
 * Structured result from the DeepSeek article generation.
 */
export interface GeneratedArticle {
  title: string;
  excerpt: string;
  content: string;
  metaDescription: string;
}

/**
 * Result wrapper for the generation process.
 */
export interface DeepSeekResult {
  success: boolean;
  article?: GeneratedArticle;
  error?: string;
}

/**
 * Parameters for the generateArticle function.
 */
export interface GenerateArticleParams {
  topic: string;
  researchContext: string;
  targetLanguage: Locale;
  apiKey: string;
}

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Builds the system prompt instructing DeepSeek to generate an SEO-optimized
 * tourism blog article in the specified language.
 */
function buildSystemPrompt(targetLanguage: Locale): string {
  const languageName = targetLanguage === "id" ? "Bahasa Indonesia" : "English";

  return `You are an expert SEO content writer specializing in Indonesian tourism. Write all content in ${languageName}.

Your task is to generate a well-structured, SEO-optimized blog article about a tourism topic in Indonesia.

Requirements:
- Write entirely in ${languageName}
- Use engaging, informative prose suitable for travelers
- Include relevant keywords naturally for SEO
- Structure the content with HTML headings (h2, h3), paragraphs, and lists where appropriate
- The content should be informative, accurate, and helpful for tourists planning trips

You MUST respond with valid JSON in exactly this format (no markdown code fences, just raw JSON):
{
  "title": "SEO-optimized article title",
  "excerpt": "A compelling 1-2 sentence summary for the article listing (max 160 characters)",
  "content": "<h2>...</h2><p>...</p>... (full HTML article body)",
  "metaDescription": "SEO meta description for search engines (max 160 characters)"
}

Important:
- The "content" field must contain valid HTML (use h2, h3, p, ul, li, strong, em tags)
- Do NOT include the title in the content (it will be rendered separately)
- The excerpt and metaDescription should be concise and compelling
- Focus on providing genuine value to readers interested in Indonesian tourism`;
}

/**
 * Builds the user prompt with the topic and research context.
 */
function buildUserPrompt(topic: string, researchContext: string): string {
  return `Write a blog article about the following topic:

Topic: ${topic}

Research context and reference material:
${researchContext}

Generate a comprehensive, SEO-optimized article based on this information. Respond with the JSON format specified in your instructions.`;
}

/**
 * Creates an AbortController with a timeout that automatically aborts the request.
 */
function createTimeoutController(timeoutMs: number): {
  controller: AbortController;
  timeoutId: ReturnType<typeof setTimeout>;
} {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timeoutId };
}

/**
 * Parses the DeepSeek API response and extracts the generated article.
 */
function parseGeneratedArticle(responseText: string): GeneratedArticle {
  // Try to parse the response as JSON directly
  let parsed: unknown;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    // If direct parse fails, try to extract JSON from the response
    // (in case the model wraps it in markdown code fences)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to extract JSON from API response");
    }
    parsed = JSON.parse(jsonMatch[0]);
  }

  const article = parsed as Record<string, unknown>;

  if (
    typeof article.title !== "string" ||
    typeof article.excerpt !== "string" ||
    typeof article.content !== "string" ||
    typeof article.metaDescription !== "string"
  ) {
    throw new Error(
      "Invalid article structure: missing required fields (title, excerpt, content, metaDescription)"
    );
  }

  return {
    title: article.title,
    excerpt: article.excerpt,
    content: article.content,
    metaDescription: article.metaDescription,
  };
}

/**
 * Generates a blog article using the DeepSeek API.
 *
 * @param params - Generation parameters including topic, research context, target language, and API key
 * @returns A DeepSeekResult with the generated article or an error message
 */
export async function generateArticle(
  params: GenerateArticleParams
): Promise<DeepSeekResult> {
  const { topic, researchContext, targetLanguage, apiKey } = params;

  if (!apiKey) {
    return {
      success: false,
      error: "DeepSeek API key is not configured",
    };
  }

  if (!topic.trim()) {
    return {
      success: false,
      error: "Topic is required for article generation",
    };
  }

  const { controller, timeoutId } = createTimeoutController(REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: buildSystemPrompt(targetLanguage),
          },
          {
            role: "user",
            content: buildUserPrompt(topic, researchContext),
          },
        ],
        temperature: 0.7,
        max_tokens: 4096,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      const statusMessage = `DeepSeek API error (${response.status}): ${response.statusText}`;
      const detail = errorBody ? ` - ${errorBody}` : "";
      return {
        success: false,
        error: `${statusMessage}${detail}`,
      };
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      return {
        success: false,
        error: "DeepSeek API returned an empty response",
      };
    }

    const article = parseGeneratedArticle(content);

    return {
      success: true,
      article,
    };
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return {
          success: false,
          error: `DeepSeek API request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds`,
        };
      }
      return {
        success: false,
        error: `DeepSeek API request failed: ${error.message}`,
      };
    }

    return {
      success: false,
      error: "An unexpected error occurred during article generation",
    };
  }
}
