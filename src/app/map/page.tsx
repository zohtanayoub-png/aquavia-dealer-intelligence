import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/layout/PageHeader';
import { MapClient } from '@/components/map/MapClient';
import type { MapPoint } from '@/components/map/ProspectMap';

export const dynamic = 'force-dynamic';

export default async function MapPage() {
  const companies = await prisma.company.findMany({
    where: { latitude: { not: null }, longitude: { not: null } },
    select: {
      id: true, name: true, city: true, countryName: true, latitude: true, longitude: true,
      score: true, priority: true, crmStatus: true, isExcluded: true, googleRating: true,
      googleReviewCount: true, phone: true, website: true, competitorBrands: true, showroom: true,
      dealerFitScore: true, commercialRelevance: true, classification: true, isDealerProspect: true,
    },
    take: 5000,
  });

  const points: MapPoint[] = companies.flatMap((c) =>
    c.latitude === null || c.longitude === null
      ? []
      : [{ ...c, latitude: c.latitude, longitude: c.longitude }],
  );

  return (
    <>
      <PageHeader
        title="Map"
        description={
          `${points.length} company/companies with verified coordinates, grouped by commercial relevance. ` +
          'Service businesses flagged NOT A DEALER PROSPECT are hidden until you enable them in the legend.'
        }
      />
      <div className="p-6">
        <MapClient points={points} />
      </div>
    </>
  );
}
