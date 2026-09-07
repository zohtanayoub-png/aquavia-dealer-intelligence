'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Banner, Card, CrmBadge, EmptyState, PriorityBadge, ScoreCell, TristateBadge, Value,
} from '@/components/ui/primitives';
import { CRM_STATUSES } from '@/components/ui/primitives';

interface DecisionMakerLite {
  id: string;
  fullName: string;
  position: string | null;
  email: string | null;
  linkedinUrl: string | null;
}

interface CompanyRow {
  id: string;
  name: string;
  city: string | null;
  countryCode: string;
  countryName: string;
  score: number;
  priority: string;
  googleRating: number | null;
  googleReviewCount: number | null;
  brands: string[];
  competitorBrands: string[];
  showroom: string;
  spaActivity: string;
  website: string | null;
  phone: string | null;
  crmStatus: string;
  isExcluded: boolean;
  exclusionKind: string | null;
  dataCompleteness: number;
  decisionMakers: DecisionMakerLite[];
}

interface Country { code: string; name: string }

const COLUMNS: { key: string; label: string; sortable?: boolean; className?: string }[] = [
  { key: 'name', label: 'Company', sortable: true },
  { key: 'city', label: 'City', sortable: true },
  { key: 'score', label: 'Score', sortable: true },
  { key: 'priority', label: 'Priority', sortable: true },
  { key: 'googleRating', label: 'Rating', sortable: true },
  { key: 'googleReviewCount', label: 'Reviews', sortable: true },
  { key: 'brands', label: 'Spa brands' },
  { key: 'showroom', label: 'Showroom' },
  { key: 'website', label: 'Website' },
  { key: 'phone', label: 'Phone' },
  { key: 'contact', label: 'Contact' },
  { key: 'crmStatus', label: 'Status', sortable: true },
];

export function CompanyTable({
  countries,
  initialCountry,
}: {
  countries: Country[];
  initialCountry?: string;
}) {
  const [rows, setRows] = useState<CompanyRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [country, setCountry] = useState(initialCountry ?? '');
  const [priority, setPriority] = useState<string[]>([]);
  const [crmStatus, setCrmStatus] = useState('');
  const [minScore, setMinScore] = useState('');
  const [showroomOnly, setShowroomOnly] = useState(false);
  const [spaOnly, setSpaOnly] = useState(false);
  const [withContact, setWithContact] = useState(false);
  const [includeExcluded, setIncludeExcluded] = useState(false);
  const [sort, setSort] = useState('score');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set('q', q.trim());
    if (country) p.set('country', country);
    for (const value of priority) p.append('priority', value);
    if (crmStatus) p.set('crmStatus', crmStatus);
    if (minScore) p.set('minScore', minScore);
    if (showroomOnly) p.set('showroom', 'YES');
    if (spaOnly) p.set('spaActivity', 'YES');
    if (withContact) p.set('hasContact', 'true');
    if (includeExcluded) p.set('includeExcluded', 'true');
    p.set('sort', sort);
    p.set('dir', dir);
    return p;
  }, [q, country, priority, crmStatus, minScore, showroomOnly, spaOnly, withContact, includeExcluded, sort, dir]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/companies?${query.toString()}&take=200`, { cache: 'no-store' });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? 'Could not load companies.');
        setRows([]);
        return;
      }
      setRows(json.data.items);
      setTotal(json.data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    // Debounce so typing in the search box does not fire a request per keystroke.
    const timer = setTimeout(() => { void load(); }, 220);
    return () => clearTimeout(timer);
  }, [load]);

  function toggleSort(key: string) {
    if (sort === key) {
      setDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSort(key);
      setDir(key === 'name' || key === 'city' ? 'asc' : 'desc');
    }
  }

  function togglePriority(value: string) {
    setPriority((prev) => (prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]));
  }

  const exportHref = (format: string) => `/api/export?${query.toString()}&format=${format}`;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[16rem] flex-1">
            <label htmlFor="q" className="label">Search</label>
            <input
              id="q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Company, city, address, brand or contact name…"
              className="field mt-1.5"
            />
          </div>

          <div className="w-48">
            <label htmlFor="country" className="label">Country</label>
            <select id="country" value={country} onChange={(e) => setCountry(e.target.value)} className="field mt-1.5">
              <option value="">All countries</option>
              {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </div>

          <div className="w-44">
            <label htmlFor="crm" className="label">CRM status</label>
            <select id="crm" value={crmStatus} onChange={(e) => setCrmStatus(e.target.value)} className="field mt-1.5">
              <option value="">Any status</option>
              {CRM_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </div>

          <div className="w-28">
            <label htmlFor="minScore" className="label">Min score</label>
            <input
              id="minScore"
              type="number"
              min={0}
              max={100}
              value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
              className="field mt-1.5 tnum"
              placeholder="0"
            />
          </div>

          <div>
            <span className="label">Priority</span>
            <div className="mt-1.5 flex gap-1">
              {['A', 'B', 'C', 'D'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePriority(p)}
                  className={`h-[38px] w-9 rounded-md border text-[13px] font-semibold transition ${
                    priority.includes(p)
                      ? 'border-aqua-500 bg-aqua-50 text-aqua-800'
                      : 'border-sand-300 bg-white text-sand-400 hover:border-sand-400'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-sand-200 pt-3">
          <Toggle label="Showroom only" checked={showroomOnly} onChange={setShowroomOnly} />
          <Toggle label="Already sells spas" checked={spaOnly} onChange={setSpaOnly} />
          <Toggle label="Has a decision maker" checked={withContact} onChange={setWithContact} />
          <Toggle label="Include excluded" checked={includeExcluded} onChange={setIncludeExcluded} />

          <div className="ml-auto flex items-center gap-2">
            <span className="tnum text-2xs text-sand-400">
              {loading ? 'Loading…' : `${rows.length} of ${total} shown`}
            </span>
            <a href={exportHref('csv')} className="btn-ghost btn-sm">CSV</a>
            <a href={exportHref('xlsx')} className="btn-ghost btn-sm">XLSX</a>
            <a href={exportHref('mymaps')} className="btn-ghost btn-sm" title="Google My Maps-compatible CSV">
              My Maps
            </a>
          </div>
        </div>
      </Card>

      {error ? <Banner tone="error" title="Could not load companies">{error}</Banner> : null}

      <Card className="overflow-hidden">
        <div className="max-h-[calc(100vh-22rem)] overflow-auto">
          <table className="table-dense w-full">
            <thead>
              <tr>
                {COLUMNS.map((col) => (
                  <th key={col.key} className={col.className}>
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className="inline-flex items-center gap-1 hover:text-aqua-700"
                      >
                        {col.label}
                        <SortMark active={sort === col.key} dir={dir} />
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {COLUMNS.map((c) => (
                      <td key={c.key}><div className="skeleton h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length}>
                    <EmptyState
                      title="No companies match these filters"
                      description="Loosen the filters, or run a new prospect search for this market."
                      action={<Link href="/search" className="btn-accent btn-sm">New search</Link>}
                    />
                  </td>
                </tr>
              ) : (
                rows.map((c) => (
                  <tr key={c.id} className={c.isExcluded ? 'bg-rose-50/40' : undefined}>
                    <td className="max-w-[18rem]">
                      <Link href={`/companies/${c.id}`} className="block truncate font-medium text-ink-900 hover:text-aqua-700">
                        {c.name}
                      </Link>
                      <p className="truncate text-2xs text-sand-400">
                        {c.countryName}
                        {c.isExcluded ? ` · EXCLUDED (${c.exclusionKind})` : ''}
                      </p>
                    </td>
                    <td className="text-ink-700"><Value>{c.city}</Value></td>
                    <td><ScoreCell score={c.score} priority={c.priority} /></td>
                    <td><PriorityBadge priority={c.priority} /></td>
                    <td className="tnum text-ink-700">
                      <Value>{c.googleRating !== null ? c.googleRating.toFixed(1) : null}</Value>
                    </td>
                    <td className="tnum text-ink-700"><Value>{c.googleReviewCount}</Value></td>
                    <td className="max-w-[14rem]">
                      <Value>
                        {c.brands.length > 0 ? (
                          <span className="block truncate" title={c.brands.join(', ')}>
                            {c.brands.join(', ')}
                          </span>
                        ) : null}
                      </Value>
                    </td>
                    <td><TristateBadge value={c.showroom} /></td>
                    <td className="max-w-[12rem]">
                      <Value>
                        {c.website ? (
                          <a
                            href={c.website}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="block truncate text-aqua-700 hover:underline"
                          >
                            {hostOf(c.website)}
                          </a>
                        ) : null}
                      </Value>
                    </td>
                    <td className="whitespace-nowrap text-ink-700"><Value>{c.phone}</Value></td>
                    <td className="max-w-[13rem]">
                      <Value>
                        {c.decisionMakers.length > 0 ? (
                          <span className="block truncate" title={c.decisionMakers.map((d) => `${d.fullName} — ${d.position ?? 'UNKNOWN'}`).join('; ')}>
                            {c.decisionMakers[0].fullName}
                            {c.decisionMakers.length > 1 ? ` +${c.decisionMakers.length - 1}` : ''}
                          </span>
                        ) : null}
                      </Value>
                    </td>
                    <td><CrmBadge status={c.crmStatus} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Toggle({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-800">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-sand-300 text-aqua-600 focus:ring-aqua-500/30"
      />
      {label}
    </label>
  );
}

function SortMark({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <span className="text-sand-300">↕</span>;
  return <span className="text-aqua-600">{dir === 'asc' ? '↑' : '↓'}</span>;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
