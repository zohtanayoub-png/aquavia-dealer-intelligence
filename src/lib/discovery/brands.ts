/**
 * Spa / hot-tub brand intelligence.
 *
 * The named list below is the STARTING point required by the brief, not a
 * closed set: `detectBrands` also recognises brand-shaped mentions from the
 * generic market vocabulary so new local brands surface instead of being
 * silently dropped.
 */

export interface BrandDef {
  /** Canonical display name. */
  name: string;
  /** Lowercase strings that identify the brand in free text. */
  aliases: string[];
  /** A directly competing spa / hot-tub manufacturer. */
  competitor: boolean;
  /** Premium positioning — a dealer carrying these is used to selling value. */
  premium: boolean;
}

export const AQUAVIA: BrandDef = {
  name: 'Aquavia Spa',
  aliases: ['aquavia', 'aquavia spa', 'iberspa'],
  competitor: false,
  premium: true,
};

/** Competing manufacturers. Explicitly required brands are marked below. */
export const COMPETITOR_BRANDS: BrandDef[] = [
  // --- Required by the brief ---
  { name: 'Wellis', aliases: ['wellis'], competitor: true, premium: true },
  { name: 'Jacuzzi', aliases: ['jacuzzi brand', 'jacuzzi®', 'jacuzzi inc'], competitor: true, premium: true },
  { name: 'HotSpring', aliases: ['hotspring', 'hot spring spas', 'hot-spring'], competitor: true, premium: true },
  { name: 'Caldera', aliases: ['caldera spas', 'caldera'], competitor: true, premium: true },
  { name: 'Sundance', aliases: ['sundance spas', 'sundance'], competitor: true, premium: true },
  { name: 'Villeroy & Boch', aliases: ['villeroy & boch', 'villeroy and boch', 'villeroy boch'], competitor: true, premium: true },
  { name: 'Bullfrog', aliases: ['bullfrog spas', 'bullfrog'], competitor: true, premium: true },
  { name: 'Master Spas', aliases: ['master spas', 'masterspas'], competitor: true, premium: true },
  { name: 'Passion Spas', aliases: ['passion spas', 'passionspas'], competitor: true, premium: false },
  // --- Discovered beyond the brief: the wider market ---
  { name: 'Marquis Spas', aliases: ['marquis spas'], competitor: true, premium: true },
  { name: 'Artesian Spas', aliases: ['artesian spas'], competitor: true, premium: false },
  { name: 'Dimension One Spas', aliases: ['dimension one', 'd1 spas'], competitor: true, premium: true },
  { name: 'Arctic Spas', aliases: ['arctic spas'], competitor: true, premium: true },
  { name: 'Beachcomber', aliases: ['beachcomber hot tubs', 'beachcomber spas'], competitor: true, premium: false },
  { name: 'Softub', aliases: ['softub'], competitor: true, premium: false },
  { name: 'Vita Spa', aliases: ['vita spa', 'vitaspa'], competitor: true, premium: false },
  { name: 'Nordic Hot Tubs', aliases: ['nordic hot tub'], competitor: true, premium: false },
  { name: 'Clearwater Spas', aliases: ['clearwater spas'], competitor: true, premium: false },
  { name: 'Coast Spas', aliases: ['coast spas'], competitor: true, premium: false },
  { name: 'Catalina Spas', aliases: ['catalina spas'], competitor: true, premium: false },
  { name: 'Hydropool', aliases: ['hydropool'], competitor: true, premium: true },
  { name: 'Endless Pools', aliases: ['endless pools'], competitor: true, premium: true },
  { name: 'RIVIERA POOL', aliases: ['riviera pool'], competitor: true, premium: true },
  { name: 'Whirlcare', aliases: ['whirlcare'], competitor: true, premium: true },
  { name: 'Optirelax', aliases: ['optirelax'], competitor: true, premium: false },
  { name: 'Canadian Spa', aliases: ['canadian spa company', 'canadian spa'], competitor: true, premium: false },
  { name: 'Spa Studio', aliases: ['spa studio'], competitor: true, premium: false },
  { name: 'NetSpa', aliases: ['netspa'], competitor: true, premium: false },
  { name: 'Intex / Bestway (entry level)', aliases: ['intex purespa', 'bestway lay-z-spa', 'lay z spa'], competitor: true, premium: false },
  { name: 'Sunbeam Spas', aliases: ['sunbeam spas'], competitor: true, premium: false },
  { name: 'Aquatica', aliases: ['aquatica spa'], competitor: true, premium: true },
  { name: 'Novitek', aliases: ['novitek'], competitor: true, premium: false },
  { name: 'Astralpool', aliases: ['astralpool', 'astral pool'], competitor: true, premium: false },
  { name: 'Fonteyn', aliases: ['fonteyn spa'], competitor: true, premium: false },
  { name: 'Welcyon', aliases: ['welcyon'], competitor: true, premium: false },
  { name: 'Tropic Spa', aliases: ['tropic spa'], competitor: true, premium: false },
];

export const ALL_BRANDS: BrandDef[] = [AQUAVIA, ...COMPETITOR_BRANDS];

/** The subset the brief explicitly asks the discovery stage to hunt for. */
export const PRIORITY_COMPETITOR_QUERY_BRANDS = [
  'Wellis',
  'Jacuzzi',
  'HotSpring',
  'Caldera',
  'Sundance',
  'Villeroy & Boch',
  'Bullfrog',
  'Master Spas',
  'Passion Spas',
];

/** Generic words that mark a *previously unseen* brand mention worth keeping. */
const BRAND_CONTEXT_WORDS = [
  'official dealer', 'authorised dealer', 'authorized dealer', 'distributor',
  'distribuidor oficial', 'revendeur officiel', 'distributeur officiel',
  'rivenditore ufficiale', 'offizieller händler', 'officiële dealer',
  'dystrybutor', 'forgalmazó', 'oficjalny dealer', 'yetkili bayi',
  'وكيل معتمد', 'موزع معتمد',
];

export interface BrandDetection {
  brands: string[];
  competitorBrands: string[];
  /** Brand-shaped mentions we could not map to a known brand. */
  unmappedMentions: string[];
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Detect brands in free text.
 *
 * Only returns a brand when its alias appears as a whole-word match, so
 * "spasso" never resolves to "Spa" and "jacuzzi-style bathtub" (generic use)
 * is filtered out by requiring the branded form.
 */
export function detectBrands(text: string): BrandDetection {
  const hay = normalize(text);
  const brands: string[] = [];
  const competitorBrands: string[] = [];

  for (const brand of ALL_BRANDS) {
    const hit = brand.aliases.some((alias) => {
      const a = normalize(alias);
      const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(a)}([^\\p{L}\\p{N}]|$)`, 'u');
      return pattern.test(hay);
    });
    if (hit) {
      if (!brands.includes(brand.name)) brands.push(brand.name);
      if (brand.competitor && !competitorBrands.includes(brand.name)) {
        competitorBrands.push(brand.name);
      }
    }
  }

  return { brands, competitorBrands, unmappedMentions: findUnmappedMentions(text, hay) };
}

/**
 * Look for "<Capitalised Name> ... official dealer" style phrasing so brands
 * outside our list are still surfaced for a human to review.
 */
function findUnmappedMentions(original: string, normalized: string): string[] {
  if (!BRAND_CONTEXT_WORDS.some((w) => normalized.includes(normalize(w)))) return [];

  const out: string[] = [];
  const candidatePattern = /\b([A-Z][\p{L}]{2,}(?:\s+(?:&\s+)?[A-Z][\p{L}]{2,}){0,2})\b/gu;
  const known = new Set(ALL_BRANDS.flatMap((b) => b.aliases.map(normalize)));

  for (const m of original.matchAll(candidatePattern)) {
    const candidate = m[1].trim();
    const key = normalize(candidate);
    if (known.has(key)) continue;
    if (STOPWORD_CANDIDATES.has(key)) continue;
    if (!out.includes(candidate)) out.push(candidate);
    if (out.length >= 8) break;
  }
  return out;
}

const STOPWORD_CANDIDATES = new Set([
  'official dealer', 'the', 'our', 'we', 'this', 'and', 'for', 'with',
  'spa', 'spas', 'hot tub', 'hot tubs', 'pool', 'pools', 'wellness', 'sauna',
  'home', 'contact', 'about', 'products', 'services', 'company', 'group',
  'privacy policy', 'cookie policy', 'all rights reserved', 'read more',
]);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isCompetitorBrand(name: string): boolean {
  const key = normalize(name);
  return COMPETITOR_BRANDS.some((b) => normalize(b.name) === key || b.aliases.some((a) => normalize(a) === key));
}

export function isPremiumBrand(name: string): boolean {
  const key = normalize(name);
  return ALL_BRANDS.some((b) => b.premium && (normalize(b.name) === key || b.aliases.some((a) => normalize(a) === key)));
}
