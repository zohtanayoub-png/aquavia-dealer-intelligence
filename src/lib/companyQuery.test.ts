import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildOrderBy, buildWhere, parseFilters, sanitizeOrderBy,
  SORTABLE_FIELDS, DEFAULT_SORT_FIELD, NULLABLE_SORT_COLUMNS,
} from '@/lib/companyQuery';

/**
 * REGRESSION GUARD — production bug, Companies page.
 *
 *   Invalid `prisma.company.findMany()` invocation.
 *   Argument `score`: Invalid value provided. Expected SortOrder, provided Object.
 *
 * Prisma accepts the `{ sort, nulls }` object form ONLY on nullable columns.
 * `Company.score` is `Int @default(0)` — non-nullable — so it must receive a
 * bare 'asc' / 'desc'.
 *
 * Rather than hard-coding which columns are nullable (which would silently rot
 * the moment the schema changes), these tests READ prisma/schema.prisma and
 * derive nullability from it. Make `score` nullable, or add a new sortable
 * column, and these tests re-derive the correct expectation automatically.
 */

const SCHEMA = readFileSync(path.join(process.cwd(), 'prisma/schema.prisma'), 'utf8');

/** Field name -> is it nullable, according to the actual schema. */
function companyFieldNullability(): Map<string, boolean> {
  const model = SCHEMA.match(/model Company \{([\s\S]*?)\n\}/);
  if (!model) throw new Error('Could not locate `model Company` in prisma/schema.prisma');

  const map = new Map<string, boolean>();
  for (const rawLine of model[1].split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('//') || line.startsWith('@@')) continue;
    // e.g. "score            Int        @default(0)"  |  "city   String?"
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+([A-Za-z][A-Za-z0-9_]*)(\[\])?(\?)?/);
    if (!match) continue;
    map.set(match[1], match[4] === '?');
  }
  return map;
}

const NULLABILITY = companyFieldNullability();

/** True when a value is the `{ sort, nulls }` object form. */
function isObjectForm(value: unknown): boolean {
  return typeof value === 'object' && value !== null && 'sort' in (value as object);
}

describe('schema introspection (sanity check on the test itself)', () => {
  it('reads Company fields from the real schema', () => {
    expect(NULLABILITY.size).toBeGreaterThan(20);
  });

  it('confirms the exact fact that caused the bug: score is NOT nullable', () => {
    expect(NULLABILITY.get('score')).toBe(false);
  });

  it('confirms nullable columns really are nullable', () => {
    expect(NULLABILITY.get('city')).toBe(true);
    expect(NULLABILITY.get('googleRating')).toBe(true);
    expect(NULLABILITY.get('googleReviewCount')).toBe(true);
  });

  it('covers every sortable field', () => {
    for (const field of SORTABLE_FIELDS) {
      expect(NULLABILITY.has(field), `${field} missing from Company model`).toBe(true);
    }
  });
});

describe('buildOrderBy — the reported bug', () => {
  it('sorts score with a bare SortOrder, never the { sort, nulls } object', () => {
    const orderBy = buildOrderBy(parseFilters(new URLSearchParams('sort=score&dir=desc')));
    expect(orderBy[0]).toEqual({ score: 'desc' });
    expect(isObjectForm((orderBy[0] as Record<string, unknown>).score)).toBe(false);
  });

  it('defaults to dealer fit desc, then name asc', () => {
    // Dealer fit is the commercially useful default: "who could actually
    // resell our spas", not "who looks impressive on the general score".
    expect(buildOrderBy(parseFilters(new URLSearchParams('')))).toEqual([
      { dealerFitScore: 'desc' },
      { name: 'asc' },
    ]);
  });

  it('still orders by score with a bare SortOrder when asked', () => {
    expect(buildOrderBy(parseFilters(new URLSearchParams('sort=score&dir=desc')))).toEqual([
      { score: 'desc' },
      { name: 'asc' },
    ]);
  });

  it('NEVER uses the object form on a non-nullable column, for any field or direction', () => {
    for (const field of SORTABLE_FIELDS) {
      for (const dir of ['asc', 'desc'] as const) {
        const orderBy = buildOrderBy(parseFilters(new URLSearchParams(`sort=${field}&dir=${dir}`)));
        for (const term of orderBy) {
          for (const [key, value] of Object.entries(term)) {
            const nullable = NULLABILITY.get(key);
            if (isObjectForm(value)) {
              expect(nullable, `"${key}" is non-nullable — Prisma rejects { sort, nulls } on it`).toBe(true);
            }
          }
        }
      }
    }
  });

  it('keeps nulls:last on nullable columns so UNKNOWN values never lead an ascending sort', () => {
    expect(buildOrderBy(parseFilters(new URLSearchParams('sort=googleRating&dir=asc')))[0])
      .toEqual({ googleRating: { sort: 'asc', nulls: 'last' } });
    expect(buildOrderBy(parseFilters(new URLSearchParams('sort=city&dir=asc')))[0])
      .toEqual({ city: { sort: 'asc', nulls: 'last' } });
  });

  it('emits only shapes Prisma accepts: a bare SortOrder or { sort, nulls }', () => {
    for (const field of SORTABLE_FIELDS) {
      for (const dir of ['asc', 'desc'] as const) {
        for (const term of buildOrderBy(parseFilters(new URLSearchParams(`sort=${field}&dir=${dir}`)))) {
          for (const value of Object.values(term)) {
            if (typeof value === 'string') expect(['asc', 'desc']).toContain(value);
            else {
              expect(value).toHaveProperty('sort');
              expect(['asc', 'desc']).toContain((value as { sort: string }).sort);
              expect(['first', 'last']).toContain((value as { nulls: string }).nulls);
            }
          }
        }
      }
    }
  });
});

describe('buildOrderBy — behaviour', () => {
  it('appends company name as the secondary sort', () => {
    expect(buildOrderBy(parseFilters(new URLSearchParams('sort=googleRating&dir=desc')))[1])
      .toEqual({ name: 'asc' });
  });

  it('does not repeat name when name is already the primary sort', () => {
    const orderBy = buildOrderBy(parseFilters(new URLSearchParams('sort=name&dir=desc')));
    expect(orderBy).toEqual([{ name: 'desc' }]);
  });

  it('falls back to the default field for an unknown or hostile sort parameter', () => {
    for (const bad of ['bogus', 'password', '; DROP TABLE companies', '__proto__', 'constructor']) {
      const orderBy = buildOrderBy(parseFilters(new URLSearchParams(`sort=${encodeURIComponent(bad)}`)));
      expect(Object.keys(orderBy[0])[0]).toBe(DEFAULT_SORT_FIELD);
    }
  });

  it('defaults to descending, and honours an explicit ascending request', () => {
    expect(buildOrderBy({ dir: 'asc', sort: 'score' })[0]).toEqual({ score: 'asc' });
    expect(buildOrderBy({ dir: null, sort: 'score' })[0]).toEqual({ score: 'desc' });
  });
});

describe('buildWhere — enum values from the query string', () => {
  it('drops unknown enum values instead of passing them to Prisma', () => {
    // These previously reached the database and threw "Expected Priority".
    expect(JSON.stringify(buildWhere(parseFilters(new URLSearchParams('priority=BOGUS')))))
      .not.toContain('BOGUS');
    expect(JSON.stringify(buildWhere(parseFilters(new URLSearchParams('crmStatus=NOPE')))))
      .not.toContain('NOPE');
    expect(JSON.stringify(buildWhere(parseFilters(new URLSearchParams('showroom=MAYBE')))))
      .not.toContain('MAYBE');
  });

  it('keeps the valid values from a mixed list', () => {
    const where = buildWhere(parseFilters(new URLSearchParams('priority=A,BOGUS,B')));
    expect(JSON.stringify(where)).toContain('"in":["A","B"]');
  });

  it('still applies genuinely valid filters', () => {
    const json = JSON.stringify(buildWhere(parseFilters(new URLSearchParams('priority=A&crmStatus=DEALER&showroom=YES'))));
    expect(json).toContain('"A"');
    expect(json).toContain('DEALER');
    expect(json).toContain('YES');
  });

  it('excludes excluded companies unless explicitly asked', () => {
    expect(JSON.stringify(buildWhere(parseFilters(new URLSearchParams(''))))).toContain('"isExcluded":false');
    expect(JSON.stringify(buildWhere(parseFilters(new URLSearchParams('includeExcluded=true'))))).not.toContain('isExcluded');
  });
});

describe('sanitizeOrderBy — defence in depth for callers outside buildOrderBy', () => {
  it('coerces the exact orderBy production reported into a valid one', () => {
    const reportedByProduction = [
      { score: { sort: 'desc', nulls: 'last' } },
      { name: 'asc' },
    ] as unknown as Parameters<typeof sanitizeOrderBy>[0];

    const errors: string[] = [];
    const original = console.error;
    console.error = (msg: string) => errors.push(String(msg));
    try {
      expect(sanitizeOrderBy(reportedByProduction)).toEqual([
        { score: 'desc' },
        { name: 'asc' },
      ]);
    } finally {
      console.error = original;
    }

    // It must not fail silently — the underlying caller still needs fixing.
    expect(errors.join(' ')).toContain('score');
  });

  it('strips the object form from every non-nullable column', () => {
    const hostile = SORTABLE_FIELDS
      .filter((f) => !NULLABLE_SORT_COLUMNS.has(f))
      .map((f) => ({ [f]: { sort: 'desc', nulls: 'last' } })) as unknown as Parameters<typeof sanitizeOrderBy>[0];

    const original = console.error;
    console.error = () => {};
    try {
      for (const term of sanitizeOrderBy(hostile)) {
        for (const value of Object.values(term)) expect(typeof value).toBe('string');
      }
    } finally {
      console.error = original;
    }
  });

  it('leaves valid object-form ordering on nullable columns untouched', () => {
    const valid = [{ googleRating: { sort: 'desc', nulls: 'last' } }] as unknown as Parameters<typeof sanitizeOrderBy>[0];
    expect(sanitizeOrderBy(valid)).toEqual([{ googleRating: { sort: 'desc', nulls: 'last' } }]);
  });

  it('leaves bare SortOrder ordering untouched', () => {
    expect(sanitizeOrderBy([{ score: 'desc' }, { name: 'asc' }])).toEqual([
      { score: 'desc' },
      { name: 'asc' },
    ]);
  });

  it('agrees with the schema about which columns may use the object form', () => {
    for (const column of NULLABLE_SORT_COLUMNS) {
      expect(NULLABILITY.get(column), `${column} must be nullable in the schema`).toBe(true);
    }
    for (const field of SORTABLE_FIELDS) {
      if (NULLABLE_SORT_COLUMNS.has(field)) continue;
      expect(NULLABILITY.get(field), `${field} must be non-nullable in the schema`).toBe(false);
    }
  });
});
