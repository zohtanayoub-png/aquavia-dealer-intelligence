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
        description={`${points.length} prospect(s) with verified coordinates. Priority A, B, C, existing dealers and excluded companies are shown separately.`}
      />
      <div className="p-6">
        <MapClient points={points} />
      </div>
    </>
  );
}
