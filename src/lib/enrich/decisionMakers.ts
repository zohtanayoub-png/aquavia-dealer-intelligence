/**
 * Decision-maker extraction from public web research.
 *
 * ETHICS / LEGAL BOUNDARY — enforced in code, not just documented:
 *   * We read only text a search provider already returned from public pages.
 *   * We never authenticate to, crawl behind, or otherwise bypass LinkedIn's
 *     access controls. A public LinkedIn profile URL appearing in ordinary
 *     search results is stored as a reference only.
 *   * Emails are ONLY kept when the address literally appears next to the
 *     person in the retrieved text. Pattern-guessing (first.last@domain) is
 *     never performed — an unverifiable email is UNKNOWN.
 */
import type { Evidence, ExtractionInput } from '@/lib/enrich/extract';
import { toTitleCase } from '@/lib/utils';

export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

export interface DecisionMakerFinding {
  fullName: string;
  position: string | null;
  roleBucket: RoleBucket | null;
  linkedinUrl: string | null;
  email: string | null;
  phone: string | null;
  confidence: Confidence;
  evidence: Evidence;
}

export type RoleBucket =
  | 'OWNER' | 'FOUNDER' | 'CEO' | 'MANAGING_DIRECTOR' | 'GENERAL_MANAGER'
  | 'COMMERCIAL_DIRECTOR' | 'SALES_DIRECTOR' | 'PURCHASING_DIRECTOR'
  | 'BUSINESS_DEVELOPMENT_DIRECTOR' | 'SPA_DIVISION_MANAGER' | 'POOL_DIVISION_MANAGER';

/** Multilingual titles mapped to the roles the brief asks for. */
const ROLE_TITLES: { bucket: RoleBucket; titles: string[] }[] = [
  { bucket: 'OWNER', titles: ['owner', 'propietario', 'propietaria', 'proprietaire', 'proprietario', 'inhaber', 'eigenaar', 'właściciel', 'wlasciciel', 'sahibi', 'tulajdonos', 'المالك'] },
  { bucket: 'FOUNDER', titles: ['founder', 'co-founder', 'cofounder', 'fundador', 'fundadora', 'fondateur', 'fondatrice', 'fondatore', 'grunder', 'gründer', 'oprichter', 'założyciel', 'kurucu'] },
  { bucket: 'CEO', titles: ['ceo', 'chief executive officer', 'presidente', 'president directeur general', 'pdg', 'amministratore delegato', 'geschaftsfuhrer', 'geschäftsführer', 'prezes', 'genel müdür', 'الرئيس التنفيذي'] },
  { bucket: 'MANAGING_DIRECTOR', titles: ['managing director', 'director general', 'directora general', 'directeur general', 'direttore generale', 'algemeen directeur', 'dyrektor zarzadzajacy', 'ügyvezető'] },
  { bucket: 'GENERAL_MANAGER', titles: ['general manager', 'gerente general', 'gerente', 'directeur', 'direttore', 'betriebsleiter', 'müdür'] },
  { bucket: 'COMMERCIAL_DIRECTOR', titles: ['commercial director', 'director comercial', 'directeur commercial', 'direttore commerciale', 'vertriebsleiter', 'commercieel directeur', 'dyrektor handlowy', 'ticaret müdürü'] },
  { bucket: 'SALES_DIRECTOR', titles: ['sales director', 'head of sales', 'director de ventas', 'responsable des ventes', 'responsabile vendite', 'verkaufsleiter', 'sales manager', 'satış müdürü'] },
  { bucket: 'PURCHASING_DIRECTOR', titles: ['purchasing director', 'head of purchasing', 'director de compras', 'directeur des achats', 'responsabile acquisti', 'einkaufsleiter', 'inkoopmanager', 'satın alma müdürü'] },
  { bucket: 'BUSINESS_DEVELOPMENT_DIRECTOR', titles: ['business development director', 'business development manager', 'director de desarrollo de negocio', 'directeur du developpement'] },
  { bucket: 'SPA_DIVISION_MANAGER', titles: ['spa division manager', 'spa manager', 'responsable spa', 'responsable de spa', 'spa department manager', 'responsabile spa', 'wellness manager'] },
  { bucket: 'POOL_DIVISION_MANAGER', titles: ['pool division manager', 'pool manager', 'responsable piscinas', 'responsable piscine', 'responsabile piscine', 'schwimmbad leiter'] },
];

/**
 * Build a case-INSENSITIVE pattern for one title without using the `i` flag.
 *
 * The `i` flag would also apply to the name pattern, which relies on requiring
 * an initial capital. Without that requirement "Sales Director, leads our spa"
 * yields a phantom person called "Leads Our Spa". Each letter is therefore
 * expanded to a character class so only the TITLE is case-insensitive.
 */
function caseInsensitivePattern(literal: string): string {
  return Array.from(literal)
    .map((ch) => {
      const lower = ch.toLowerCase();
      const upper = ch.toUpperCase();
      if (lower === upper) return lower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return `[${lower}${upper}]`;
    })
    .join('');
}

const ALL_TITLE_ALTERNATIVES = ROLE_TITLES.flatMap((r) => r.titles)
  .sort((a, b) => b.length - a.length)
  .map(caseInsensitivePattern);

const TITLE_GROUP = ALL_TITLE_ALTERNATIVES.join('|');

/** A person's name: 2-3 capitalised tokens, allowing particles like "van", "de". */
const NAME_TOKEN = "[A-ZÀ-ÞĄ-Ž][\\p{L}'’\\-]+";
const PARTICLE = '(?:de|del|della|van|von|der|den|di|da|dos|das|el|al|le|la|bin|ben)';
const NAME_PATTERN = `${NAME_TOKEN}(?:\\s+(?:${PARTICLE}\\s+)?${NAME_TOKEN}){1,2}`;

/** "Jane Doe, Sales Director" / "Jane Doe – CEO" */
const NAME_THEN_TITLE = new RegExp(
  `(${NAME_PATTERN})\\s*(?:,|-|–|—|\\||:)\\s*(${TITLE_GROUP})\\b`,
  'gu',
);

/** "CEO: Jane Doe" / "Director comercial – Jane Doe" */
const TITLE_THEN_NAME = new RegExp(
  `(?:^|[^\\p{L}])(${TITLE_GROUP})\\s*(?:,|-|–|—|\\||:|\\bes\\b|\\bis\\b)\\s*(${NAME_PATTERN})`,
  'gu',
);

const LINKEDIN_PROFILE_RE = /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[A-Za-z0-9\-_%.]+/gi;
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
const PHONE_RE = /\+\d{1,3}[\s.\-]?(?:\(?\d{1,4}\)?[\s.\-]?){2,5}\d{2,4}/;

/** Words that look like names but are not people. */
const NAME_BLOCKLIST = new Set([
  'cookie policy', 'privacy policy', 'terms conditions', 'read more', 'contact us',
  'our team', 'about us', 'the company', 'united kingdom', 'united states',
  'google maps', 'all rights', 'rights reserved', 'customer service', 'new york',
  'hot tub', 'hot tubs', 'swim spa', 'swimming pool', 'los angeles', 'costa del',
]);

function normalizeTitleToBucket(title: string): RoleBucket | null {
  const t = title.toLowerCase().trim();
  for (const { bucket, titles } of ROLE_TITLES) {
    if (titles.some((x) => x.toLowerCase() === t)) return bucket;
  }
  for (const { bucket, titles } of ROLE_TITLES) {
    if (titles.some((x) => t.includes(x.toLowerCase()))) return bucket;
  }
  return null;
}

function isPlausibleName(name: string): boolean {
  const clean = name.trim();
  if (clean.length < 5 || clean.length > 60) return false;
  if (NAME_BLOCKLIST.has(clean.toLowerCase())) return false;
  if (/\d/.test(clean)) return false;
  const tokens = clean.split(/\s+/);
  return tokens.length >= 2 && tokens.length <= 4;
}

/** Take the sentence containing `index` so we can look for a nearby email/phone. */
/**
 * A sentence terminator is `.`/`!`/`?` followed by whitespace or end of text.
 *
 * Splitting on a bare `.` would cut "ana@acme.example" in half and lose the
 * published email — the one piece of contact detail we are allowed to keep.
 */
const SENTENCE_BREAK = /[.!?](?=\s|$)/g;

function sentenceAround(text: string, index: number): string {
  let start = 0;
  let end = text.length;

  SENTENCE_BREAK.lastIndex = 0;
  for (const match of text.matchAll(SENTENCE_BREAK)) {
    const at = match.index ?? 0;
    if (at < index) start = at + 1;
    else { end = at + 1; break; }
  }
  return text.slice(start, end).trim();
}

function quoteAt(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 100);
  const end = Math.min(text.length, index + length + 100);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}

export function extractDecisionMakers(sources: ExtractionInput[]): DecisionMakerFinding[] {
  const byName = new Map<string, DecisionMakerFinding>();

  for (const source of sources) {
    const text = `${source.title ?? ''}\n${source.content}`;
    const linkedInUrls = Array.from(text.matchAll(LINKEDIN_PROFILE_RE)).map((m) => m[0]);

    const candidates: { name: string; title: string; index: number; length: number }[] = [];

    NAME_THEN_TITLE.lastIndex = 0;
    for (const m of text.matchAll(NAME_THEN_TITLE)) {
      candidates.push({ name: m[1], title: m[2], index: m.index ?? 0, length: m[0].length });
    }
    TITLE_THEN_NAME.lastIndex = 0;
    for (const m of text.matchAll(TITLE_THEN_NAME)) {
      candidates.push({ name: m[2], title: m[1], index: m.index ?? 0, length: m[0].length });
    }

    for (const candidate of candidates) {
      const fullName = toTitleCase(candidate.name.replace(/\s+/g, ' ').trim());
      if (!isPlausibleName(fullName)) continue;

      const key = fullName.toLowerCase();
      const context = sentenceAround(text, candidate.index);

      // Email ONLY if it is literally in the same sentence as the person.
      const emailMatch = context.match(EMAIL_RE);
      const phoneMatch = context.match(PHONE_RE);

      // Attach a LinkedIn URL only when its slug plausibly matches the name.
      const nameSlugParts = fullName.toLowerCase().split(/\s+/).filter((p) => p.length > 2);
      const linkedinUrl =
        linkedInUrls.find((url) => {
          const slug = url.toLowerCase().split('/in/')[1] ?? '';
          return nameSlugParts.filter((p) => slug.includes(p)).length >= Math.min(2, nameSlugParts.length);
        }) ?? null;

      const roleBucket = normalizeTitleToBucket(candidate.title);

      // Confidence reflects HOW the fact was obtained, never how likely it feels.
      let confidence: Confidence = 'LOW';
      if (roleBucket && linkedinUrl) confidence = 'HIGH';
      else if (roleBucket && (emailMatch || phoneMatch)) confidence = 'HIGH';
      else if (roleBucket) confidence = 'MEDIUM';

      const finding: DecisionMakerFinding = {
        fullName,
        position: candidate.title.trim(),
        roleBucket,
        linkedinUrl,
        email: emailMatch ? emailMatch[0].toLowerCase() : null,
        phone: phoneMatch ? phoneMatch[0].trim() : null,
        confidence,
        evidence: {
          url: source.url,
          title: source.title,
          quote: quoteAt(text, candidate.index, candidate.length),
        },
      };

      const existing = byName.get(key);
      if (!existing || rank(finding.confidence) > rank(existing.confidence)) {
        byName.set(key, mergeFindings(existing, finding));
      } else {
        byName.set(key, mergeFindings(finding, existing));
      }
    }
  }

  return Array.from(byName.values()).sort((a, b) => rank(b.confidence) - rank(a.confidence));
}

function mergeFindings(
  lower: DecisionMakerFinding | undefined,
  higher: DecisionMakerFinding,
): DecisionMakerFinding {
  if (!lower) return higher;
  return {
    ...higher,
    linkedinUrl: higher.linkedinUrl ?? lower.linkedinUrl,
    email: higher.email ?? lower.email,
    phone: higher.phone ?? lower.phone,
    position: higher.position ?? lower.position,
    roleBucket: higher.roleBucket ?? lower.roleBucket,
  };
}

function rank(c: Confidence): number {
  return c === 'HIGH' ? 3 : c === 'MEDIUM' ? 2 : c === 'LOW' ? 1 : 0;
}

export { ROLE_TITLES };
