/**
 * Export column definitions.
 *
 * Shared by CSV, XLSX and Google My Maps so the three exports can never drift
 * apart. UNKNOWN is written literally — a blank cell would look like an
 * oversight, whereas UNKNOWN is a deliberate, defensible statement.
 */
import type { Company, DecisionMaker } from '@prisma/client';
import { PRIORITY_LABELS } from '@/lib/scoring/score';

export type ExportCompany = Company & { decisionMakers: DecisionMaker[] };

export const UNKNOWN = 'UNKNOWN';

function s(v: string | null | undefined): string {
  return v === null || v === undefined || v === '' ? UNKNOWN : v;
}
function n(v: number | null | undefined): string {
  return v === null || v === undefined ? UNKNOWN : String(v);
}
function list(v: string[] | null | undefined): string {
  return !v || v.length === 0 ? UNKNOWN : v.join('; ');
}
function d(v: Date | null | undefined): string {
  return v ? v.toISOString().slice(0, 10) : UNKNOWN;
}

export function primaryContact(c: ExportCompany): DecisionMaker | null {
  if (c.decisionMakers.length === 0) return null;
  const rank = (x: DecisionMaker) =>
    (x.confidence === 'HIGH' ? 3 : x.confidence === 'MEDIUM' ? 2 : 1) +
    (x.email ? 2 : 0) +
    (x.linkedinUrl ? 1 : 0);
  return [...c.decisionMakers].sort((a, b) => rank(b) - rank(a))[0];
}

export interface Column {
  header: string;
  width: number;
  value: (c: ExportCompany) => string;
}

/** The full prospect export — every stored field. */
export const FULL_COLUMNS: Column[] = [
  { header: 'Company Name', width: 34, value: (c) => c.name },
  { header: 'Country', width: 16, value: (c) => c.countryName },
  { header: 'Region', width: 18, value: (c) => s(c.region) },
  { header: 'City', width: 18, value: (c) => s(c.city) },
  { header: 'Full Address', width: 42, value: (c) => s(c.fullAddress) },
  { header: 'Latitude', width: 12, value: (c) => n(c.latitude) },
  { header: 'Longitude', width: 12, value: (c) => n(c.longitude) },
  { header: 'Google Place ID', width: 30, value: (c) => s(c.googlePlaceId) },
  { header: 'Google Rating', width: 13, value: (c) => n(c.googleRating) },
  { header: 'Google Review Count', width: 18, value: (c) => n(c.googleReviewCount) },
  { header: 'Website', width: 34, value: (c) => s(c.website) },
  { header: 'Phone', width: 20, value: (c) => s(c.phone) },
  { header: 'Public Email', width: 28, value: (c) => s(c.publicEmail) },
  { header: 'WhatsApp', width: 18, value: (c) => s(c.whatsapp) },
  { header: 'Year Founded', width: 13, value: (c) => n(c.yearFounded) },
  { header: 'Years In Spa Industry', width: 20, value: (c) => n(c.yearsInSpaIndustry) },
  { header: 'Spa Activity', width: 13, value: (c) => c.spaActivity },
  { header: 'Swimming Pool Activity', width: 20, value: (c) => c.poolActivity },
  { header: 'Sauna Activity', width: 14, value: (c) => c.saunaActivity },
  { header: 'Wellness Activity', width: 16, value: (c) => c.wellnessActivity },
  { header: 'Hammam Activity', width: 16, value: (c) => c.hammamActivity },
  { header: 'Outdoor Living', width: 15, value: (c) => c.outdoorLiving },
  { header: 'Hospitality Activity', width: 18, value: (c) => c.hospitalityActivity },
  { header: 'Showroom', width: 11, value: (c) => c.showroom },
  { header: 'Locations', width: 10, value: (c) => n(c.locationCount) },
  { header: 'Brands', width: 30, value: (c) => list(c.brands) },
  { header: 'Competitor Brands', width: 30, value: (c) => list(c.competitorBrands) },
  { header: 'LinkedIn', width: 30, value: (c) => s(c.linkedinUrl) },
  { header: 'Instagram', width: 30, value: (c) => s(c.instagramUrl) },
  { header: 'Facebook', width: 30, value: (c) => s(c.facebookUrl) },
  { header: 'Aquavia Score', width: 13, value: (c) => String(c.score) },
  { header: 'Priority', width: 10, value: (c) => c.priority },
  { header: 'Priority Label', width: 17, value: (c) => PRIORITY_LABELS[c.priority] },
  { header: 'Recommended Next Action', width: 22, value: (c) => c.recommendedAction },
  { header: 'Why This Company', width: 70, value: (c) => s(c.whyThisCompany) },
  { header: 'Confidence', width: 12, value: (c) => c.confidence },
  { header: 'Data Completeness %', width: 18, value: (c) => String(c.dataCompleteness) },
  {
    header: 'Decision Makers',
    width: 48,
    value: (c) =>
      c.decisionMakers.length === 0
        ? UNKNOWN
        : c.decisionMakers
            .map((d0) =>
              [d0.fullName, d0.position ?? UNKNOWN, d0.email ?? UNKNOWN, d0.linkedinUrl ?? UNKNOWN].join(' | '),
            )
            .join(' ;; '),
  },
  { header: 'CRM Status', width: 16, value: (c) => c.crmStatus },
  { header: 'Sales Notes', width: 40, value: (c) => s(c.salesNotes) },
  { header: 'Last Contact', width: 14, value: (c) => d(c.lastContactAt) },
  { header: 'Next Follow-up', width: 14, value: (c) => d(c.nextFollowUpAt) },
  { header: 'Excluded', width: 10, value: (c) => (c.isExcluded ? 'YES' : 'NO') },
  { header: 'Exclusion Kind', width: 20, value: (c) => s(c.exclusionKind) },
  { header: 'Research Notes', width: 60, value: (c) => s(c.researchNotes) },
  { header: 'Date First Discovered', width: 20, value: (c) => d(c.discoveredAt) },
  { header: 'Date Last Verified', width: 20, value: (c) => d(c.lastVerifiedAt) },
];

/**
 * Google My Maps import format.
 *
 * My Maps places points from Latitude/Longitude and shows the remaining
 * columns in the point's info card, so the column set is deliberately short
 * and ordered for readability in that card.
 */
export const GOOGLE_MY_MAPS_COLUMNS: Column[] = [
  { header: 'Company', width: 34, value: (c) => c.name },
  { header: 'Address', width: 42, value: (c) => s(c.fullAddress) },
  { header: 'Latitude', width: 12, value: (c) => n(c.latitude) },
  { header: 'Longitude', width: 12, value: (c) => n(c.longitude) },
  { header: 'Score', width: 8, value: (c) => String(c.score) },
  { header: 'Priority', width: 9, value: (c) => c.priority },
  { header: 'Rating', width: 8, value: (c) => n(c.googleRating) },
  { header: 'Reviews', width: 9, value: (c) => n(c.googleReviewCount) },
  { header: 'Phone', width: 20, value: (c) => s(c.phone) },
  { header: 'Website', width: 34, value: (c) => s(c.website) },
  { header: 'Brands', width: 30, value: (c) => list(c.brands) },
  {
    header: 'Decision Maker',
    width: 34,
    value: (c) => {
      const p = primaryContact(c);
      return p ? [p.fullName, p.position ?? UNKNOWN].join(' — ') : UNKNOWN;
    },
  },
  {
    header: 'Notes',
    width: 60,
    value: (c) =>
      [
        `Aquavia score ${c.score} (${PRIORITY_LABELS[c.priority]})`,
        `Next action: ${c.recommendedAction}`,
        c.showroom === 'YES' ? 'Showroom: YES' : `Showroom: ${c.showroom}`,
        c.competitorBrands.length > 0 ? `Competitor brands: ${c.competitorBrands.join(', ')}` : null,
      ]
        .filter(Boolean)
        .join(' · '),
  },
];

export type ExportPreset = 'full' | 'googleMyMaps';

export function columnsFor(preset: ExportPreset): Column[] {
  return preset === 'googleMyMaps' ? GOOGLE_MY_MAPS_COLUMNS : FULL_COLUMNS;
}
