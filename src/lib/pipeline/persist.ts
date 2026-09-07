/**
 * Persistence helpers shared by the pipeline.
 *
 * Merge policy: a verified value never gets overwritten by UNKNOWN, and a
 * later run can only ADD evidence. That makes repeated searches of the same
 * market strictly accretive instead of destructive.
 */
import { prisma } from '@/lib/db';
import type { Prisma, Tristate as PrismaTristate } from '@prisma/client';
import { buildDedupeKey, extractDomain, mergeStringLists } from '@/lib/utils';
import { matchExclusion, type ExclusionRule } from '@/lib/exclusions/match';
import type { PlaceResult } from '@/lib/providers/googlePlaces';

export async function loadExclusionRules(countryCode?: string): Promise<ExclusionRule[]> {
  const rows = await prisma.exclusionEntry.findMany({
    where: countryCode
      ? { OR: [{ countryCode: null }, { countryCode: countryCode.toUpperCase() }] }
      : undefined,
  });
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    name: r.name,
    nameKey: r.nameKey,
    countryCode: r.countryCode,
    city: r.city,
    domain: r.domain,
    note: r.note,
  }));
}

export interface UpsertResult {
  companyId: string;
  isNew: boolean;
  excluded: boolean;
}

/**
 * Create or merge a company discovered from Google Places.
 * Only Google-sourced facts are written here; research fields come later.
 */
export async function upsertCompanyFromPlace(
  place: PlaceResult,
  context: { countryCode: string; countryName: string; rules: ExclusionRule[]; queryText: string },
): Promise<UpsertResult> {
  const countryCode = (place.countryCode ?? context.countryCode).toUpperCase();
  const websiteDomain = extractDomain(place.website);
  const dedupeKey = buildDedupeKey({
    googlePlaceId: place.placeId,
    websiteDomain,
    countryCode,
    name: place.name,
    city: place.city,
  });

  const exclusion = matchExclusion(
    { name: place.name, countryCode, city: place.city, websiteDomain },
    context.rules,
  );

  const existing = await prisma.company.findFirst({
    where: { OR: [{ dedupeKey }, { googlePlaceId: place.placeId }] },
  });

  const googleFields = {
    googlePlaceId: place.placeId,
    googleRating: place.rating,
    googleReviewCount: place.userRatingCount,
    googleTypes: place.types,
    googleMapsUri: place.googleMapsUri,
    googleBusinessStatus: place.businessStatus,
    latitude: place.latitude,
    longitude: place.longitude,
    fullAddress: place.formattedAddress,
    postalCode: place.postalCode,
    region: place.region,
    city: place.city,
    website: place.website,
    websiteDomain,
    phone: place.phone,
    lastVerifiedAt: new Date(),
  };

  if (existing) {
    await prisma.company.update({
      where: { id: existing.id },
      data: {
        // Never replace a known value with null.
        name: existing.name || place.name,
        countryCode,
        countryName: context.countryName,
        ...pruneNulls(googleFields),
        ...(exclusion
          ? {
              isExcluded: true,
              exclusionKind: exclusion.rule.kind,
              exclusionNote: exclusion.reason,
            }
          : {}),
      },
    });
    await recordSource(existing.id, place, context.queryText);
    return { companyId: existing.id, isNew: false, excluded: Boolean(exclusion) };
  }

  const created = await prisma.company.create({
    data: {
      name: place.name,
      dedupeKey,
      countryCode,
      countryName: context.countryName,
      ...googleFields,
      isExcluded: Boolean(exclusion),
      exclusionKind: exclusion?.rule.kind ?? null,
      exclusionNote: exclusion?.reason ?? null,
      crmStatus: exclusion?.rule.kind === 'DO_NOT_CONTACT' ? 'DO_NOT_CONTACT' : 'NEW',
    },
  });
  await recordSource(created.id, place, context.queryText);
  return { companyId: created.id, isNew: true, excluded: Boolean(exclusion) };
}

async function recordSource(companyId: string, place: PlaceResult, queryText: string): Promise<void> {
  if (!place.googleMapsUri) return;
  await prisma.sourceRef.upsert({
    where: {
      companyId_url_kind: { companyId, url: place.googleMapsUri, kind: 'DISCOVERY' },
    },
    create: {
      companyId,
      url: place.googleMapsUri,
      title: `Google Places — ${place.name}`,
      snippet: `Discovered via Google Places text search: "${queryText}"`,
      kind: 'DISCOVERY',
      provider: 'GOOGLE_PLACES',
    },
    update: { retrievedAt: new Date() },
  });
}

/** Drop null/undefined so an update never clears a previously verified field. */
function pruneNulls<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== null && v !== undefined),
  ) as Partial<T>;
}

/** A verified YES/NO wins; UNKNOWN never overwrites a known value. */
export function mergeTristate(existing: PrismaTristate, incoming: PrismaTristate): PrismaTristate {
  if (incoming === 'UNKNOWN') return existing;
  if (existing === 'YES') return 'YES';
  return incoming;
}

export function mergeBrands(existing: string[], incoming: string[]): string[] {
  return mergeStringLists(existing, incoming);
}

export async function addSourceRefs(
  companyId: string,
  refs: { url: string; title: string | null; snippet: string | null; kind: Prisma.SourceRefCreateInput['kind']; provider?: Prisma.SourceRefCreateInput['provider'] }[],
): Promise<void> {
  for (const ref of refs) {
    if (!ref.url) continue;
    try {
      await prisma.sourceRef.upsert({
        where: { companyId_url_kind: { companyId, url: ref.url, kind: ref.kind ?? 'OTHER' } },
        create: {
          companyId,
          url: ref.url,
          title: ref.title,
          snippet: ref.snippet?.slice(0, 1000) ?? null,
          kind: ref.kind ?? 'OTHER',
          provider: ref.provider ?? 'TAVILY',
        },
        update: { snippet: ref.snippet?.slice(0, 1000) ?? undefined, retrievedAt: new Date() },
      });
    } catch {
      // A single bad URL must never abort a whole enrichment step.
    }
  }
}
