import { describe, expect, it } from 'vitest';
import { scoreCompany, toPriority, type ScoreInput } from '@/lib/scoring/score';

function baseInput(overrides: Partial<ScoreInput> = {}): ScoreInput {
  return {
    spaActivity: 'UNKNOWN', poolActivity: 'UNKNOWN', saunaActivity: 'UNKNOWN',
    wellnessActivity: 'UNKNOWN', hammamActivity: 'UNKNOWN', outdoorLiving: 'UNKNOWN',
    hospitalityActivity: 'UNKNOWN', showroom: 'UNKNOWN',
    brands: [], competitorBrands: [],
    yearFounded: null, spaSinceYear: null,
    googleRating: null, googleReviewCount: null,
    website: null, linkedinUrl: null, instagramUrl: null, facebookUrl: null,
    locationCount: null, decisionMakerCount: 0,
    isMajorCity: false, isMajorCityKnown: false,
    representsAquavia: 'UNKNOWN',
    ...overrides,
  };
}

describe('priority thresholds', () => {
  it('maps scores to the bands defined by the brief', () => {
    expect(toPriority(100)).toBe('A');
    expect(toPriority(80)).toBe('A');
    expect(toPriority(79)).toBe('B');
    expect(toPriority(60)).toBe('B');
    expect(toPriority(59)).toBe('C');
    expect(toPriority(40)).toBe('C');
    expect(toPriority(39)).toBe('D');
    expect(toPriority(0)).toBe('D');
  });
});

describe('scoreCompany', () => {
  it('scores a company with nothing verified as 0 / priority D', () => {
    const result = scoreCompany(baseInput());
    expect(result.score).toBe(0);
    expect(result.priority).toBe('D');
    expect(result.dataCompleteness).toBe(0);
    expect(result.confidence).toBe('UNKNOWN');
  });

  it('never awards points for an UNKNOWN signal', () => {
    const result = scoreCompany(baseInput());
    for (const signal of result.breakdown) {
      if (!signal.verified) expect(signal.points).toBe(0);
    }
  });

  it('scores a strong dealer prospect as priority A', () => {
    const result = scoreCompany(
      baseInput({
        spaActivity: 'YES', poolActivity: 'YES', showroom: 'YES',
        wellnessActivity: 'YES', saunaActivity: 'YES', hospitalityActivity: 'YES',
        outdoorLiving: 'YES',
        brands: ['Wellis', 'HotSpring'], competitorBrands: ['Wellis', 'HotSpring'],
        yearFounded: 1995, spaSinceYear: 2005,
        googleRating: 4.8, googleReviewCount: 240,
        website: 'https://example.com',
        linkedinUrl: 'https://linkedin.com/company/example',
        instagramUrl: 'https://instagram.com/example',
        facebookUrl: 'https://facebook.com/example',
        locationCount: 5, decisionMakerCount: 2,
        isMajorCity: true, isMajorCityKnown: true,
      }),
    );
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.priority).toBe('A');
    expect(result.confidence).toBe('HIGH');
  });

  it('ranks a verified company above an identical but unverified one', () => {
    const verified = scoreCompany(baseInput({ spaActivity: 'YES', showroom: 'YES' }));
    const unverified = scoreCompany(baseInput());
    expect(verified.score).toBeGreaterThan(unverified.score);
  });

  it('treats an explicit NO differently from UNKNOWN in completeness', () => {
    const no = scoreCompany(baseInput({ showroom: 'NO' }));
    const unknown = scoreCompany(baseInput({ showroom: 'UNKNOWN' }));
    // Both score zero points for the signal...
    const noSignal = no.breakdown.find((s) => s.key === 'showroom');
    const unknownSignal = unknown.breakdown.find((s) => s.key === 'showroom');
    expect(noSignal?.points).toBe(0);
    expect(unknownSignal?.points).toBe(0);
    // ...but NO is a verified fact, UNKNOWN is a gap.
    expect(noSignal?.verified).toBe(true);
    expect(unknownSignal?.verified).toBe(false);
    expect(no.dataCompleteness).toBeGreaterThan(unknown.dataCompleteness);
  });

  it('does not use company age as a substitute for spa tenure', () => {
    const oldCompanyNewToSpas = scoreCompany(baseInput({ yearFounded: 1970, spaSinceYear: null }));
    const spaTenure = oldCompanyNewToSpas.breakdown.find((s) => s.key === 'spaTenure');
    expect(spaTenure?.points).toBe(0);
    expect(spaTenure?.verified).toBe(false);
    expect(spaTenure?.detail).toContain('UNKNOWN');
  });

  it('rewards representing more competitor brands, with a cap', () => {
    const one = scoreCompany(baseInput({ competitorBrands: ['Wellis'], brands: ['Wellis'] }));
    const three = scoreCompany(
      baseInput({ competitorBrands: ['Wellis', 'Jacuzzi', 'Bullfrog'], brands: ['Wellis', 'Jacuzzi', 'Bullfrog'] }),
    );
    const oneSignal = one.breakdown.find((s) => s.key === 'competitorBrands');
    const threeSignal = three.breakdown.find((s) => s.key === 'competitorBrands');
    expect(threeSignal!.points).toBeGreaterThan(oneSignal!.points);
    expect(threeSignal!.points).toBeLessThanOrEqual(threeSignal!.max);
  });

  it('reports an unknown geography market as unverified rather than unimportant', () => {
    const result = scoreCompany(baseInput({ isMajorCity: false, isMajorCityKnown: false }));
    const geo = result.breakdown.find((s) => s.key === 'geography');
    expect(geo?.verified).toBe(false);
    expect(geo?.detail).toContain('UNKNOWN');
  });

  it('keeps every score within 0-100', () => {
    const maxed = scoreCompany(
      baseInput({
        spaActivity: 'YES', poolActivity: 'YES', saunaActivity: 'YES', wellnessActivity: 'YES',
        hammamActivity: 'YES', outdoorLiving: 'YES', hospitalityActivity: 'YES', showroom: 'YES',
        brands: ['Wellis', 'Jacuzzi', 'HotSpring', 'Bullfrog'],
        competitorBrands: ['Wellis', 'Jacuzzi', 'HotSpring', 'Bullfrog'],
        yearFounded: 1950, spaSinceYear: 1960, googleRating: 5, googleReviewCount: 5000,
        website: 'https://x.com', linkedinUrl: 'a', instagramUrl: 'b', facebookUrl: 'c',
        locationCount: 40, decisionMakerCount: 10, isMajorCity: true, isMajorCityKnown: true,
      }),
    );
    expect(maxed.score).toBeGreaterThan(0);
    expect(maxed.score).toBeLessThanOrEqual(100);
  });
});
