/**
 * Tavily web research — https://api.tavily.com/search
 *
 * V1 web-research provider. The interface below (`WebResearchProvider`) is what
 * the pipeline depends on, so a second provider can be dropped in later without
 * touching the enrichment code.
 *
 * This module returns SEARCH RESULTS ONLY — url, title and the verbatim content
 * snippet Tavily supplies. It never summarises or paraphrases: interpretation
 * happens in `src/lib/enrich`, where every derived fact keeps its source URL.
 */
import { env } from '@/lib/env';
import {
  classifyHttpError,
  fetchWithTimeout,
  providerError,
  type ProviderOutcome,
} from '@/lib/providers/types';

const TAVILY_SEARCH_URL = 'https://api.tavily.com/search';

export interface WebResult {
  url: string;
  title: string | null;
  /** Verbatim excerpt as returned by the provider. Never rewritten. */
  content: string;
  score: number | null;
  publishedDate: string | null;
}

export interface WebSearchOptions {
  query: string;
  maxResults?: number;
  /** 'basic' is cheap and fast; 'advanced' reads more of each page. */
  depth?: 'basic' | 'advanced';
  includeDomains?: string[];
  excludeDomains?: string[];
}

export interface WebResearchProvider {
  readonly id: string;
  isConfigured(): boolean;
  search(options: WebSearchOptions): Promise<ProviderOutcome<WebResult[]>>;
}

/**
 * Domains whose access controls we deliberately do not work around.
 * LinkedIn *public* profile URLs found in ordinary search results are kept as
 * references, but we never fetch behind, authenticate to, or scrape LinkedIn.
 */
export const NEVER_CRAWL_DOMAINS = ['linkedin.com', 'www.linkedin.com'];

interface RawTavilyResult {
  url?: string;
  title?: string;
  content?: string;
  score?: number;
  published_date?: string;
}

export const tavilyProvider: WebResearchProvider = {
  id: 'tavily',

  isConfigured(): boolean {
    return Boolean(env.tavilyApiKey);
  },

  async search(options: WebSearchOptions): Promise<ProviderOutcome<WebResult[]>> {
    const apiKey = env.tavilyApiKey;
    if (!apiKey) {
      return providerError(
        'NOT_CONFIGURED',
        'TAVILY_API_KEY is not set. Web research is skipped and research-only fields stay UNKNOWN.',
        { retryable: false },
      );
    }

    try {
      const res = await fetchWithTimeout(
        TAVILY_SEARCH_URL,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            query: options.query,
            search_depth: options.depth ?? 'basic',
            max_results: Math.min(options.maxResults ?? 5, 20),
            include_answer: false,
            include_raw_content: false,
            ...(options.includeDomains?.length ? { include_domains: options.includeDomains } : {}),
            exclude_domains: [...(options.excludeDomains ?? [])],
          }),
        },
        25_000,
      );

      if (!res.ok) return classifyHttpError(res.status, await res.text());

      const json = (await res.json()) as { results?: RawTavilyResult[] };
      const results: WebResult[] = (json.results ?? [])
        .filter((r): r is RawTavilyResult & { url: string } => typeof r.url === 'string')
        .map((r) => ({
          url: r.url,
          title: r.title ?? null,
          content: r.content ?? '',
          score: typeof r.score === 'number' ? r.score : null,
          publishedDate: r.published_date ?? null,
        }));

      return { ok: true, data: results };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return providerError('TIMEOUT', 'Tavily request timed out.');
      }
      return providerError(
        'NETWORK_ERROR',
        `Could not reach Tavily: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  },
};

/** The provider the pipeline uses. Swap here to change web-research backend. */
export function getWebResearchProvider(): WebResearchProvider {
  return tavilyProvider;
}
