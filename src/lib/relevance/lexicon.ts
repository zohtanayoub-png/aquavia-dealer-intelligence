/**
 * Dealer-relevance lexicon.
 *
 * THE CENTRAL PROBLEM THIS SOLVES
 * -------------------------------
 * "Spa" is the most dangerous word in this domain. In English, French, Arabic
 * and almost every market we prospect, it means BOTH:
 *
 *   (a) a hot tub — a physical product a dealer resells   → our prospect
 *   (b) a massage / beauty / treatment venue              → NOT our prospect
 *
 * Google Places makes this worse: its `spa` place-type means (b). So the naive
 * search that found our first Morocco dataset pulled in massage salons and
 * hotel treatment spas alongside genuine pool-and-spa retailers.
 *
 * The rule encoded here: the bare word "spa" NEVER establishes relevance on
 * its own. Relevance requires evidence of a PHYSICAL PRODUCT being sold —
 * a hot tub, a swim spa, pool equipment, a sauna cabin — or a competing spa
 * brand being represented.
 */

export type Lang = 'en' | 'fr' | 'ar' | 'es' | 'pt' | 'it' | 'de' | 'nl' | 'pl' | 'tr';

export interface Term {
  /** The phrase to match, lowercase and accent-free. */
  phrase: string;
  lang: Lang;
  /** Relative strength of the signal. */
  weight: 'strong' | 'medium' | 'weak';
}

const t = (lang: Lang, weight: Term['weight']) => (phrase: string): Term => ({ phrase, lang, weight });

// ---------------------------------------------------------------------------
// POSITIVE — evidence of a PHYSICAL PRODUCT being sold
// ---------------------------------------------------------------------------

/**
 * STRONG: essentially unambiguous references to a hot tub as a product.
 * These are what override negative service terminology.
 */
export const HOT_TUB_PRODUCT_TERMS: Term[] = [
  ...['hot tub', 'hot tubs', 'hottub', 'whirlpool bath', 'portable spa', 'portable spas',
      'spa pool', 'outdoor spa', 'outdoor spas', 'inflatable spa', 'plug and play spa',
      'acrylic spa', 'spa cover', 'spa chemicals', 'hot tub showroom'].map(t('en', 'strong')),
  ...['spa de nage', 'spa exterieur', 'spa exterieurs', 'spa portable', 'spa gonflable',
      'spa rigide', 'spa encastrable', 'jacuzzi exterieur', 'bain a remous', 'bains a remous',
      'vente de spas', 'vente de spa', 'spas a debordement', 'couverture de spa',
      'spa 5 places', 'spa 4 places', 'spa 6 places'].map(t('fr', 'strong')),
  ...['جاكوزي خارجي', 'حوض جاكوزي', 'بيع جاكوزي', 'مغطس جاكوزي', 'جاكوزي للبيع'].map(t('ar', 'strong')),
  ...['spa de exterior', 'spa hinchable', 'banera de hidromasaje', 'venta de spas',
      'jacuzzi exterior'].map(t('es', 'strong')),
  ...['banheira de hidromassagem', 'spa exterior', 'venda de spas'].map(t('pt', 'strong')),
  ...['minipiscina idromassaggio', 'vasca idromassaggio esterna', 'vendita spa'].map(t('it', 'strong')),
  ...['aussenwhirlpool', 'whirlpool kaufen', 'whirlpool fachhandel', 'gartenwhirlpool'].map(t('de', 'strong')),
  ...['buitenspa', 'jacuzzi kopen', 'spa kopen'].map(t('nl', 'strong')),
  ...['jacuzzi ogrodowe', 'wanna z hydromasazem', 'sprzedaz jacuzzi'].map(t('pl', 'strong')),
  ...['dis mekan jakuzi', 'jakuzi satis', 'jakuzi bayi'].map(t('tr', 'strong')),
];

export const SWIM_SPA_TERMS: Term[] = [
  ...['swim spa', 'swimspa', 'swim spas', 'endless pool'].map(t('en', 'strong')),
  ...['spa de nage', 'piscine a contre courant', 'nage a contre courant'].map(t('fr', 'strong')),
  ...['حوض سباحة سبا'].map(t('ar', 'strong')),
  ...['piscina de nado contracorriente'].map(t('es', 'strong')),
  ...['swim spa becken', 'gegenstromanlage'].map(t('de', 'strong')),
];

export const POOL_PRODUCT_TERMS: Term[] = [
  ...['pool equipment', 'pool construction', 'pool builder', 'swimming pool installation',
      'pool pumps', 'pool filtration', 'pool liner', 'pool maintenance products',
      'above ground pool', 'pool showroom'].map(t('en', 'strong')),
  ...['construction de piscine', 'constructeur de piscines', 'pisciniste',
      'equipement de piscine', 'materiel de piscine', 'pompe de piscine',
      'filtration piscine', 'liner piscine', 'piscine coque', 'vente de piscines',
      'traitement de l eau piscine', 'produits piscine'].map(t('fr', 'strong')),
  ...['بناء المسابح', 'تجهيزات المسابح', 'معدات المسابح', 'مقاول مسابح', 'بيع مسابح'].map(t('ar', 'strong')),
  ...['construccion de piscinas', 'equipamiento de piscinas', 'venta de piscinas'].map(t('es', 'strong')),
  ...['construcao de piscinas', 'equipamento de piscinas'].map(t('pt', 'strong')),
  ...['costruzione piscine', 'attrezzature piscine'].map(t('it', 'strong')),
  ...['schwimmbadbau', 'poolbau', 'schwimmbadtechnik'].map(t('de', 'strong')),
  ...['zwembadbouw', 'zwembadtechniek'].map(t('nl', 'strong')),
  ...['budowa basenow', 'technika basenowa'].map(t('pl', 'strong')),
  ...['havuz insaati', 'havuz malzemeleri'].map(t('tr', 'strong')),
];

export const SAUNA_EQUIPMENT_TERMS: Term[] = [
  ...['sauna cabin', 'infrared sauna', 'sauna heater', 'steam generator',
      'steam room installation', 'sauna installation', 'sauna supplier'].map(t('en', 'strong')),
  ...['cabine de sauna', 'sauna infrarouge', 'poele de sauna', 'installation de hammam',
      'generateur de vapeur', 'construction de hammam', 'fabricant de hammam'].map(t('fr', 'strong')),
  ...['تركيب ساونا', 'كابينة ساونا', 'مولد بخار', 'تجهيز حمام بخار'].map(t('ar', 'strong')),
  ...['cabina de sauna', 'sauna infrarrojos'].map(t('es', 'strong')),
  ...['saunabau', 'infrarotkabine', 'dampfgenerator'].map(t('de', 'strong')),
];

export const WELLNESS_EQUIPMENT_TERMS: Term[] = [
  ...['wellness equipment', 'spa equipment supplier', 'wellness installation',
      'balneotherapy equipment', 'hydrotherapy equipment'].map(t('en', 'strong')),
  ...['equipement wellness', 'equipement de spa', 'materiel de bien etre',
      'amenagement espace bien etre', 'balneotherapie'].map(t('fr', 'strong')),
  ...['تجهيزات سبا', 'معدات العافية'].map(t('ar', 'strong')),
  ...['equipamiento wellness'].map(t('es', 'strong')),
  ...['wellnessanlagen', 'wellness ausstattung'].map(t('de', 'strong')),
];

export const OUTDOOR_LIVING_TERMS: Term[] = [
  ...['outdoor living', 'garden furniture', 'patio furniture', 'pergola',
      'outdoor kitchen', 'landscaping showroom'].map(t('en', 'medium')),
  ...['mobilier de jardin', 'amenagement exterieur', 'amenagement de jardin',
      'salon de jardin', 'pergola bioclimatique', 'paysagiste'].map(t('fr', 'medium')),
  ...['أثاث حدائق', 'تنسيق حدائق', 'برجولات'].map(t('ar', 'medium')),
  ...['muebles de exterior', 'paisajismo'].map(t('es', 'medium')),
  ...['gartenmobel', 'aussenanlagen'].map(t('de', 'medium')),
];

/** Retail/distribution activity — proves they SELL rather than only service. */
export const RETAIL_DISTRIBUTION_TERMS: Term[] = [
  ...['official dealer', 'authorised dealer', 'authorized dealer', 'distributor',
      'importer', 'exclusive distributor', 'dealer locator', 'find a dealer',
      'our showroom', 'visit our showroom', 'showroom', 'price list', 'catalogue',
      'add to cart', 'in stock', 'delivery and installation'].map(t('en', 'medium')),
  ...['distributeur officiel', 'revendeur officiel', 'importateur',
      'distributeur exclusif', 'notre showroom', 'salle d exposition',
      'point de vente', 'devis gratuit', 'livraison et installation',
      'catalogue', 'tarifs'].map(t('fr', 'medium')),
  ...['موزع معتمد', 'وكيل معتمد', 'مستورد', 'صالة عرض', 'معرض'].map(t('ar', 'medium')),
  ...['distribuidor oficial', 'sala de exposicion'].map(t('es', 'medium')),
  ...['offizieller handler', 'vertragshandler', 'ausstellung'].map(t('de', 'medium')),
];

// ---------------------------------------------------------------------------
// NEGATIVE — service businesses, NOT product resellers
// ---------------------------------------------------------------------------

/** Massage / treatment venues. */
export const MASSAGE_SERVICE_TERMS: Term[] = [
  ...['massage', 'massage therapy', 'massage center', 'massage centre', 'thai massage',
      'body treatment', 'body scrub', 'relaxation center', 'relaxation centre',
      'spa therapist', 'massage parlour', 'wellness massage', 'day spa',
      'treatment room', 'reflexology', 'aromatherapy massage'].map(t('en', 'strong')),
  ...['centre de massage', 'salon de massage', 'massage relaxant', 'massage traditionnel',
      'soins du corps', 'gommage', 'modelage', 'centre de relaxation',
      'spa de jour', 'salle de soins', 'reflexologie'].map(t('fr', 'strong')),
  ...['تدليك', 'مركز تدليك', 'مساج', 'صالون مساج', 'علاج بالتدليك'].map(t('ar', 'strong')),
  ...['masaje', 'centro de masajes'].map(t('es', 'strong')),
  ...['massagem', 'centro de massagem'].map(t('pt', 'strong')),
  ...['massaggio', 'centro massaggi'].map(t('it', 'strong')),
  ...['massage studio', 'wellnessmassage'].map(t('de', 'strong')),
  ...['masaj salonu'].map(t('tr', 'strong')),
];

/** Beauty / aesthetics. */
export const BEAUTY_SERVICE_TERMS: Term[] = [
  ...['beauty salon', 'beauty spa', 'facial', 'facials', 'nail salon', 'nails',
      'manicure', 'pedicure', 'hair salon', 'hairdresser', 'barber', 'barbershop',
      'eyelash', 'waxing', 'aesthetic clinic', 'esthetic', 'aesthetics',
      'medical spa', 'medspa', 'botox', 'laser hair removal', 'skin clinic',
      'makeup', 'cosmetic treatments'].map(t('en', 'strong')),
  ...['institut de beaute', 'salon de beaute', 'soins du visage', 'spa beaute',
      'centre esthetique', 'esthetique', 'onglerie', 'manucure', 'pedicure',
      'coiffure', 'salon de coiffure', 'barbier', 'epilation', 'clinique esthetique',
      'medecine esthetique', 'soins visage', 'maquillage'].map(t('fr', 'strong')),
  ...['صالون تجميل', 'مركز تجميل', 'العناية بالبشرة', 'تجميل', 'حلاقة',
      'عيادة تجميل', 'مانيكير', 'باديكير'].map(t('ar', 'strong')),
  ...['salon de belleza', 'centro de estetica', 'tratamientos faciales'].map(t('es', 'strong')),
  ...['salao de beleza', 'estetica'].map(t('pt', 'strong')),
  ...['centro estetico', 'estetista'].map(t('it', 'strong')),
  ...['kosmetikstudio', 'friseur', 'schonheitssalon'].map(t('de', 'strong')),
  ...['schoonheidssalon', 'kapper'].map(t('nl', 'strong')),
  ...['salon kosmetyczny', 'fryzjer'].map(t('pl', 'strong')),
  ...['guzellik salonu', 'kuafor'].map(t('tr', 'strong')),
];

/** Traditional hammam as a SERVICE (not hammam construction/equipment). */
export const HAMMAM_SERVICE_TERMS: Term[] = [
  ...['traditional hammam', 'hammam experience', 'hammam ritual', 'moroccan bath',
      'turkish bath experience', 'public bath'].map(t('en', 'strong')),
  ...['hammam traditionnel', 'hammam marocain', 'rituel hammam', 'bain maure',
      'hammam pour femmes', 'hammam pour hommes'].map(t('fr', 'strong')),
  ...['حمام تقليدي', 'حمام مغربي', 'حمام شعبي', 'كيس حمام'].map(t('ar', 'strong')),
];

/** Hotel / resort treatment spas. */
export const HOTEL_SPA_TERMS: Term[] = [
  ...['hotel spa', 'resort spa', 'spa hotel', 'our spa offers', 'spa menu',
      'spa treatments', 'book a treatment', 'spa packages', 'guest rooms',
      'riad', 'boutique hotel'].map(t('en', 'strong')),
  ...['spa de l hotel', 'spa hotel', 'menu de soins', 'carte des soins',
      'reserver un soin', 'forfait spa', 'chambres et suites', 'riad'].map(t('fr', 'strong')),
  ...['سبا الفندق', 'منتجع سبا', 'حجز جلسة'].map(t('ar', 'strong')),
];

/** Fitness / yoga / clinical — clearly not dealers. */
export const FITNESS_MEDICAL_TERMS: Term[] = [
  ...['yoga studio', 'yoga classes', 'pilates', 'fitness center', 'fitness centre',
      'gym membership', 'personal training', 'crossfit', 'physiotherapy',
      'physiotherapist', 'chiropractor', 'dental', 'clinic'].map(t('en', 'strong')),
  ...['salle de sport', 'salle de fitness', 'cours de yoga', 'kinesitherapie',
      'kinesitherapeute', 'clinique', 'cabinet medical'].map(t('fr', 'strong')),
  ...['نادي رياضي', 'يوغا', 'عيادة', 'علاج طبيعي'].map(t('ar', 'strong')),
];

// ---------------------------------------------------------------------------
// Google Places types
// ---------------------------------------------------------------------------

/**
 * Google place types that indicate a SERVICE venue.
 *
 * `spa` is on this list deliberately: in the Google Places taxonomy it means
 * a day spa / treatment venue, not a hot tub retailer. Treating it as a
 * positive is precisely what produced the false positives in the first run.
 */
export const NEGATIVE_PLACE_TYPES = new Set([
  'spa', 'massage', 'beauty_salon', 'nail_salon', 'hair_salon', 'hair_care',
  'barber_shop', 'skin_care_clinic', 'tanning_studio', 'yoga_studio', 'gym',
  'fitness_center', 'physiotherapist', 'chiropractor', 'doctor', 'dentist',
  'hospital', 'medical_lab', 'wellness_center', 'sauna', 'public_bath',
  'hotel', 'resort_hotel', 'lodging', 'motel', 'guest_house', 'bed_and_breakfast',
  'restaurant', 'cafe', 'bar', 'night_club', 'tourist_attraction',
]);

/** Google place types consistent with a product retailer / installer. */
export const POSITIVE_PLACE_TYPES = new Set([
  'store', 'home_improvement_store', 'hardware_store', 'furniture_store',
  'home_goods_store', 'garden_center', 'plumbing_supply_store',
  'building_materials_supplier', 'wholesaler', 'general_contractor',
  'contractor', 'plumber', 'electrician', 'swimming_pool_supply_store',
  'swimming_pool_contractor', 'landscaper', 'roofing_contractor',
]);

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

export function normalizeForMatch(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Whole-phrase match.
 *
 * Arabic and other non-Latin scripts have no word boundaries usable by \b, so
 * the boundary is expressed as "not a letter or digit" on either side, which
 * works across scripts.
 */
export function containsTerm(haystack: string, phrase: string): boolean {
  const p = normalizeForMatch(phrase);
  if (!p) return false;
  const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, 'u').test(haystack);
}

export interface TermHit {
  term: Term;
  /** Verbatim excerpt from the source text, never paraphrased. */
  quote: string;
}

/** Find the first matching term per phrase, with a real quote around it. */
export function findTerms(text: string, terms: Term[], limit = 6): TermHit[] {
  const hay = normalizeForMatch(text);
  const hits: TermHit[] = [];
  for (const term of terms) {
    if (hits.length >= limit) break;
    if (!containsTerm(hay, term.phrase)) continue;
    hits.push({ term, quote: quoteAround(text, term.phrase) });
  }
  return hits;
}

function quoteAround(text: string, phrase: string, radius = 110): string {
  const hay = normalizeForMatch(text);
  const idx = hay.indexOf(normalizeForMatch(phrase));
  if (idx === -1) return text.slice(0, radius * 2).trim();
  // Normalisation can shift offsets slightly; clamp into range.
  const start = Math.max(0, Math.min(idx - radius, text.length - 1));
  const end = Math.min(text.length, idx + phrase.length + radius);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}
