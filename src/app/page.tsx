import Link from 'next/link';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  Banner, Card, CardHeader, CrmBadge, EmptyState, PriorityBadge, ScoreCell, Stat, Value,
} from '@/components/ui/primitives';
import { integrationStatuses } from '@/lib/env';
import { phaseLabel } from '@/lib/pipeline/runner';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const integrations = integrationStatuses();
  const placesReady = integrations.find((i) => i.id === 'googlePlaces')?.configured ?? false;
  const tavilyReady = integrations.find((i) => i.id === 'tavily')?.configured ?? false;

  let data: Awaited<ReturnType<typeof loadDashboard>> | null = null;
  let dbError: string | null = null;
  try {
    data = await loadDashboard();
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Pipeline overview across every market you have prospected."
        actions={
          <Link href="/search" className="btn-accent">
            New prospect search
          </Link>
        }
      />

      <div className="space-y-5 p-6">
        {dbError ? (
          <Banner tone="error" title="Database unavailable">
            <p>{dbError}</p>
            <p className="mt-1">
              Set <code className="rounded bg-white/60 px-1">DATABASE_URL</code> and run{' '}
              <code className="rounded bg-white/60 px-1">npm run db:deploy</code>.
            </p>
          </Banner>
        ) : null}

        {!placesReady ? (
          <Banner tone="warning" title="Google Places is not configured — discovery is disabled">
            <p>
              Set <code className="rounded bg-white/60 px-1">GOOGLE_PLACES_API_KEY</code> to start
              finding companies. Everything else in the application works without it, but no
              prospects can be discovered or verified.
            </p>
            <Link href="/settings" className="mt-2 inline-block font-medium underline">
              Open Settings
            </Link>
          </Banner>
        ) : null}

        {placesReady && !tavilyReady ? (
          <Banner tone="info" title="Web research is not configured">
            <p>
              Companies will be discovered and scored from Google Places data only. Brands carried,
              showroom evidence, founding year and decision makers will stay UNKNOWN until{' '}
              <code className="rounded bg-white/60 px-1">TAVILY_API_KEY</code> is set.
            </p>
          </Banner>
        ) : null}

        {data ? <DashboardBody data={data} /> : null}
      </div>
    </>
  );
}

async function loadDashboard() {
  const [total, excluded, byPriority, byStatus, byCountry, withContacts, avg, recentRuns, topProspects, followUps] =
    await Promise.all([
      prisma.company.count({ where: { isExcluded: false } }),
      prisma.company.count({ where: { isExcluded: true } }),
      prisma.company.groupBy({ by: ['priority'], _count: { _all: true }, where: { isExcluded: false } }),
      prisma.company.groupBy({ by: ['crmStatus'], _count: { _all: true }, where: { isExcluded: false } }),
      prisma.company.groupBy({
        by: ['countryCode', 'countryName'],
        _count: { _all: true },
        where: { isExcluded: false },
      }),
      prisma.company.count({ where: { isExcluded: false, decisionMakers: { some: {} } } }),
      prisma.company.aggregate({ where: { isExcluded: false }, _avg: { score: true, dataCompleteness: true } }),
      prisma.searchRun.findMany({ orderBy: { startedAt: 'desc' }, take: 5 }),
      prisma.company.findMany({
        where: { isExcluded: false },
        orderBy: [{ score: 'desc' }, { googleReviewCount: 'desc' }],
        take: 8,
        select: {
          id: true, name: true, city: true, countryName: true, score: true, priority: true,
          googleRating: true, googleReviewCount: true, competitorBrands: true, crmStatus: true,
        },
      }),
      prisma.company.findMany({
        where: { isExcluded: false, nextFollowUpAt: { not: null } },
        orderBy: { nextFollowUpAt: 'asc' },
        take: 6,
        select: { id: true, name: true, city: true, nextFollowUpAt: true, crmStatus: true, priority: true },
      }),
    ]);

  const priorities = { A: 0, B: 0, C: 0, D: 0 };
  for (const row of byPriority) priorities[row.priority] = row._count._all;

  return {
    total, excluded, priorities, withContacts,
    statuses: byStatus.sort((a, b) => b._count._all - a._count._all),
    countries: byCountry.sort((a, b) => b._count._all - a._count._all).slice(0, 8),
    averageScore: avg._avg.score !== null ? Math.round(avg._avg.score) : null,
    averageCompleteness: avg._avg.dataCompleteness !== null ? Math.round(avg._avg.dataCompleteness) : null,
    recentRuns, topProspects, followUps,
  };
}

function DashboardBody({ data }: { data: Awaited<ReturnType<typeof loadDashboard>> }) {
  if (data.total === 0 && data.excluded === 0) {
    return (
      <Card>
        <EmptyState
          title="No prospects yet"
          description="Run your first search to discover spa, pool and wellness companies in a market. Start with a country — add a city to focus the search."
          action={<Link href="/search" className="btn-accent">Start prospecting</Link>}
        />
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <Stat label="Prospects" value={data.total} sub={`${data.excluded} excluded`} />
        <Stat label="Priority A" value={data.priorities.A} sub="High priority" accent="a" />
        <Stat label="Priority B" value={data.priorities.B} sub="Good prospect" accent="b" />
        <Stat label="Priority C" value={data.priorities.C} sub="Secondary" accent="c" />
        <Stat label="With contacts" value={data.withContacts} sub="Decision maker found" />
        <Stat
          label="Avg. score"
          value={data.averageScore ?? '—'}
          sub={data.averageCompleteness !== null ? `${data.averageCompleteness}% data completeness` : undefined}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Top prospects"
            subtitle="Highest Aquavia opportunity score across all markets"
            actions={<Link href="/companies" className="btn-ghost btn-sm">View all</Link>}
          />
          <div className="overflow-x-auto">
            <table className="table-dense w-full">
              <thead>
                <tr>
                  <th>Company</th><th>City</th><th>Score</th><th>Rating</th>
                  <th>Competitor brands</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.topProspects.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/companies/${c.id}`} className="font-medium text-ink-900 hover:text-aqua-700">
                        {c.name}
                      </Link>
                      <p className="text-2xs text-sand-400">{c.countryName}</p>
                    </td>
                    <td className="text-ink-700"><Value>{c.city}</Value></td>
                    <td><ScoreCell score={c.score} priority={c.priority} /></td>
                    <td className="tnum text-ink-700">
                      <Value>
                        {c.googleRating !== null
                          ? `${c.googleRating.toFixed(1)} (${c.googleReviewCount ?? 0})`
                          : null}
                      </Value>
                    </td>
                    <td className="max-w-[16rem] truncate text-ink-700">
                      <Value>{c.competitorBrands.length > 0 ? c.competitorBrands.join(', ') : null}</Value>
                    </td>
                    <td><CrmBadge status={c.crmStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Markets" subtitle="Prospects discovered per country" />
            <ul className="divide-y divide-sand-200">
              {data.countries.map((c) => (
                <li key={c.countryCode} className="flex items-center justify-between px-4 py-2.5">
                  <Link href={`/companies?country=${c.countryCode}`} className="text-[13px] text-ink-800 hover:text-aqua-700">
                    {c.countryName}
                  </Link>
                  <span className="tnum text-[13px] font-semibold text-ink-900">{c._count._all}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Pipeline" subtitle="Companies by CRM status" />
            <ul className="divide-y divide-sand-200">
              {data.statuses.map((s) => (
                <li key={s.crmStatus} className="flex items-center justify-between px-4 py-2">
                  <CrmBadge status={s.crmStatus} />
                  <span className="tnum text-[13px] font-semibold text-ink-900">{s._count._all}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Recent searches" subtitle="Discovery runs and their outcome" />
          {data.recentRuns.length === 0 ? (
            <EmptyState title="No searches yet" description="Your prospecting runs will appear here." />
          ) : (
            <ul className="divide-y divide-sand-200">
              {data.recentRuns.map((run) => (
                <li key={run.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-ink-900">
                      {run.countryName}{run.city ? ` — ${run.city}` : ''}
                      <span className="ml-2 text-2xs uppercase tracking-wide text-sand-400">{run.depth}</span>
                    </p>
                    <p className="text-2xs text-sand-400">
                      {phaseLabel(run.status)} · {run.newCount} new · {run.discoveredCount} found
                      {run.warnings.length > 0 ? ` · ${run.warnings.length} warning(s)` : ''}
                    </p>
                  </div>
                  <Link href={`/search?run=${run.id}`} className="btn-ghost btn-sm shrink-0">Open</Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Follow-ups due" subtitle="Scheduled next contact dates" />
          {data.followUps.length === 0 ? (
            <EmptyState
              title="No follow-ups scheduled"
              description="Set a next follow-up date on a company profile and it will appear here."
            />
          ) : (
            <ul className="divide-y divide-sand-200">
              {data.followUps.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
                  <div className="min-w-0">
                    <Link href={`/companies/${c.id}`} className="truncate text-[13px] font-medium text-ink-900 hover:text-aqua-700">
                      {c.name}
                    </Link>
                    <p className="text-2xs text-sand-400"><Value>{c.city}</Value></p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <PriorityBadge priority={c.priority} />
                    <span className="tnum text-2xs text-sand-400">
                      {c.nextFollowUpAt?.toISOString().slice(0, 10)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
