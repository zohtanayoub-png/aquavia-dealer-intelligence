'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CRM_STATUSES } from '@/components/ui/primitives';

export function CrmPanel({
  companyId,
  initial,
}: {
  companyId: string;
  initial: {
    crmStatus: string;
    salesNotes: string | null;
    lastContactAt: string | null;
    nextFollowUpAt: string | null;
    ownerName: string | null;
  };
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initial.crmStatus);
  const [notes, setNotes] = useState(initial.salesNotes ?? '');
  const [lastContact, setLastContact] = useState(initial.lastContactAt?.slice(0, 10) ?? '');
  const [followUp, setFollowUp] = useState(initial.nextFollowUpAt?.slice(0, 10) ?? '');
  const [owner, setOwner] = useState(initial.ownerName ?? '');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setState('saving');
    setMessage(null);
    try {
      const res = await fetch(`/api/companies/${companyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crmStatus: status,
          salesNotes: notes.trim() || null,
          ownerName: owner.trim() || null,
          lastContactAt: lastContact ? new Date(`${lastContact}T12:00:00Z`).toISOString() : null,
          nextFollowUpAt: followUp ? new Date(`${followUp}T12:00:00Z`).toISOString() : null,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setState('error');
        setMessage(json.error ?? 'Could not save.');
        return;
      }
      setState('saved');
      router.refresh();
      setTimeout(() => setState('idle'), 2000);
    } catch (err) {
      setState('error');
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="space-y-3 p-4">
      <div>
        <label htmlFor="status" className="label">Status</label>
        <select id="status" value={status} onChange={(e) => setStatus(e.target.value)} className="field mt-1.5">
          {CRM_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="lastContact" className="label">Last contact</label>
          <input id="lastContact" type="date" value={lastContact} onChange={(e) => setLastContact(e.target.value)} className="field mt-1.5" />
        </div>
        <div>
          <label htmlFor="followUp" className="label">Next follow-up</label>
          <input id="followUp" type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} className="field mt-1.5" />
        </div>
      </div>

      <div>
        <label htmlFor="owner" className="label">Owner</label>
        <input id="owner" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Area manager" className="field mt-1.5" />
      </div>

      <div>
        <label htmlFor="notes" className="label">Sales notes</label>
        <textarea
          id="notes"
          rows={6}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Call outcomes, pricing discussed, next steps…"
          className="field mt-1.5 resize-y"
        />
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={save} className="btn-primary" disabled={state === 'saving'}>
          {state === 'saving' ? 'Saving…' : 'Save'}
        </button>
        {state === 'saved' ? <span className="text-2xs font-medium text-emerald-700">Saved</span> : null}
        {state === 'error' ? <span className="text-2xs font-medium text-rose-700">{message}</span> : null}
      </div>
    </div>
  );
}
