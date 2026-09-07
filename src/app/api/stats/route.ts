import { prisma } from '@/lib/db';
import { handleError, ok } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** Dashboard roll-up. One round trip, no client-side aggregation. */
export async function GET() {
  try {
    const [
      total, excluded, byPriority, byStatus, byCountry,
      withContacts, recentRuns, topProspects, followUps, avg,
    ] = await Promise.all([
      prisma.company.count({ where: { isExcluded: false } }),
      prisma.company.count({ where: { isExcluded: true } }),
      prisma.company.groupBy({
        by: ['priority'], _count: { _all: true }, where: { isExcluded: false },
      }),
      prisma.company.groupBy({
        by: ['crmStatus'], _count: { _all: true }, where: { isExcluded: false },
      }),
      prisma.company.groupBy({
        by: ['countryCode', 'countryName'], _count: { _all: true },
        where: { isExcluded: false }, orderBy: { _count: { countryCode: 'desc' } }, take: 8,
      }),
      prisma.company.count({ where: { isExcluded: false, decisionMakers: { some: {} } } }),
      prisma.searchRun.findMany({ orderBy: { startedAt: 'desc' }, take: 6 }),
      prisma.company.findMany({
        where: { isExcluded: false },
        orderBy: [{ score: 'desc' }, { googleReviewCount: 'desc' }],
        take: 8,
        select: {
          id: true, name: true, city: true, countryName: true, score: true,
          priority: true, googleRating: true, googleReviewCount: true,
          competitorBrands: true, showroom: true, recommendedAction: true,
        },
      }),
      prisma.company.findMany({
        where: { isExcluded: false, nextFollowUpAt: { not: null } },
        orderBy: { nextFollowUpAt: 'asc' },
        take: 8,
        select: { id: true, name: true, city: true, nextFollowUpAt: true, crmStatus: true, priority: true },
      }),
      prisma.company.aggregate({
        where: { isExcluded: false },
        _avg: { score: true, dataCompleteness: true },
      }),
    ]);

    const priorities = { A: 0, B: 0, C: 0, D: 0 };
    for (const row of byPriority) priorities[row.priority] = row._count._all;

    return ok({
      total,
      excluded,
      priorities,
      statuses: Object.fromEntries(byStatus.map((s) => [s.crmStatus, s._count._all])),
      countries: byCountry.map((c) => ({
        code: c.countryCode, name: c.countryName, count: c._count._all,
      })),
      withContacts,
      averageScore: avg._avg.score !== null ? Math.round(avg._avg.score) : null,
      averageCompleteness: avg._avg.dataCompleteness !== null ? Math.round(avg._avg.dataCompleteness) : null,
      recentRuns,
      topProspects,
      followUps,
    });
  } catch (err) {
    return handleError(err);
  }
}
