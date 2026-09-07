import { describe, expect, it } from 'vitest';
import { escapeCsvCell, sanitize, toCsv } from '@/lib/export/csv';
import { toGoogleMyMapsCsv } from '@/lib/export/googleMyMaps';
import { GOOGLE_MY_MAPS_COLUMNS } from '@/lib/export/columns';
import type { ExportCompany } from '@/lib/export/columns';

/** Minimal RFC 4180 row parser, so assertions survive quoted commas. */
function parseCsvRow(row: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < row.length; i += 1) {
    const ch = row[i];
    if (inQuotes) {
      if (ch === '"') {
        if (row[i + 1] === '"') { cell += '"'; i += 1; }
        else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { cells.push(cell); cell = ''; }
    else cell += ch;
  }
  cells.push(cell);
  return cells;
}

function company(overrides: Partial<ExportCompany> = {}): ExportCompany {
  return {
    id: 'c1', name: 'Acme Spas', legalName: null, dedupeKey: 'k1',
    countryCode: 'MA', countryName: 'Morocco', region: null, city: 'Casablanca',
    fullAddress: '1 Rue Example, Casablanca', postalCode: null,
    latitude: 33.5731, longitude: -7.5898,
    googlePlaceId: 'PLACE1', googleRating: 4.6, googleReviewCount: 88,
    googleTypes: [], googleMapsUri: null, googleBusinessStatus: null,
    website: 'https://acme.example', websiteDomain: 'acme.example',
    phone: '+212 5 22 00 00 00', publicEmail: null, whatsapp: null,
    linkedinUrl: null, instagramUrl: null, facebookUrl: null, youtubeUrl: null,
    spaActivity: 'YES', poolActivity: 'YES', saunaActivity: 'UNKNOWN',
    wellnessActivity: 'UNKNOWN', hammamActivity: 'UNKNOWN', outdoorLiving: 'UNKNOWN',
    hospitalityActivity: 'UNKNOWN', showroom: 'YES',
    yearFounded: 1998, yearFoundedConfidence: 'MEDIUM',
    spaSinceYear: null, spaSinceConfidence: 'UNKNOWN', yearsInSpaIndustry: null,
    locationCount: null, brands: ['Wellis'], competitorBrands: ['Wellis'],
    representsAquavia: 'UNKNOWN',
    score: 74, priority: 'B', scoreBreakdown: null,
    whyThisCompany: 'Already sells spas.', recommendedAction: 'CALL',
    confidence: 'MEDIUM', dataCompleteness: 55,
    crmStatus: 'NEW', salesNotes: null, lastContactAt: null, nextFollowUpAt: null,
    ownerName: null, isExcluded: false, exclusionKind: null, exclusionNote: null,
    researchNotes: null, enrichmentStatus: null,
    discoveredAt: new Date('2026-01-15T00:00:00Z'), lastVerifiedAt: null,
    createdAt: new Date('2026-01-15T00:00:00Z'), updatedAt: new Date('2026-01-15T00:00:00Z'),
    decisionMakers: [],
    ...overrides,
  } as ExportCompany;
}

describe('CSV escaping', () => {
  it('quotes cells containing commas, quotes or newlines', () => {
    expect(escapeCsvCell('plain')).toBe('plain');
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it('neutralises spreadsheet formula injection', () => {
    // A company legitimately named "=Best Pools" must not execute in Excel.
    expect(sanitize('=cmd|calc')).toBe("'=cmd|calc");
    expect(sanitize('+1 555')).toBe("'+1 555");
    expect(sanitize('@handle')).toBe("'@handle");
    expect(sanitize('Normal Name')).toBe('Normal Name');
  });
});

describe('toCsv', () => {
  it('writes UNKNOWN for unverified values rather than leaving cells blank', () => {
    const csv = toCsv([company()], 'full');
    const [header, row] = csv.replace(/^﻿/, '').trim().split('\r\n');
    const columns = parseCsvRow(header);
    const values = parseCsvRow(row);

    expect(values[columns.indexOf('Sauna Activity')]).toBe('UNKNOWN');
    expect(values[columns.indexOf('Years In Spa Industry')]).toBe('UNKNOWN');
    expect(values[columns.indexOf('Public Email')]).toBe('UNKNOWN');
    // A quoted field containing a comma must survive round-tripping intact.
    expect(values[columns.indexOf('Full Address')]).toBe('1 Rue Example, Casablanca');
  });

  it('keeps founded year and spa tenure in separate columns', () => {
    const header = toCsv([company()], 'full').split('\r\n')[0];
    expect(header).toContain('Year Founded');
    expect(header).toContain('Years In Spa Industry');
  });

  it('starts with a BOM so Excel reads UTF-8 correctly', () => {
    expect(toCsv([company({ name: 'Piscinas Málaga' })], 'full').startsWith('﻿')).toBe(true);
  });
});

describe('Google My Maps export', () => {
  it('emits exactly the columns the brief requires', () => {
    expect(GOOGLE_MY_MAPS_COLUMNS.map((c) => c.header)).toEqual([
      'Company', 'Address', 'Latitude', 'Longitude', 'Score', 'Priority',
      'Rating', 'Reviews', 'Phone', 'Website', 'Brands', 'Decision Maker', 'Notes',
    ]);
  });

  it('includes companies that have coordinates', () => {
    const result = toGoogleMyMapsCsv([company()]);
    expect(result.includedCount).toBe(1);
    expect(result.skipped).toEqual([]);
    expect(result.csv).toContain('Acme Spas');
    expect(result.csv).toContain('33.5731');
  });

  it('reports rather than silently drops companies with no coordinates', () => {
    const result = toGoogleMyMapsCsv([company({ latitude: null, longitude: null, name: 'No Coords Ltd' })]);
    expect(result.includedCount).toBe(0);
    expect(result.skipped).toEqual(['No Coords Ltd']);
  });
});
