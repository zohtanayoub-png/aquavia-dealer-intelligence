import { describe, expect, it } from 'vitest';
import { buildQueryPlan, buildResearchQueries } from '@/lib/discovery/queryPlan';
import { PRIORITY_COMPETITOR_QUERY_BRANDS } from '@/lib/discovery/brands';

describe('buildQueryPlan', () => {
  it('adapts terminology to the local language of the market', () => {
    const morocco = buildQueryPlan({ country: 'MA', city: 'Casablanca', depth: 'QUICK' });
    expect(morocco.languages).toContain('fr');
    // French trade terms, not English ones.
    expect(morocco.queries.some((q) => q.text.includes('vente de spas'))).toBe(true);
    expect(morocco.queries.every((q) => q.text.includes('Casablanca'))).toBe(true);
  });

  it('uses different vocabulary for a different market', () => {
    const poland = buildQueryPlan({ country: 'PL', depth: 'QUICK' });
    expect(poland.queries.some((q) => q.text.includes('sprzedaż spa jacuzzi'))).toBe(true);

    const germany = buildQueryPlan({ country: 'DE', depth: 'QUICK' });
    expect(germany.queries.some((q) => q.text.includes('Whirlpool Fachhandel'))).toBe(true);
  });

  it('always includes competitor dealer discovery', () => {
    const plan = buildQueryPlan({ country: 'ES', depth: 'QUICK' });
    const brandQueries = plan.queries.filter((q) => q.category === 'competitorBrand');
    expect(brandQueries.length).toBeGreaterThan(0);
    expect(brandQueries.map((q) => q.brand)).toContain('Wellis');
  });

  it('searches every required competitor brand at DEEP depth', () => {
    const plan = buildQueryPlan({ country: 'ES', depth: 'DEEP' });
    const brands = plan.queries.filter((q) => q.category === 'competitorBrand').map((q) => q.brand);
    for (const brand of PRIORITY_COMPETITOR_QUERY_BRANDS) {
      expect(brands).toContain(brand);
    }
  });

  it('produces a bigger plan for DEEP than for QUICK', () => {
    const quick = buildQueryPlan({ country: 'FR', depth: 'QUICK' });
    const deep = buildQueryPlan({ country: 'FR', depth: 'DEEP' });
    expect(deep.queries.length).toBeGreaterThan(quick.queries.length);
  });

  it('is deterministic, so a run can be resumed across requests', () => {
    const a = buildQueryPlan({ country: 'MA', city: 'Casablanca', depth: 'DEEP' });
    const b = buildQueryPlan({ country: 'MA', city: 'Casablanca', depth: 'DEEP' });
    expect(a.queries.map((q) => q.text)).toEqual(b.queries.map((q) => q.text));
  });

  it('never emits duplicate queries', () => {
    const plan = buildQueryPlan({ country: 'CH', depth: 'DEEP' });
    const texts = plan.queries.map((q) => q.text.toLowerCase());
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('scopes to the country when no city is given', () => {
    const plan = buildQueryPlan({ country: 'MA', depth: 'QUICK' });
    expect(plan.city).toBeNull();
    expect(plan.queries.every((q) => q.text.includes('Morocco'))).toBe(true);
  });

  it('accepts a country name as well as an ISO code', () => {
    expect(buildQueryPlan({ country: 'Morocco', depth: 'QUICK' }).countryCode).toBe('MA');
  });

  it('rejects an unknown country rather than silently searching nothing', () => {
    expect(() => buildQueryPlan({ country: 'Atlantis', depth: 'QUICK' })).toThrow(/Unknown country/);
  });

  it('flags markets where only the English fallback vocabulary exists', () => {
    expect(buildQueryPlan({ country: 'MA', depth: 'QUICK' }).hasLocalTerms).toBe(true);
    expect(buildQueryPlan({ country: 'GB', depth: 'QUICK' }).hasLocalTerms).toBe(false);
  });
});

describe('buildResearchQueries', () => {
  it('targets the company site when a domain is known', () => {
    const queries = buildResearchQueries({
      name: 'Acme Spas', city: 'Casablanca', countryName: 'Morocco', websiteDomain: 'acme.ma',
    });
    expect(queries.some((q) => q.startsWith('site:acme.ma'))).toBe(true);
    expect(queries.every((q) => q.length > 0)).toBe(true);
  });

  it('still produces useful queries with no website', () => {
    const queries = buildResearchQueries({ name: 'Acme Spas', countryName: 'Morocco' });
    expect(queries.length).toBeGreaterThan(0);
    expect(queries[0]).toContain('Acme Spas');
  });
});
