import { prisma } from '@/lib/db';
import { handleError, ok } from '@/lib/api';
import { listCountries } from '@/lib/geo/countries';
import { majorCitiesFor } from '@/lib/geo/majorCities';

export const dynamic = 'force-dynamic';

/** Per-country roll-up: what has been prospected and what it produced. */
export async function GET() {
  try {
    const [grouped, priorityCounts, runs, marketRows] = await Promise.all([
      prisma.company.groupBy({
        by: ['countryCode', 'countryName'],
        _count: { _all: true },
        _avg: { score: true },
      }),
      prisma.company.groupBy({
        by: ['countryCode', 'priority'],
        _count: { _all: true },
      }),
      prisma.searchRun.groupBy({
        by: ['countryCode'],
        _count: { _all: true },
        _max: { startedAt: true },
      }),
      prisma.market.findMany(),
    ]);

    const byCountry = new Map<string, { A: number; B: number; C: number; D: number }>();
    for (const row of priorityCounts) {
      const entry = byCountry.get(row.countryCode) ?? { A: 0, B: 0, C: 0, D: 0 };
      entry[row.priority] = row._count._all;
      byCountry.set(row.countryCode, entry);
    }

    const runMap = new Map(runs.map((r) => [r.countryCode, r]));
    const marketMap = new Map(marketRows.map((m) => [m.countryCode, m]));

    const markets = grouped
      .map((g) => ({
        countryCode: g.countryCode,
        countryName: g.countryName,
        companies: g._count._all,
        averageScore: g._avg.score !== null ? Math.round(g._avg.score) : null,
        priorities: byCountry.get(g.countryCode) ?? { A: 0, B: 0, C: 0, D: 0 },
        runCount: runMap.get(g.countryCode)?._count._all ?? 0,
        lastRunAt: runMap.get(g.countryCode)?._max.startedAt ?? null,
        notes: marketMap.get(g.countryCode)?.notes ?? null,
        majorCities: majorCitiesFor(g.countryCode).slice(0, 6),
      }))
      .sort((a, b) => b.companies - a.companies);

    return ok({ markets, availableCountries: listCountries() });
  } catch (err) {
    return handleError(err);
  }
}
