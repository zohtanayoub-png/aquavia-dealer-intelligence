'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Banner, Card, ConfidenceDot, EmptyState, PriorityBadge, Value } from '@/components/ui/primitives';

interface Contact {
  id: string;
  fullName: string;
  position: string | null;
  roleBucket: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  confidence: string;
  sourceUrl: string | null;
  company: {
    id: string;
    name: string;
    city: string | null;
    countryName: string;
    score: number;
    priority: string;
    crmStatus: string;
    phone: string | null;
  };
}

const ROLES = [
  'OWNER', 'FOUNDER', 'CEO', 'MANAGING_DIRECTOR', 'GENERAL_MANAGER',
  'COMMERCIAL_DIRECTOR', 'SALES_DIRECTOR', 'PURCHASING_DIRECTOR',
  'BUSINESS_DEVELOPMENT_DIRECTOR', 'SPA_DIVISION_MANAGER', 'POOL_DIVISION_MANAGER',
];

export function ContactsTable({ countries }: { countries: { code: string; name: string }[] }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [country, setCountry] = useState('');
  const [role, setRole] = useState('');
  const [withEmail, setWithEmail] = useState(false);
  const [withLinkedIn, setWithLinkedIn] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams();
      if (q.trim()) p.set('q', q.trim());
      if (country) p.set('country', country);
      if (role) p.set('role', role);
      if (withEmail) p.set('withEmail', 'true');
      if (withLinkedIn) p.set('withLinkedIn', 'true');

      const res = await fetch(`/api/contacts?${p.toString()}`, { cache: 'no-store' });
      const json = await res.json();
      if (!json.ok) { setError(json.error); return; }
      setContacts(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [q, country, role, withEmail, withLinkedIn]);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 220);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[16rem] flex-1">
            <label htmlFor="cq" className="label">Search</label>
            <input id="cq" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, position or company…" className="field mt-1.5" />
          </div>
          <div className="w-48">
            <label htmlFor="ccountry" className="label">Country</label>
            <select id="ccountry" value={country} onChange={(e) => setCountry(e.target.value)} className="field mt-1.5">
              <option value="">All countries</option>
              {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </div>
          <div className="w-56">
            <label htmlFor="crole" className="label">Role</label>
            <select id="crole" value={role} onChange={(e) => setRole(e.target.value)} className="field mt-1.5">
              <option value="">All roles</option>
              {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <label className="flex h-[38px] cursor-pointer items-center gap-2 text-[13px] text-ink-800">
            <input type="checkbox" checked={withEmail} onChange={(e) => setWithEmail(e.target.checked)} className="h-3.5 w-3.5 rounded border-sand-300 text-aqua-600" />
            Has email
          </label>
          <label className="flex h-[38px] cursor-pointer items-center gap-2 text-[13px] text-ink-800">
            <input type="checkbox" checked={withLinkedIn} onChange={(e) => setWithLinkedIn(e.target.checked)} className="h-3.5 w-3.5 rounded border-sand-300 text-aqua-600" />
            Has LinkedIn
          </label>
          <span className="ml-auto tnum text-2xs text-sand-400">
            {loading ? 'Loading…' : `${contacts.length} contact(s)`}
          </span>
        </div>
      </Card>

      {error ? <Banner tone="error" title="Could not load contacts">{error}</Banner> : null}

      <Card className="overflow-hidden">
        <div className="max-h-[calc(100vh-20rem)] overflow-auto">
          <table className="table-dense w-full">
            <thead>
              <tr>
                <th>Name</th><th>Position</th><th>Company</th><th>City</th>
                <th>Email</th><th>Phone</th><th>LinkedIn</th><th>Confidence</th><th>Source</th>
              </tr>
            </thead>
            <tbody>
              {contacts.length === 0 && !loading ? (
                <tr>
                  <td colSpan={9}>
                    <EmptyState
                      title="No contacts yet"
                      description="Decision makers are discovered during enrichment. They require TAVILY_API_KEY to be configured, and only public professional information is ever stored."
                      action={<Link href="/search" className="btn-accent btn-sm">Run a search</Link>}
                    />
                  </td>
                </tr>
              ) : (
                contacts.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium text-ink-900">{c.fullName}</td>
                    <td className="text-ink-700"><Value>{c.position}</Value></td>
                    <td>
                      <Link href={`/companies/${c.company.id}`} className="text-ink-900 hover:text-aqua-700">
                        {c.company.name}
                      </Link>
                      <span className="ml-2 inline-block align-middle"><PriorityBadge priority={c.company.priority} /></span>
                    </td>
                    <td className="text-ink-700"><Value>{c.company.city}</Value></td>
                    <td>
                      <Value>
                        {c.email ? <a href={`mailto:${c.email}`} className="text-aqua-700 hover:underline">{c.email}</a> : null}
                      </Value>
                    </td>
                    <td className="tnum text-ink-700"><Value>{c.phone ?? c.company.phone}</Value></td>
                    <td>
                      <Value>
                        {c.linkedinUrl ? (
                          <a href={c.linkedinUrl} target="_blank" rel="noreferrer noopener" className="text-aqua-700 hover:underline">Profile</a>
                        ) : null}
                      </Value>
                    </td>
                    <td><ConfidenceDot confidence={c.confidence} /></td>
                    <td className="max-w-[12rem]">
                      <Value>
                        {c.sourceUrl ? (
                          <a href={c.sourceUrl} target="_blank" rel="noreferrer noopener" className="block truncate text-2xs text-aqua-700 hover:underline">
                            {c.sourceUrl}
                          </a>
                        ) : null}
                      </Value>
                    </td>
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
