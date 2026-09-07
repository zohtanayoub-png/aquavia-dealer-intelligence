import { describe, expect, it } from 'vitest';
import {
  buildDedupeKey, companyNameKey, extractDomain, isPlausibleFoundingYear,
  mergeStringLists, normalizeName, yearsInSpaIndustry,
} from '@/lib/utils';

describe('normalizeName', () => {
  it('strips accents, case and punctuation', () => {
    expect(normalizeName('Piscinas Málaga, S.L.')).toBe('piscinas malaga s l');
    expect(normalizeName('Spa & Wellness')).toBe('spa and wellness');
  });
});

describe('companyNameKey', () => {
  it('treats legal-form variants of the same company as equal', () => {
    expect(companyNameKey('Aqua Pools S.L.')).toBe(companyNameKey('AQUA POOLS SL'));
    expect(companyNameKey('Wellness GmbH')).toBe(companyNameKey('Wellness'));
  });

  it('strips the Italian "S.p.A." legal suffix without destroying the name', () => {
    expect(companyNameKey('Idroterme SpA')).toBe('idroterme');
  });

  it('never strips a name down to nothing', () => {
    expect(companyNameKey('SL')).toBe('sl');
  });
});

describe('extractDomain', () => {
  it('returns the registrable host without www', () => {
    expect(extractDomain('https://www.Example.com/about')).toBe('example.com');
    expect(extractDomain('example.co.uk')).toBe('example.co.uk');
  });

  it('returns null for unusable input', () => {
    expect(extractDomain(null)).toBeNull();
    expect(extractDomain('')).toBeNull();
    expect(extractDomain('not a url at all !!')).toBeNull();
  });
});

describe('buildDedupeKey', () => {
  it('prefers the Google Place ID above everything else', () => {
    const key = buildDedupeKey({
      googlePlaceId: 'PLACE123', websiteDomain: 'example.com',
      countryCode: 'MA', name: 'Acme',
    });
    expect(key).toBe('place:PLACE123');
  });

  it('falls back to the website domain, then to country + name', () => {
    expect(buildDedupeKey({ websiteDomain: 'acme.ma', countryCode: 'MA', name: 'Acme' }))
      .toBe('domain:acme.ma');
    expect(buildDedupeKey({ countryCode: 'ma', name: 'Acme Spas S.L.', city: 'Casablanca' }))
      .toBe('name:MA:casablanca:acme spas');
  });

  it('gives the same key to the same company found by two different queries', () => {
    const a = buildDedupeKey({ countryCode: 'MA', name: 'Piscines Atlas SARL', city: 'Casablanca' });
    const b = buildDedupeKey({ countryCode: 'ma', name: 'PISCINES ATLAS  sarl', city: 'casablanca' });
    expect(a).toBe(b);
  });
});

describe('year handling', () => {
  it('accepts only plausible founding years', () => {
    expect(isPlausibleFoundingYear(1990)).toBe(true);
    expect(isPlausibleFoundingYear(1700)).toBe(false);
    expect(isPlausibleFoundingYear(new Date().getUTCFullYear() + 1)).toBe(false);
  });

  it('derives spa tenure ONLY from the spa start year', () => {
    const year = new Date().getUTCFullYear();
    expect(yearsInSpaIndustry(year - 10)).toBe(10);
    expect(yearsInSpaIndustry(null)).toBeNull();
    expect(yearsInSpaIndustry(1500)).toBeNull();
  });
});

describe('mergeStringLists', () => {
  it('merges case-insensitively and keeps first-seen casing', () => {
    expect(mergeStringLists(['Wellis'], ['wellis', 'Jacuzzi'])).toEqual(['Wellis', 'Jacuzzi']);
  });
});
