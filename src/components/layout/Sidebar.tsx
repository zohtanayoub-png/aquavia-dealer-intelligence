'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

const NAV = [
  { href: '/', label: 'Dashboard', icon: IconDashboard, exact: true },
  { href: '/search', label: 'New Search', icon: IconSearch },
  { href: '/companies', label: 'Companies', icon: IconCompanies },
  { href: '/contacts', label: 'Contacts', icon: IconContacts },
  { href: '/map', label: 'Map', icon: IconMap },
  { href: '/markets', label: 'Markets', icon: IconMarkets },
  { href: '/settings', label: 'Settings', icon: IconSettings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-ink-800 bg-ink-900">
      <div className="border-b border-ink-800/80 px-5 py-5">
        <Link href="/" className="block">
          <div className="flex items-center gap-2">
            <WaveMark />
            <span className="text-sm font-semibold tracking-[0.14em] text-white">AQUAVIA</span>
          </div>
          <p className="mt-1.5 text-2xs uppercase tracking-[0.16em] text-aqua-300/70">
            Dealer Intelligence
          </p>
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 px-2.5 py-4">
        {NAV.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition',
                active
                  ? 'bg-ink-800 font-medium text-white'
                  : 'text-sand-300/70 hover:bg-ink-800/60 hover:text-white',
              )}
            >
              {active ? (
                <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-aqua-400" />
              ) : null}
              <Icon className={clsx('h-4 w-4', active ? 'text-aqua-300' : 'text-sand-400/60 group-hover:text-aqua-300')} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-ink-800/80 px-5 py-4">
        <p className="text-2xs leading-relaxed text-sand-400/60">
          IBERSPA S.L. — international B2B dealer prospecting.
        </p>
      </div>
    </aside>
  );
}

function WaveMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <path d="M2 15c2.5 0 2.5-2.4 5-2.4S9.5 15 12 15s2.5-2.4 5-2.4 2.5 2.4 5 2.4" stroke="#5FDBC2" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M2 19.5c2.5 0 2.5-2.4 5-2.4s2.5 2.4 5 2.4 2.5-2.4 5-2.4 2.5 2.4 5 2.4" stroke="#12A78C" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="6.5" r="3" stroke="#9BEBD9" strokeWidth="1.8" />
    </svg>
  );
}

type IconProps = { className?: string };

function IconDashboard({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" aria-hidden>
      <rect x="2.5" y="2.5" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
      <rect x="11.5" y="2.5" width="6" height="9" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
      <rect x="2.5" y="11.5" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
      <rect x="11.5" y="14.5" width="6" height="3" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
function IconSearch({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" aria-hidden>
      <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="m13.5 13.5 3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function IconCompanies({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" aria-hidden>
      <path d="M3 17V5.5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1V17" stroke="currentColor" strokeWidth="1.4" />
      <path d="M11 9h5a1 1 0 0 1 1 1v7" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 17h16M5.5 7.5h3M5.5 10.5h3M5.5 13.5h3M13.5 12h1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function IconContacts({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" aria-hidden>
      <circle cx="8" cy="7" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 16.5c0-2.8 2.5-4.5 5.5-4.5s5.5 1.7 5.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M14.5 6.5h3M14.5 9.5h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function IconMap({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" aria-hidden>
      <path d="M2.5 5.5 7 3.5v11l-4.5 2v-11ZM7 3.5l6 2v11l-6-2M13 5.5l4.5-2v11l-4.5 2" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}
function IconMarkets({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" aria-hidden>
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 10h15M10 2.5c2 2.2 3 4.8 3 7.5s-1 5.3-3 7.5c-2-2.2-3-4.8-3-7.5s1-5.3 3-7.5Z" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
function IconSettings({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" aria-hidden>
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4M15.3 15.3l-1.4-1.4M6.1 6.1 4.7 4.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
