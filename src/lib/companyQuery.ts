/** Shared company filtering — used by the table, the map and the exports. */
import { Prisma, type CrmStatus, type Priority, type Tristate } from '@prisma/client';

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

/**
 * Sortable columns, each paired with the orderBy shape Prisma actually accepts
 * for it.
 *
 * Prisma only allows the `{ sort, nulls }` object form on NULLABLE columns.
 * On a non-nullable column it expects a bare SortOrder, and passing the object
 * form fails at runtime with:
 *
 *   Argument `score`: Invalid value provided. Expected SortOrder, provided Object.
 *
 * This table is deliberately typed as `Prisma.CompanyOrderByWithRelationInput`
 * with NO casts, so the compiler checks each entry against the generated
 * schema types. Adding a column here with the wrong shape is a build error,
 * not a production 500.
 */
const ORDER_BY: Record<string, (dir: Prisma.SortOrder) => Prisma.CompanyOrderByWithRelationInput> = {
  // Non-nullable columns — bare SortOrder only.
  score: (dir) => ({ score: dir }),
  name: (dir) => ({ name: dir }),
  priority: (dir) => ({ priority: dir }),
  crmStatus: (dir) => ({ crmStatus: dir }),
  dataCompleteness: (dir) => ({ dataCompleteness: dir }),
  discoveredAt: (dir) => ({ discoveredAt: dir }),

  // Nullable columns — `nulls: 'last'` keeps UNKNOWN values out of the way in
  // BOTH directions, so an ascending sort does not open with a wall of blanks.
  city: (dir) => ({ city: { sort: dir, nulls: 'last' } }),
  googleRating: (dir) => ({ googleRating: { sort: dir, nulls: 'last' } }),
  googleReviewCount: (dir) => ({ googleReviewCount: { sort: dir, nulls: 'last' } }),
};

export const SORTABLE_FIELDS = Object.keys(ORDER_BY);

/** Default sort: highest opportunity score first. */
export const DEFAULT_SORT_FIELD = 'score';

/**
 * Enum values accepted from the query string.
 *
 * A value that is not in these sets is DROPPED rather than passed to Prisma —
 * an unknown enum reaches the database layer and throws, turning a stale
 * bookmark or a hand-edited URL into a 500.
 */
const PRIORITY_VALUES = new Set<Priority>(['A', 'B', 'C', 'D']);
const CRM_STATUS_VALUES = new Set<CrmStatus>([
  'NEW', 'TO_CONTACT', 'CONTACTED', 'REPLIED', 'MEETING', 'QUALIFIED',
  'NEGOTIATING', 'DEALER', 'NOT_INTERESTED', 'DO_NOT_CONTACT',
]);
const TRISTATE_VALUES = new Set<Tristate>(['YES', 'NO', 'UNKNOWN']);

function keepValid<T>(values: string[] | null | undefined, allowed: Set<T>): T[] {
  if (!values?.length) return [];
  return values.filter((v): v is T & string => allowed.has(v as T));
}

function asValid<T>(value: string | null | undefined, allowed: Set<T>): T | undefined {
  if (!value) return undefined;
  return allowed.has(value as T) ? (value as T) : undefined;
}

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
  const priorities = keepValid(f.priority, PRIORITY_VALUES);
  if (priorities.length > 0) and.push({ priority: { in: priorities } });

  const statuses = keepValid(f.crmStatus, CRM_STATUS_VALUES);
  if (statuses.length > 0) and.push({ crmStatus: { in: statuses } });
  if (f.minScore !== null && f.minScore !== undefined) and.push({ score: { gte: f.minScore } });
  if (f.maxScore !== null && f.maxScore !== undefined) and.push({ score: { lte: f.maxScore } });
  const showroom = asValid(f.showroom, TRISTATE_VALUES);
  if (showroom) and.push({ showroom });

  const spaActivity = asValid(f.spaActivity, TRISTATE_VALUES);
  if (spaActivity) and.push({ spaActivity });
  if (f.hasWebsite === true) and.push({ website: { not: null } });
  if (f.hasContact === true) and.push({ decisionMakers: { some: {} } });
  if (f.competitorBrand) and.push({ competitorBrands: { has: f.competitorBrand } });
  if (!f.includeExcluded) and.push({ isExcluded: false });

  if (and.length > 0) where.AND = and;
  return where;
}

export function buildOrderBy(f: CompanyFilters): Prisma.CompanyOrderByWithRelationInput[] {
  // `Object.hasOwn`, not `in`: the `in` operator also matches inherited keys,
  // so `?sort=constructor` or `?sort=__proto__` would pass the guard and then
  // blow up on a non-function lookup.
  const field = f.sort && Object.hasOwn(ORDER_BY, f.sort) ? f.sort : DEFAULT_SORT_FIELD;
  const dir: Prisma.SortOrder = f.dir === 'asc' ? 'asc' : 'desc';

  const primary = ORDER_BY[field](dir);

  // Company name is the tie-breaker, except when it IS the primary sort —
  // repeating it there would emit a contradictory second ORDER BY term.
  return field === 'name' ? [primary] : [primary, { name: 'asc' }];
}
