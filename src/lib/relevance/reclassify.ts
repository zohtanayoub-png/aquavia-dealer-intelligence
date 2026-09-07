/**
 * Safe reclassification of companies already in the database.
 *
 * NON-DESTRUCTIVE BY DESIGN:
 *  - no company is ever deleted;
 *  - CRM status, sales notes and follow-up dates are never touched;
 *  - a manual `relevanceOverride` always wins over the computed value;
 *  - the general opportunity score is left alone — dealer fit is a separate axis.
 *
 * COST CONTROL: three stages, cheapest first. Tavily is only spent on
 * companies that are ambiguous or already look promising, never on obvious
 * massage / beauty businesses.
 */
import { prisma } from '@/lib/db';
import { classifyCompany, toRelevance, type ClassifyInput, type ClassificationResult } from '@/lib/relevance/classify';
import { geographicImportance } from '@/lib/geo/majorCities';
import { getWebResearchProvider, NEVER_CRAWL_DOMAINS } from '@/lib/providers/tavily';
import { addSourceRefs } from '@/lib/pipeline/persist';
import type { Prisma } from '@prisma/client';

/** Dealer fit at or above this justifies deeper (stage 3) research. */
export const DEEP_RESEARCH_THRESHOLD = 40;

export interface ReclassifyOptions {
  countryCode?: string;
  /** Allow stage 2/3 Tavily enrichment. */
  allowTavily?: boolean;
  /** Hard ceiling on Tavily requests for the whole run. */
  maxTavilyCalls?: number;
  /** Report only — compute everything but write nothing. */
  dryRun?: boolean;
  onProgress?: (done: number, total: number, name: string) => void;
}

export interface ReclassifyReport {
  total: number;
  updated: number;
  skippedManualOverride: number;
  tavilyCallsUsed: number;
  byRelevance: Record<string, number>;
  byClassification: Record<string, number>;
  notDealerProspects: number;
  topProspects: { id: string; name: string; city: string | null; dealerFitScore: number; classification: string; relevance: string }[];
  demoted: { id: string; name: string; oldScore: number; dealerFitScore: number; classification: string; reason: string }[];
}

type CompanyWithRelations = Prisma.CompanyGetPayload<{
  include: { sources: true; decisionMakers: true };
}>;

function toClassifyInput(company: CompanyWithRelations): ClassifyInput {
  const geo = geographicImportance(company.countryCode, company.city);
  return {
    name: company.name,
    googleTypes: company.googleTypes,
    sources: company.sources.map((s) => ({ url: s.url, title: s.title, snippet: s.snippet })),
    website: company.website,
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
    locationCount: company.locationCount,
    decisionMakerCount: company.decisionMakers.length,
    isMajorCity: geo.isMajorCity,
  };
}

/** Stage 1: free classification from data already stored. */
export function classifyFromStoredData(company: CompanyWithRelations): ClassificationResult {
  return classifyCompany(toClassifyInput(company));
}

async function persist(
  company: CompanyWithRelations,
  result: ClassificationResult,
  stage: number,
): Promise<void> {
  // A human decision always outranks the classifier.
  const relevance = company.relevanceOverride ?? result.commercialRelevance;

  await prisma.company.update({
    where: { id: company.id },
    data: {
      classification: result.classification,
      classificationConfidence: result.confidence,
      classificationReasons: result.reasons,
      dealerFitScore: result.dealerFitScore,
      dealerFitBreakdown: result.dealerFitBreakdown as unknown as object,
      commercialRelevance: relevance,
      isDealerProspect: result.isDealerProspect,
      notDealerProspectReason: result.notDealerProspectReason,
      positiveSignals: result.positiveSignals as unknown as object,
      negativeSignals: result.negativeSignals as unknown as object,
      productEvidence: result.productEvidence as unknown as object,
      brandEvidence: buildBrandEvidence(company) as unknown as object,
      whyDealer: result.whyDealer,
      whyNotDealer: result.whyNotDealer,
      classifiedAt: new Date(),
      classificationStage: stage,
      // CRM status, sales notes, follow-up dates and `score` are deliberately
      // NOT written here.
    },
  });
}

/** Brand mentions with the source and quote that evidence them. */
function buildBrandEvidence(company: CompanyWithRelations) {
  const brandSources = company.sources.filter((s) => s.kind === 'BRAND' || s.kind === 'COMPETITOR_BRAND' || s.kind === 'DEALER_LOCATOR');
  return company.brands.map((brand) => {
    const match = brandSources.find((s) => (s.snippet ?? '').toLowerCase().includes(brand.toLowerCase().split(' ')[0]));
    const isCompetitor = company.competitorBrands.includes(brand);
    return {
      brand,
      isCompetitor,
      sourceUrl: match?.url ?? null,
      quote: match?.snippet ?? null,
      confidence: match ? 'HIGH' : 'MEDIUM',
    };
  });
}

/**
 * Targeted web research for one company.
 * Stage 2 asks the cheap question ("what do they actually sell?");
 * stage 3 digs into brands and dealer status.
 */
async function enrich(company: CompanyWithRelations, stage: 2 | 3): Promise<number> {
  const provider = getWebResearchProvider();
  if (!provider.isConfigured()) return 0;

  const where = [company.city, company.countryName].filter(Boolean).join(' ');
  const queries = stage === 2
    ? [`${company.name} ${where} vente spa jacuzzi piscine produits`]
    : [
        `${company.name} ${where} distributeur officiel marque spa`,
        `${company.name} ${where} showroom exposition spa piscine`,
      ];

  let calls = 0;
  for (const query of queries) {
    const outcome = await provider.search({
      query, maxResults: stage === 2 ? 4 : 6,
      depth: stage === 2 ? 'basic' : 'advanced',
      excludeDomains: NEVER_CRAWL_DOMAINS,
    });
    calls += 1;
    if (!outcome.ok) break;

    await addSourceRefs(
      company.id,
      outcome.data.map((r) => ({
        url: r.url, title: r.title, snippet: r.content,
        kind: 'CLASSIFICATION' as const, provider: 'TAVILY' as const,
      })),
    );
  }
  return calls;
}

export async function reclassifyAll(options: ReclassifyOptions = {}): Promise<ReclassifyReport> {
  const { countryCode, allowTavily = false, maxTavilyCalls = 40, dryRun = false } = options;

  const companies = await prisma.company.findMany({
    where: countryCode ? { countryCode: countryCode.toUpperCase() } : undefined,
    include: { sources: true, decisionMakers: true },
  });

  const report: ReclassifyReport = {
    total: companies.length, updated: 0, skippedManualOverride: 0, tavilyCallsUsed: 0,
    byRelevance: {}, byClassification: {}, notDealerProspects: 0,
    topProspects: [], demoted: [],
  };

  // --- Stage 1: free classification for everyone ---------------------------
  const stage1 = new Map<string, ClassificationResult>();
  for (const company of companies) {
    stage1.set(company.id, classifyFromStoredData(company));
  }

  // --- Decide who is worth paying for --------------------------------------
  // Strongest candidates first, so a budget cap spends on the best prospects.
  const enrichQueue = companies
    .filter((c) => {
      const r = stage1.get(c.id)!;
      // Never spend research budget on a confirmed service business.
      if (!r.isDealerProspect && r.confidence !== 'LOW' && r.confidence !== 'UNKNOWN') return false;
      return r.needsEnrichment || r.dealerFitScore >= DEEP_RESEARCH_THRESHOLD;
    })
    .sort((a, b) => stage1.get(b.id)!.dealerFitScore - stage1.get(a.id)!.dealerFitScore);

  const finalResults = new Map<string, { result: ClassificationResult; stage: number }>();
  for (const c of companies) finalResults.set(c.id, { result: stage1.get(c.id)!, stage: 1 });

  if (allowTavily && !dryRun) {
    for (const company of enrichQueue) {
      if (report.tavilyCallsUsed >= maxTavilyCalls) break;

      report.tavilyCallsUsed += await enrich(company, 2);
      let refreshed = await prisma.company.findUniqueOrThrow({
        where: { id: company.id }, include: { sources: true, decisionMakers: true },
      });
      let result = classifyFromStoredData(refreshed);
      let stage = 2;

      // Stage 3 only for candidates that now look genuinely promising.
      if (result.dealerFitScore >= DEEP_RESEARCH_THRESHOLD && report.tavilyCallsUsed < maxTavilyCalls) {
        report.tavilyCallsUsed += await enrich(refreshed, 3);
        refreshed = await prisma.company.findUniqueOrThrow({
          where: { id: company.id }, include: { sources: true, decisionMakers: true },
        });
        result = classifyFromStoredData(refreshed);
        stage = 3;
      }
      finalResults.set(company.id, { result, stage });
    }
  }

  // --- Persist + build the report ------------------------------------------
  for (const company of companies) {
    const { result, stage } = finalResults.get(company.id)!;

    if (company.relevanceOverride) report.skippedManualOverride += 1;
    if (!dryRun) {
      await persist(company, result, stage);
      report.updated += 1;
    }

    const relevance = company.relevanceOverride ?? result.commercialRelevance;
    report.byRelevance[relevance] = (report.byRelevance[relevance] ?? 0) + 1;
    report.byClassification[result.classification] = (report.byClassification[result.classification] ?? 0) + 1;
    if (!result.isDealerProspect) report.notDealerProspects += 1;

    report.topProspects.push({
      id: company.id, name: company.name, city: company.city,
      dealerFitScore: result.dealerFitScore,
      classification: result.classification, relevance,
    });

    // Companies the general score flattered but that are not dealers at all.
    if (!result.isDealerProspect && company.score >= result.dealerFitScore) {
      report.demoted.push({
        id: company.id, name: company.name, oldScore: company.score,
        dealerFitScore: result.dealerFitScore, classification: result.classification,
        reason: result.notDealerProspectReason ?? 'Not a dealer prospect.',
      });
    }
  }

  report.topProspects.sort((a, b) => b.dealerFitScore - a.dealerFitScore);
  report.demoted.sort((a, b) => b.oldScore - a.oldScore);

  return report;
}

/** Classify a single company from stored data. Used after every search. */
export async function classifyCompanyById(companyId: string): Promise<ClassificationResult | null> {
  const company = await prisma.company.findUnique({
    where: { id: companyId }, include: { sources: true, decisionMakers: true },
  });
  if (!company) return null;

  const result = classifyFromStoredData(company);
  await persist(company, result, 1);
  return result;
}

export { toRelevance };
