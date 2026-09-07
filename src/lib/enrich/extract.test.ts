import { describe, expect, it } from 'vitest';
import { extractFromSources } from '@/lib/enrich/extract';

const src = (content: string, url = 'https://example.com/about') => [
  { url, title: 'About us', content },
];

describe('extractFromSources — the never-invent contract', () => {
  it('returns UNKNOWN for everything when the text says nothing relevant', () => {
    const result = extractFromSources(src('We sell office furniture and stationery in the city centre.'));
    expect(result.spaActivity.value).toBe('UNKNOWN');
    expect(result.showroom.value).toBe('UNKNOWN');
    expect(result.yearFounded.year).toBeNull();
    expect(result.spaSinceYear.year).toBeNull();
    expect(result.brands.names).toEqual([]);
  });

  it('emits no evidence for an UNKNOWN signal', () => {
    const result = extractFromSources(src('Nothing relevant here at all.'));
    expect(result.spaActivity.evidence).toHaveLength(0);
    expect(result.showroom.evidence).toHaveLength(0);
  });

  it('detects spa activity and keeps the source URL and a real quote', () => {
    const result = extractFromSources(
      src('We are a leading retailer of hot tubs and outdoor spas in the region.', 'https://acme.example/spa'),
    );
    expect(result.spaActivity.value).toBe('YES');
    expect(result.spaActivity.evidence[0].url).toBe('https://acme.example/spa');
    expect(result.spaActivity.evidence[0].quote.toLowerCase()).toContain('hot tub');
  });

  it('does not match a keyword inside a longer word', () => {
    // "spain" and "space" must never trigger the "spa" signal.
    const result = extractFromSources(src('Our offices in Spain have plenty of space for storage.'));
    expect(result.spaActivity.value).toBe('UNKNOWN');
  });

  it('requires explicit framing before accepting a founding year', () => {
    const bare = extractFromSources(src('Call us on 1998 555 0100 for a quote about our 2024 catalogue.'));
    expect(bare.yearFounded.year).toBeNull();

    const framed = extractFromSources(src('Founded in 1987, we have served the region ever since.'));
    expect(framed.yearFounded.year).toBe(1987);
  });

  it('keeps founding year and spa-since year strictly separate', () => {
    const result = extractFromSources(
      src('The company was founded in 1975 as a pool builder. We have been selling spas since 2012.'),
    );
    expect(result.yearFounded.year).toBe(1975);
    expect(result.spaSinceYear.year).toBe(2012);
  });

  it('leaves spa-since UNKNOWN when only a company founding year is stated', () => {
    const result = extractFromSources(src('Established in 1990, a family business.'));
    expect(result.yearFounded.year).toBe(1990);
    expect(result.spaSinceYear.year).toBeNull();
  });

  it('rejects implausible years', () => {
    const result = extractFromSources(src('Founded in 1500 according to legend.'));
    expect(result.yearFounded.year).toBeNull();
  });

  it('detects competitor brands and classifies them', () => {
    const result = extractFromSources(src('We are the official dealer for Wellis and HotSpring spas.'));
    expect(result.brands.names).toContain('Wellis');
    expect(result.brands.names).toContain('HotSpring');
    expect(result.brands.competitors).toContain('Wellis');
  });

  it('finds local-language showroom evidence', () => {
    const result = extractFromSources(src('Visite nuestra sala de exposicion en Madrid.'));
    expect(result.showroom.value).toBe('YES');
  });

  it('records an explicit online-only statement as NO, not UNKNOWN', () => {
    const result = extractFromSources(src('We are an online only retailer with no showroom.'));
    expect(result.showroom.value).toBe('NO');
    expect(result.showroom.evidence).toHaveLength(1);
  });

  it('only harvests emails that literally appear in the text', () => {
    const result = extractFromSources(src('Contact us at info@acme-spas.com for details.'));
    expect(result.emails.map((e) => e.value)).toEqual(['info@acme-spas.com']);
  });

  it('never constructs an email when none is published', () => {
    const result = extractFromSources(src('Our managing director is Ana Torres. Call the office.'));
    expect(result.emails).toEqual([]);
  });

  it('extracts social profile URLs verbatim', () => {
    const result = extractFromSources(
      src('Follow us: https://www.instagram.com/acmespas and https://facebook.com/acmespas'),
    );
    expect(result.socials.instagram).toBe('https://www.instagram.com/acmespas');
    expect(result.socials.facebook).toBe('https://facebook.com/acmespas');
    expect(result.socials.linkedin).toBeNull();
  });

  it('reads a multi-location claim only when a count is stated', () => {
    expect(extractFromSources(src('Visit one of our 4 showrooms.')).locationCount.count).toBe(4);
    expect(extractFromSources(src('Visit our showroom.')).locationCount.count).toBeNull();
  });

  it('merges evidence across several sources, preferring positive findings', () => {
    const result = extractFromSources([
      { url: 'https://a.example', title: null, content: 'Nothing here.' },
      { url: 'https://b.example', title: null, content: 'We install swimming pools and hot tubs.' },
    ]);
    expect(result.spaActivity.value).toBe('YES');
    expect(result.poolActivity.value).toBe('YES');
    expect(result.spaActivity.evidence[0].url).toBe('https://b.example');
  });
});
