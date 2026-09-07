import { PageHeader } from '@/components/layout/PageHeader';
import { Banner, Card, CardHeader } from '@/components/ui/primitives';
import { ExclusionManager } from '@/components/ui/ExclusionManager';
import { integrationStatuses } from '@/lib/env';
import { listCountries } from '@/lib/geo/countries';
import { prisma } from '@/lib/db';
import { COMPETITOR_BRANDS } from '@/lib/discovery/brands';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const integrations = integrationStatuses();

  let databaseReachable = false;
  let databaseError: string | null = null;
  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseReachable = true;
  } catch (err) {
    databaseError = err instanceof Error ? err.message : String(err);
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Integration status and the exclusion lists applied to every search."
      />

      <div className="grid gap-5 p-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Integrations"
              subtitle="Configured through environment variables — key values are never displayed"
            />
            <ul className="divide-y divide-sand-200">
              {integrations.map((integration) => {
                const configured =
                  integration.id === 'database' ? databaseReachable : integration.configured;
                return (
                  <li key={integration.id} className="px-4 py-3.5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13px] font-semibold text-ink-900">{integration.label}</span>
                          <code className="rounded bg-sand-100 px-1.5 py-0.5 font-mono text-2xs text-ink-700">
                            {integration.envVar}
                          </code>
                          {integration.required ? (
                            <span className="chip bg-sand-100 text-sand-400 ring-1 ring-inset ring-sand-300">Required</span>
                          ) : (
                            <span className="chip bg-sand-100 text-sand-400 ring-1 ring-inset ring-sand-300">Optional</span>
                          )}
                        </div>
                        <p className="mt-1 text-2xs leading-relaxed text-sand-400">{integration.impact}</p>
                        {integration.docsUrl ? (
                          <a href={integration.docsUrl} target="_blank" rel="noreferrer noopener" className="mt-1 inline-block text-2xs font-medium text-aqua-700 hover:underline">
                            Documentation →
                          </a>
                        ) : null}
                      </div>
                      <span
                        className={`chip shrink-0 ring-1 ring-inset ${
                          configured
                            ? 'bg-emerald-50 text-emerald-800 ring-emerald-600/20'
                            : integration.required
                              ? 'bg-rose-50 text-rose-800 ring-rose-600/20'
                              : 'bg-sand-100 text-sand-400 ring-sand-300'
                        }`}
                      >
                        {configured ? 'Configured' : 'Not configured'}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          {databaseError ? (
            <Banner tone="error" title="Database unreachable">
              <p>{databaseError}</p>
              <p className="mt-1">
                Set <code className="rounded bg-white/60 px-1">DATABASE_URL</code> (and{' '}
                <code className="rounded bg-white/60 px-1">DIRECT_URL</code>), then apply migrations
                with <code className="rounded bg-white/60 px-1">npm run db:deploy</code>.
              </p>
            </Banner>
          ) : null}

          <Card>
            <CardHeader
              title="Data quality policy"
              subtitle="Enforced in code, not just documented"
            />
            <ul className="space-y-2.5 px-4 py-4 text-[13px] leading-relaxed text-ink-800">
              <li>• A fact is stored only when a provider returned it or a retrieved page states it. Everything else is <span className="unknown">UNKNOWN</span>.</li>
              <li>• Every research finding keeps its source URL and a verbatim quote, visible on the company profile.</li>
              <li>• <strong>Company founded year</strong> and <strong>years working in the spa industry</strong> are separate fields. One is never derived from the other.</li>
              <li>• Emails are only kept when the address literally appears in the retrieved text. Addresses are never pattern-guessed.</li>
              <li>• LinkedIn is never authenticated against or crawled behind its access controls. Public profile URLs found in ordinary search results are stored as references only.</li>
              <li>• Unknown signals score zero — never a midpoint — so a well-researched company always outranks an unresearched one at equal evidence.</li>
            </ul>
          </Card>

          <Card>
            <CardHeader
              title="Competitor brand watchlist"
              subtitle={`${COMPETITOR_BRANDS.length} brands actively detected — discovery is not limited to this list`}
            />
            <div className="flex flex-wrap gap-1.5 px-4 py-4">
              {COMPETITOR_BRANDS.map((brand) => (
                <span
                  key={brand.name}
                  className={`chip ring-1 ring-inset ${
                    brand.premium
                      ? 'bg-aqua-50 text-aqua-800 ring-aqua-500/20'
                      : 'bg-sand-100 text-ink-700 ring-sand-300'
                  }`}
                  title={brand.premium ? 'Premium positioning' : 'Volume / entry positioning'}
                >
                  {brand.name}
                </span>
              ))}
            </div>
            <p className="px-4 pb-4 text-2xs leading-relaxed text-sand-400">
              Brand-shaped mentions that are not on this list are captured separately in each
              company&apos;s research notes as &ldquo;possible additional brands to review&rdquo;,
              so new local brands surface instead of being discarded.
            </p>
          </Card>
        </div>

        <ExclusionManager countries={listCountries()} />
      </div>
    </>
  );
}
