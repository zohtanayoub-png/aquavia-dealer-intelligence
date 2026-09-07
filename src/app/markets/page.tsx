import Link from 'next/link';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, EmptyState, Value } from '@/components/ui/primitives';
import { listCountries } from '@/lib/geo/countries';
import { majorCitiesFor } from '@/lib/geo/majorCities';
import { hasLocalTerms } from '@/lib/discovery/terms';

export const dynamic = 'force-dynamic';

export default async function MarketsPage() {
  const [grouped, priorityCounts, runs] = await Promise.all([
    prisma.company.groupBy({
      by: ['countryCode', 'countryName'],
      _count: { _all: true },
      _avg: { score: true, dataCompleteness: true },
    }),
    prisma.company.groupBy({ by: ['countryCode', 'priority'], _count: { _all: true } }),
    prisma.searchRun.groupBy({
      by: ['countryCode'],
      _count: { _all: true },
      _max: { startedAt: true },
    }),
  ]);

  const priorityByCountry = new Map<string, Record<string, number>>();
  for (const row of priorityCounts) {
    const entry = priorityByCountry.get(row.countryCode) ?? { A: 0, B: 0, C: 0, D: 0 };
    entry[row.priority] = row._count._all;
    priorityByCountry.set(row.countryCode, entry);
  }
  const runMap = new Map(runs.map((r) => [r.countryCode, r]));

  const markets = grouped
    .map((g) => ({
      code: g.countryCode,
      name: g.countryName,
      companies: g._count._all,
      avgScore: g._avg.score !== null ? Math.round(g._avg.score) : null,
      avgCompleteness: g._avg.dataCompleteness !== null ? Math.round(g._avg.dataCompleteness) : null,
      priorities: priorityByCountry.get(g.countryCode) ?? { A: 0, B: 0, C: 0, D: 0 },
      runCount: runMap.get(g.countryCode)?._count._all ?? 0,
      lastRunAt: runMap.get(g.countryCode)?._max.startedAt ?? null,
    }))
    .sort((a, b) => b.companies - a.companies);

  const allCountries = listCountries();
  const prospected = new Set(markets.map((m) => m.code));
  const untouched = allCountries.filter((c) => !prospected.has(c.code));

  return (
    <>
      <PageHeader
        title="Markets"
        description="Coverage by country: what has been prospected, what it produced, and which markets are still untouched."
        actions={<Link href="/search" className="btn-accent">New search</Link>}
      />

      <div className="space-y-5 p-6">
        <Card>
          <CardHeader title="Prospected markets" subtitle={`${markets.length} market(s) with data`} />
          {markets.length === 0 ? (
            <EmptyState
              title="No markets prospected yet"
              description="Run your first search to start building country coverage."
              action={<Link href="/search" className="btn-accent btn-sm">Start prospecting</Link>}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-dense w-full">
                <thead>
                  <tr>
                    <th>Market</th><th>Companies</th><th>A</th><th>B</th><th>C</th><th>D</th>
                    <th>Avg. score</th><th>Avg. completeness</th><th>Searches</th><th>Last search</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {markets.map((m) => (
                    <tr key={m.code}>
                      <td>
                        <span className="font-medium text-ink-900">{m.name}</span>
                        <span className="ml-2 font-mono text-2xs text-sand-400">{m.code}</span>
                      </td>
                      <td className="tnum font-semibold text-ink-900">{m.companies}</td>
                      <td className="tnum text-emerald-700">{m.priorities.A}</td>
                      <td className="tnum text-sky-700">{m.priorities.B}</td>
                      <td className="tnum text-amber-700">{m.priorities.C}</td>
                      <td className="tnum text-sand-400">{m.priorities.D}</td>
                      <td className="tnum text-ink-800"><Value>{m.avgScore}</Value></td>
                      <td className="tnum text-ink-800">
                        <Value>{m.avgCompleteness !== null ? `${m.avgCompleteness}%` : null}</Value>
                      </td>
                      <td className="tnum text-ink-700">{m.runCount}</td>
                      <td className="tnum text-2xs text-sand-400">
                        <Value>{m.lastRunAt?.toISOString().slice(0, 10)}</Value>
                      </td>
                      <td>
                        <Link href={`/companies?country=${m.code}`} className="btn-ghost btn-sm">View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Available markets"
            subtitle={`${untouched.length} market(s) not yet prospected — search vocabulary is ready for each`}
          />
          <div className="grid gap-px bg-sand-200 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {untouched.map((country) => {
              const local = hasLocalTerms(country.languages);
              return (
                <Link
                  key={country.code}
                  href={`/search`}
                  className="group bg-white px-4 py-3 transition hover:bg-aqua-50/60"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[13px] font-medium text-ink-900 group-hover:text-aqua-800">
                      {country.name}
                    </span>
                    <span className="font-mono text-2xs text-sand-400">{country.code}</span>
                  </div>
                  <p className="mt-0.5 text-2xs text-sand-400">
                    {country.languages.map((l) => l.toUpperCase()).join(' · ')}
                    {local ? '' : ' — English fallback only'}
                  </p>
                  <p className="mt-0.5 truncate text-2xs text-sand-400">
                    {majorCitiesFor(country.code).slice(0, 3).join(', ') || 'No major-city reference held'}
                  </p>
                </Link>
              );
            })}
          </div>
        </Card>
      </div>
    </>
  );
}
