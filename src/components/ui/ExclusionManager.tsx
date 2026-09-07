'use client';

import { useCallback, useEffect, useState } from 'react';
import { Banner, Card, CardHeader, EmptyState } from '@/components/ui/primitives';

interface Entry {
  id: string;
  kind: string;
  name: string;
  countryCode: string | null;
  city: string | null;
  domain: string | null;
  note: string | null;
}

const KINDS = [
  { value: 'EXISTING_DEALER', label: 'Existing Aquavia dealers', help: 'Already selling Aquavia — never prospect again.' },
  { value: 'ACTIVE_NEGOTIATION', label: 'Active negotiations', help: 'Being handled by someone else right now.' },
  { value: 'DO_NOT_CONTACT', label: 'Do not contact', help: 'Explicitly off-limits.' },
  { value: 'KNOWN_COMPETITOR', label: 'Known competitors', help: 'Competing manufacturers, not prospects.' },
];

export function ExclusionManager({ countries }: { countries: { code: string; name: string }[] }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [kind, setKind] = useState(KINDS[0].value);
  const [name, setName] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [city, setCity] = useState('');
  const [domain, setDomain] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/exclusions', { cache: 'no-store' });
      const json = await res.json();
      if (json.ok) setEntries(json.data);
      else setError(json.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/exclusions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind, name: name.trim(),
          countryCode: countryCode || null,
          city: city.trim() || null,
          domain: domain.trim() || null,
          note: note.trim() || null,
        }),
      });
      const json = await res.json();
      if (!json.ok) { setError(json.error); return; }
      setNotice(
        json.data.retroactivelyFlagged > 0
          ? `Added. ${json.data.retroactivelyFlagged} existing company/companies were flagged as excluded.`
          : 'Added. Future searches will flag any match.',
      );
      setName(''); setCity(''); setDomain(''); setNote('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/exclusions/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.ok) { setError(json.error); return; }
      setNotice(json.data.restored > 0 ? `Removed. ${json.data.restored} company/companies returned to the pipeline.` : 'Removed.');
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? <Banner tone="error" title="Exclusion list error">{error}</Banner> : null}
      {notice ? <Banner tone="success" title="Exclusion list updated">{notice}</Banner> : null}

      <Card>
        <CardHeader
          title="Add an exclusion"
          subtitle="Matched on website domain first, then on company name within a country"
        />
        <form onSubmit={add} className="grid gap-3 p-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="kind" className="label">List</label>
            <select id="kind" value={kind} onChange={(e) => setKind(e.target.value)} className="field mt-1.5">
              {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
            <p className="mt-1 text-2xs text-sand-400">{KINDS.find((k) => k.value === kind)?.help}</p>
          </div>

          <div>
            <label htmlFor="ename" className="label">Company name <span className="text-rose-500">*</span></label>
            <input id="ename" required value={name} onChange={(e) => setName(e.target.value)} className="field mt-1.5" placeholder="e.g. Piscinas Ejemplo S.L." />
          </div>

          <div>
            <label htmlFor="edomain" className="label">Website domain</label>
            <input id="edomain" value={domain} onChange={(e) => setDomain(e.target.value)} className="field mt-1.5" placeholder="ejemplo.com" />
          </div>

          <div>
            <label htmlFor="ecountry" className="label">Country</label>
            <select id="ecountry" value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className="field mt-1.5">
              <option value="">Any country (global rule)</option>
              {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="ecity" className="label">City</label>
            <input id="ecity" value={city} onChange={(e) => setCity(e.target.value)} className="field mt-1.5" />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="enote" className="label">Note</label>
            <input id="enote" value={note} onChange={(e) => setNote(e.target.value)} className="field mt-1.5" placeholder="Why is this company excluded?" />
          </div>

          <div className="md:col-span-2">
            <button type="submit" className="btn-primary" disabled={busy || !name.trim()}>Add to list</button>
          </div>
        </form>
      </Card>

      {KINDS.map((k) => {
        const list = entries.filter((e) => e.kind === k.value);
        return (
          <Card key={k.value}>
            <CardHeader title={k.label} subtitle={`${list.length} entry/entries`} />
            {list.length === 0 ? (
              <EmptyState title="Empty list" description={k.help} />
            ) : (
              <ul className="divide-y divide-sand-200">
                {list.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-ink-900">{entry.name}</p>
                      <p className="truncate text-2xs text-sand-400">
                        {[entry.domain, entry.city, entry.countryCode ?? 'global'].filter(Boolean).join(' · ')}
                        {entry.note ? ` — ${entry.note}` : ''}
                      </p>
                    </div>
                    <button type="button" onClick={() => remove(entry.id)} className="btn-ghost btn-sm shrink-0" disabled={busy}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}
