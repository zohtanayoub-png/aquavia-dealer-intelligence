/**
 * Deterministic evidence extraction.
 *
 * Turns retrieved web excerpts into structured findings. Every finding carries
 * the URL and the verbatim quote it came from, so the UI can always answer
 * "how do you know that?".
 *
 * DESIGN RULE: a signal is only emitted when a matching phrase is literally
 * present in the retrieved text. There is no "probably", no defaulting to YES,
 * and no inference across fields. Everything else stays UNKNOWN.
 */
import { detectBrands } from '@/lib/discovery/brands';
import { isPlausibleFoundingYear, stripDiacritics } from '@/lib/utils';

export type Tristate = 'YES' | 'NO' | 'UNKNOWN';

export interface Evidence {
  url: string;
  title: string | null;
  quote: string;
}

export interface SignalFinding {
  value: Tristate;
  evidence: Evidence[];
}

export interface YearFinding {
  year: number | null;
  evidence: Evidence[];
}

export interface ExtractionInput {
  url: string;
  title: string | null;
  content: string;
}

export interface ExtractionResult {
  spaActivity: SignalFinding;
  poolActivity: SignalFinding;
  saunaActivity: SignalFinding;
  wellnessActivity: SignalFinding;
  hammamActivity: SignalFinding;
  outdoorLiving: SignalFinding;
  hospitalityActivity: SignalFinding;
  showroom: SignalFinding;
  yearFounded: YearFinding;
  spaSinceYear: YearFinding;
  brands: { names: string[]; competitors: string[]; unmapped: string[]; evidence: Evidence[] };
  socials: { linkedin: string | null; instagram: string | null; facebook: string | null; youtube: string | null };
  emails: { value: string; url: string }[];
  /** Multi-location wording, e.g. "our 3 showrooms". */
  locationCount: { count: number | null; evidence: Evidence[] };
}

/** Multilingual keyword sets. A hit requires the literal phrase in the text. */
const SIGNAL_PHRASES: Record<
  Exclude<keyof ExtractionResult, 'yearFounded' | 'spaSinceYear' | 'brands' | 'socials' | 'emails' | 'locationCount'>,
  string[]
> = {
  spaActivity: [
    'spa', 'spas', 'hot tub', 'hot tubs', 'jacuzzi', 'whirlpool', 'hydromassage',
    'hidromasaje', 'idromassaggio', 'banera de hidromasaje', 'spa de nage',
    'swim spa', 'poreallas', 'boblebad', 'spabad', 'virivka', 'virivky',
    'jakuzzi', 'masazni bazen', 'dzhakuzi', 'джакузи', 'جاكوزي', 'сп а бассейн',
    'спа бассейн', 'banheira de hidromassagem', 'aussenwhirlpool',
  ],
  poolActivity: [
    'swimming pool', 'swimming pools', 'pool construction', 'pool builder',
    'pool', 'pools', 'piscina', 'piscinas', 'piscine', 'piscines',
    'schwimmbad', 'schwimmbader', 'zwembad', 'zwembaden', 'basen', 'baseny',
    'bazen', 'bazeny', 'medence', 'medencek', 'havuz', 'havuzlar',
    'бассейн', 'бассейны', 'басейн', 'басейни', 'مسبح', 'مسابح',
    'πισίνα', 'πισίνες', 'uima-allas', 'poolbygg', 'bassenger', 'bazén',
  ],
  saunaActivity: [
    'sauna', 'saunas', 'saune', 'saune finlandesi', 'sauny', 'szauna', 'szaunak',
    'bastu', 'bastuar', 'badstue', 'loyly', 'сауна', 'сауны', 'ساونا', 'σάουνα',
  ],
  wellnessActivity: [
    'wellness', 'bien-etre', 'bienestar', 'benessere', 'welness', 'wellnes',
    'spa & wellness', 'centro de bienestar', 'wellnessbereich', 'велнес',
  ],
  hammamActivity: [
    'hammam', 'hammams', 'hamam', 'steam room', 'steam rooms', 'bano turco',
    'bagno turco', 'dampfbad', 'stoomcabine', 'حمام بخار', 'χαμάμ',
  ],
  outdoorLiving: [
    'outdoor living', 'garden furniture', 'mobilier de jardin', 'muebles de exterior',
    'arredo giardino', 'gartenmobel', 'tuinmeubelen', 'meble ogrodowe', 'landscaping',
    'paysagiste', 'paisajismo', 'jardineria', 'bahce mobilyasi',
  ],
  hospitalityActivity: [
    'hotel', 'hotels', 'hoteles', 'hotellerie', 'hospitality', 'resort', 'resorts',
    'commercial projects', 'proyectos comerciales', 'projets hoteliers', 'wellness hotel',
    'thalasso', 'thermal', 'balneario', 'فنادق',
  ],
  showroom: [
    'showroom', 'show room', 'exposicion', 'exposición', 'sala de exposicion',
    'salle d exposition', 'salle exposition', 'ausstellung', 'ausstellungsraum',
    'esposizione', 'toonzaal', 'salon wystawowy', 'kiallitoterem', 'expozice',
    'visit our store', 'visit us', 'our store', 'nuestra tienda', 'notre magasin',
    'point de vente', 'punto de venta', 'flagship store', 'معرض', 'salon d exposition',
  ],
};

/** Phrases that positively indicate an ABSENT capability. Rare but real. */
const NEGATIVE_PHRASES: Partial<Record<keyof typeof SIGNAL_PHRASES, string[]>> = {
  showroom: ['online only', 'solo online', 'venta solo online', 'uniquement en ligne', 'no showroom', 'pas de showroom'],
};

function haystack(text: string): string {
  return stripDiacritics(text).toLowerCase().replace(/\s+/g, ' ');
}

/** Whole-word containment so "spa" does not match "space" or "spain". */
function containsPhrase(hay: string, phrase: string): boolean {
  const p = stripDiacritics(phrase).toLowerCase().trim();
  if (!p) return false;
  const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, 'u').test(hay);
}

/** Pull a readable sentence around the match so the quote is real, not a fragment. */
function quoteAround(content: string, phrase: string, radius = 140): string {
  const hay = haystack(content);
  const p = stripDiacritics(phrase).toLowerCase();
  const idx = hay.indexOf(p);
  if (idx === -1) return content.slice(0, radius * 2).trim();
  const start = Math.max(0, idx - radius);
  const end = Math.min(content.length, idx + p.length + radius);
  return `${start > 0 ? '…' : ''}${content.slice(start, end).trim()}${end < content.length ? '…' : ''}`;
}

function emptySignal(): SignalFinding {
  return { value: 'UNKNOWN', evidence: [] };
}

/**
 * Founding-year patterns.
 *
 * Deliberately conservative: a bare 4-digit number is never a founding year.
 * The text must explicitly frame it (founded/since/established/…).
 */
const FOUNDED_PATTERNS: RegExp[] = [
  /\b(?:founded|established|est\.?|incorporated)\s*(?:in|since)?\s*[:\-]?\s*(\d{4})\b/gi,
  /\bsince\s+(\d{4})\b/gi,
  /\bfundada?\s+en\s+(\d{4})\b/gi,
  /\bdesde\s+(\d{4})\b/gi,
  /\bfondee?\s+en\s+(\d{4})\b/gi,
  /\bdepuis\s+(\d{4})\b/gi,
  /\bfondata\s+nel\s+(\d{4})\b/gi,
  /\bdal\s+(\d{4})\b/gi,
  /\bfundada\s+em\s+(\d{4})\b/gi,
  /\bgegrundet\s+(?:im\s+jahr\s+)?(\d{4})\b/gi,
  /\bseit\s+(\d{4})\b/gi,
  /\bopgericht\s+in\s+(\d{4})\b/gi,
  /\bsinds\s+(\d{4})\b/gi,
  /\bzalozona\s+w\s+(\d{4})\b/gi,
  /\bod\s+(\d{4})\s*roku\b/gi,
  /\balapitva\s+(\d{4})\b/gi,
  /\bkurulus\s+(\d{4})\b/gi,
  /\bتأسست\s+(?:عام\s+)?(\d{4})\b/g,
];

/** Only these forms tie a year to SPA activity specifically. */
const SPA_SINCE_PATTERNS: RegExp[] = [
  /\b(?:spa|spas|hot tubs?|jacuzzis?|whirlpools?)\b[^.]{0,60}?\bsince\s+(\d{4})\b/gi,
  /\bsince\s+(\d{4})\b[^.]{0,60}?\b(?:spa|spas|hot tubs?|jacuzzis?)\b/gi,
  /\b(?:spas?|hidromasaje)\b[^.]{0,60}?\bdesde\s+(\d{4})\b/gi,
  /\bdesde\s+(\d{4})\b[^.]{0,60}?\b(?:spas?|hidromasaje)\b/gi,
  /\b(?:spas?)\b[^.]{0,60}?\bdepuis\s+(\d{4})\b/gi,
  /\bdepuis\s+(\d{4})\b[^.]{0,60}?\b(?:spas?|jacuzzis?)\b/gi,
  /\b(?:whirlpool|whirlpools)\b[^.]{0,60}?\bseit\s+(\d{4})\b/gi,
  /\bseit\s+(\d{4})\b[^.]{0,60}?\b(?:whirlpool|whirlpools)\b/gi,
];

function extractYear(text: string, patterns: RegExp[]): number | null {
  const flat = stripDiacritics(text).replace(/\s+/g, ' ');
  const found: number[] = [];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    for (const m of flat.matchAll(pattern)) {
      const year = Number.parseInt(m[1], 10);
      if (isPlausibleFoundingYear(year)) found.push(year);
    }
  }
  if (found.length === 0) return null;
  // Earliest stated year is the founding claim; later ones are usually milestones.
  return Math.min(...found);
}

const SOCIAL_PATTERNS: { key: 'linkedin' | 'instagram' | 'facebook' | 'youtube'; re: RegExp }[] = [
  { key: 'linkedin', re: /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(?:company|in)\/[A-Za-z0-9\-_%.]+/i },
  { key: 'instagram', re: /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9\-_.]+/i },
  { key: 'facebook', re: /https?:\/\/(?:[a-z]{2,3}\.)?facebook\.com\/[A-Za-z0-9\-_.]+/i },
  { key: 'youtube', re: /https?:\/\/(?:www\.)?youtube\.com\/(?:@|c\/|channel\/|user\/)[A-Za-z0-9\-_%.]+/i },
];

/**
 * Email harvesting.
 *
 * ONLY addresses literally present in the retrieved text are kept. We never
 * construct `firstname.lastname@domain` or any other pattern-guessed address.
 * Role mailboxes are kept because they are genuinely public business contacts.
 */
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const EMAIL_BLOCKLIST = /(example\.|sentry\.io|\.png|\.jpg|\.jpeg|\.gif|\.webp|wixpress|godaddy|@2x)/i;

const LOCATION_COUNT_RE =
  /\b(\d{1,2})\s+(?:showrooms?|stores?|shops?|branches|locations?|tiendas|magasins|filialen|negozi|sucursales|punti vendita|salons)\b/i;

export function extractFromSources(sources: ExtractionInput[]): ExtractionResult {
  const result: ExtractionResult = {
    spaActivity: emptySignal(),
    poolActivity: emptySignal(),
    saunaActivity: emptySignal(),
    wellnessActivity: emptySignal(),
    hammamActivity: emptySignal(),
    outdoorLiving: emptySignal(),
    hospitalityActivity: emptySignal(),
    showroom: emptySignal(),
    yearFounded: { year: null, evidence: [] },
    spaSinceYear: { year: null, evidence: [] },
    brands: { names: [], competitors: [], unmapped: [], evidence: [] },
    socials: { linkedin: null, instagram: null, facebook: null, youtube: null },
    emails: [],
    locationCount: { count: null, evidence: [] },
  };

  const seenEmails = new Set<string>();

  for (const source of sources) {
    const text = `${source.title ?? ''}\n${source.content}`;
    const hay = haystack(text);

    // --- Activity signals ---------------------------------------------------
    for (const key of Object.keys(SIGNAL_PHRASES) as (keyof typeof SIGNAL_PHRASES)[]) {
      const negatives = NEGATIVE_PHRASES[key] ?? [];
      const negativeHit = negatives.find((p) => containsPhrase(hay, p));
      if (negativeHit && result[key].value === 'UNKNOWN') {
        result[key] = {
          value: 'NO',
          evidence: [{ url: source.url, title: source.title, quote: quoteAround(text, negativeHit) }],
        };
        continue;
      }

      const hit = SIGNAL_PHRASES[key].find((p) => containsPhrase(hay, p));
      if (!hit) continue;
      // A positive observation always wins over a previous UNKNOWN or NO.
      if (result[key].value !== 'YES') {
        result[key] = { value: 'YES', evidence: [] };
      }
      if (result[key].evidence.length < 3) {
        result[key].evidence.push({ url: source.url, title: source.title, quote: quoteAround(text, hit) });
      }
    }

    // --- Years --------------------------------------------------------------
    const founded = extractYear(text, FOUNDED_PATTERNS);
    if (founded !== null && (result.yearFounded.year === null || founded < result.yearFounded.year)) {
      result.yearFounded = {
        year: founded,
        evidence: [{ url: source.url, title: source.title, quote: quoteAround(text, String(founded)) }],
      };
    }

    const spaSince = extractYear(text, SPA_SINCE_PATTERNS);
    if (spaSince !== null && (result.spaSinceYear.year === null || spaSince < result.spaSinceYear.year)) {
      result.spaSinceYear = {
        year: spaSince,
        evidence: [{ url: source.url, title: source.title, quote: quoteAround(text, String(spaSince)) }],
      };
    }

    // --- Brands -------------------------------------------------------------
    const detection = detectBrands(text);
    if (detection.brands.length > 0) {
      for (const b of detection.brands) if (!result.brands.names.includes(b)) result.brands.names.push(b);
      for (const b of detection.competitorBrands) {
        if (!result.brands.competitors.includes(b)) result.brands.competitors.push(b);
      }
      if (result.brands.evidence.length < 5) {
        result.brands.evidence.push({
          url: source.url,
          title: source.title,
          quote: quoteAround(text, detection.brands[0]),
        });
      }
    }
    for (const m of detection.unmappedMentions) {
      if (!result.brands.unmapped.includes(m)) result.brands.unmapped.push(m);
    }

    // --- Socials ------------------------------------------------------------
    for (const { key, re } of SOCIAL_PATTERNS) {
      if (result.socials[key]) continue;
      const m = text.match(re);
      if (m) result.socials[key] = m[0];
    }

    // --- Emails -------------------------------------------------------------
    for (const m of text.matchAll(EMAIL_RE)) {
      const email = m[0].toLowerCase();
      if (EMAIL_BLOCKLIST.test(email) || seenEmails.has(email)) continue;
      seenEmails.add(email);
      result.emails.push({ value: email, url: source.url });
    }

    // --- Multi-location -----------------------------------------------------
    const locMatch = text.match(LOCATION_COUNT_RE);
    if (locMatch && result.locationCount.count === null) {
      const count = Number.parseInt(locMatch[1], 10);
      if (count > 1 && count <= 50) {
        result.locationCount = {
          count,
          evidence: [{ url: source.url, title: source.title, quote: quoteAround(text, locMatch[0]) }],
        };
      }
    }
  }

  return result;
}
