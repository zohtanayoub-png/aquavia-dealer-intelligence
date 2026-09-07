'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { Map as LeafletMap, CircleMarker, LayerGroup } from 'leaflet';
import { Card, EmptyState } from '@/components/ui/primitives';
import 'leaflet/dist/leaflet.css';

export interface MapPoint {
  id: string;
  name: string;
  city: string | null;
  countryName: string;
  latitude: number;
  longitude: number;
  score: number;
  priority: string;
  crmStatus: string;
  isExcluded: boolean;
  googleRating: number | null;
  googleReviewCount: number | null;
  phone: string | null;
  website: string | null;
  competitorBrands: string[];
  showroom: string;
}

/** Marker categories required by the brief, each visually distinct. */
type Category = 'A' | 'B' | 'C' | 'DEALER' | 'EXCLUDED' | 'OTHER';

const CATEGORY_STYLE: Record<Category, { colour: string; label: string; radius: number }> = {
  A: { colour: '#0F9D6E', label: 'Priority A', radius: 9 },
  B: { colour: '#2A7FB8', label: 'Priority B', radius: 8 },
  C: { colour: '#D9A02B', label: 'Priority C', radius: 7 },
  DEALER: { colour: '#7C3AED', label: 'Existing dealer', radius: 10 },
  EXCLUDED: { colour: '#E11D48', label: 'Excluded', radius: 7 },
  OTHER: { colour: '#8A9199', label: 'Priority D / other', radius: 6 },
};

function categorise(point: MapPoint): Category {
  if (point.crmStatus === 'DEALER') return 'DEALER';
  if (point.isExcluded) return 'EXCLUDED';
  if (point.priority === 'A') return 'A';
  if (point.priority === 'B') return 'B';
  if (point.priority === 'C') return 'C';
  return 'OTHER';
}

export function ProspectMap({ points }: { points: MapPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const [selected, setSelected] = useState<MapPoint | null>(null);
  const [hidden, setHidden] = useState<Set<Category>>(new Set());
  const [ready, setReady] = useState(false);

  const visible = useMemo(
    () => points.filter((p) => !hidden.has(categorise(p))),
    [points, hidden],
  );

  // Leaflet touches `window`, so it is imported only in the browser.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = await import('leaflet');
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
        attributionControl: true,
      }).setView([25, 5], 2);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
      setReady(true);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    (async () => {
      const L = await import('leaflet');
      const map = mapRef.current;
      const layer = layerRef.current;
      if (cancelled || !map || !layer) return;

      layer.clearLayers();

      const markers: CircleMarker[] = [];
      for (const point of visible) {
        const style = CATEGORY_STYLE[categorise(point)];
        const marker = L.circleMarker([point.latitude, point.longitude], {
          radius: style.radius,
          color: '#ffffff',
          weight: 1.5,
          fillColor: style.colour,
          fillOpacity: 0.88,
        });
        marker.on('click', () => setSelected(point));
        marker.bindTooltip(`${point.name} — ${point.score}`, { direction: 'top', offset: [0, -6] });
        marker.addTo(layer);
        markers.push(marker);
      }

      if (markers.length > 0) {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 12 });
      }
    })();

    return () => { cancelled = true; };
  }, [visible, ready]);

  function toggle(category: Category) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  const counts = useMemo(() => {
    const map = new Map<Category, number>();
    for (const p of points) {
      const c = categorise(p);
      map.set(c, (map.get(c) ?? 0) + 1);
    }
    return map;
  }, [points]);

  if (points.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No mappable prospects"
          description="Companies appear on the map once Google Places has supplied coordinates. Run a search to populate this view."
          action={<Link href="/search" className="btn-accent btn-sm">New search</Link>}
        />
      </Card>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <Card className="overflow-hidden">
        <div ref={containerRef} className="h-[calc(100vh-16rem)] min-h-[26rem] w-full bg-sand-100" />
      </Card>

      <div className="space-y-4">
        <Card>
          <div className="border-b border-sand-200 px-4 py-3">
            <h2 className="card-title">Legend</h2>
            <p className="mt-0.5 text-2xs text-sand-400">Click a category to show or hide it</p>
          </div>
          <ul className="p-2">
            {(Object.keys(CATEGORY_STYLE) as Category[]).map((category) => {
              const style = CATEGORY_STYLE[category];
              const off = hidden.has(category);
              return (
                <li key={category}>
                  <button
                    type="button"
                    onClick={() => toggle(category)}
                    className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition hover:bg-sand-50 ${off ? 'opacity-40' : ''}`}
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white"
                      style={{ backgroundColor: style.colour }}
                    />
                    <span className="flex-1 text-[13px] text-ink-800">{style.label}</span>
                    <span className="tnum text-2xs text-sand-400">{counts.get(category) ?? 0}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <div className="border-b border-sand-200 px-4 py-3">
            <h2 className="card-title">Selected company</h2>
          </div>
          {selected ? (
            <div className="space-y-3 p-4">
              <div>
                <Link href={`/companies/${selected.id}`} className="text-[15px] font-semibold text-ink-900 hover:text-aqua-700">
                  {selected.name}
                </Link>
                <p className="text-xs text-sand-400">
                  {[selected.city, selected.countryName].filter(Boolean).join(', ')}
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-3 text-[13px]">
                <div><dt className="label">Score</dt><dd className="tnum font-semibold text-ink-900">{selected.score} ({selected.priority})</dd></div>
                <div><dt className="label">Status</dt><dd className="text-ink-800">{selected.crmStatus.replace(/_/g, ' ')}</dd></div>
                <div>
                  <dt className="label">Rating</dt>
                  <dd className="tnum text-ink-800">
                    {selected.googleRating !== null ? `${selected.googleRating.toFixed(1)} (${selected.googleReviewCount ?? 0})` : <span className="unknown">UNKNOWN</span>}
                  </dd>
                </div>
                <div>
                  <dt className="label">Showroom</dt>
                  <dd className="text-ink-800">{selected.showroom}</dd>
                </div>
              </dl>

              <div>
                <dt className="label">Competitor brands</dt>
                <dd className="mt-0.5 text-[13px] text-ink-800">
                  {selected.competitorBrands.length > 0
                    ? selected.competitorBrands.join(', ')
                    : <span className="unknown">UNKNOWN</span>}
                </dd>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {selected.phone ? <a href={`tel:${selected.phone}`} className="btn-ghost btn-sm">Call</a> : null}
                {selected.website ? (
                  <a href={selected.website} target="_blank" rel="noreferrer noopener" className="btn-ghost btn-sm">Website</a>
                ) : null}
                <Link href={`/companies/${selected.id}`} className="btn-accent btn-sm">Open profile</Link>
              </div>
            </div>
          ) : (
            <p className="px-4 py-8 text-center text-[13px] text-sand-400">
              Click any point on the map to see company information here.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
