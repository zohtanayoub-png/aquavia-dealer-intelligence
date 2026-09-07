/**
 * Google My Maps export.
 *
 * My Maps imports CSV and geocodes from explicit Latitude/Longitude columns.
 * Companies with no coordinates cannot be placed on a map, so they are
 * reported back to the caller rather than exported as invisible rows.
 */
import { toCsv } from '@/lib/export/csv';
import type { ExportCompany } from '@/lib/export/columns';

export interface MyMapsExport {
  csv: string;
  includedCount: number;
  /** Names skipped because latitude/longitude are UNKNOWN. */
  skipped: string[];
}

export function toGoogleMyMapsCsv(companies: ExportCompany[]): MyMapsExport {
  const mappable = companies.filter(
    (c) => typeof c.latitude === 'number' && typeof c.longitude === 'number',
  );
  const skipped = companies
    .filter((c) => typeof c.latitude !== 'number' || typeof c.longitude !== 'number')
    .map((c) => c.name);

  return {
    csv: toCsv(mappable, 'googleMyMaps'),
    includedCount: mappable.length,
    skipped,
  };
}
