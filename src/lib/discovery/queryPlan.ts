import { getCountry, languagesForCountry } from '@/lib/geo/countries';
import { termsFor, hasLocalTerms, type TermCategory } from '@/lib/discovery/terms';
import { PRIORITY_COMPETITOR_QUERY_BRANDS } from '@/lib/discovery/brands';

export type SearchDepth = 'QUICK' | 'DEEP';

export interface PlannedQuery {
  /** The exact text sent to Google Places `searchText`. */
  text: string;
  /** BCP-47 language the query is written in — passed to Places as languageCode. */
  language: string;
  category: TermCategory | 'competitorBrand';
  /** Present when this query hunts for a specific competitor's dealers. */
  brand?: string;
}

export interface QueryPlan {
  countryCode: string;
  countryName: string;
  city: string | null;
  depth: SearchDepth;
  languages: string[];
  /** False when we only have the English fallback vocabulary for this market. */
  hasLocalTerms: boolean;
  queries: PlannedQuery[];
}

/** Categories searched at each depth. QUICK stays cheap; DEEP goes wide. */
const QUICK_CATEGORIES: TermCategory[] = ['spa', 'hotTub', 'pool', 'poolBuilder', 'wellness'];

const DEEP_CATEGORIES: TermCategory[] = [
  'spa', 'hotTub', 'swimSpa', 'pool', 'poolBuilder', 'poolInstaller',
  'wellness', 'sauna', 'hammam', 'outdoorLiving', 'gardenPremium', 'hotelWellness',
];

/** How many localized phrases per category to actually use. */
const QUICK_TERMS_PER_CATEGORY = 1;
const DEEP_TERMS_PER_CATEGORY = 2;

/** How many languages to search in. */
const QUICK_LANGUAGES = 1;
const DEEP_LANGUAGES = 2;

/** Competitor-dealer queries. */
const QUICK_BRANDS = 4;
const DEEP_BRANDS = PRIORITY_COMPETITOR_QUERY_BRANDS.length;

export interface BuildPlanInput {
  country: string;
  city?: string | null;
  depth: SearchDepth;
}

/**
 * Build the full discovery plan for a market.
 *
 * Deterministic: the same input always yields the same plan, which is what
 * lets a run be resumed step-by-step across serverless invocations.
 */
export function buildQueryPlan(input: BuildPlanInput): QueryPlan {
  const country = getCountry(input.country);
  if (!country) {
    throw new Error(`Unknown country: "${input.country}". Use an ISO 3166-1 alpha-2 code or an English country name.`);
  }

  const city = input.city?.trim() || null;
  const depth = input.depth;
  const allLanguages = languagesForCountry(country.code);
  const languages = allLanguages.slice(0, depth === 'DEEP' ? DEEP_LANGUAGES : QUICK_LANGUAGES);
  // Always keep English available as a safety net for thin dictionaries.
  if (!languages.includes('en')) languages.push('en');

  const categories = depth === 'DEEP' ? DEEP_CATEGORIES : QUICK_CATEGORIES;
  const perCategory = depth === 'DEEP' ? DEEP_TERMS_PER_CATEGORY : QUICK_TERMS_PER_CATEGORY;
  const locationSuffix = city ? `${city} ${country.name}` : country.name;

  const queries: PlannedQuery[] = [];
  const seen = new Set<string>();

  const push = (q: PlannedQuery) => {
    const key = q.text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    queries.push(q);
  };

  // 1) Category queries, in the market's own language(s).
  for (const category of categories) {
    for (const language of languages) {
      const terms = termsFor(category, [language]).slice(0, perCategory);
      for (const term of terms) {
        push({ text: `${term} ${locationSuffix}`, language, category });
      }
    }
  }

  // 2) Competitor dealer discovery — who already sells a rival spa here.
  const brandCount = depth === 'DEEP' ? DEEP_BRANDS : QUICK_BRANDS;
  const primaryLanguage = languages[0] ?? 'en';
  for (const brand of PRIORITY_COMPETITOR_QUERY_BRANDS.slice(0, brandCount)) {
    push({
      text: `${brand} ${locationSuffix}`,
      language: primaryLanguage,
      category: 'competitorBrand',
      brand,
    });
  }

  return {
    countryCode: country.code,
    countryName: country.name,
    city,
    depth,
    languages,
    hasLocalTerms: hasLocalTerms(allLanguages),
    queries,
  };
}

/** Web-research queries used to enrich one specific company. */
export function buildResearchQueries(company: {
  name: string;
  city?: string | null;
  countryName: string;
  websiteDomain?: string | null;
}): string[] {
  const where = [company.city, company.countryName].filter(Boolean).join(' ');
  const base = `${company.name} ${where}`.trim();
  const queries = [
    `${base} spa jacuzzi hot tub brands`,
    `${base} showroom exposicion`,
    `${base} company founded history "since"`,
    `${base} owner CEO managing director contact`,
  ];
  if (company.websiteDomain) {
    queries.push(`site:${company.websiteDomain} spa OR jacuzzi OR wellness`);
  }
  return queries;
}
