'use client';

import dynamic from 'next/dynamic';
import type { MapPoint } from '@/components/map/ProspectMap';

/**
 * Leaflet reads `window` at import time, so the map is loaded client-side only.
 * The skeleton keeps the layout stable while the bundle arrives.
 */
const ProspectMap = dynamic(
  () => import('@/components/map/ProspectMap').then((m) => m.ProspectMap),
  {
    ssr: false,
    loading: () => (
      <div className="card h-[calc(100vh-16rem)] min-h-[26rem] w-full animate-pulse bg-sand-100" />
    ),
  },
);

export function MapClient({ points }: { points: MapPoint[] }) {
  return <ProspectMap points={points} />;
}
