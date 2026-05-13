/**
 * Exa.ai research client for topic research.
 * Used by the content generation pipeline to gather source material
 * before generating blog articles.
 */

export interface ExaSource {
  title: string;
  url: string;
  content: string;
}

export interface ExaResearchResult {
  success: true;
  sources: ExaSource[];
}

export interface ExaResearchError {
  success: false;
  error: {
    code: "NETWORK_ERROR" | "API_ERROR" | "RATE_LIMIT" | "INVALID_API_KEY" | "UNKNOWN_ERROR";
    message: string;
    statusCode?: number;
  };
}

export type ExaSearchResponse = ExaResearchResult | ExaResearchError;

interface ExaApiResult {
  title?: string;
  url?: string;
  text?: string;
}

interface ExaApiResponse {
  results?: ExaApiResult[];
}

const EXA_API_ENDPOINT = "https://api.exa.ai/search";

/**
 * Searches Exa.ai for research material on a given topic.
 *
 * @param topic - The main topic to research
 * @param keywords - Additional keywords to refine the search
 * @param apiKey - Exa.ai API key
 * @param numResults - Number of results to return (default: 5)
 * @returns Structured research results or a typed error response
 */
export async function searchTopic(
  topic: string,
  keywords: string[],
  apiKey: string,
  numResults: number = 5
): Promise<ExaSearchResponse> {
  if (!apiKey) {
    return {
      success: false,
      error: {
        code: "INVALID_API_KEY",
        message: "Exa.ai API key is required",
      },
    };
  }

  const query = [topic, ...keywords].filter(Boolean).join(" ");

  try {
    const response = await fetch(EXA_API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        query,
        numResults,
        type: "auto",
        contents: {
          text: true,
        },
      }),
    });

    if (response.status === 429) {
      return {
        success: false,
        error: {
          code: "RATE_LIMIT",
          message: "Exa.ai rate limit exceeded. Please try again later.",
          statusCode: 429,
        },
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        success: false,
        error: {
          code: "INVALID_API_KEY",
          message: "Invalid or unauthorized Exa.ai API key.",
          statusCode: response.status,
        },
      };
    }

    if (!response.ok) {
      return {
        success: false,
        error: {
          code: "API_ERROR",
          message: `Exa.ai API returned status ${response.status}`,
          statusCode: response.status,
        },
      };
    }

    const data = (await response.json()) as ExaApiResponse;

    const sources: ExaSource[] = (data.results ?? []).map((result) => ({
      title: result.title ?? "",
      url: result.url ?? "",
      content: result.text ?? "",
    }));

    return {
      success: true,
      sources,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";

    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: `Failed to connect to Exa.ai: ${message}`,
      },
    };
  }
}
