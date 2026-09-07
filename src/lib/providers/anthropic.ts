/**
 * OPTIONAL Anthropic integration.
 *
 * The application is fully functional without ANTHROPIC_API_KEY — the
 * deterministic extractor in `src/lib/enrich/extract.ts` reads the same
 * research text and produces the same shape of result.
 *
 * When a key IS present, Claude is used strictly as a READER: it receives web
 * excerpts that were already retrieved and returns structured facts, each of
 * which must cite one of the supplied source URLs. Any claim citing a URL that
 * was not provided is discarded — the model cannot introduce facts from memory.
 */
import { env } from '@/lib/env';
import {
  classifyHttpError,
  fetchWithTimeout,
  providerError,
  type ProviderOutcome,
} from '@/lib/providers/types';

const MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

export function isAnthropicConfigured(): boolean {
  return Boolean(env.anthropicApiKey);
}

export interface ClaimExtractionInput {
  companyName: string;
  countryName: string;
  city: string | null;
  /** Already-retrieved excerpts. The model may not go beyond these. */
  excerpts: { url: string; title: string | null; content: string }[];
}

export interface ExtractedClaim {
  field:
    | 'spaActivity' | 'poolActivity' | 'saunaActivity' | 'wellnessActivity'
    | 'hammamActivity' | 'outdoorLiving' | 'hospitalityActivity' | 'showroom'
    | 'yearFounded' | 'spaSinceYear' | 'brands' | 'locationCount';
  value: string;
  sourceUrl: string;
  quote: string;
}

export interface ClaimExtractionResult {
  claims: ExtractedClaim[];
  /** Claims dropped because they cited a URL we never supplied. */
  rejectedCount: number;
}

const SYSTEM_PROMPT = `You extract verifiable B2B facts about spa/pool/wellness companies from supplied web excerpts.

HARD RULES:
- Use ONLY the supplied excerpts. Never use prior knowledge about the company.
- Every claim MUST cite a sourceUrl that appears in the supplied excerpts, and MUST include a verbatim quote from that excerpt.
- If a fact is not stated in the excerpts, DO NOT emit a claim for it. Omission is correct; guessing is not.
- Distinguish the year the COMPANY was founded (yearFounded) from the year it started selling SPAS/HOT TUBS (spaSinceYear). Never use one for the other.
- Never emit an email address, phone number or person's name in these claims.

Respond with JSON only: {"claims":[{"field":"...","value":"...","sourceUrl":"...","quote":"..."}]}`;

export async function extractClaimsWithClaude(
  input: ClaimExtractionInput,
): Promise<ProviderOutcome<ClaimExtractionResult>> {
  const apiKey = env.anthropicApiKey;
  if (!apiKey) {
    return providerError('NOT_CONFIGURED', 'ANTHROPIC_API_KEY is not set (optional integration).', {
      retryable: false,
    });
  }
  if (input.excerpts.length === 0) {
    return { ok: true, data: { claims: [], rejectedCount: 0 } };
  }

  const allowedUrls = new Set(input.excerpts.map((e) => e.url));
  const location = [input.city, input.countryName].filter(Boolean).join(', ');
  const userContent = [
    `Company: ${input.companyName}`,
    `Location: ${location}`,
    '',
    'Excerpts:',
    ...input.excerpts.map((e, i) =>
      `[${i + 1}] url: ${e.url}\ntitle: ${e.title ?? ''}\ncontent: ${e.content.slice(0, 2000)}`,
    ),
  ].join('\n');

  try {
    const res = await fetchWithTimeout(
      MESSAGES_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: env.anthropicModel,
          max_tokens: 2000,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userContent }],
        }),
      },
      45_000,
    );

    if (!res.ok) return classifyHttpError(res.status, await res.text());

    const json = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = (json.content ?? [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('');

    const parsed = safeParseClaims(text);
    // Enforce the contract: a claim citing a URL we did not supply is fabricated.
    const claims = parsed.filter((c) => allowedUrls.has(c.sourceUrl));
    return {
      ok: true,
      data: { claims, rejectedCount: parsed.length - claims.length },
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return providerError('TIMEOUT', 'Anthropic request timed out.');
    }
    return providerError(
      'NETWORK_ERROR',
      `Could not reach Anthropic: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

const VALID_FIELDS = new Set<ExtractedClaim['field']>([
  'spaActivity', 'poolActivity', 'saunaActivity', 'wellnessActivity',
  'hammamActivity', 'outdoorLiving', 'hospitalityActivity', 'showroom',
  'yearFounded', 'spaSinceYear', 'brands', 'locationCount',
]);

export function safeParseClaims(text: string): ExtractedClaim[] {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return [];

  try {
    const obj = JSON.parse(text.slice(start, end + 1)) as { claims?: unknown };
    if (!Array.isArray(obj.claims)) return [];

    return obj.claims.flatMap((raw): ExtractedClaim[] => {
      if (typeof raw !== 'object' || raw === null) return [];
      const c = raw as Record<string, unknown>;
      const field = c.field as ExtractedClaim['field'];
      if (!VALID_FIELDS.has(field)) return [];
      if (typeof c.sourceUrl !== 'string' || typeof c.value !== 'string') return [];
      if (typeof c.quote !== 'string' || c.quote.trim().length === 0) return [];
      return [{ field, value: c.value, sourceUrl: c.sourceUrl, quote: c.quote }];
    });
  } catch {
    return [];
  }
}
