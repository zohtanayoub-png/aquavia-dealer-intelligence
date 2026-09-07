/**
 * Country reference data.
 *
 * Country display names come from the ICU data built into Node/V8 via
 * Intl.DisplayNames, so we do not hand-maintain 200 names. What we DO
 * maintain is the mapping from country -> the languages a local business
 * actually advertises in, because that drives search terminology.
 */

/** ISO 3166-1 alpha-2 -> ISO 639-1 language codes, most dominant first. */
const COUNTRY_LANGUAGES: Record<string, string[]> = {
  // --- Europe: Western ---
  ES: ['es', 'ca'], PT: ['pt'], FR: ['fr'], IT: ['it'], DE: ['de'], AT: ['de'],
  CH: ['de', 'fr', 'it'], BE: ['nl', 'fr'], NL: ['nl'], LU: ['fr', 'de'],
  GB: ['en'], IE: ['en'], AD: ['ca', 'es'], MC: ['fr'], MT: ['en'], SM: ['it'],
  // --- Europe: Nordic & Baltic ---
  SE: ['sv'], NO: ['no'], DK: ['da'], FI: ['fi'], IS: ['is'],
  EE: ['et'], LV: ['lv'], LT: ['lt'],
  // --- Europe: Central & Eastern ---
  PL: ['pl'], CZ: ['cs'], SK: ['sk'], HU: ['hu'], RO: ['ro'], BG: ['bg'],
  SI: ['sl'], HR: ['hr'], RS: ['sr'], BA: ['hr'], ME: ['sr'], MK: ['mk'],
  AL: ['sq'], GR: ['el'], CY: ['el', 'en'], UA: ['uk'], MD: ['ro'],
  BY: ['ru'], RU: ['ru'], TR: ['tr'],
  // --- Middle East & North Africa ---
  MA: ['fr', 'ar'], DZ: ['fr', 'ar'], TN: ['fr', 'ar'], LY: ['ar'], EG: ['ar'],
  AE: ['en', 'ar'], SA: ['ar', 'en'], QA: ['en', 'ar'], KW: ['ar', 'en'],
  BH: ['en', 'ar'], OM: ['ar', 'en'], JO: ['ar', 'en'], LB: ['fr', 'ar'],
  IL: ['he', 'en'], IQ: ['ar'],
  // --- Sub-Saharan Africa ---
  ZA: ['en'], NG: ['en'], KE: ['en'], GH: ['en'], TZ: ['en'], UG: ['en'],
  SN: ['fr'], CI: ['fr'], CM: ['fr'], MU: ['en', 'fr'], RE: ['fr'],
  // --- Americas ---
  US: ['en'], CA: ['en', 'fr'], MX: ['es'], BR: ['pt'], AR: ['es'], CL: ['es'],
  CO: ['es'], PE: ['es'], UY: ['es'], PY: ['es'], BO: ['es'], EC: ['es'],
  VE: ['es'], CR: ['es'], PA: ['es'], GT: ['es'], DO: ['es'], PR: ['es', 'en'],
  // --- Asia-Pacific ---
  AU: ['en'], NZ: ['en'], SG: ['en'], MY: ['ms', 'en'], TH: ['th', 'en'],
  ID: ['id'], PH: ['en'], VN: ['vi'], IN: ['en'], JP: ['ja'], KR: ['ko'],
  CN: ['zh'], TW: ['zh'], HK: ['zh', 'en'], KZ: ['ru'], GE: ['en'], AM: ['ru'],
  AZ: ['ru', 'en'],
};

export interface Country {
  code: string;
  name: string;
  languages: string[];
}

let displayNames: Intl.DisplayNames | null = null;
function countryDisplayName(code: string): string {
  if (!displayNames) {
    try {
      displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
    } catch {
      displayNames = null;
    }
  }
  try {
    return displayNames?.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Every country the application can prospect, alphabetical by English name. */
export function listCountries(): Country[] {
  return Object.entries(COUNTRY_LANGUAGES)
    .map(([code, languages]) => ({ code, name: countryDisplayName(code), languages }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getCountry(codeOrName: string): Country | null {
  const raw = codeOrName.trim();
  if (!raw) return null;

  const upper = raw.toUpperCase();
  if (COUNTRY_LANGUAGES[upper]) {
    return { code: upper, name: countryDisplayName(upper), languages: COUNTRY_LANGUAGES[upper] };
  }

  const needle = raw.toLowerCase();
  const match = listCountries().find(
    (c) => c.name.toLowerCase() === needle || c.code.toLowerCase() === needle,
  );
  return match ?? null;
}

/** Languages to search in for a market. Always includes English as a fallback. */
export function languagesForCountry(code: string): string[] {
  const langs = COUNTRY_LANGUAGES[code.toUpperCase()] ?? ['en'];
  return langs.includes('en') ? langs : [...langs, 'en'];
}

export { COUNTRY_LANGUAGES };
