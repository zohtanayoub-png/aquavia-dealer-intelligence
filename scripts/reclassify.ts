/**
 * Safe backfill: reclassify companies already in the database.
 *
 *   npm run db:reclassify                    # free, stored data only
 *   npm run db:reclassify -- --country=MA    # one market
 *   npm run db:reclassify -- --tavily        # allow enrichment (spends credits)
 *   npm run db:reclassify -- --tavily --max-tavily=25
 *   npm run db:reclassify -- --dry-run       # report only, writes nothing
 *
 * Never deletes a company. Never touches CRM status, sales notes or the
 * general opportunity score.
 */
import { reclassifyAll } from '../src/lib/relevance/reclassify';
import { prisma } from '../src/lib/db';

function flag(name: string): string | undefined {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  return hit.includes('=') ? hit.split('=').slice(1).join('=') : 'true';
}

function bar(count: number, total: number, width = 28): string {
  const filled = total === 0 ? 0 : Math.round((count / total) * width);
  return '█'.repeat(filled).padEnd(width, '·');
}

async function main() {
  const country = flag('country');
  const allowTavily = flag('tavily') === 'true';
  const dryRun = flag('dry-run') === 'true';
  const maxTavilyCalls = Number(flag('max-tavily') ?? 40);

  console.log('\nAquavia — dealer relevance reclassification');
  console.log('───────────────────────────────────────────────────────────');
  console.log(`market        : ${country ?? 'ALL'}`);
  console.log(`web research  : ${allowTavily ? `enabled (max ${maxTavilyCalls} calls)` : 'disabled (stored data only, no API cost)'}`);
  console.log(`mode          : ${dryRun ? 'DRY RUN — nothing will be written' : 'writing'}\n`);

  const report = await reclassifyAll({ countryCode: country, allowTavily, maxTavilyCalls, dryRun });

  const order = ['HIGHLY_RELEVANT', 'RELEVANT', 'POSSIBLE', 'LOW_RELEVANCE', 'IRRELEVANT'];
  const labels: Record<string, string> = {
    HIGHLY_RELEVANT: '🔥 Highly relevant', RELEVANT: '✅ Relevant',
    POSSIBLE: '🟡 Possible', LOW_RELEVANCE: '⚪ Low relevance', IRRELEVANT: '❌ Irrelevant',
  };

  console.log(`Total companies       : ${report.total}`);
  console.log(`Reclassified          : ${report.updated}`);
  console.log(`Manual overrides kept : ${report.skippedManualOverride}`);
  console.log(`Tavily calls used     : ${report.tavilyCallsUsed}`);
  console.log(`NOT a dealer prospect : ${report.notDealerProspects}\n`);

  console.log('Commercial relevance');
  console.log('───────────────────────────────────────────────────────────');
  for (const key of order) {
    const n = report.byRelevance[key] ?? 0;
    console.log(`${labels[key].padEnd(22)} ${String(n).padStart(4)}  ${bar(n, report.total)}`);
  }

  console.log('\nBusiness classification');
  console.log('───────────────────────────────────────────────────────────');
  for (const [k, v] of Object.entries(report.byClassification).sort((a, b) => b[1] - a[1])) {
    console.log(`${k.replace(/_/g, ' ').padEnd(34)} ${String(v).padStart(4)}`);
  }

  console.log('\nProduct evidence');
  console.log('───────────────────────────────────────────────────────────');
  const evidenceOrder = ['VERIFIED_PRODUCT', 'STRONG_PRODUCT', 'WEAK_AMBIGUOUS', 'SERVICE_ONLY', 'NO_EVIDENCE'];
  for (const key of evidenceOrder) {
    const n = report.byProductEvidence[key] ?? 0;
    console.log(`${key.replace(/_/g, ' ').padEnd(22)} ${String(n).padStart(4)}  ${bar(n, report.total)}`);
  }
  console.log(`\nWith VERIFIED_PRODUCT evidence   : ${report.verifiedProductCount}`);
  console.log(`With STRONG_PRODUCT evidence     : ${report.strongProductCount}`);
  console.log(`Downgraded — "spa" was ambiguous : ${report.downgradedForAmbiguousSpa}`);

  console.log('\nTOP 20 by Dealer Fit');
  console.log('─'.repeat(150));
  console.log(
    'Company'.padEnd(32) + 'City'.padEnd(14) + 'Fit'.padStart(4) + '  ' +
    'Classification'.padEnd(26) + 'Relevance'.padEnd(17) + 'Evidence'.padEnd(17) + 'Confirmed brands',
  );
  console.log('─'.repeat(150));
  for (const p of report.topProspects.slice(0, 20)) {
    const brands = p.competitorBrands.length === 0
      ? '—'
      : `${p.competitorBrands.join(', ')}${p.competitorEvidenceVerified ? '' : ' (UNVERIFIED)'}`;
    console.log(
      p.name.slice(0, 31).padEnd(32) +
      (p.city ?? 'UNKNOWN').slice(0, 13).padEnd(14) +
      String(p.dealerFitScore).padStart(4) + '  ' +
      p.classification.replace(/_/g, ' ').slice(0, 25).padEnd(26) +
      p.relevance.replace(/_/g, ' ').slice(0, 16).padEnd(17) +
      p.productEvidenceLevel.replace(/_/g, ' ').slice(0, 16).padEnd(17) +
      brands.slice(0, 40),
    );
  }

  console.log('\nWhy the top 5 qualify');
  console.log('───────────────────────────────────────────────────────────');
  for (const p of report.topProspects.slice(0, 5)) {
    console.log(`• ${p.name} (${p.dealerFitScore}) — ${p.whyDealer.slice(0, 200)}`);
  }

  console.log('\nTOP 15 FALSE POSITIVES REMOVED');
  console.log('─'.repeat(140));
  console.log(
    'Company'.padEnd(32) + 'Old'.padStart(4) + ' → ' + 'New'.padStart(3) + '  ' +
    'Old classification'.padEnd(26) + 'New classification'.padEnd(26) + 'Why',
  );
  console.log('─'.repeat(140));
  if (report.demoted.length === 0) {
    console.log('  none');
  } else {
    for (const d of report.demoted.slice(0, 15)) {
      console.log(
        d.name.slice(0, 31).padEnd(32) +
        String(d.oldScore).padStart(4) + ' → ' + String(d.dealerFitScore).padStart(3) + '  ' +
        d.oldClassification.replace(/_/g, ' ').slice(0, 25).padEnd(26) +
        d.classification.replace(/_/g, ' ').slice(0, 25).padEnd(26) +
        d.reason.slice(0, 60),
      );
    }
  }
  console.log('');
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
