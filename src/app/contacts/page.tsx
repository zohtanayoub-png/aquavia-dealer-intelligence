import { PageHeader } from '@/components/layout/PageHeader';
import { ContactsTable } from '@/components/contacts/ContactsTable';
import { listCountries } from '@/lib/geo/countries';

export const dynamic = 'force-dynamic';

export default function ContactsPage() {
  return (
    <>
      <PageHeader
        title="Contacts"
        description="Decision makers found in public professional sources. Every entry keeps the URL it came from — nothing here is inferred or pattern-guessed."
      />
      <div className="p-6">
        <ContactsTable countries={listCountries()} />
      </div>
    </>
  );
}
