import { PageHeader } from '@/components/layout/PageHeader';
import { SearchConsole } from '@/components/search/SearchConsole';
import { listCountries } from '@/lib/geo/countries';
import { integrationStatuses } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const { run } = await searchParams;
  const integrations = integrationStatuses();

  return (
    <>
      <PageHeader
        title="New prospect search"
        description="Discover spa, hot tub, pool, wellness and outdoor-living companies in a market — plus dealers already representing competing spa brands."
      />
      <div className="p-6">
        <SearchConsole
          countries={listCountries()}
          discoveryReady={integrations.find((i) => i.id === 'googlePlaces')?.configured ?? false}
          researchReady={integrations.find((i) => i.id === 'tavily')?.configured ?? false}
          initialRunId={run}
        />
      </div>
    </>
  );
}
