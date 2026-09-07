import { describe, expect, it } from 'vitest';
import { extractDecisionMakers } from '@/lib/enrich/decisionMakers';

const src = (content: string, url = 'https://acme.example/team') => [
  { url, title: 'Our team', content },
];

describe('extractDecisionMakers — public information only', () => {
  it('finds nobody when the text names nobody', () => {
    expect(extractDecisionMakers(src('We sell pools and spas across the region.'))).toEqual([]);
  });

  it('extracts a name and position stated together', () => {
    const people = extractDecisionMakers(src('Maria Lopez, Sales Director, leads our spa division.'));
    expect(people).toHaveLength(1);
    expect(people[0].fullName).toBe('Maria Lopez');
    expect(people[0].roleBucket).toBe('SALES_DIRECTOR');
  });

  it('handles the title-first phrasing used on many sites', () => {
    const people = extractDecisionMakers(src('Director comercial: Juan Perez'));
    expect(people[0]?.fullName).toBe('Juan Perez');
    expect(people[0]?.roleBucket).toBe('COMMERCIAL_DIRECTOR');
  });

  it('recognises local-language titles', () => {
    const de = extractDecisionMakers(src('Thomas Weber, Geschäftsführer'));
    expect(de[0]?.roleBucket).toBe('CEO');

    const fr = extractDecisionMakers(src('Sophie Martin, Directeur Commercial'));
    expect(fr[0]?.roleBucket).toBe('COMMERCIAL_DIRECTOR');
  });

  it('NEVER invents an email when none is published', () => {
    const people = extractDecisionMakers(src('Ana Torres, Managing Director. Call our office today.'));
    expect(people[0].email).toBeNull();
  });

  it('keeps an email only when it appears in the same sentence as the person', () => {
    const attached = extractDecisionMakers(src('Ana Torres, Managing Director, ana@acme.example.'));
    expect(attached[0].email).toBe('ana@acme.example');

    const detached = extractDecisionMakers(
      src('Ana Torres, Managing Director. Separately, our general inbox is info@acme.example.'),
    );
    expect(detached[0].email).toBeNull();
  });

  it('only attaches a LinkedIn URL whose slug matches the person', () => {
    const matching = extractDecisionMakers(
      src('Ana Torres, Managing Director. Profile: https://www.linkedin.com/in/ana-torres-spa'),
    );
    expect(matching[0].linkedinUrl).toContain('ana-torres');

    const mismatched = extractDecisionMakers(
      src('Ana Torres, Managing Director. See https://www.linkedin.com/in/someone-entirely-else'),
    );
    expect(mismatched[0].linkedinUrl).toBeNull();
  });

  it('always records the source URL and a quote for every person', () => {
    const people = extractDecisionMakers(src('Ana Torres, Managing Director.', 'https://acme.example/about'));
    expect(people[0].evidence.url).toBe('https://acme.example/about');
    expect(people[0].evidence.quote).toContain('Ana Torres');
  });

  it('raises confidence only when corroborated by contact detail or a profile', () => {
    const bare = extractDecisionMakers(src('Ana Torres, Managing Director.'));
    const withEmail = extractDecisionMakers(src('Ana Torres, Managing Director, ana@acme.example.'));
    expect(bare[0].confidence).toBe('MEDIUM');
    expect(withEmail[0].confidence).toBe('HIGH');
  });

  it('rejects boilerplate that looks like a name', () => {
    const people = extractDecisionMakers(src('Cookie Policy, Sales Director of nothing'));
    expect(people.map((p) => p.fullName)).not.toContain('Cookie Policy');
  });

  it('de-duplicates a person appearing on several pages, keeping the best detail', () => {
    const people = extractDecisionMakers([
      { url: 'https://a.example', title: null, content: 'Ana Torres, Managing Director.' },
      { url: 'https://b.example', title: null, content: 'Ana Torres, Managing Director, ana@acme.example.' },
    ]);
    expect(people).toHaveLength(1);
    expect(people[0].email).toBe('ana@acme.example');
  });
});
