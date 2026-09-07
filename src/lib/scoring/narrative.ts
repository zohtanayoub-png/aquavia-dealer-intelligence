/**
 * "WHY THIS COMPANY" and "RECOMMENDED NEXT ACTION".
 *
 * The narrative is assembled ONLY from signals that actually scored. It never
 * asserts anything the score did not verify, and it names what is still missing
 * so the sales team knows what to qualify.
 */
import type { NextAction, ScoreResult, ScoreInput, Priority } from '@/lib/scoring/score';

export interface NarrativeInput extends ScoreInput {
  companyName: string;
  city: string | null;
  countryName: string;
  publicEmail: string | null;
  phone: string | null;
  decisionMakerHasLinkedIn: boolean;
  decisionMakerHasEmail: boolean;
  isExcluded: boolean;
}

export interface Narrative {
  whyThisCompany: string;
  recommendedAction: NextAction;
  actionRationale: string;
}

export function buildNarrative(input: NarrativeInput, result: ScoreResult): Narrative {
  return {
    whyThisCompany: buildWhy(input, result),
    ...recommendAction(input, result),
  };
}

function buildWhy(input: NarrativeInput, result: ScoreResult): string {
  const reasons: string[] = [];

  if (input.representsAquavia === 'YES') {
    reasons.push('Already represents Aquavia Spa — verify status before any outreach.');
  }
  if (input.spaActivity === 'YES') reasons.push('already sells spas or hot tubs');
  if (input.competitorBrands.length > 0) {
    reasons.push(`represents ${input.competitorBrands.slice(0, 3).join(', ')}, proving they can sell this product at this price point`);
  }
  if (input.showroom === 'YES') reasons.push('has a physical showroom where a spa can be displayed');
  if (input.poolActivity === 'YES') reasons.push('runs a pool business with the same customers and installation skills');
  if (input.wellnessActivity === 'YES' || input.saunaActivity === 'YES' || input.hammamActivity === 'YES') {
    reasons.push('operates in adjacent wellness categories');
  }
  if (input.hospitalityActivity === 'YES') reasons.push('supplies hotels or commercial wellness projects');
  if (input.outdoorLiving === 'YES') reasons.push('sells outdoor living products');
  if (input.googleRating !== null && input.googleReviewCount !== null && input.googleReviewCount >= 20) {
    reasons.push(`holds a ${input.googleRating.toFixed(1)} Google rating across ${input.googleReviewCount} reviews`);
  }
  if (input.locationCount !== null && input.locationCount > 1) {
    reasons.push(`operates ${input.locationCount} locations`);
  }
  if (input.yearFounded !== null) {
    reasons.push(`has been trading since ${input.yearFounded}`);
  }
  if (input.spaSinceYear !== null) {
    reasons.push(`has worked with spas since ${input.spaSinceYear}`);
  }
  if (input.decisionMakerCount > 0) {
    reasons.push(`has ${input.decisionMakerCount} identified decision maker(s)`);
  }

  const where = [input.city, input.countryName].filter(Boolean).join(', ');
  const head = `${input.companyName} (${where}) scores ${result.score}/100 — priority ${result.priority}.`;

  if (reasons.length === 0) {
    return `${head} No qualifying signals could be verified from public sources. ` +
      `Everything about this company is currently UNKNOWN — it must be qualified manually before any outreach.`;
  }

  const body = `Why: ${capitalise(joinList(reasons))}.`;

  // Always state what is NOT known. An honest gap list is what makes the
  // positive claims trustworthy.
  const gaps = result.breakdown.filter((s) => !s.verified).map((s) => s.label.toLowerCase());
  const tail = gaps.length > 0
    ? ` Still UNKNOWN: ${gaps.slice(0, 6).join(', ')}${gaps.length > 6 ? `, +${gaps.length - 6} more` : ''}.`
    : ' All scoring signals are verified.';

  return `${head} ${body}${tail} Data completeness ${result.dataCompleteness}% (confidence ${result.confidence}).`;
}

function recommendAction(
  input: NarrativeInput,
  result: ScoreResult,
): { recommendedAction: NextAction; actionRationale: string } {
  // Exclusions always win — they exist precisely to stop outreach.
  if (input.isExcluded) {
    return {
      recommendedAction: 'LOW_PRIORITY',
      actionRationale: 'On an exclusion list. Do not contact without checking with the market manager.',
    };
  }

  const priority: Priority = result.priority;
  const strongFit = input.spaActivity === 'YES' || input.competitorBrands.length > 0;

  // A-priority with a showroom is worth flying to. That is the whole point.
  if (priority === 'A' && input.showroom === 'YES') {
    return {
      recommendedAction: 'VISIT',
      actionRationale: 'Top-priority prospect with a confirmed showroom. Worth a field visit on the next market trip.',
    };
  }

  if ((priority === 'A' || priority === 'B') && input.phone && strongFit) {
    return {
      recommendedAction: 'CALL',
      actionRationale: `Strong fit with a verified phone number (${input.phone}). Call the branch and ask for the spa or purchasing decision maker.`,
    };
  }

  if (priority !== 'D' && input.decisionMakerHasEmail) {
    return {
      recommendedAction: 'EMAIL',
      actionRationale: 'A public professional email for a named decision maker was found. Send a direct, personalised approach.',
    };
  }

  if (priority !== 'D' && input.decisionMakerHasLinkedIn) {
    return {
      recommendedAction: 'LINKEDIN',
      actionRationale: 'A decision maker has a public LinkedIn profile but no published email. Approach via LinkedIn.',
    };
  }

  if (priority !== 'D' && input.publicEmail) {
    return {
      recommendedAction: 'EMAIL',
      actionRationale: `A public company email (${input.publicEmail}) is available, but no named decision maker. Email and ask to be routed.`,
    };
  }

  if (result.dataCompleteness < 45) {
    return {
      recommendedAction: 'QUALIFY_FIRST',
      actionRationale: `Only ${result.dataCompleteness}% of scoring signals are verified. Research or call to qualify before investing sales time.`,
    };
  }

  if (priority === 'D') {
    return {
      recommendedAction: 'LOW_PRIORITY',
      actionRationale: 'Verified data does not support a dealer fit. Park unless the market opens up.',
    };
  }

  return {
    recommendedAction: 'QUALIFY_FIRST',
    actionRationale: 'Reasonable profile but no reliable contact route was found. Qualify before outreach.',
  };
}

function joinList(items: string[]): string {
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
