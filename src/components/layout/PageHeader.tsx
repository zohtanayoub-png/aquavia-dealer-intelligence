import type { ReactNode } from 'react';

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-sand-200 bg-white px-6 py-4">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-tight text-ink-900">{title}</h1>
        {description ? (
          <p className="mt-0.5 max-w-3xl text-[13px] leading-relaxed text-sand-400">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
