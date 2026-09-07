import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  ActionBadge, Banner, Card, CardHeader, ConfidenceDot, CrmBadge,
  PriorityBadge, TristateBadge, Value,
} from '@/components/ui/primitives';
import { CrmPanel } from '@/components/companies/CrmPanel';
import { PRIORITY_LABELS } from '@/lib/scoring/score';
import type { ScoreSignal } from '@/lib/scoring/score';

export const dynamic = 'force-dynamic';

export default async function CompanyProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      decisionMakers: { orderBy: [{ confidence: 'asc' }, { fullName: 'asc' }] },
      sources: { orderBy: { retrievedAt: 'desc' } },
      runLinks: { include: { run: true }, orderBy: { createdAt: 'desc' }, take: 5 },
    },
  });

  if (!company) notFound();

  const breakdown = (company.scoreBreakdown as unknown as ScoreSignal[] | null) ?? [];
  const verified = breakdown.filter((s) => s.verified);
  const unverified = breakdown.filter((s) => !s.verified);

  return (
    <>
      <PageHeader
        title={company.name}
        description={[company.city, company.region, company.countryName].filter(Boolean).join(', ')}
        actions={
          <>
            <Link href="/companies" className="btn-ghost btn-sm">Back to companies</Link>
            {company.website ? (
              <a href={company.website} target="_blank" rel="noreferrer noopener" className="btn-accent btn-sm">
                Visit website
              </a>
            ) : null}
          </>
        }
      />

      <div className="space-y-5 p-6">
        {company.isExcluded ? (
          <Banner tone="warning" title={`Excluded — ${company.exclusionKind?.replace(/_/g, ' ')}`}>
            {company.exclusionNote ?? 'This company is on an exclusion list.'}
          </Banner>
        ) : null}

        {company.enrichmentStatus ? (
          <Banner tone="info" title="Research incomplete">{company.enrichmentStatus}</Banner>
        ) : null}

        {/* ---- Score header ---- */}
        <Card className="overflow-hidden">
          <div className="grid gap-px bg-sand-200 md:grid-cols-4">
            <div className="bg-white px-5 py-4">
              <p className="label">Aquavia opportunity score</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="tnum text-4xl font-semibold tracking-tight text-ink-900">{company.score}</span>
                <span className="text-sm text-sand-400">/ 100</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <PriorityBadge priority={company.priority} />
                <span className="text-2xs font-medium uppercase tracking-wide text-ink-700">
                  {PRIORITY_LABELS[company.priority]}
                </span>
              </div>
            </div>

            <div className="bg-white px-5 py-4">
              <p className="label">Recommended next action</p>
              <div className="mt-2"><ActionBadge action={company.recommendedAction} /></div>
              <div className="mt-3"><CrmBadge status={company.crmStatus} /></div>
            </div>

            <div className="bg-white px-5 py-4">
              <p className="label">Data confidence</p>
              <div className="mt-2"><ConfidenceDot confidence={company.confidence} /></div>
              <p className="mt-2 text-2xs text-sand-400">
                {company.dataCompleteness}% of scoring signals rest on verified data
              </p>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-sand-200">
                <div className="h-full rounded-full bg-aqua-500" style={{ width: `${company.dataCompleteness}%` }} />
              </div>
            </div>

            <div className="bg-white px-5 py-4">
              <p className="label">Google</p>
              <p className="tnum mt-1 text-xl font-semibold text-ink-900">
                <Value>{company.googleRating !== null ? company.googleRating.toFixed(1) : null}</Value>
              </p>
              <p className="text-2xs text-sand-400">
                <Value>{company.googleReviewCount !== null ? `${company.googleReviewCount} reviews` : null}</Value>
              </p>
              {company.googleMapsUri ? (
                <a href={company.googleMapsUri} target="_blank" rel="noreferrer noopener" className="mt-2 inline-block text-2xs font-medium text-aqua-700 hover:underline">
                  Open in Google Maps →
                </a>
              ) : null}
            </div>
          </div>
        </Card>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-5">
            {/* ---- Why this company ---- */}
            <Card>
              <CardHeader title="Why this company" subtitle="Assembled only from verified signals" />
              <div className="px-4 py-3">
                <p className="whitespace-pre-line text-[13px] leading-relaxed text-ink-800">
                  <Value>{company.whyThisCompany}</Value>
                </p>
              </div>
            </Card>

            {/* ---- Score breakdown ---- */}
            <Card>
              <CardHeader
                title="Score breakdown"
                subtitle={`${verified.length} verified signal(s), ${unverified.length} unknown`}
              />
              {breakdown.length === 0 ? (
                <p className="px-4 py-6 text-[13px] text-sand-400">Not scored yet.</p>
              ) : (
                <ul className="divide-y divide-sand-200">
                  {breakdown.map((signal) => (
                    <li key={signal.key} className="flex items-start gap-4 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-ink-900">{signal.label}</span>
                          {!signal.verified ? (
                            <span className="chip bg-sand-100 text-sand-400 ring-1 ring-inset ring-sand-300">UNKNOWN</span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-2xs leading-relaxed text-sand-400">{signal.detail}</p>
                      </div>
                      <div className="flex w-24 shrink-0 items-center gap-2">
                        <span className="tnum w-10 text-right text-[13px] font-semibold text-ink-900">
                          {signal.points}
                          <span className="text-sand-400">/{signal.max}</span>
                        </span>
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-sand-200">
                          <span
                            className={`block h-full rounded-full ${signal.points > 0 ? 'bg-aqua-500' : 'bg-sand-300'}`}
                            style={{ width: `${signal.max > 0 ? (signal.points / signal.max) * 100 : 0}%` }}
                          />
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* ---- Activities & brands ---- */}
            <Card>
              <CardHeader title="Activities, brands & footprint" />
              <div className="space-y-4 px-4 py-4">
                <div className="flex flex-wrap gap-2">
                  <TristateBadge value={company.spaActivity} label="Spa" />
                  <TristateBadge value={company.poolActivity} label="Pool" />
                  <TristateBadge value={company.saunaActivity} label="Sauna" />
                  <TristateBadge value={company.wellnessActivity} label="Wellness" />
                  <TristateBadge value={company.hammamActivity} label="Hammam" />
                  <TristateBadge value={company.outdoorLiving} label="Outdoor" />
                  <TristateBadge value={company.hospitalityActivity} label="Hotels" />
                  <TristateBadge value={company.showroom} label="Showroom" />
                </div>

                <dl className="grid gap-4 sm:grid-cols-2">
                  <Field label="Brands represented">
                    <Value>{company.brands.length > 0 ? company.brands.join(', ') : null}</Value>
                  </Field>
                  <Field label="Competitor spa brands">
                    <Value>{company.competitorBrands.length > 0 ? company.competitorBrands.join(', ') : null}</Value>
                  </Field>
                  <Field label="Company founded (year)">
                    <Value>{company.yearFounded}</Value>
                    {company.yearFounded ? (
                      <span className="ml-2 text-2xs text-sand-400">confidence {company.yearFoundedConfidence}</span>
                    ) : null}
                  </Field>
                  <Field label="Years working in the spa industry">
                    <Value>
                      {company.yearsInSpaIndustry !== null
                        ? `${company.yearsInSpaIndustry} years (since ${company.spaSinceYear})`
                        : null}
                    </Value>
                  </Field>
                  <Field label="Locations"><Value>{company.locationCount}</Value></Field>
                  <Field label="Represents Aquavia"><TristateBadge value={company.representsAquavia} /></Field>
                </dl>
              </div>
            </Card>

            {/* ---- Decision makers ---- */}
            <Card>
              <CardHeader
                title="Decision makers"
                subtitle="Public professional information only — never fabricated, never scraped behind a login"
              />
              {company.decisionMakers.length === 0 ? (
                <p className="px-4 py-6 text-[13px] text-sand-400">
                  UNKNOWN — no public decision maker was found for this company.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table-dense w-full">
                    <thead>
                      <tr><th>Name</th><th>Position</th><th>Email</th><th>Phone</th><th>LinkedIn</th><th>Confidence</th><th>Source</th></tr>
                    </thead>
                    <tbody>
                      {company.decisionMakers.map((d) => (
                        <tr key={d.id}>
                          <td className="font-medium text-ink-900">{d.fullName}</td>
                          <td className="text-ink-700"><Value>{d.position}</Value></td>
                          <td>
                            <Value>
                              {d.email ? <a href={`mailto:${d.email}`} className="text-aqua-700 hover:underline">{d.email}</a> : null}
                            </Value>
                          </td>
                          <td className="tnum text-ink-700"><Value>{d.phone}</Value></td>
                          <td>
                            <Value>
                              {d.linkedinUrl ? (
                                <a href={d.linkedinUrl} target="_blank" rel="noreferrer noopener" className="text-aqua-700 hover:underline">
                                  Profile
                                </a>
                              ) : null}
                            </Value>
                          </td>
                          <td><ConfidenceDot confidence={d.confidence} /></td>
                          <td className="max-w-[14rem]">
                            <Value>
                              {d.sourceUrl ? (
                                <a href={d.sourceUrl} target="_blank" rel="noreferrer noopener" className="block truncate text-2xs text-aqua-700 hover:underline">
                                  {d.sourceUrl}
                                </a>
                              ) : null}
                            </Value>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* ---- Sources ---- */}
            <Card>
              <CardHeader
                title="Sources & evidence"
                subtitle={`${company.sources.length} evidenced reference(s)`}
              />
              {company.sources.length === 0 ? (
                <p className="px-4 py-6 text-[13px] text-sand-400">No sources recorded.</p>
              ) : (
                <ul className="divide-y divide-sand-200">
                  {company.sources.map((s) => (
                    <li key={s.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <a href={s.url} target="_blank" rel="noreferrer noopener" className="block truncate text-[13px] font-medium text-aqua-700 hover:underline">
                            {s.title ?? s.url}
                          </a>
                          <p className="truncate text-2xs text-sand-400">{s.url}</p>
                        </div>
                        <span className="chip shrink-0 bg-sand-100 text-ink-700 ring-1 ring-inset ring-sand-300">
                          {s.kind.replace(/_/g, ' ')}
                        </span>
                      </div>
                      {s.snippet ? (
                        <blockquote className="mt-2 border-l-2 border-sand-300 pl-3 text-2xs italic leading-relaxed text-ink-700">
                          {s.snippet}
                        </blockquote>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* ---- Right rail ---- */}
          <div className="space-y-5">
            <Card>
              <CardHeader title="CRM" subtitle="Status, notes and follow-up" />
              <CrmPanel
                companyId={company.id}
                initial={{
                  crmStatus: company.crmStatus,
                  salesNotes: company.salesNotes,
                  lastContactAt: company.lastContactAt?.toISOString() ?? null,
                  nextFollowUpAt: company.nextFollowUpAt?.toISOString() ?? null,
                  ownerName: company.ownerName,
                }}
              />
            </Card>

            <Card>
              <CardHeader title="Company details" />
              <dl className="space-y-3 px-4 py-4">
                <Field label="Address"><Value>{company.fullAddress}</Value></Field>
                <Field label="Coordinates">
                  <Value>
                    {company.latitude !== null && company.longitude !== null
                      ? `${company.latitude.toFixed(5)}, ${company.longitude.toFixed(5)}`
                      : null}
                  </Value>
                </Field>
                <Field label="Google Place ID">
                  <span className="break-all font-mono text-2xs"><Value>{company.googlePlaceId}</Value></span>
                </Field>
                <Field label="Phone"><Value>{company.phone}</Value></Field>
                <Field label="Public email">
                  <Value>
                    {company.publicEmail ? (
                      <a href={`mailto:${company.publicEmail}`} className="text-aqua-700 hover:underline">{company.publicEmail}</a>
                    ) : null}
                  </Value>
                </Field>
                <Field label="WhatsApp"><Value>{company.whatsapp}</Value></Field>
                <Field label="Website">
                  <Value>
                    {company.website ? (
                      <a href={company.website} target="_blank" rel="noreferrer noopener" className="break-all text-aqua-700 hover:underline">
                        {company.website}
                      </a>
                    ) : null}
                  </Value>
                </Field>
                <Field label="Business status"><Value>{company.googleBusinessStatus}</Value></Field>
                <Field label="First discovered">
                  <span className="tnum">{company.discoveredAt.toISOString().slice(0, 10)}</span>
                </Field>
                <Field label="Last verified">
                  <span className="tnum">
                    <Value>{company.lastVerifiedAt?.toISOString().slice(0, 10)}</Value>
                  </span>
                </Field>
              </dl>
            </Card>

            <Card>
              <CardHeader title="Social profiles" />
              <div className="space-y-2 px-4 py-4">
                <SocialRow label="LinkedIn" url={company.linkedinUrl} />
                <SocialRow label="Instagram" url={company.instagramUrl} />
                <SocialRow label="Facebook" url={company.facebookUrl} />
                <SocialRow label="YouTube" url={company.youtubeUrl} />
              </div>
            </Card>

            <Card>
              <CardHeader title="Research notes" />
              <div className="px-4 py-3">
                <p className="whitespace-pre-line text-2xs leading-relaxed text-ink-700">
                  <Value>{company.researchNotes}</Value>
                </p>
              </div>
            </Card>

            {company.runLinks.length > 0 ? (
              <Card>
                <CardHeader title="Discovered by" />
                <ul className="divide-y divide-sand-200">
                  {company.runLinks.map((link) => (
                    <li key={`${link.runId}-${link.companyId}`} className="px-4 py-2.5">
                      <Link href={`/search?run=${link.runId}`} className="text-[13px] text-ink-800 hover:text-aqua-700">
                        {link.run.countryName}{link.run.city ? ` — ${link.run.city}` : ''}
                      </Link>
                      <p className="tnum text-2xs text-sand-400">
                        {link.run.depth} · {link.run.startedAt.toISOString().slice(0, 10)}
                        {link.isNew ? ' · new' : ' · re-verified'}
                      </p>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="mt-0.5 text-[13px] text-ink-800">{children}</dd>
    </div>
  );
}

function SocialRow({ label, url }: { label: string; url: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="label">{label}</span>
      <span className="min-w-0 text-right text-[13px]">
        <Value>
          {url ? (
            <a href={url} target="_blank" rel="noreferrer noopener" className="block truncate text-aqua-700 hover:underline">
              Open
            </a>
          ) : null}
        </Value>
      </span>
    </div>
  );
}
