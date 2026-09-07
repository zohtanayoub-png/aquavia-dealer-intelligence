/** Shared company filtering — used by the table, the map and the exports. */
import { Prisma } from '@prisma/client';

export interface CompanyFilters {
  q?: string | null;
  country?: string | null;
  city?: string | null;
  priority?: string[] | null;
  crmStatus?: string[] | null;
  minScore?: number | null;
  maxScore?: number | null;
  showroom?: string | null;
  spaActivity?: string | null;
  hasWebsite?: boolean | null;
  hasContact?: boolean | null;
  competitorBrand?: string | null;
  includeExcluded?: boolean | null;
  sort?: string | null;
  dir?: 'asc' | 'desc' | null;
}

const SORTABLE = new Set([
  'score', 'name', 'city', 'googleRating', 'googleReviewCount',
  'discoveredAt', 'priority', 'crmStatus', 'dataCompleteness',
]);

export function parseFilters(searchParams: URLSearchParams): CompanyFilters {
  const listParam = (key: string) => {
    const raw = searchParams.getAll(key).flatMap((v) => v.split(',')).filter(Boolean);
    return raw.length > 0 ? raw : null;
  };
  const num = (key: string) => {
    const v = searchParams.get(key);
    if (v === null || v === '') return null;
    const parsed = Number(v);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const bool = (key: string) => {
    const v = searchParams.get(key);
    if (v === null) return null;
    return v === 'true' || v === '1';
  };

  return {
    q: searchParams.get('q'),
    country: searchParams.get('country'),
    city: searchParams.get('city'),
    priority: listParam('priority'),
    crmStatus: listParam('crmStatus'),
    minScore: num('minScore'),
    maxScore: num('maxScore'),
    showroom: searchParams.get('showroom'),
    spaActivity: searchParams.get('spaActivity'),
    hasWebsite: bool('hasWebsite'),
    hasContact: bool('hasContact'),
    competitorBrand: searchParams.get('competitorBrand'),
    includeExcluded: bool('includeExcluded'),
    sort: searchParams.get('sort'),
    dir: (searchParams.get('dir') as 'asc' | 'desc' | null) ?? null,
  };
}

export function buildWhere(f: CompanyFilters): Prisma.CompanyWhereInput {
  const where: Prisma.CompanyWhereInput = {};
  const and: Prisma.CompanyWhereInput[] = [];

  if (f.q) {
    const q = f.q.trim();
    and.push({
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
        { fullAddress: { contains: q, mode: 'insensitive' } },
        { website: { contains: q, mode: 'insensitive' } },
        { brands: { has: q } },
        { competitorBrands: { has: q } },
        { decisionMakers: { some: { fullName: { contains: q, mode: 'insensitive' } } } },
      ],
    });
  }
  if (f.country) and.push({ countryCode: f.country.toUpperCase() });
  if (f.city) and.push({ city: { contains: f.city, mode: 'insensitive' } });
  if (f.priority?.length) {
    and.push({ priority: { in: f.priority as Prisma.EnumPriorityFilter['in'] } });
  }
  if (f.crmStatus?.length) {
    and.push({ crmStatus: { in: f.crmStatus as Prisma.EnumCrmStatusFilter['in'] } });
  }
  if (f.minScore !== null && f.minScore !== undefined) and.push({ score: { gte: f.minScore } });
  if (f.maxScore !== null && f.maxScore !== undefined) and.push({ score: { lte: f.maxScore } });
  if (f.showroom) and.push({ showroom: f.showroom as Prisma.EnumTristateFilter['equals'] });
  if (f.spaActivity) and.push({ spaActivity: f.spaActivity as Prisma.EnumTristateFilter['equals'] });
  if (f.hasWebsite === true) and.push({ website: { not: null } });
  if (f.hasContact === true) and.push({ decisionMakers: { some: {} } });
  if (f.competitorBrand) and.push({ competitorBrands: { has: f.competitorBrand } });
  if (!f.includeExcluded) and.push({ isExcluded: false });

  if (and.length > 0) where.AND = and;
  return where;
}

export function buildOrderBy(f: CompanyFilters): Prisma.CompanyOrderByWithRelationInput[] {
  const field = f.sort && SORTABLE.has(f.sort) ? f.sort : 'score';
  const dir: Prisma.SortOrder = f.dir === 'asc' ? 'asc' : 'desc';
  // Nulls last keeps UNKNOWN ratings from dominating an ascending sort.
  const primary = { [field]: { sort: dir, nulls: 'last' } } as unknown as Prisma.CompanyOrderByWithRelationInput;
  return [primary, { name: 'asc' }];
}
