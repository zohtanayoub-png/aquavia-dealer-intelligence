/**
 * Business classification + dealer fit scoring.
 *
 * The governing rule, from the first Morocco dataset's false positives:
 *
 *   The word "spa" alone NEVER establishes relevance. A company is a dealer
 *   prospect only when there is evidence it SELLS A PHYSICAL PRODUCT — a hot
 *   tub, a swim spa, pool equipment, a sauna cabin — or represents a competing
 *   spa brand. Everything else is a service business, however "spa" its name.
 *
 * Conversely, product evidence OVERRIDES negative service terminology: a pool
 * company that also runs a treatment room is still a dealer prospect.
 */
import {
  BEAUTY_SERVICE_TERMS, FITNESS_MEDICAL_TERMS, HAMMAM_SERVICE_TERMS,
  HOTEL_SPA_TERMS, HOT_TUB_PRODUCT_TERMS, MASSAGE_SERVICE_TERMS,
  NEGATIVE_PLACE_TYPES, OUTDOOR_LIVING_TERMS, POOL_PRODUCT_TERMS,
  POSITIVE_PLACE_TYPES, RETAIL_DISTRIBUTION_TERMS, SAUNA_EQUIPMENT_TERMS,
  SWIM_SPA_TERMS, WELLNESS_EQUIPMENT_TERMS, findTerms, normalizeForMatch,
  type TermHit,
} from '@/lib/relevance/lexicon';

export type BusinessClassification =
  | 'HOT_TUB_SPA_RETAILER' | 'POOL_AND_SPA_COMPANY' | 'POOL_COMPANY'
  | 'WELLNESS_EQUIPMENT' | 'SAUNA_HAMMAM_EQUIPMENT' | 'OUTDOOR_LIVING'
  | 'HOTEL_HOSPITALITY_SUPPLIER' | 'CONSTRUCTION_LANDSCAPE_RELEVANT'
  | 'MASSAGE_DAY_SPA' | 'BEAUTY_AESTHETICS' | 'HOTEL_SPA_ONLY'
  | 'HAMMAM_SERVICE_ONLY' | 'IRRELEVANT' | 'UNKNOWN';

export type CommercialRelevance =
  | 'HIGHLY_RELEVANT' | 'RELEVANT' | 'POSSIBLE' | 'LOW_RELEVANCE' | 'IRRELEVANT';

export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
export type Tristate = 'YES' | 'NO' | 'UNKNOWN';

export interface Signal {
  code: string;
  label: string;
  points: number;
  /** Verbatim supporting text. Null when the signal comes from structured data. */
  quote: string | null;
  /** Where the evidence came from. */
  sourceUrl: string | null;
  source: 'NAME' | 'GOOGLE_TYPE' | 'WEB' | 'STORED_FIELD' | 'BRAND';
}

export interface EvidenceSource {
  url: string;
  title?: string | null;
  snippet?: string | null;
}

export interface ClassifyInput {
  name: string;
  googleTypes: string[];
  /** Verbatim excerpts already retrieved and stored — no new API calls. */
  sources: EvidenceSource[];
  website: string | null;
  spaActivity: Tristate;
  poolActivity: Tristate;
  saunaActivity: Tristate;
  wellnessActivity: Tristate;
  hammamActivity: Tristate;
  outdoorLiving: Tristate;
  hospitalityActivity: Tristate;
  showroom: Tristate;
  brands: string[];
  competitorBrands: string[];
  yearFounded: number | null;
  locationCount: number | null;
  decisionMakerCount: number;
  isMajorCity: boolean;
}

export interface ProductEvidenceItem {
  category: 'HOT_TUB' | 'SWIM_SPA' | 'POOL' | 'SAUNA' | 'WELLNESS' | 'OUTDOOR' | 'RETAIL';
  phrase: string;
  lang: string;
  quote: string;
  sourceUrl: string | null;
}

export interface ClassificationResult {
  classification: BusinessClassification;
  confidence: Confidence;
  reasons: string[];
  positiveSignals: Signal[];
  negativeSignals: Signal[];
  productEvidence: ProductEvidenceItem[];
  dealerFitScore: number;
  dealerFitBreakdown: Signal[];
  commercialRelevance: CommercialRelevance;
  isDealerProspect: boolean;
  notDealerProspectReason: string | null;
  whyDealer: string;
  whyNotDealer: string;
  /** True when only the company name was available — weak, needs enrichment. */
  needsEnrichment: boolean;
}

/** Points awarded per positive signal. Tuned so a genuine dealer reaches 80+. */
const POINTS = {
  hotTubProduct: 35,
  competitorBrand: 15,
  showroom: 12,
  showroomWithSpa: 5,
  dealerLocator: 10,
  poolProduct: 10,
  swimSpa: 5,
  saunaEquipment: 6,
  wellnessEquipment: 5,
  outdoorLiving: 5,
  retailDistribution: 6,
  multiLocation: 5,
  hospitality: 4,
  website: 5,
  established: 4,
  decisionMaker: 3,
  geography: 3,
  positivePlaceType: 4,
} as const;

/** Penalties. Only applied when product evidence does NOT override them. */
const PENALTIES = {
  massageService: -35,
  beautyService: -35,
  hammamService: -25,
  hotelSpaOnly: -30,
  fitnessMedical: -35,
  negativePlaceType: -20,
} as const;

const CLASSIFICATION_BONUS: Partial<Record<BusinessClassification, number>> = {
  HOT_TUB_SPA_RETAILER: 10,
  POOL_AND_SPA_COMPANY: 10,
  POOL_COMPANY: 6,
  SAUNA_HAMMAM_EQUIPMENT: 5,
  WELLNESS_EQUIPMENT: 5,
  OUTDOOR_LIVING: 4,
  HOTEL_HOSPITALITY_SUPPLIER: 4,
  CONSTRUCTION_LANDSCAPE_RELEVANT: 2,
};

function hitsToSignals(
  hits: { hit: TermHit; url: string | null }[],
  code: string,
  label: string,
  points: number,
  source: Signal['source'],
): Signal[] {
  return hits.slice(0, 3).map(({ hit, url }) => ({
    code,
    label: `${label}: "${hit.term.phrase}"`,
    points,
    quote: hit.quote,
    sourceUrl: url,
    source,
  }));
}

/** Search the company name plus every stored excerpt for a term set. */
function scan(input: ClassifyInput, terms: Parameters<typeof findTerms>[1]) {
  const out: { hit: TermHit; url: string | null }[] = [];
  for (const hit of findTerms(input.name, terms, 3)) out.push({ hit, url: null });
  for (const source of input.sources) {
    const text = [source.title, source.snippet].filter(Boolean).join(' \n ');
    if (!text.trim()) continue;
    for (const hit of findTerms(text, terms, 3)) out.push({ hit, url: source.url });
  }
  return out;
}

export function classifyCompany(input: ClassifyInput): ClassificationResult {
  const positives: Signal[] = [];
  const negatives: Signal[] = [];
  const productEvidence: ProductEvidenceItem[] = [];
  const reasons: string[] = [];

  const pushProduct = (
    category: ProductEvidenceItem['category'],
    entries: { hit: TermHit; url: string | null }[],
  ) => {
    for (const { hit, url } of entries.slice(0, 4)) {
      productEvidence.push({
        category,
        phrase: hit.term.phrase,
        lang: hit.term.lang,
        quote: hit.quote,
        sourceUrl: url,
      });
    }
  };

  // --- Positive product evidence -------------------------------------------
  const hotTub = scan(input, HOT_TUB_PRODUCT_TERMS);
  const swimSpa = scan(input, SWIM_SPA_TERMS);
  const pool = scan(input, POOL_PRODUCT_TERMS);
  const sauna = scan(input, SAUNA_EQUIPMENT_TERMS);
  const wellness = scan(input, WELLNESS_EQUIPMENT_TERMS);
  const outdoor = scan(input, OUTDOOR_LIVING_TERMS);
  const retail = scan(input, RETAIL_DISTRIBUTION_TERMS);

  if (hotTub.length > 0) {
    positives.push(...hitsToSignals(hotTub, 'HOT_TUB_PRODUCT', 'Sells hot tubs / spas as a product', POINTS.hotTubProduct, 'WEB'));
    pushProduct('HOT_TUB', hotTub);
    reasons.push('Explicit hot tub / spa product terminology found in retrieved text.');
  }
  if (swimSpa.length > 0) {
    positives.push(...hitsToSignals(swimSpa, 'SWIM_SPA', 'Sells swim spas', POINTS.swimSpa, 'WEB'));
    pushProduct('SWIM_SPA', swimSpa);
  }
  if (pool.length > 0) {
    positives.push(...hitsToSignals(pool, 'POOL_PRODUCT', 'Pool construction / equipment', POINTS.poolProduct, 'WEB'));
    pushProduct('POOL', pool);
  }
  if (sauna.length > 0) {
    positives.push(...hitsToSignals(sauna, 'SAUNA_EQUIPMENT', 'Sauna / hammam equipment', POINTS.saunaEquipment, 'WEB'));
    pushProduct('SAUNA', sauna);
  }
  if (wellness.length > 0) {
    positives.push(...hitsToSignals(wellness, 'WELLNESS_EQUIPMENT', 'Wellness equipment supply', POINTS.wellnessEquipment, 'WEB'));
    pushProduct('WELLNESS', wellness);
  }
  if (outdoor.length > 0) {
    positives.push(...hitsToSignals(outdoor, 'OUTDOOR_LIVING', 'Outdoor living / garden', POINTS.outdoorLiving, 'WEB'));
    pushProduct('OUTDOOR', outdoor);
  }

  const dealerLocator = retail.filter(({ hit }) =>
    /dealer locator|find a dealer|distributeur officiel|revendeur officiel|official dealer|authorised dealer|authorized dealer|موزع معتمد|وكيل معتمد/.test(
      normalizeForMatch(hit.term.phrase),
    ));
  if (dealerLocator.length > 0) {
    positives.push(...hitsToSignals(dealerLocator, 'DEALER_LOCATOR', 'Appears as an official dealer / distributor', POINTS.dealerLocator, 'WEB'));
    pushProduct('RETAIL', dealerLocator);
  } else if (retail.length > 0) {
    positives.push(...hitsToSignals(retail, 'RETAIL_DISTRIBUTION', 'Retail / distribution activity', POINTS.retailDistribution, 'WEB'));
    pushProduct('RETAIL', retail);
  }

  // --- Competitor brands ---------------------------------------------------
  if (input.competitorBrands.length > 0) {
    positives.push({
      code: 'COMPETITOR_BRAND',
      label: `Represents competing spa brand(s): ${input.competitorBrands.join(', ')}`,
      points: POINTS.competitorBrand,
      quote: null,
      sourceUrl: null,
      source: 'BRAND',
    });
    reasons.push(`Represents ${input.competitorBrands.join(', ')} — proven ability to sell this product category.`);
  }

  // --- Structured fields ---------------------------------------------------
  const structured: [boolean, string, string, number][] = [
    [input.showroom === 'YES', 'SHOWROOM', 'Physical showroom confirmed', POINTS.showroom],
    [input.showroom === 'YES' && input.spaActivity === 'YES', 'SHOWROOM_WITH_SPA', 'Showroom displaying spa products', POINTS.showroomWithSpa],
    [(input.locationCount ?? 0) > 1, 'MULTI_LOCATION', `${input.locationCount} physical locations`, POINTS.multiLocation],
    [input.hospitalityActivity === 'YES', 'HOSPITALITY', 'Supplies hotels / commercial projects', POINTS.hospitality],
    [Boolean(input.website), 'WEBSITE', 'Has a working website', POINTS.website],
    [input.yearFounded !== null && new Date().getUTCFullYear() - input.yearFounded >= 10, 'ESTABLISHED', `Established since ${input.yearFounded}`, POINTS.established],
    [input.decisionMakerCount > 0, 'DECISION_MAKER', `${input.decisionMakerCount} decision maker(s) identified`, POINTS.decisionMaker],
    [input.isMajorCity, 'GEOGRAPHY', 'Located in a major commercial city', POINTS.geography],
  ];
  for (const [ok, code, label, points] of structured) {
    if (ok) positives.push({ code, label, points, quote: null, sourceUrl: null, source: 'STORED_FIELD' });
  }

  const positiveTypes = input.googleTypes.filter((t) => POSITIVE_PLACE_TYPES.has(t));
  if (positiveTypes.length > 0) {
    positives.push({
      code: 'POSITIVE_PLACE_TYPE',
      label: `Google business category: ${positiveTypes.join(', ')}`,
      points: POINTS.positivePlaceType,
      quote: null,
      sourceUrl: null,
      source: 'GOOGLE_TYPE',
    });
  }

  // --- Negative service signals --------------------------------------------
  const massage = scan(input, MASSAGE_SERVICE_TERMS);
  const beauty = scan(input, BEAUTY_SERVICE_TERMS);
  const hammamService = scan(input, HAMMAM_SERVICE_TERMS);
  const hotelSpa = scan(input, HOTEL_SPA_TERMS);
  const fitnessMedical = scan(input, FITNESS_MEDICAL_TERMS);
  const negativeTypes = input.googleTypes.filter((t) => NEGATIVE_PLACE_TYPES.has(t));

  if (massage.length > 0) negatives.push(...hitsToSignals(massage, 'MASSAGE_SERVICE', 'Massage / treatment service', PENALTIES.massageService, 'WEB'));
  if (beauty.length > 0) negatives.push(...hitsToSignals(beauty, 'BEAUTY_SERVICE', 'Beauty / aesthetics service', PENALTIES.beautyService, 'WEB'));
  if (hammamService.length > 0) negatives.push(...hitsToSignals(hammamService, 'HAMMAM_SERVICE', 'Traditional hammam service', PENALTIES.hammamService, 'WEB'));
  if (hotelSpa.length > 0) negatives.push(...hitsToSignals(hotelSpa, 'HOTEL_SPA', 'Hotel / resort treatment spa', PENALTIES.hotelSpaOnly, 'WEB'));
  if (fitnessMedical.length > 0) negatives.push(...hitsToSignals(fitnessMedical, 'FITNESS_MEDICAL', 'Fitness / medical service', PENALTIES.fitnessMedical, 'WEB'));
  if (negativeTypes.length > 0) {
    negatives.push({
      code: 'NEGATIVE_PLACE_TYPE',
      label: `Google business category indicates a service venue: ${negativeTypes.join(', ')}`,
      points: PENALTIES.negativePlaceType,
      quote: null,
      sourceUrl: null,
      source: 'GOOGLE_TYPE',
    });
  }

  // --- The override rule ---------------------------------------------------
  // Product evidence beats service terminology: a pool builder that also has a
  // treatment room is still a dealer prospect. Structured spa/pool activity is
  // NOT sufficient on its own, because that is what "spa" ambiguity poisoned.
  const hasProductEvidence =
    hotTub.length > 0 || swimSpa.length > 0 || pool.length > 0 ||
    sauna.length > 0 || wellness.length > 0 ||
    input.competitorBrands.length > 0 || dealerLocator.length > 0;

  const hasServiceEvidence =
    massage.length > 0 || beauty.length > 0 || hammamService.length > 0 ||
    hotelSpa.length > 0 || fitnessMedical.length > 0 || negativeTypes.length > 0;

  if (hasProductEvidence && hasServiceEvidence) {
    reasons.push('Service terminology present, but overridden by confirmed physical product evidence.');
  }

  const classification = decideClassification({
    input, hasProductEvidence,
    hotTub: hotTub.length > 0, swimSpa: swimSpa.length > 0, pool: pool.length > 0,
    sauna: sauna.length > 0, wellness: wellness.length > 0, outdoor: outdoor.length > 0,
    massage: massage.length > 0, beauty: beauty.length > 0,
    hammamService: hammamService.length > 0, hotelSpa: hotelSpa.length > 0,
    fitnessMedical: fitnessMedical.length > 0, negativeTypes,
  });

  // --- Dealer fit score ----------------------------------------------------
  const breakdown: Signal[] = [...positives];
  const bonus = CLASSIFICATION_BONUS[classification];
  if (bonus) {
    breakdown.push({
      code: 'CLASSIFICATION_BONUS',
      label: `Classified as ${classification.replace(/_/g, ' ')}`,
      points: bonus,
      quote: null, sourceUrl: null, source: 'STORED_FIELD',
    });
  }
  // Penalties apply only when nothing proves they actually sell product.
  if (!hasProductEvidence) breakdown.push(...negatives);

  const raw = breakdown.reduce((sum, s) => sum + s.points, 0);
  const dealerFitScore = Math.max(0, Math.min(100, raw));

  const isServiceOnly = SERVICE_CLASSIFICATIONS.has(classification);
  const isDealerProspect = !isServiceOnly && classification !== 'IRRELEVANT';

  const evidenceCount = productEvidence.length + input.competitorBrands.length;
  const confidence: Confidence =
    classification === 'UNKNOWN' ? 'UNKNOWN'
    : evidenceCount >= 3 || (isServiceOnly && negatives.length >= 3) ? 'HIGH'
    : evidenceCount >= 1 || negatives.length >= 1 ? 'MEDIUM'
    : 'LOW';

  return {
    classification,
    confidence,
    reasons,
    positiveSignals: positives,
    negativeSignals: negatives,
    productEvidence,
    dealerFitScore,
    dealerFitBreakdown: breakdown,
    commercialRelevance: toRelevance(
      dealerFitScore,
      isDealerProspect,
      // "Nothing found" is not the same as "found to be irrelevant".
      classification === 'UNKNOWN' && negatives.length === 0 ? 'NO_EVIDENCE' : 'EVIDENCED',
    ),
    isDealerProspect,
    notDealerProspectReason: isDealerProspect ? null : buildNotProspectReason(classification, negatives),
    whyDealer: buildWhyDealer(input, positives, productEvidence, classification),
    whyNotDealer: buildWhyNotDealer(negatives, hasProductEvidence, classification),
    needsEnrichment: input.sources.length === 0 || classification === 'UNKNOWN',
  };
}

const SERVICE_CLASSIFICATIONS = new Set<BusinessClassification>([
  'MASSAGE_DAY_SPA', 'BEAUTY_AESTHETICS', 'HOTEL_SPA_ONLY', 'HAMMAM_SERVICE_ONLY',
]);

interface DecideInput {
  input: ClassifyInput;
  hasProductEvidence: boolean;
  hotTub: boolean; swimSpa: boolean; pool: boolean; sauna: boolean;
  wellness: boolean; outdoor: boolean; massage: boolean; beauty: boolean;
  hammamService: boolean; hotelSpa: boolean; fitnessMedical: boolean;
  negativeTypes: string[];
}

function decideClassification(d: DecideInput): BusinessClassification {
  const { input } = d;

  // Product evidence takes precedence over any service terminology.
  const sellsHotTubs = d.hotTub || d.swimSpa || input.competitorBrands.length > 0;
  if (sellsHotTubs && d.pool) return 'POOL_AND_SPA_COMPANY';
  if (sellsHotTubs) return 'HOT_TUB_SPA_RETAILER';
  if (d.pool) return 'POOL_COMPANY';
  if (d.sauna) return 'SAUNA_HAMMAM_EQUIPMENT';
  if (d.wellness) return 'WELLNESS_EQUIPMENT';

  // Service classifications, only once product evidence is ruled out.
  if (d.fitnessMedical) return 'IRRELEVANT';
  if (d.beauty) return 'BEAUTY_AESTHETICS';
  if (d.massage) return 'MASSAGE_DAY_SPA';
  if (d.hotelSpa) return 'HOTEL_SPA_ONLY';
  if (d.hammamService) return 'HAMMAM_SERVICE_ONLY';

  if (d.outdoor) return 'OUTDOOR_LIVING';
  if (input.hospitalityActivity === 'YES') return 'HOTEL_HOSPITALITY_SUPPLIER';

  // Google's own taxonomy, used only as a fallback.
  if (d.negativeTypes.some((t) => ['massage', 'spa', 'wellness_center', 'sauna', 'public_bath'].includes(t))) {
    return 'MASSAGE_DAY_SPA';
  }
  if (d.negativeTypes.some((t) => ['beauty_salon', 'nail_salon', 'hair_salon', 'hair_care', 'barber_shop', 'skin_care_clinic'].includes(t))) {
    return 'BEAUTY_AESTHETICS';
  }
  if (d.negativeTypes.some((t) => ['hotel', 'resort_hotel', 'lodging', 'motel', 'guest_house', 'bed_and_breakfast'].includes(t))) {
    return 'HOTEL_SPA_ONLY';
  }
  if (d.negativeTypes.some((t) => ['gym', 'fitness_center', 'yoga_studio', 'doctor', 'dentist', 'hospital', 'restaurant', 'cafe', 'bar'].includes(t))) {
    return 'IRRELEVANT';
  }
  if (input.googleTypes.some((t) => POSITIVE_PLACE_TYPES.has(t))) return 'CONSTRUCTION_LANDSCAPE_RELEVANT';

  // Deliberately UNKNOWN rather than a guess.
  return 'UNKNOWN';
}

/**
 * Band a dealer fit score.
 *
 * IRRELEVANT is a POSITIVE claim — "we have evidence this is a service
 * business, not a reseller". It is not the same as "we found nothing".
 * A company with no evidence either way bottoms out at LOW_RELEVANCE, because
 * calling it irrelevant would assert something we have not established, and
 * would bury exactly the records that most deserve enrichment.
 */
export function toRelevance(
  score: number,
  isDealerProspect: boolean,
  evidenceState: 'EVIDENCED' | 'NO_EVIDENCE' = 'EVIDENCED',
): CommercialRelevance {
  if (!isDealerProspect) return 'IRRELEVANT';
  if (score >= 80) return 'HIGHLY_RELEVANT';
  if (score >= 60) return 'RELEVANT';
  if (score >= 40) return 'POSSIBLE';
  // Below 20 a company is weak, but it is still in an adjacent trade — the
  // classifier already decided it is a dealer prospect. IRRELEVANT is reserved
  // for companies that are NOT dealer prospects at all, so the two concepts
  // stay in step: IRRELEVANT ⟺ NOT A DEALER PROSPECT.
  void evidenceState;
  return 'LOW_RELEVANCE';
}

function buildNotProspectReason(c: BusinessClassification, negatives: Signal[]): string {
  const label: Record<string, string> = {
    MASSAGE_DAY_SPA: 'a massage / day spa offering treatments, not selling spa products',
    BEAUTY_AESTHETICS: 'a beauty / aesthetics business',
    HOTEL_SPA_ONLY: 'a hotel or resort treatment spa with no product retail',
    HAMMAM_SERVICE_ONLY: 'a traditional hammam service business',
    IRRELEVANT: 'outside the spa, pool and wellness equipment trade',
  };
  const top = negatives[0]?.label;
  return `NOT A DEALER PROSPECT — this appears to be ${label[c] ?? 'not a product reseller'}. ` +
    `No confirmed physical product or equipment sales.${top ? ` Strongest signal: ${top}.` : ''} ` +
    'Kept for research history; reclassify manually if product sales are confirmed.';
}

function buildWhyDealer(
  input: ClassifyInput, positives: Signal[],
  product: ProductEvidenceItem[], classification: BusinessClassification,
): string {
  if (positives.length === 0) {
    return 'No positive dealer signals could be verified from the evidence held. UNKNOWN.';
  }
  const parts: string[] = [];
  if (product.some((p) => p.category === 'HOT_TUB')) parts.push('sells hot tubs / spas as physical products');
  if (product.some((p) => p.category === 'SWIM_SPA')) parts.push('sells swim spas');
  if (input.competitorBrands.length > 0) parts.push(`already represents ${input.competitorBrands.join(', ')}`);
  if (product.some((p) => p.category === 'POOL')) parts.push('builds or supplies swimming pools');
  if (product.some((p) => p.category === 'SAUNA')) parts.push('supplies sauna / hammam equipment');
  if (input.showroom === 'YES') parts.push('has a physical showroom');
  if ((input.locationCount ?? 0) > 1) parts.push(`operates ${input.locationCount} locations`);
  if (input.hospitalityActivity === 'YES') parts.push('supplies hotels and commercial projects');

  const head = `Classified as ${classification.replace(/_/g, ' ')}.`;
  if (parts.length === 0) return `${head} Supporting signals are structural (website, location, contactability) rather than product-based.`;
  return `${head} This company ${parts.join(', ')}.`;
}

function buildWhyNotDealer(
  negatives: Signal[], hasProductEvidence: boolean, classification: BusinessClassification,
): string {
  if (negatives.length === 0) {
    return SERVICE_CLASSIFICATIONS.has(classification)
      ? 'Classified as a service business, but no explicit negative terminology was found — treat as UNKNOWN and qualify manually.'
      : 'No negative signals found.';
  }
  const list = negatives.slice(0, 4).map((n) => n.label).join('; ');
  if (hasProductEvidence) {
    return `Service-oriented signals were found (${list}), but they are OVERRIDDEN by confirmed physical product evidence, ` +
      'so this company remains a dealer prospect.';
  }
  return `${list}. No physical product or equipment sales could be confirmed, so this is not a realistic Aquavia reseller.`;
}
