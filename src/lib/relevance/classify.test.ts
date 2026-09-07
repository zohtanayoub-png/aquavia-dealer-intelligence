import { describe, expect, it } from 'vitest';
import { classifyCompany, toRelevance, type ClassifyInput } from '@/lib/relevance/classify';

function company(overrides: Partial<ClassifyInput> = {}): ClassifyInput {
  return {
    name: 'Test Company', googleTypes: [], sources: [], website: null,
    spaActivity: 'UNKNOWN', poolActivity: 'UNKNOWN', saunaActivity: 'UNKNOWN',
    wellnessActivity: 'UNKNOWN', hammamActivity: 'UNKNOWN', outdoorLiving: 'UNKNOWN',
    hospitalityActivity: 'UNKNOWN', showroom: 'UNKNOWN',
    brands: [], competitorBrands: [], yearFounded: null, locationCount: null,
    decisionMakerCount: 0, isMajorCity: false,
    ...overrides,
  };
}
const src = (content: string, url = 'https://example.ma/about') => [{ url, snippet: content, title: null }];

// ---------------------------------------------------------------------------
// The false positives that motivated this whole layer
// ---------------------------------------------------------------------------
describe('service businesses must NOT be dealer prospects', () => {
  it('"Wang Thai Spa" — a massage venue, not a hot tub retailer', () => {
    const r = classifyCompany(company({ name: 'Wang Thai Spa', googleTypes: ['spa', 'massage'] }));
    expect(r.classification).toBe('MASSAGE_DAY_SPA');
    expect(r.isDealerProspect).toBe(false);
    expect(r.commercialRelevance).toBe('IRRELEVANT');
    expect(r.dealerFitScore).toBeLessThan(20);
    expect(r.notDealerProspectReason).toContain('NOT A DEALER PROSPECT');
  });

  it('massage treatment centre (French)', () => {
    const r = classifyCompany(company({
      name: 'Centre de Massage Atlas',
      sources: src('Centre de massage et de relaxation. Massage relaxant, gommage et soins du corps.'),
    }));
    expect(r.classification).toBe('MASSAGE_DAY_SPA');
    expect(r.isDealerProspect).toBe(false);
  });

  it('beauty spa (French)', () => {
    const r = classifyCompany(company({
      name: 'Institut de Beauté Yasmine',
      sources: src("Institut de beauté à Casablanca. Soins du visage, manucure et épilation."),
    }));
    expect(r.classification).toBe('BEAUTY_AESTHETICS');
    expect(r.isDealerProspect).toBe(false);
    expect(r.commercialRelevance).toBe('IRRELEVANT');
  });

  it('beauty salon (Arabic)', () => {
    const r = classifyCompany(company({
      name: 'صالون الجمال',
      sources: src('صالون تجميل متخصص في العناية بالبشرة والمانيكير'),
    }));
    expect(r.classification).toBe('BEAUTY_AESTHETICS');
    expect(r.isDealerProspect).toBe(false);
  });

  it('traditional hammam service (Arabic + French)', () => {
    const r = classifyCompany(company({
      name: 'Hammam Al Andalous',
      sources: src('حمام تقليدي مغربي — hammam traditionnel et bain maure pour femmes'),
    }));
    expect(r.classification).toBe('HAMMAM_SERVICE_ONLY');
    expect(r.isDealerProspect).toBe(false);
  });

  it('hotel treatment spa', () => {
    const r = classifyCompany(company({
      name: 'Riad Zitoun Spa',
      googleTypes: ['lodging'],
      sources: src('Our hotel spa offers a full spa menu. Book a treatment in our riad.'),
    }));
    expect(r.classification).toBe('HOTEL_SPA_ONLY');
    expect(r.isDealerProspect).toBe(false);
  });

  it('yoga / fitness studio is irrelevant', () => {
    const r = classifyCompany(company({
      name: 'Zen Yoga', sources: src('Yoga classes and pilates. Fitness centre membership available.'),
    }));
    expect(r.classification).toBe('IRRELEVANT');
    expect(r.isDealerProspect).toBe(false);
  });

  it('a good general score does not rescue a massage salon', () => {
    // Strong structural signals — real website, major city, multiple locations —
    // exactly what inflated these companies on the general opportunity score.
    const r = classifyCompany(company({
      name: 'Wang Thai Spa', googleTypes: ['spa', 'massage'],
      website: 'https://wangthai.example', isMajorCity: true, locationCount: 3,
      decisionMakerCount: 2, yearFounded: 2005,
    }));
    expect(r.isDealerProspect).toBe(false);
    expect(r.commercialRelevance).toBe('IRRELEVANT');
  });
});

// ---------------------------------------------------------------------------
// Genuine dealer prospects
// ---------------------------------------------------------------------------
describe('real dealer prospects must score highly', () => {
  it('hot tub retailer with showroom and a competing brand', () => {
    const r = classifyCompany(company({
      name: 'Maroc Spas & Piscines',
      sources: src('Vente de spas et jacuzzi extérieur. Notre showroom à Casablanca présente nos spas de nage.'),
      competitorBrands: ['Wellis'], brands: ['Wellis'], showroom: 'YES', spaActivity: 'YES',
      website: 'https://example.ma', isMajorCity: true, yearFounded: 2008, decisionMakerCount: 1,
    }));
    expect(r.classification).toBe('HOT_TUB_SPA_RETAILER');
    expect(r.dealerFitScore).toBeGreaterThanOrEqual(80);
    expect(r.commercialRelevance).toBe('HIGHLY_RELEVANT');
    expect(r.isDealerProspect).toBe(true);
  });

  it('company selling Jacuzzi brand', () => {
    const r = classifyCompany(company({
      name: 'Aqua Confort', competitorBrands: ['Jacuzzi'], brands: ['Jacuzzi'],
      showroom: 'YES', website: 'https://example.ma',
    }));
    expect(r.classification).toBe('HOT_TUB_SPA_RETAILER');
    expect(r.dealerFitScore).toBeGreaterThanOrEqual(40);
    expect(r.isDealerProspect).toBe(true);
  });

  it('pool company with a showroom is at least POSSIBLE', () => {
    const r = classifyCompany(company({
      name: 'Piscines Atlas',
      sources: src('Construction de piscine et équipement de piscine. Pisciniste à Casablanca.'),
      showroom: 'YES', website: 'https://example.ma', isMajorCity: true,
    }));
    expect(r.classification).toBe('POOL_COMPANY');
    expect(r.dealerFitScore).toBeGreaterThanOrEqual(40);
    expect(['POSSIBLE', 'RELEVANT', 'HIGHLY_RELEVANT']).toContain(r.commercialRelevance);
  });

  it('pool + spa retailer classifies as POOL_AND_SPA_COMPANY', () => {
    const r = classifyCompany(company({
      name: 'Confort Piscine & Spa',
      sources: src('Vente de spas, jacuzzi extérieur et construction de piscine. Distributeur officiel.'),
      showroom: 'YES',
    }));
    expect(r.classification).toBe('POOL_AND_SPA_COMPANY');
    expect(r.isDealerProspect).toBe(true);
  });

  it('pool + sauna equipment retailer', () => {
    const r = classifyCompany(company({
      name: 'Wellness Maroc',
      sources: src('Équipement de piscine, cabine de sauna et installation de hammam.'),
    }));
    expect(['POOL_AND_SPA_COMPANY', 'POOL_COMPANY', 'SAUNA_HAMMAM_EQUIPMENT']).toContain(r.classification);
    expect(r.isDealerProspect).toBe(true);
  });

  it('Arabic hot tub retailer is detected', () => {
    const r = classifyCompany(company({
      name: 'الرياض للجاكوزي',
      sources: src('بيع جاكوزي وجاكوزي خارجي بأفضل الأسعار — صالة عرض بالدار البيضاء'),
    }));
    expect(r.classification).toBe('HOT_TUB_SPA_RETAILER');
    expect(r.isDealerProspect).toBe(true);
    expect(r.productEvidence.some((p) => p.lang === 'ar')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The override rule
// ---------------------------------------------------------------------------
describe('product evidence overrides negative terminology', () => {
  it('a pool company that also offers massage is still a prospect', () => {
    const r = classifyCompany(company({
      name: 'Complexe Aquatique Atlas',
      sources: src('Construction de piscine et vente de spas. Nous proposons aussi un service de massage relaxant.'),
      showroom: 'YES',
    }));
    expect(r.isDealerProspect).toBe(true);
    expect(r.classification).toBe('POOL_AND_SPA_COMPANY');
    expect(r.negativeSignals.length).toBeGreaterThan(0);
    expect(r.whyNotDealer).toContain('OVERRIDDEN');
  });

  it('negative penalties are not applied when product evidence exists', () => {
    const withBoth = classifyCompany(company({
      name: 'X', sources: src('Vente de spas et jacuzzi extérieur. Salon de massage également.'),
    }));
    const productOnly = classifyCompany(company({
      name: 'X', sources: src('Vente de spas et jacuzzi extérieur.'),
    }));
    expect(withBoth.dealerFitScore).toBe(productOnly.dealerFitScore);
  });
});

// ---------------------------------------------------------------------------
// Data quality
// ---------------------------------------------------------------------------
describe('data quality guarantees', () => {
  it('the bare word "spa" never establishes relevance on its own', () => {
    const r = classifyCompany(company({ name: 'Le Spa', sources: src('Bienvenue au Spa.') }));
    expect(r.classification).not.toBe('HOT_TUB_SPA_RETAILER');
    expect(r.dealerFitScore).toBeLessThan(40);
  });

  it('returns UNKNOWN rather than guessing when there is no evidence', () => {
    const r = classifyCompany(company({ name: 'Société Générale de Commerce' }));
    expect(r.classification).toBe('UNKNOWN');
    expect(r.confidence).toBe('UNKNOWN');
    expect(r.needsEnrichment).toBe(true);
  });

  it('every product evidence item keeps a verbatim quote', () => {
    const r = classifyCompany(company({
      name: 'X', sources: src('Nous proposons la vente de spas et le spa de nage.', 'https://src.example/p'),
    }));
    expect(r.productEvidence.length).toBeGreaterThan(0);
    for (const e of r.productEvidence) {
      expect(e.quote.length).toBeGreaterThan(0);
      expect(e.sourceUrl).toBe('https://src.example/p');
    }
  });

  it('name-only evidence never produces HIGH confidence product claims', () => {
    const r = classifyCompany(company({ name: 'Spa Center' }));
    expect(r.confidence).not.toBe('HIGH');
  });

  it('score always lands within 0-100', () => {
    const loaded = classifyCompany(company({
      name: 'Mega Spa Pools', sources: src('vente de spas jacuzzi exterieur spa de nage construction de piscine cabine de sauna distributeur officiel showroom'),
      competitorBrands: ['Wellis', 'Jacuzzi'], showroom: 'YES', spaActivity: 'YES',
      locationCount: 6, hospitalityActivity: 'YES', website: 'https://x.ma',
      yearFounded: 1990, decisionMakerCount: 3, isMajorCity: true,
    }));
    expect(loaded.dealerFitScore).toBeLessThanOrEqual(100);
    expect(loaded.dealerFitScore).toBeGreaterThan(0);
    expect(classifyCompany(company()).dealerFitScore).toBeGreaterThanOrEqual(0);
  });
});

describe('toRelevance banding', () => {
  it('matches the specified thresholds', () => {
    expect(toRelevance(100, true)).toBe('HIGHLY_RELEVANT');
    expect(toRelevance(80, true)).toBe('HIGHLY_RELEVANT');
    expect(toRelevance(79, true)).toBe('RELEVANT');
    expect(toRelevance(60, true)).toBe('RELEVANT');
    expect(toRelevance(59, true)).toBe('POSSIBLE');
    expect(toRelevance(40, true)).toBe('POSSIBLE');
    expect(toRelevance(39, true)).toBe('LOW_RELEVANCE');
    expect(toRelevance(20, true)).toBe('LOW_RELEVANCE');
    // IRRELEVANT is reserved for non-prospects, so a weak-but-adjacent
    // company floors at LOW_RELEVANCE rather than being written off.
    expect(toRelevance(19, true)).toBe('LOW_RELEVANCE');
    expect(toRelevance(19, false)).toBe('IRRELEVANT');
  });

  it('a non-prospect is always IRRELEVANT regardless of score', () => {
    expect(toRelevance(95, false)).toBe('IRRELEVANT');
  });

  it('does not call a company IRRELEVANT merely because nothing was found', () => {
    // "We found no evidence" must never be reported as "we found it to be
    // irrelevant" — those records are the ones most worth enriching.
    expect(toRelevance(0, true, 'NO_EVIDENCE')).toBe('LOW_RELEVANCE');
    expect(toRelevance(0, true, 'EVIDENCED')).toBe('LOW_RELEVANCE');
  });

  it('an unresearched company is LOW_RELEVANCE, not IRRELEVANT', () => {
    const r = classifyCompany(company({ name: 'Société Atlantique de Commerce' }));
    expect(r.classification).toBe('UNKNOWN');
    expect(r.commercialRelevance).toBe('LOW_RELEVANCE');
    expect(r.needsEnrichment).toBe(true);
  });
});
