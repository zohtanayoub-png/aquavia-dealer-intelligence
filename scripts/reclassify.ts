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

  console.log('\nTop 15 dealer prospects by Dealer Fit');
  console.log('───────────────────────────────────────────────────────────');
  report.topProspects.slice(0, 15).forEach((p, i) => {
    console.log(
      `${String(i + 1).padStart(2)}. ${String(p.dealerFitScore).padStart(3)}  ` +
      `${p.name.slice(0, 38).padEnd(38)} ${(p.city ?? 'UNKNOWN').slice(0, 14).padEnd(14)} ${p.classification}`,
    );
  });

  console.log('\nPreviously misleading — service businesses the general score flattered');
  console.log('───────────────────────────────────────────────────────────');
  if (report.demoted.length === 0) {
    console.log('  none found');
  } else {
    report.demoted.slice(0, 10).forEach((d, i) => {
      console.log(
        `${String(i + 1).padStart(2)}. old score ${String(d.oldScore).padStart(3)} → dealer fit ${String(d.dealerFitScore).padStart(3)}  ` +
        `${d.name.slice(0, 40).padEnd(40)} ${d.classification}`,
      );
    });
  }
  console.log('');
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
