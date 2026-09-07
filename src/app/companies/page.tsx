import { PageHeader } from '@/components/layout/PageHeader';
import { CompanyTable } from '@/components/companies/CompanyTable';
import { listCountries } from '@/lib/geo/countries';

export const dynamic = 'force-dynamic';

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}) {
  const { country } = await searchParams;

  return (
    <>
      <PageHeader
        title="Companies"
        description="Every discovered prospect, scored and prioritised. Sort any column, filter the set, then export exactly what you see."
      />
      <div className="p-6">
        <CompanyTable countries={listCountries()} initialCountry={country} />
      </div>
    </>
  );
}
