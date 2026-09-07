import { prisma } from '@/lib/db';
import { handleError, ok } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * Live dealer-relevance distribution. Read-only.
 * Lets the market manager see the effect of reclassification without opening
 * a database console.
 */
export async function GET(request: Request) {
  try {
    const country = new URL(request.url).searchParams.get('country');
    const where = country ? { countryCode: country.toUpperCase() } : {};

    const [total, byRelevance, byClassification, notProspects, unclassified, top, demoted] =
      await Promise.all([
        prisma.company.count({ where }),
        prisma.company.groupBy({ by: ['commercialRelevance'], _count: { _all: true }, where }),
        prisma.company.groupBy({ by: ['classification'], _count: { _all: true }, where }),
        prisma.company.count({ where: { ...where, isDealerProspect: false } }),
        prisma.company.count({ where: { ...where, classifiedAt: null } }),
        prisma.company.findMany({
          where: { ...where, isDealerProspect: true },
          orderBy: [{ dealerFitScore: 'desc' }, { name: 'asc' }],
          take: 15,
          select: {
            id: true, name: true, city: true, dealerFitScore: true, score: true,
            classification: true, commercialRelevance: true, competitorBrands: true,
            showroom: true, website: true,
          },
        }),
        // Companies the general score flattered but that are not dealers.
        prisma.company.findMany({
          where: { ...where, isDealerProspect: false },
          orderBy: [{ score: 'desc' }],
          take: 10,
          select: {
            id: true, name: true, city: true, score: true, dealerFitScore: true,
            classification: true, notDealerProspectReason: true,
          },
        }),
      ]);

    return ok({
      total,
      unclassified,
      notDealerProspects: notProspects,
      byRelevance: Object.fromEntries(byRelevance.map((r) => [r.commercialRelevance, r._count._all])),
      byClassification: Object.fromEntries(byClassification.map((r) => [r.classification, r._count._all])),
      topProspects: top,
      misleadingByGeneralScore: demoted,
    });
  } catch (err) {
    return handleError(err);
  }
}
