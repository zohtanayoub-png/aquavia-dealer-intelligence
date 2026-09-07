/** Small shared helpers. No side effects, no I/O. */

export function stripDiacritics(input: string): string {
  return input.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

/** Lowercase, accent-free, punctuation-free form used for comparisons. */
export function normalizeName(input: string): string {
  return stripDiacritics(input)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Legal-form suffixes stripped before comparing company names. */
const LEGAL_SUFFIXES = [
  'sl', 'slu', 'sa', 'sau', 'sarl', 'sas', 'sasu', 'eurl', 'sprl', 'bvba', 'bv', 'nv',
  'gmbh', 'mbh', 'ag', 'kg', 'ohg', 'ug', 'ltd', 'limited', 'llc', 'inc', 'corp',
  'plc', 'lda', 'srl', 'spa', 'snc', 'oy', 'ab', 'as', 'aps', 'kft', 'zrt', 'bt',
  'sro', 'spzoo', 'sp z oo', 'doo', 'dooel', 'ood', 'eood', 'ad', 'sarlau', 'sarl au',
];

/**
 * Comparable company key.
 *
 * NOTE: `spa` is a legal suffix in Italy (Società per Azioni) but also our
 * industry word. It is only stripped when it is the FINAL token and the name
 * has other tokens left, which is exactly the Italian legal-form position.
 */
export function companyNameKey(name: string): string {
  let tokens = collapseInitialisms(normalizeName(name).split(' ').filter(Boolean));
  while (tokens.length > 1 && LEGAL_SUFFIXES.includes(tokens[tokens.length - 1])) {
    tokens = tokens.slice(0, -1);
  }
  return tokens.join(' ');
}

/**
 * Join runs of single-letter tokens into one token.
 *
 * Punctuation stripping turns "S.L." into "s l", which would otherwise never
 * match the "sl" written by a source that omits the dots — and the same
 * company would be stored twice. "S.p.A." likewise becomes "spa".
 */
function collapseInitialisms(tokens: string[]): string[] {
  const out: string[] = [];
  let run: string[] = [];

  const flush = () => {
    if (run.length >= 2) out.push(run.join(''));
    else out.push(...run);
    run = [];
  };

  for (const token of tokens) {
    if (token.length === 1) run.push(token);
    else {
      flush();
      out.push(token);
    }
  }
  flush();
  return out;
}

/** Registrable domain of a URL, lowercase, without `www.`. Null when unusable. */
export function extractDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  const candidate = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  try {
    const host = new URL(candidate).hostname.toLowerCase();
    return host.startsWith('www.') ? host.slice(4) : host;
  } catch {
    return null;
  }
}

/**
 * Stable de-duplication key.
 *
 * A Google Place ID is authoritative when present. Otherwise a company is
 * identified by its website domain, and failing that by country + name key,
 * so the same business found via two different queries merges into one record.
 */
export function buildDedupeKey(input: {
  googlePlaceId?: string | null;
  websiteDomain?: string | null;
  countryCode: string;
  name: string;
  city?: string | null;
}): string {
  if (input.googlePlaceId) return `place:${input.googlePlaceId}`;
  if (input.websiteDomain) return `domain:${input.websiteDomain}`;
  const city = input.city ? normalizeName(input.city) : '';
  return `name:${input.countryCode.toUpperCase()}:${city}:${companyNameKey(input.name)}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function uniq<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

/** Merge two string lists case-insensitively, preserving first-seen casing. */
export function mergeStringLists(a: string[], b: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of [...a, ...b]) {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value.trim());
  }
  return out;
}

export function toTitleCase(input: string): string {
  return input.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
}

const CURRENT_YEAR = () => new Date().getUTCFullYear();

/** Accept a year only when it is plausible for a trading company. */
export function isPlausibleFoundingYear(year: number): boolean {
  return Number.isInteger(year) && year >= 1850 && year <= CURRENT_YEAR();
}

/** Years in the spa industry — derived from spaSinceYear ONLY, never yearFounded. */
export function yearsInSpaIndustry(spaSinceYear: number | null | undefined): number | null {
  if (typeof spaSinceYear !== 'number' || !isPlausibleFoundingYear(spaSinceYear)) return null;
  return CURRENT_YEAR() - spaSinceYear;
}

export function formatUnknown(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'UNKNOWN';
  return String(value);
}
