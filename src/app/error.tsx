'use client';

import { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  const isDatabase = /database|prisma|connect|ECONNREFUSED|DATABASE_URL/i.test(error.message);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center">
      <h1 className="text-lg font-semibold text-ink-900">Something went wrong</h1>
      <p className="max-w-xl text-[13px] leading-relaxed text-sand-400">{error.message}</p>
      {isDatabase ? (
        <p className="max-w-xl rounded-lg border border-amber-300/70 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          This looks like a database connection problem. Check that <code>DATABASE_URL</code> is set
          and that migrations have been applied with <code>npm run db:deploy</code>.
        </p>
      ) : null}
      <button type="button" onClick={reset} className="btn-accent mt-2">Try again</button>
    </div>
  );
}
