/**
 * AQUAVIA OPPORTUNITY SCORE — 0-100.
 *
 * Design principles:
 *  1. Every point is attributable. `breakdown` explains the whole score, so a
 *     sales manager can challenge any number in the table.
 *  2. UNKNOWN scores ZERO — never a midpoint, never a penalty guess. A company
 *     we know nothing about must not outrank one we have verified.
 *  3. `dataCompleteness` is reported separately so a 62 built on 9 verified
 *     signals is visibly stronger than a 62 built on 3.
 */
import { clamp } from '@/lib/utils';
import { isPremiumBrand } from '@/lib/discovery/brands';

export type Tristate = 'YES' | 'NO' | 'UNKNOWN';
export type Priority = 'A' | 'B' | 'C' | 'D';
export type NextAction = 'VISIT' | 'CALL' | 'EMAIL' | 'LINKEDIN' | 'QUALIFY_FIRST' | 'LOW_PRIORITY';
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

export interface ScoreInput {
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
  spaSinceYear: number | null;
  googleRating: number | null;
  googleReviewCount: number | null;
  website: string | null;
  linkedinUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  locationCount: number | null;
  decisionMakerCount: number;
  /** Signal that the company sits in a commercially important place. */
  isMajorCity: boolean;
  /** False when we hold no major-city reference for this market. */
  isMajorCityKnown: boolean;
  representsAquavia: Tristate;
}

export interface ScoreSignal {
  key: string;
  label: string;
  /** Points awarded. */
  points: number;
  /** Maximum this signal can contribute. */
  max: number;
  /** How the points were arrived at, in plain language. */
  detail: string;
  /** False when the underlying data was UNKNOWN — scored 0, not penalised. */
  verified: boolean;
}

export interface ScoreResult {
  score: number;
  priority: Priority;
  breakdown: ScoreSignal[];
  /** 0-100: proportion of scoring weight that rests on verified data. */
  dataCompleteness: number;
  confidence: Confidence;
}

const CURRENT_YEAR = () => new Date().getUTCFullYear();

export function scoreCompany(input: ScoreInput): ScoreResult {
  const signals: ScoreSignal[] = [];

  // --- 1. Already sells spas (the single strongest buying signal) -----------
  signals.push(
    tri('sellsSpas', 'Already sells spas', input.spaActivity, 20, {
      yes: 'Spa / hot tub activity confirmed in research.',
      no: 'No spa activity found — Aquavia would be a new category for them.',
    }),
  );

  // --- 2. Physical showroom ------------------------------------------------
  signals.push(
    tri('showroom', 'Physical showroom', input.showroom, 12, {
      yes: 'A physical showroom or point of sale is evidenced.',
      no: 'Stated as online-only — spas need a display space.',
    }),
  );

  // --- 3. Pool business ----------------------------------------------------
  signals.push(
    tri('pool', 'Swimming pool business', input.poolActivity, 10, {
      yes: 'Pool business confirmed — same customer, same installation skills.',
      no: 'No pool activity found.',
    }),
  );

  // --- 4. Wellness / sauna / hammam ----------------------------------------
  const wellnessSignals = [input.wellnessActivity, input.saunaActivity, input.hammamActivity];
  const wellnessYes = wellnessSignals.filter((s) => s === 'YES').length;
  const wellnessKnown = wellnessSignals.some((s) => s !== 'UNKNOWN');
  signals.push({
    key: 'wellness',
    label: 'Wellness / sauna / hammam',
    points: Math.min(8, wellnessYes * 4),
    max: 8,
    detail: wellnessYes > 0
      ? `${wellnessYes} adjacent wellness activity/activities confirmed.`
      : wellnessKnown
        ? 'No wellness, sauna or hammam activity found.'
        : 'UNKNOWN — no wellness evidence retrieved.',
    verified: wellnessKnown,
  });

  // --- 5. Competitor brands represented ------------------------------------
  // A dealer already selling Wellis or HotSpring is PROVEN to sell this product
  // at this price point. That is the most convertible prospect there is.
  const competitorCount = input.competitorBrands.length;
  signals.push({
    key: 'competitorBrands',
    label: 'Competitor spa brands represented',
    points: competitorCount === 0 ? 0 : Math.min(14, 8 + (competitorCount - 1) * 3),
    max: 14,
    detail: competitorCount === 0
      ? 'No competing spa brand identified.'
      : `Represents ${input.competitorBrands.join(', ')} — proven ability to sell this product.`,
    verified: competitorCount > 0 || input.brands.length > 0,
  });

  // --- 6. Premium positioning ---------------------------------------------
  const premiumBrands = input.brands.filter(isPremiumBrand);
  const premiumFromRating = input.googleRating !== null && input.googleRating >= 4.5;
  const premiumPoints = clamp((premiumBrands.length > 0 ? 5 : 0) + (premiumFromRating ? 3 : 0), 0, 8);
  signals.push({
    key: 'premium',
    label: 'Premium positioning',
    points: premiumPoints,
    max: 8,
    detail: premiumPoints === 0
      ? 'No premium indicators found.'
      : [
          premiumBrands.length > 0 ? `Carries premium brand(s): ${premiumBrands.join(', ')}.` : null,
          premiumFromRating ? `Google rating ${input.googleRating} indicates a quality operation.` : null,
        ].filter(Boolean).join(' '),
    verified: input.brands.length > 0 || input.googleRating !== null,
  });

  // --- 7. Company age ------------------------------------------------------
  // NOTE: uses yearFounded ONLY. Spa tenure is scored separately below,
  // because a 40-year-old pool builder that started spas last year is a
  // different prospect from a 40-year spa specialist.
  const age = input.yearFounded !== null ? CURRENT_YEAR() - input.yearFounded : null;
  signals.push({
    key: 'companyAge',
    label: 'Company age',
    points: age === null ? 0 : age >= 20 ? 6 : age >= 10 ? 4 : age >= 5 ? 2 : 1,
    max: 6,
    detail: age === null
      ? 'UNKNOWN — founding year not verified.'
      : `Founded ${input.yearFounded} (${age} years old).`,
    verified: age !== null,
  });

  // --- 8. Spa industry tenure (distinct from company age) ------------------
  const spaYears = input.spaSinceYear !== null ? CURRENT_YEAR() - input.spaSinceYear : null;
  signals.push({
    key: 'spaTenure',
    label: 'Years in the spa industry',
    points: spaYears === null ? 0 : spaYears >= 10 ? 5 : spaYears >= 5 ? 3 : 1,
    max: 5,
    detail: spaYears === null
      ? 'UNKNOWN — no verified start date for spa activity.'
      : `Working with spas since ${input.spaSinceYear} (${spaYears} years).`,
    verified: spaYears !== null,
  });

  // --- 9. Google rating ----------------------------------------------------
  const rating = input.googleRating;
  signals.push({
    key: 'rating',
    label: 'Google rating',
    points: rating === null ? 0 : rating >= 4.7 ? 6 : rating >= 4.3 ? 5 : rating >= 4.0 ? 3 : rating >= 3.5 ? 1 : 0,
    max: 6,
    detail: rating === null ? 'UNKNOWN — no Google rating.' : `Google rating ${rating.toFixed(1)}.`,
    verified: rating !== null,
  });

  // --- 10. Review count (market presence) ----------------------------------
  const reviews = input.googleReviewCount;
  signals.push({
    key: 'reviews',
    label: 'Google review volume',
    points: reviews === null ? 0 : reviews >= 200 ? 6 : reviews >= 80 ? 5 : reviews >= 30 ? 3 : reviews >= 10 ? 2 : 1,
    max: 6,
    detail: reviews === null ? 'UNKNOWN — no review count.' : `${reviews} Google reviews.`,
    verified: reviews !== null,
  });

  // --- 11. Website ---------------------------------------------------------
  signals.push({
    key: 'website',
    label: 'Website',
    points: input.website ? 5 : 0,
    max: 5,
    detail: input.website ? `Active website: ${input.website}` : 'UNKNOWN — no website found.',
    verified: input.website !== null,
  });

  // --- 12. Social activity -------------------------------------------------
  const socials = [input.linkedinUrl, input.instagramUrl, input.facebookUrl].filter(Boolean).length;
  signals.push({
    key: 'social',
    label: 'Social presence',
    points: Math.min(4, socials * 2),
    max: 4,
    detail: socials === 0 ? 'UNKNOWN — no social profiles found.' : `${socials} social profile(s) found.`,
    verified: socials > 0,
  });

  // --- 13. Multiple locations ---------------------------------------------
  const locs = input.locationCount;
  signals.push({
    key: 'locations',
    label: 'Multiple locations',
    points: locs === null || locs <= 1 ? 0 : locs >= 5 ? 5 : locs >= 3 ? 4 : 2,
    max: 5,
    detail: locs === null ? 'UNKNOWN — location count not verified.' : `${locs} location(s).`,
    verified: locs !== null,
  });

  // --- 14. Hospitality / commercial channel -------------------------------
  signals.push(
    tri('hospitality', 'Hotel / commercial channel', input.hospitalityActivity, 5, {
      yes: 'Supplies hotels or commercial wellness projects — high-value channel.',
      no: 'No hospitality channel found.',
    }),
  );

  // --- 15. Decision maker identified ---------------------------------------
  signals.push({
    key: 'decisionMaker',
    label: 'Decision maker identified',
    points: input.decisionMakerCount === 0 ? 0 : input.decisionMakerCount >= 2 ? 4 : 3,
    max: 4,
    detail: input.decisionMakerCount === 0
      ? 'UNKNOWN — no public decision maker found.'
      : `${input.decisionMakerCount} decision maker(s) identified from public sources.`,
    verified: input.decisionMakerCount > 0,
  });

  // --- 16. Outdoor living / premium garden --------------------------------
  signals.push(
    tri('outdoor', 'Outdoor living business', input.outdoorLiving, 4, {
      yes: 'Outdoor living / premium garden business — natural fit for outdoor spas.',
      no: 'No outdoor living activity found.',
    }),
  );

  // --- 17. Geographic importance ------------------------------------------
  signals.push({
    key: 'geography',
    label: 'Geographic importance',
    points: input.isMajorCity ? 2 : 0,
    max: 2,
    detail: !input.isMajorCityKnown
      ? 'UNKNOWN — no major-city reference held for this market.'
      : input.isMajorCity
        ? 'Located in a major commercial city for this market.'
        : 'Secondary location for this market.',
    verified: input.isMajorCityKnown,
  });

  const rawTotal = signals.reduce((sum, s) => sum + s.points, 0);
  const maxTotal = signals.reduce((sum, s) => sum + s.max, 0);
  const score = clamp(Math.round((rawTotal / maxTotal) * 100), 0, 100);

  const verifiedWeight = signals.filter((s) => s.verified).reduce((sum, s) => sum + s.max, 0);
  const dataCompleteness = clamp(Math.round((verifiedWeight / maxTotal) * 100), 0, 100);

  return {
    score,
    priority: toPriority(score),
    breakdown: signals,
    dataCompleteness,
    confidence: toConfidence(dataCompleteness),
  };
}

function tri(
  key: string,
  label: string,
  value: Tristate,
  max: number,
  detail: { yes: string; no: string },
): ScoreSignal {
  if (value === 'YES') return { key, label, points: max, max, detail: detail.yes, verified: true };
  if (value === 'NO') return { key, label, points: 0, max, detail: detail.no, verified: true };
  return { key, label, points: 0, max, detail: `UNKNOWN — not verified.`, verified: false };
}

export function toPriority(score: number): Priority {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}

export function toConfidence(dataCompleteness: number): Confidence {
  if (dataCompleteness >= 70) return 'HIGH';
  if (dataCompleteness >= 45) return 'MEDIUM';
  if (dataCompleteness > 0) return 'LOW';
  return 'UNKNOWN';
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  A: 'HIGH PRIORITY',
  B: 'GOOD PROSPECT',
  C: 'SECONDARY',
  D: 'LOW PRIORITY',
};
