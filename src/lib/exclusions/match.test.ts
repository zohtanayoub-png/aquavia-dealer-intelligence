import { describe, expect, it } from 'vitest';
import { buildNameKey, matchExclusion, type ExclusionRule } from '@/lib/exclusions/match';

function rule(overrides: Partial<ExclusionRule> & { name: string }): ExclusionRule {
  return {
    id: overrides.id ?? 'r1',
    kind: overrides.kind ?? 'EXISTING_DEALER',
    name: overrides.name,
    nameKey: overrides.nameKey ?? buildNameKey(overrides.name),
    countryCode: overrides.countryCode ?? null,
    city: overrides.city ?? null,
    domain: overrides.domain ?? null,
    note: overrides.note ?? null,
  };
}

describe('matchExclusion', () => {
  it('returns null when nothing matches', () => {
    const match = matchExclusion(
      { name: 'Acme Spas', countryCode: 'MA' },
      [rule({ name: 'Other Company', countryCode: 'MA' })],
    );
    expect(match).toBeNull();
  });

  it('matches on website domain regardless of name spelling', () => {
    const match = matchExclusion(
      { name: 'Totally Different Trading Name', countryCode: 'MA', website: 'https://www.acme.ma/x' },
      [rule({ name: 'Acme', domain: 'acme.ma' })],
    );
    expect(match?.strength).toBe('DOMAIN');
    expect(match?.rule.kind).toBe('EXISTING_DEALER');
  });

  it('matches on name within the same country', () => {
    const match = matchExclusion(
      { name: 'Piscines Atlas SARL', countryCode: 'MA', city: 'Casablanca' },
      [rule({ name: 'PISCINES ATLAS', countryCode: 'MA' })],
    );
    expect(match?.strength).toBe('NAME_IN_COUNTRY');
  });

  it('does NOT match the same name in a different country', () => {
    const match = matchExclusion(
      { name: 'Aqua Pools', countryCode: 'FR' },
      [rule({ name: 'Aqua Pools', countryCode: 'ES' })],
    );
    expect(match).toBeNull();
  });

  it('applies a country-less rule globally', () => {
    const match = matchExclusion(
      { name: 'Do Not Call Ltd', countryCode: 'GB' },
      [rule({ name: 'Do Not Call Ltd', kind: 'DO_NOT_CONTACT', countryCode: null })],
    );
    expect(match?.rule.kind).toBe('DO_NOT_CONTACT');
  });

  it('prefers a domain match over a weaker name match', () => {
    const match = matchExclusion(
      { name: 'Acme', countryCode: 'MA', websiteDomain: 'acme.ma' },
      [
        rule({ id: 'name-rule', name: 'Acme', countryCode: 'MA', kind: 'ACTIVE_NEGOTIATION' }),
        rule({ id: 'domain-rule', name: 'Acme Holdings', domain: 'acme.ma', kind: 'EXISTING_DEALER' }),
      ],
    );
    expect(match?.strength).toBe('DOMAIN');
    expect(match?.rule.id).toBe('domain-rule');
  });

  it('always explains why a company was excluded', () => {
    const match = matchExclusion(
      { name: 'Acme', countryCode: 'MA', websiteDomain: 'acme.ma' },
      [rule({ name: 'Acme', domain: 'acme.ma' })],
    );
    expect(match?.reason).toContain('acme.ma');
  });
});
