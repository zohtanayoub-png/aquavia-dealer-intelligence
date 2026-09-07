/**
 * Exclusion matching.
 *
 * Four lists (existing dealers, active negotiations, do-not-contact, known
 * competitors) are checked on every discovery so a company already handled
 * elsewhere in the business never re-enters the prospecting funnel as "new".
 */
import { companyNameKey, extractDomain } from '@/lib/utils';

export type ExclusionKind =
  | 'EXISTING_DEALER'
  | 'ACTIVE_NEGOTIATION'
  | 'DO_NOT_CONTACT'
  | 'KNOWN_COMPETITOR';

export interface ExclusionRule {
  id: string;
  kind: ExclusionKind;
  name: string;
  nameKey: string;
  countryCode: string | null;
  city: string | null;
  domain: string | null;
  note: string | null;
}

export interface ExclusionCandidate {
  name: string;
  countryCode: string;
  city?: string | null;
  website?: string | null;
  websiteDomain?: string | null;
}

export interface ExclusionMatch {
  rule: ExclusionRule;
  /** How the match was made — shown to the user so it can be challenged. */
  reason: string;
  strength: 'DOMAIN' | 'EXACT_NAME' | 'NAME_IN_COUNTRY';
}

export function buildNameKey(name: string): string {
  return companyNameKey(name);
}

/**
 * Find the strongest exclusion match, or null.
 *
 * Matching is deliberately conservative — a false exclusion silently hides a
 * real prospect, which is worse than a duplicate. Domain equality is trusted
 * outright; name equality requires the country to agree.
 */
export function matchExclusion(
  candidate: ExclusionCandidate,
  rules: ExclusionRule[],
): ExclusionMatch | null {
  const candidateDomain =
    candidate.websiteDomain ?? extractDomain(candidate.website ?? null);
  const candidateKey = companyNameKey(candidate.name);
  const country = candidate.countryCode.toUpperCase();
  const city = candidate.city ? companyNameKey(candidate.city) : null;

  let best: ExclusionMatch | null = null;

  for (const rule of rules) {
    // 1) Domain match — the strongest signal available.
    if (candidateDomain && rule.domain && rule.domain.toLowerCase() === candidateDomain) {
      return {
        rule,
        reason: `Website domain ${candidateDomain} is on the ${label(rule.kind)} list.`,
        strength: 'DOMAIN',
      };
    }

    if (!rule.nameKey || rule.nameKey !== candidateKey) continue;

    // 2) Exact name + country + city.
    if (rule.countryCode && rule.countryCode.toUpperCase() === country) {
      if (rule.city && city && companyNameKey(rule.city) === city) {
        const match: ExclusionMatch = {
          rule,
          reason: `"${candidate.name}" in ${candidate.city} is on the ${label(rule.kind)} list.`,
          strength: 'EXACT_NAME',
        };
        if (!best || strengthRank(match.strength) > strengthRank(best.strength)) best = match;
        continue;
      }
      const match: ExclusionMatch = {
        rule,
        reason: `"${candidate.name}" in ${country} is on the ${label(rule.kind)} list.`,
        strength: 'NAME_IN_COUNTRY',
      };
      if (!best || strengthRank(match.strength) > strengthRank(best.strength)) best = match;
      continue;
    }

    // 3) A rule with no country is global (typically DO_NOT_CONTACT).
    if (!rule.countryCode) {
      const match: ExclusionMatch = {
        rule,
        reason: `"${candidate.name}" matches a global ${label(rule.kind)} entry.`,
        strength: 'NAME_IN_COUNTRY',
      };
      if (!best || strengthRank(match.strength) > strengthRank(best.strength)) best = match;
    }
  }

  return best;
}

function strengthRank(s: ExclusionMatch['strength']): number {
  return s === 'DOMAIN' ? 3 : s === 'EXACT_NAME' ? 2 : 1;
}

export function label(kind: ExclusionKind): string {
  switch (kind) {
    case 'EXISTING_DEALER': return 'existing Aquavia dealer';
    case 'ACTIVE_NEGOTIATION': return 'active negotiation';
    case 'DO_NOT_CONTACT': return 'do not contact';
    case 'KNOWN_COMPETITOR': return 'known competitor';
  }
}

export const EXCLUSION_KINDS: ExclusionKind[] = [
  'EXISTING_DEALER',
  'ACTIVE_NEGOTIATION',
  'DO_NOT_CONTACT',
  'KNOWN_COMPETITOR',
];
