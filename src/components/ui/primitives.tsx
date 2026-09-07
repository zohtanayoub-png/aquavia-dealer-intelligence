import type { ReactNode } from 'react';
import clsx from 'clsx';

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={clsx('card', className)}>{children}</section>;
}

export function CardHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="card-header">
      <div className="min-w-0">
        <h2 className="card-title">{title}</h2>
        {subtitle ? <p className="mt-0.5 truncate text-xs text-sand-400">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

const PRIORITY_STYLES: Record<string, string> = {
  A: 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-600/20',
  B: 'bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-600/20',
  C: 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/20',
  D: 'bg-sand-100 text-sand-400 ring-1 ring-inset ring-sand-300',
};

export const PRIORITY_TEXT: Record<string, string> = {
  A: 'HIGH PRIORITY',
  B: 'GOOD PROSPECT',
  C: 'SECONDARY',
  D: 'LOW PRIORITY',
};

export function PriorityBadge({ priority, showLabel = false }: { priority: string; showLabel?: boolean }) {
  return (
    <span className={clsx('chip', PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.D)}>
      {priority}
      {showLabel ? <span className="font-medium normal-case tracking-normal">{PRIORITY_TEXT[priority]}</span> : null}
    </span>
  );
}

/** Score with an inline bar — the number and its magnitude read together. */
export function ScoreCell({ score, priority }: { score: number; priority: string }) {
  const colour =
    priority === 'A' ? 'bg-emerald-500'
    : priority === 'B' ? 'bg-sky-500'
    : priority === 'C' ? 'bg-amber-500'
    : 'bg-sand-300';
  return (
    <div className="flex items-center gap-2">
      <span className="tnum w-7 text-right text-[13px] font-semibold text-ink-900">{score}</span>
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-sand-200">
        <span className={clsx('block h-full rounded-full', colour)} style={{ width: `${score}%` }} />
      </span>
    </div>
  );
}

/**
 * The UNKNOWN renderer.
 * Used everywhere a value may be unverified, so the interface states the gap
 * rather than showing an empty cell that reads like a bug.
 */
export function Value({
  children,
  title,
}: {
  children: ReactNode | null | undefined;
  title?: string;
}) {
  const empty =
    children === null ||
    children === undefined ||
    children === '' ||
    (Array.isArray(children) && children.length === 0);
  if (empty) return <span className="unknown" title={title ?? 'Not verified from any source'}>UNKNOWN</span>;
  return <>{children}</>;
}

const TRISTATE_STYLES: Record<string, string> = {
  YES: 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-600/20',
  NO: 'bg-rose-50 text-rose-800 ring-1 ring-inset ring-rose-600/20',
  UNKNOWN: 'bg-sand-100 text-sand-400 ring-1 ring-inset ring-sand-300',
};

export function TristateBadge({ value, label }: { value: string; label?: string }) {
  return (
    <span className={clsx('chip', TRISTATE_STYLES[value] ?? TRISTATE_STYLES.UNKNOWN)}>
      {label ? <span className="font-medium normal-case tracking-normal">{label}:</span> : null}
      {value}
    </span>
  );
}

export const CRM_STATUSES = [
  'NEW', 'TO_CONTACT', 'CONTACTED', 'REPLIED', 'MEETING', 'QUALIFIED',
  'NEGOTIATING', 'DEALER', 'NOT_INTERESTED', 'DO_NOT_CONTACT',
] as const;

export type CrmStatus = (typeof CRM_STATUSES)[number];

const CRM_STYLES: Record<string, string> = {
  NEW: 'bg-sand-100 text-ink-700 ring-1 ring-inset ring-sand-300',
  TO_CONTACT: 'bg-indigo-50 text-indigo-800 ring-1 ring-inset ring-indigo-600/20',
  CONTACTED: 'bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-600/20',
  REPLIED: 'bg-cyan-50 text-cyan-800 ring-1 ring-inset ring-cyan-600/20',
  MEETING: 'bg-violet-50 text-violet-800 ring-1 ring-inset ring-violet-600/20',
  QUALIFIED: 'bg-teal-50 text-teal-800 ring-1 ring-inset ring-teal-600/20',
  NEGOTIATING: 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/20',
  DEALER: 'bg-emerald-100 text-emerald-900 ring-1 ring-inset ring-emerald-600/30',
  NOT_INTERESTED: 'bg-sand-100 text-sand-400 ring-1 ring-inset ring-sand-300',
  DO_NOT_CONTACT: 'bg-rose-50 text-rose-800 ring-1 ring-inset ring-rose-600/20',
};

export function CrmBadge({ status }: { status: string }) {
  return (
    <span className={clsx('chip', CRM_STYLES[status] ?? CRM_STYLES.NEW)}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

const ACTION_STYLES: Record<string, string> = {
  VISIT: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  CALL: 'bg-sky-50 text-sky-800 ring-sky-600/20',
  EMAIL: 'bg-indigo-50 text-indigo-800 ring-indigo-600/20',
  LINKEDIN: 'bg-blue-50 text-blue-800 ring-blue-600/20',
  QUALIFY_FIRST: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  LOW_PRIORITY: 'bg-sand-100 text-sand-400 ring-sand-300',
};

export function ActionBadge({ action }: { action: string }) {
  return (
    <span className={clsx('chip ring-1 ring-inset', ACTION_STYLES[action] ?? ACTION_STYLES.LOW_PRIORITY)}>
      {action.replace(/_/g, ' ')}
    </span>
  );
}

export function ConfidenceDot({ confidence }: { confidence: string }) {
  const colour =
    confidence === 'HIGH' ? 'bg-emerald-500'
    : confidence === 'MEDIUM' ? 'bg-amber-500'
    : confidence === 'LOW' ? 'bg-rose-400'
    : 'bg-sand-300';
  return (
    <span className="inline-flex items-center gap-1.5" title={`Confidence: ${confidence}`}>
      <span className={clsx('h-1.5 w-1.5 rounded-full', colour)} />
      <span className="text-2xs uppercase tracking-wide text-sand-400">{confidence}</span>
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <h3 className="text-sm font-semibold text-ink-800">{title}</h3>
      <p className="max-w-md text-[13px] leading-relaxed text-sand-400">{description}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  accent?: 'a' | 'b' | 'c' | 'd' | 'neutral';
}) {
  const bar =
    accent === 'a' ? 'bg-emerald-500'
    : accent === 'b' ? 'bg-sky-500'
    : accent === 'c' ? 'bg-amber-500'
    : accent === 'd' ? 'bg-sand-300'
    : 'bg-aqua-500';
  return (
    <div className="card relative overflow-hidden px-4 py-3.5">
      <span className={clsx('absolute inset-y-0 left-0 w-0.5', bar)} />
      <p className="label">{label}</p>
      <p className="tnum mt-1 text-2xl font-semibold tracking-tight text-ink-900">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-sand-400">{sub}</p> : null}
    </div>
  );
}

export function Banner({
  tone,
  title,
  children,
}: {
  tone: 'warning' | 'error' | 'info' | 'success';
  title: string;
  children?: ReactNode;
}) {
  const styles = {
    warning: 'border-amber-300/70 bg-amber-50 text-amber-900',
    error: 'border-rose-300/70 bg-rose-50 text-rose-900',
    info: 'border-sky-300/70 bg-sky-50 text-sky-900',
    success: 'border-emerald-300/70 bg-emerald-50 text-emerald-900',
  }[tone];
  return (
    <div className={clsx('rounded-lg border px-4 py-3 text-[13px] leading-relaxed', styles)}>
      <p className="font-semibold">{title}</p>
      {children ? <div className="mt-1 opacity-90">{children}</div> : null}
    </div>
  );
}
