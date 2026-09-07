/**
 * Prospecting pipeline.
 *
 * Runs in bounded STEPS rather than one long process, so it fits inside
 * serverless execution limits (Vercel) and can be resumed after a cold start,
 * a deploy or a browser refresh. All progress lives in Postgres, never in
 * process memory.
 *
 *   PENDING -> DISCOVERING -> ENRICHING -> SCORING -> COMPLETED
 */
import { prisma } from '@/lib/db';
import { buildQueryPlan, buildResearchQueries, type QueryPlan } from '@/lib/discovery/queryPlan';
import { searchText } from '@/lib/providers/googlePlaces';
import { getWebResearchProvider, NEVER_CRAWL_DOMAINS } from '@/lib/providers/tavily';
import { extractFromSources, type ExtractionInput } from '@/lib/enrich/extract';
import { extractDecisionMakers } from '@/lib/enrich/decisionMakers';
import { scoreCompany, type ScoreInput } from '@/lib/scoring/score';
import { buildNarrative } from '@/lib/scoring/narrative';
import { geographicImportance } from '@/lib/geo/majorCities';
import { classifyCompanyById } from '@/lib/relevance/reclassify';
import { yearsInSpaIndustry, mergeStringLists } from '@/lib/utils';
import {
  loadExclusionRules,
  upsertCompanyFromPlace,
  mergeTristate,
  addSourceRefs,
} from '@/lib/pipeline/persist';
import type { RunStatus, SearchDepth, Company, EvidenceKind } from '@prisma/client';

/** Work done per HTTP step. Tuned to stay well inside a 60s function budget. */
const QUERIES_PER_STEP = 2;
const COMPANIES_PER_ENRICH_STEP = 3;
const RESEARCH_QUERIES_PER_COMPANY_QUICK = 2;
const RESEARCH_QUERIES_PER_COMPANY_DEEP = 4;

export interface StepResult {
  runId: string;
  status: RunStatus;
  phase: string;
  cursor: number;
  totalSteps: number;
  done: boolean;
  message: string;
  discoveredCount: number;
  newCount: number;
  enrichedCount: number;
  excludedCount: number;
  warnings: string[];
}

export interface CreateRunInput {
  country: string;
  city?: string | null;
  depth: SearchDepth;
}

export async function createRun(input: CreateRunInput) {
  const plan = buildQueryPlan({
    country: input.country,
    city: input.city ?? null,
    depth: input.depth,
  });

  const warnings: string[] = [];
  if (!process.env.GOOGLE_PLACES_API_KEY?.trim()) {
    warnings.push(
      'GOOGLE_PLACES_API_KEY is not configured — no companies can be discovered. Set it in your environment and re-run.',
    );
  }
  if (!process.env.TAVILY_API_KEY?.trim()) {
    warnings.push(
      'TAVILY_API_KEY is not configured — web research is skipped. Brands, showroom evidence, founding year and decision makers will stay UNKNOWN.',
    );
  }
  if (!plan.hasLocalTerms) {
    warnings.push(
      `No local-language search vocabulary is held for ${plan.countryName}; English terms are being used, which reduces recall in this market.`,
    );
  }

  const run = await prisma.searchRun.create({
    data: {
      countryCode: plan.countryCode,
      countryName: plan.countryName,
      city: plan.city,
      depth: input.depth,
      status: 'PENDING',
      queryPlan: plan as unknown as object,
      totalSteps: plan.queries.length,
      cursor: 0,
      warnings,
    },
  });

  await log(run.id, 'info', `Run created for ${plan.countryName}${plan.city ? ` / ${plan.city}` : ''}`, {
    depth: input.depth,
    queries: plan.queries.length,
    languages: plan.languages,
  });

  return run;
}

/** Execute one bounded chunk of work. Safe to call repeatedly until `done`. */
export async function stepRun(runId: string): Promise<StepResult> {
  const run = await prisma.searchRun.findUnique({ where: { id: runId } });
  if (!run) throw new Error(`Run ${runId} not found`);

  if (run.status === 'COMPLETED' || run.status === 'FAILED' || run.status === 'CANCELLED') {
    return summarise(run.id, 'Run already finished.');
  }

  try {
    if (run.status === 'PENDING' || run.status === 'DISCOVERING') return await discoverStep(runId);
    if (run.status === 'ENRICHING') return await enrichStep(runId);
    if (run.status === 'SCORING') return await scoreStep(runId);
    return summarise(runId, 'Nothing to do.');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.searchRun.update({
      where: { id: runId },
      data: { status: 'FAILED', error: message, finishedAt: new Date() },
    });
    await log(runId, 'error', `Run failed: ${message}`);
    return summarise(runId, `Run failed: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// Phase 1 — DISCOVERY (Google Places)
// ---------------------------------------------------------------------------

async function discoverStep(runId: string): Promise<StepResult> {
  const run = await prisma.searchRun.findUniqueOrThrow({ where: { id: runId } });
  const plan = run.queryPlan as unknown as QueryPlan;

  if (run.status === 'PENDING') {
    await prisma.searchRun.update({ where: { id: runId }, data: { status: 'DISCOVERING' } });
  }

  const rules = await loadExclusionRules(run.countryCode);
  const slice = plan.queries.slice(run.cursor, run.cursor + QUERIES_PER_STEP);

  if (slice.length === 0) return await finishDiscovery(runId);

  let discovered = 0;
  let created = 0;
  let excluded = 0;
  const warnings = new Set(run.warnings);

  for (const query of slice) {
    const outcome = await searchText({
      query: query.text,
      languageCode: query.language,
      regionCode: run.countryCode,
      maxResults: plan.depth === 'DEEP' ? 20 : 10,
    });

    if (!outcome.ok) {
      await log(runId, 'warn', `Query failed: "${query.text}" — ${outcome.error.message}`, {
        code: outcome.error.code,
      });
      warnings.add(providerWarning(outcome.error.code, outcome.error.message));

      // A missing/invalid key will fail every remaining query — stop early
      // instead of burning the whole plan on the same error.
      if (outcome.error.code === 'NOT_CONFIGURED' || outcome.error.code === 'UNAUTHORIZED') {
        await prisma.searchRun.update({
          where: { id: runId },
          data: { cursor: plan.queries.length, warnings: Array.from(warnings) },
        });
        return await finishDiscovery(runId);
      }
      continue;
    }

    for (const place of outcome.data.places) {
      // Google biases rather than restricts by region; drop out-of-market hits.
      if (place.countryCode && place.countryCode.toUpperCase() !== run.countryCode) continue;

      discovered += 1;
      const result = await upsertCompanyFromPlace(place, {
        countryCode: run.countryCode,
        countryName: run.countryName,
        rules,
        queryText: query.text,
      });
      if (result.isNew) created += 1;
      if (result.excluded) excluded += 1;

      await prisma.searchRunCompany.upsert({
        where: { runId_companyId: { runId, companyId: result.companyId } },
        create: { runId, companyId: result.companyId, isNew: result.isNew },
        update: {},
      });
    }

    await log(runId, 'info', `"${query.text}" → ${outcome.data.places.length} place(s)`, {
      language: query.language,
      category: query.category,
      brand: query.brand ?? null,
    });
  }

  const updated = await prisma.searchRun.update({
    where: { id: runId },
    data: {
      cursor: run.cursor + slice.length,
      discoveredCount: { increment: discovered },
      newCount: { increment: created },
      excludedCount: { increment: excluded },
      warnings: Array.from(warnings),
    },
  });

  if (updated.cursor >= plan.queries.length) return await finishDiscovery(runId);

  return summarise(
    runId,
    `Discovery ${updated.cursor}/${plan.queries.length} — ${discovered} place(s) this step.`,
  );
}

async function finishDiscovery(runId: string): Promise<StepResult> {
  const companyIds = await prisma.searchRunCompany.findMany({
    where: { runId },
    select: { companyId: true },
  });

  await prisma.searchRun.update({
    where: { id: runId },
    data: { status: 'ENRICHING', cursor: 0, totalSteps: companyIds.length },
  });
  await log(runId, 'info', `Discovery complete — ${companyIds.length} company/companies to enrich.`);

  return summarise(runId, `Discovery complete. Enriching ${companyIds.length} company/companies.`);
}

// ---------------------------------------------------------------------------
// Phase 2 — ENRICHMENT (web research)
// ---------------------------------------------------------------------------

async function enrichStep(runId: string): Promise<StepResult> {
  const run = await prisma.searchRun.findUniqueOrThrow({ where: { id: runId } });
  const provider = getWebResearchProvider();

  const links = await prisma.searchRunCompany.findMany({
    where: { runId },
    orderBy: { createdAt: 'asc' },
    skip: run.cursor,
    take: COMPANIES_PER_ENRICH_STEP,
    include: { company: true },
  });

  if (links.length === 0) {
    await prisma.searchRun.update({ where: { id: runId }, data: { status: 'SCORING', cursor: 0 } });
    return summarise(runId, 'Enrichment complete. Scoring…');
  }

  if (!provider.isConfigured()) {
    // Skip the whole phase in one go rather than looping pointlessly.
    await prisma.company.updateMany({
      where: { id: { in: links.map((l) => l.companyId) } },
      data: { enrichmentStatus: `Web research skipped — ${provider.id.toUpperCase()}_API_KEY not configured.` },
    });
    await prisma.searchRun.update({
      where: { id: runId },
      data: { status: 'SCORING', cursor: 0 },
    });
    await log(runId, 'warn', 'Web research skipped — provider not configured. Research fields remain UNKNOWN.');
    return summarise(runId, 'Web research not configured — skipping enrichment. Scoring on Google data only.');
  }

  let enriched = 0;
  for (const link of links) {
    // An exclusion means we already know the answer; do not spend research budget.
    if (link.company.isExcluded) continue;
    try {
      await enrichCompany(link.company, run.depth);
      enriched += 1;
    } catch (err) {
      await log(runId, 'warn', `Enrichment failed for ${link.company.name}: ${String(err)}`);
      await prisma.company.update({
        where: { id: link.companyId },
        data: { enrichmentStatus: `Enrichment error: ${err instanceof Error ? err.message : String(err)}` },
      });
    }
  }

  const updated = await prisma.searchRun.update({
    where: { id: runId },
    data: { cursor: run.cursor + links.length, enrichedCount: { increment: enriched } },
  });

  if (updated.cursor >= updated.totalSteps) {
    await prisma.searchRun.update({ where: { id: runId }, data: { status: 'SCORING', cursor: 0 } });
    return summarise(runId, 'Enrichment complete. Scoring…');
  }

  return summarise(runId, `Enriched ${updated.cursor}/${updated.totalSteps} company/companies.`);
}

async function enrichCompany(company: Company, depth: SearchDepth): Promise<void> {
  const provider = getWebResearchProvider();
  const queries = buildResearchQueries({
    name: company.name,
    city: company.city,
    countryName: company.countryName,
    websiteDomain: company.websiteDomain,
  }).slice(
    0,
    depth === 'DEEP' ? RESEARCH_QUERIES_PER_COMPANY_DEEP : RESEARCH_QUERIES_PER_COMPANY_QUICK,
  );

  const excerpts: ExtractionInput[] = [];
  const notes: string[] = [];

  for (const query of queries) {
    const outcome = await provider.search({
      query,
      maxResults: depth === 'DEEP' ? 6 : 4,
      depth: depth === 'DEEP' ? 'advanced' : 'basic',
      // We reference public LinkedIn URLs found elsewhere, but never crawl LinkedIn.
      excludeDomains: NEVER_CRAWL_DOMAINS,
    });
    if (!outcome.ok) {
      notes.push(`Research query failed (${outcome.error.code}): ${outcome.error.message}`);
      if (outcome.error.code === 'NOT_CONFIGURED' || outcome.error.code === 'UNAUTHORIZED') break;
      continue;
    }
    for (const r of outcome.data) {
      excerpts.push({ url: r.url, title: r.title, content: r.content });
    }
  }

  if (excerpts.length === 0) {
    await prisma.company.update({
      where: { id: company.id },
      data: {
        enrichmentStatus: notes.length > 0 ? notes.join(' | ') : 'No web research results returned.',
        lastVerifiedAt: new Date(),
      },
    });
    return;
  }

  const facts = extractFromSources(excerpts);
  const people = extractDecisionMakers(excerpts);

  // --- Persist evidence FIRST so every stored fact is already attributable ---
  const refs: { url: string; title: string | null; snippet: string | null; kind: EvidenceKind }[] = [];
  const pushEvidence = (kind: EvidenceKind, ev: { url: string; title: string | null; quote: string }[]) => {
    for (const e of ev) refs.push({ url: e.url, title: e.title, snippet: e.quote, kind });
  };
  pushEvidence('SPA_ACTIVITY', facts.spaActivity.evidence);
  pushEvidence('POOL_ACTIVITY', facts.poolActivity.evidence);
  pushEvidence('SAUNA_ACTIVITY', facts.saunaActivity.evidence);
  pushEvidence('WELLNESS_ACTIVITY', facts.wellnessActivity.evidence);
  pushEvidence('SHOWROOM', facts.showroom.evidence);
  pushEvidence('HOSPITALITY', facts.hospitalityActivity.evidence);
  pushEvidence('BRAND', facts.brands.evidence);
  pushEvidence('YEAR_FOUNDED', facts.yearFounded.evidence);
  pushEvidence('SPA_SINCE', facts.spaSinceYear.evidence);
  pushEvidence('LOCATIONS', facts.locationCount.evidence);
  await addSourceRefs(company.id, refs);

  const researchNotes = buildResearchNotes(facts, people.length, notes);

  await prisma.company.update({
    where: { id: company.id },
    data: {
      spaActivity: mergeTristate(company.spaActivity, facts.spaActivity.value),
      poolActivity: mergeTristate(company.poolActivity, facts.poolActivity.value),
      saunaActivity: mergeTristate(company.saunaActivity, facts.saunaActivity.value),
      wellnessActivity: mergeTristate(company.wellnessActivity, facts.wellnessActivity.value),
      hammamActivity: mergeTristate(company.hammamActivity, facts.hammamActivity.value),
      outdoorLiving: mergeTristate(company.outdoorLiving, facts.outdoorLiving.value),
      hospitalityActivity: mergeTristate(company.hospitalityActivity, facts.hospitalityActivity.value),
      showroom: mergeTristate(company.showroom, facts.showroom.value),

      brands: mergeStringLists(company.brands, facts.brands.names),
      competitorBrands: mergeStringLists(company.competitorBrands, facts.brands.competitors),
      representsAquavia:
        facts.brands.names.includes('Aquavia Spa') ? 'YES' : company.representsAquavia,

      // Founding year and spa tenure stay strictly separate.
      yearFounded: company.yearFounded ?? facts.yearFounded.year,
      yearFoundedConfidence:
        company.yearFounded ?? facts.yearFounded.year ? 'MEDIUM' : 'UNKNOWN',
      spaSinceYear: company.spaSinceYear ?? facts.spaSinceYear.year,
      spaSinceConfidence:
        company.spaSinceYear ?? facts.spaSinceYear.year ? 'MEDIUM' : 'UNKNOWN',
      yearsInSpaIndustry: yearsInSpaIndustry(company.spaSinceYear ?? facts.spaSinceYear.year),

      linkedinUrl: company.linkedinUrl ?? facts.socials.linkedin,
      instagramUrl: company.instagramUrl ?? facts.socials.instagram,
      facebookUrl: company.facebookUrl ?? facts.socials.facebook,
      youtubeUrl: company.youtubeUrl ?? facts.socials.youtube,

      publicEmail: company.publicEmail ?? pickBestEmail(facts.emails, company.websiteDomain),
      locationCount: company.locationCount ?? facts.locationCount.count,

      researchNotes,
      enrichmentStatus: null,
      lastVerifiedAt: new Date(),
    },
  });

  // --- Decision makers ------------------------------------------------------
  for (const person of people.slice(0, 8)) {
    try {
      await prisma.decisionMaker.upsert({
        where: { companyId_fullName: { companyId: company.id, fullName: person.fullName } },
        create: {
          companyId: company.id,
          fullName: person.fullName,
          position: person.position,
          roleBucket: person.roleBucket,
          linkedinUrl: person.linkedinUrl,
          email: person.email,
          phone: person.phone,
          sourceUrl: person.evidence.url,
          sourceNote: person.evidence.quote.slice(0, 1000),
          confidence: person.confidence,
        },
        update: {
          position: person.position ?? undefined,
          roleBucket: person.roleBucket ?? undefined,
          linkedinUrl: person.linkedinUrl ?? undefined,
          email: person.email ?? undefined,
          phone: person.phone ?? undefined,
          confidence: person.confidence,
        },
      });
    } catch {
      // Duplicate/edge-case names must not abort the run.
    }
  }

  if (people.length > 0) {
    await addSourceRefs(
      company.id,
      people.slice(0, 8).map((p) => ({
        url: p.evidence.url,
        title: p.evidence.title,
        snippet: p.evidence.quote,
        kind: 'DECISION_MAKER' as EvidenceKind,
      })),
    );
  }
}

/**
 * Prefer an address on the company's own domain — a generic gmail found on a
 * directory page is far weaker evidence. Never constructs an address.
 */
function pickBestEmail(
  emails: { value: string; url: string }[],
  websiteDomain: string | null,
): string | null {
  if (emails.length === 0) return null;
  if (websiteDomain) {
    const onDomain = emails.find((e) => e.value.endsWith(`@${websiteDomain}`));
    if (onDomain) return onDomain.value;
  }
  return emails[0].value;
}

function buildResearchNotes(
  facts: ReturnType<typeof extractFromSources>,
  peopleCount: number,
  errors: string[],
): string {
  const lines: string[] = [];
  lines.push(`Web research read ${facts.brands.evidence.length + facts.spaActivity.evidence.length} evidenced excerpt(s).`);
  if (facts.brands.names.length > 0) lines.push(`Brands mentioned: ${facts.brands.names.join(', ')}.`);
  if (facts.brands.unmapped.length > 0) {
    lines.push(`Possible additional brands to review (not in our brand list): ${facts.brands.unmapped.slice(0, 6).join(', ')}.`);
  }
  if (facts.yearFounded.year) lines.push(`Company founding year found: ${facts.yearFounded.year}.`);
  else lines.push('Company founding year: UNKNOWN.');
  if (facts.spaSinceYear.year) lines.push(`Spa activity stated since: ${facts.spaSinceYear.year}.`);
  else lines.push('Years working in the spa industry: UNKNOWN (no dated spa reference found).');
  lines.push(`Decision makers found in public sources: ${peopleCount}.`);
  if (errors.length > 0) lines.push(`Issues: ${errors.join(' | ')}`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Phase 3 — SCORING
// ---------------------------------------------------------------------------

async function scoreStep(runId: string): Promise<StepResult> {
  const run = await prisma.searchRun.findUniqueOrThrow({ where: { id: runId } });
  const links = await prisma.searchRunCompany.findMany({
    where: { runId },
    select: { companyId: true },
  });

  for (const link of links) {
    await rescoreCompany(link.companyId);
  }

  await prisma.searchRun.update({
    where: { id: runId },
    data: { status: 'COMPLETED', finishedAt: new Date() },
  });
  await log(runId, 'info', `Run completed — ${links.length} company/companies scored.`);

  return summarise(runId, `Run complete. ${links.length} company/companies scored.`, run.id);
}

/** Recompute score + narrative for one company. Also used after manual edits. */
export async function rescoreCompany(companyId: string): Promise<void> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { decisionMakers: true },
  });
  if (!company) return;

  const geo = geographicImportance(company.countryCode, company.city);

  const scoreInput: ScoreInput = {
    spaActivity: company.spaActivity,
    poolActivity: company.poolActivity,
    saunaActivity: company.saunaActivity,
    wellnessActivity: company.wellnessActivity,
    hammamActivity: company.hammamActivity,
    outdoorLiving: company.outdoorLiving,
    hospitalityActivity: company.hospitalityActivity,
    showroom: company.showroom,
    brands: company.brands,
    competitorBrands: company.competitorBrands,
    yearFounded: company.yearFounded,
    spaSinceYear: company.spaSinceYear,
    googleRating: company.googleRating,
    googleReviewCount: company.googleReviewCount,
    website: company.website,
    linkedinUrl: company.linkedinUrl,
    instagramUrl: company.instagramUrl,
    facebookUrl: company.facebookUrl,
    locationCount: company.locationCount,
    decisionMakerCount: company.decisionMakers.length,
    isMajorCity: geo.isMajorCity,
    isMajorCityKnown: geo.known,
    representsAquavia: company.representsAquavia,
  };

  const result = scoreCompany(scoreInput);
  const narrative = buildNarrative(
    {
      ...scoreInput,
      companyName: company.name,
      city: company.city,
      countryName: company.countryName,
      publicEmail: company.publicEmail,
      phone: company.phone,
      decisionMakerHasLinkedIn: company.decisionMakers.some((d) => Boolean(d.linkedinUrl)),
      decisionMakerHasEmail: company.decisionMakers.some((d) => Boolean(d.email)),
      isExcluded: company.isExcluded,
    },
    result,
  );

  await prisma.company.update({
    where: { id: companyId },
    data: {
      score: result.score,
      priority: result.priority,
      scoreBreakdown: result.breakdown as unknown as object,
      dataCompleteness: result.dataCompleteness,
      confidence: result.confidence,
      whyThisCompany: `${narrative.whyThisCompany}\n\nNext action rationale: ${narrative.actionRationale}`,
      recommendedAction: narrative.recommendedAction,
    },
  });

  // Dealer relevance is a separate axis from the general opportunity score.
  // Running it here keeps every newly discovered company classified without a
  // second pass, using only data already stored (no extra API calls).
  await classifyCompanyById(companyId);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function providerWarning(code: string, message: string): string {
  switch (code) {
    case 'NOT_CONFIGURED':
      return 'GOOGLE_PLACES_API_KEY is not configured — discovery cannot run.';
    case 'UNAUTHORIZED':
      return 'Google Places rejected the API key. Check that the key is valid and that "Places API (New)" is enabled for the project.';
    case 'QUOTA_EXCEEDED':
    case 'RATE_LIMITED':
      return 'Google Places rate limit or quota reached. Some queries were skipped.';
    default:
      return `Google Places error: ${message.slice(0, 200)}`;
  }
}

async function log(
  runId: string,
  level: 'info' | 'warn' | 'error',
  message: string,
  meta?: object,
): Promise<void> {
  try {
    await prisma.searchRunLog.create({
      data: { runId, level, message, meta: meta ? (meta as object) : undefined },
    });
  } catch {
    // Logging must never break a run.
  }
}

async function summarise(runId: string, message: string, _prev?: string): Promise<StepResult> {
  const run = await prisma.searchRun.findUniqueOrThrow({ where: { id: runId } });
  return {
    runId,
    status: run.status,
    phase: phaseLabel(run.status),
    cursor: run.cursor,
    totalSteps: run.totalSteps,
    done: ['COMPLETED', 'FAILED', 'CANCELLED'].includes(run.status),
    message,
    discoveredCount: run.discoveredCount,
    newCount: run.newCount,
    enrichedCount: run.enrichedCount,
    excludedCount: run.excludedCount,
    warnings: run.warnings,
  };
}

export function phaseLabel(status: RunStatus): string {
  switch (status) {
    case 'PENDING': return 'Queued';
    case 'DISCOVERING': return 'Discovering companies';
    case 'ENRICHING': return 'Researching & enriching';
    case 'SCORING': return 'Scoring & prioritising';
    case 'COMPLETED': return 'Completed';
    case 'FAILED': return 'Failed';
    case 'CANCELLED': return 'Cancelled';
  }
}

