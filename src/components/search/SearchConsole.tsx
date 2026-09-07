'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Banner, Card, CardHeader } from '@/components/ui/primitives';

interface Country {
  code: string;
  name: string;
  languages: string[];
}

interface RunState {
  runId: string;
  status: string;
  phase: string;
  cursor: number;
  totalSteps: number;
  done: boolean;
  message: string;
  discoveredCount: number;
  newCount: number;
  enrichedCount: number;
  excludedCount: number;
  warnings: string[];
}

interface LogLine {
  id: string;
  level: string;
  message: string;
  at: string;
}

export function SearchConsole({
  countries,
  discoveryReady,
  researchReady,
  initialRunId,
}: {
  countries: Country[];
  discoveryReady: boolean;
  researchReady: boolean;
  initialRunId?: string;
}) {
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [depth, setDepth] = useState<'QUICK' | 'DEEP'>('QUICK');
  const [run, setRun] = useState<RunState | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // A ref guard stops React 18 double-effects from launching two step loops.
  const running = useRef(false);

  const pumpLogs = useCallback(async (runId: string) => {
    try {
      const res = await fetch(`/api/runs/${runId}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.ok) setLogs(json.data.logs ?? []);
    } catch {
      // Log fetch failures are cosmetic; the run itself keeps going.
    }
  }, []);

  /** Drive the run one bounded step at a time until it reports `done`. */
  const drive = useCallback(
    async (runId: string) => {
      if (running.current) return;
      running.current = true;
      try {
        for (let guard = 0; guard < 500; guard += 1) {
          const res = await fetch(`/api/runs/${runId}/step`, { method: 'POST' });
          const json = await res.json();
          if (!json.ok) {
            setError(json.error ?? 'The search step failed.');
            break;
          }
          setRun(json.data as RunState);
          await pumpLogs(runId);
          if (json.data.done) break;
        }
      } catch (err) {
        setError(
          `Lost connection while running the search: ${err instanceof Error ? err.message : String(err)}. ` +
            'The run is saved — reopen it to continue.',
        );
      } finally {
        running.current = false;
        setBusy(false);
      }
    },
    [pumpLogs],
  );

  useEffect(() => {
    if (!initialRunId) return;
    void (async () => {
      const res = await fetch(`/api/runs/${initialRunId}`, { cache: 'no-store' });
      const json = await res.json();
      if (!json.ok) return;
      const d = json.data;
      setRun({
        runId: d.id, status: d.status, phase: d.phase, cursor: d.cursor,
        totalSteps: d.totalSteps, done: d.done, message: d.error ?? d.phase,
        discoveredCount: d.discoveredCount, newCount: d.newCount,
        enrichedCount: d.enrichedCount, excludedCount: d.excludedCount,
        warnings: d.warnings ?? [],
      });
      setLogs(d.logs ?? []);
      setCountry(d.countryCode);
      setCity(d.city ?? '');
      setDepth(d.depth);
    })();
  }, [initialRunId]);

  async function start(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLogs([]);
    setRun(null);

    if (!country) {
      setError('Country is required.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country, city: city.trim() || null, depth }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? 'Could not start the search.');
        setBusy(false);
        return;
      }
      await drive(json.data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  const progress =
    run && run.totalSteps > 0 ? Math.min(100, Math.round((run.cursor / run.totalSteps) * 100)) : 0;
  const selected = countries.find((c) => c.code === country);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <div className="space-y-4">
        <Card>
          <CardHeader title="New prospect search" subtitle="Country is required. City narrows the market." />
          <form onSubmit={start} className="space-y-4 p-4">
            <div>
              <label htmlFor="country" className="label">
                Country <span className="text-rose-500">*</span>
              </label>
              <select
                id="country"
                required
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="field mt-1.5"
                disabled={busy}
              >
                <option value="">Select a country…</option>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
              {selected ? (
                <p className="mt-1.5 text-2xs text-sand-400">
                  Search terms will be generated in:{' '}
                  <span className="font-medium text-ink-700">
                    {selected.languages.map((l) => l.toUpperCase()).join(', ')}
                  </span>
                </p>
              ) : null}
            </div>

            <div>
              <label htmlFor="city" className="label">City / Region <span className="text-sand-400">(optional)</span></label>
              <input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Casablanca"
                className="field mt-1.5"
                disabled={busy}
              />
            </div>

            <fieldset>
              <legend className="label">Search depth</legend>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {(
                  [
                    { value: 'QUICK', title: 'Quick', detail: '~5 categories, 1 language, 4 competitor brands' },
                    { value: 'DEEP', title: 'Deep', detail: '12 categories, 2 languages, all competitor brands' },
                  ] as const
                ).map((option) => (
                  <label
                    key={option.value}
                    className={`cursor-pointer rounded-md border p-3 transition ${
                      depth === option.value
                        ? 'border-aqua-500 bg-aqua-50 ring-1 ring-aqua-500/30'
                        : 'border-sand-300 bg-white hover:border-sand-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="depth"
                      value={option.value}
                      checked={depth === option.value}
                      onChange={() => setDepth(option.value)}
                      className="sr-only"
                      disabled={busy}
                    />
                    <p className="text-[13px] font-semibold text-ink-900">{option.title}</p>
                    <p className="mt-0.5 text-2xs leading-snug text-sand-400">{option.detail}</p>
                  </label>
                ))}
              </div>
            </fieldset>

            <button type="submit" className="btn-accent w-full" disabled={busy || !country}>
              {busy ? 'Prospecting…' : 'Start Prospecting'}
            </button>

            {!discoveryReady ? (
              <p className="text-2xs leading-relaxed text-amber-700">
                GOOGLE_PLACES_API_KEY is not configured. The run will start and be recorded, but no
                companies can be discovered until the key is set.
              </p>
            ) : null}
            {discoveryReady && !researchReady ? (
              <p className="text-2xs leading-relaxed text-sand-400">
                TAVILY_API_KEY is not configured — research fields will stay UNKNOWN.
              </p>
            ) : null}
          </form>
        </Card>

        {error ? <Banner tone="error" title="Search error">{error}</Banner> : null}

        {run?.warnings && run.warnings.length > 0 ? (
          <Banner tone="warning" title="Configuration warnings">
            <ul className="list-disc space-y-1 pl-4">
              {run.warnings.map((w) => <li key={w}>{w}</li>)}
            </ul>
          </Banner>
        ) : null}
      </div>

      <div className="space-y-4">
        {run ? (
          <Card>
            <CardHeader
              title="Run progress"
              subtitle={run.phase}
              actions={
                run.done ? (
                  <Link href="/companies" className="btn-accent btn-sm">View companies</Link>
                ) : (
                  <span className="chip bg-aqua-50 text-aqua-700 ring-1 ring-inset ring-aqua-500/20">Running</span>
                )
              }
            />
            <div className="space-y-4 p-4">
              <div>
                <div className="flex items-center justify-between text-2xs text-sand-400">
                  <span>{run.phase}</span>
                  <span className="tnum">{run.cursor}/{run.totalSteps || '—'}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sand-200">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      run.status === 'FAILED' ? 'bg-rose-500' : run.done ? 'bg-emerald-500' : 'bg-aqua-500'
                    }`}
                    style={{ width: `${run.done ? 100 : progress}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <Metric label="Found" value={run.discoveredCount} />
                <Metric label="New" value={run.newCount} />
                <Metric label="Enriched" value={run.enrichedCount} />
                <Metric label="Excluded" value={run.excludedCount} />
              </div>

              <p className="rounded-md bg-sand-50 px-3 py-2 text-[13px] text-ink-700">{run.message}</p>
            </div>
          </Card>
        ) : (
          <Card>
            <CardHeader title="Run progress" subtitle="Start a search to see live progress" />
            <div className="space-y-2 p-4">
              <p className="text-[13px] leading-relaxed text-sand-400">
                A search runs in three phases: discovery via Google Places using local-language
                search terms, web research to enrich each company with evidence, then scoring and
                prioritisation. Progress is saved continuously, so a run survives a page refresh.
              </p>
            </div>
          </Card>
        )}

        <Card>
          <CardHeader title="Activity log" subtitle="Every query and its result" />
          <div className="max-h-[26rem] overflow-y-auto">
            {logs.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-sand-400">No activity yet.</p>
            ) : (
              <ul className="divide-y divide-sand-200">
                {logs.map((line) => (
                  <li key={line.id} className="flex gap-3 px-4 py-2">
                    <span
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                        line.level === 'error' ? 'bg-rose-500'
                        : line.level === 'warn' ? 'bg-amber-500'
                        : 'bg-aqua-400'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] leading-snug text-ink-800">{line.message}</p>
                      <p className="tnum text-2xs text-sand-400">
                        {new Date(line.at).toLocaleTimeString()}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-sand-200 bg-sand-50 px-3 py-2">
      <p className="label">{label}</p>
      <p className="tnum mt-0.5 text-lg font-semibold text-ink-900">{value}</p>
    </div>
  );
}
