import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center">
      <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-sand-400">404</p>
      <h1 className="text-lg font-semibold text-ink-900">That page does not exist</h1>
      <p className="max-w-md text-[13px] text-sand-400">
        The company or page you are looking for may have been removed, or the link may be wrong.
      </p>
      <Link href="/" className="btn-accent mt-2">Back to dashboard</Link>
    </div>
  );
}
