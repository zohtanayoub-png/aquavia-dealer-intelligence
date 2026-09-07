import { prisma } from '@/lib/db';
import { fail, handleError } from '@/lib/api';
import { buildOrderBy, buildWhere, parseFilters } from '@/lib/companyQuery';
import { toCsv } from '@/lib/export/csv';
import { toXlsx } from '@/lib/export/xlsx';
import { toGoogleMyMapsCsv } from '@/lib/export/googleMyMaps';
import type { ExportCompany } from '@/lib/export/columns';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Export the current filtered selection.
 *
 * `format` = csv | xlsx | mymaps
 * All company filters from the table are honoured, so "export what I see"
 * genuinely exports what the user is looking at.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const format = (url.searchParams.get('format') ?? 'csv').toLowerCase();
    const filters = parseFilters(url.searchParams);

    const companies = (await prisma.company.findMany({
      where: buildWhere(filters),
      orderBy: buildOrderBy(filters),
      include: { decisionMakers: true },
      take: 5000,
    })) as ExportCompany[];

    if (companies.length === 0) {
      return fail('No companies match the current filters, so there is nothing to export.', 404);
    }

    const stamp = new Date().toISOString().slice(0, 10);
    const scope = filters.country ? `-${filters.country.toUpperCase()}` : '';

    if (format === 'xlsx') {
      const buffer = await toXlsx(companies, 'full');
      return new Response(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="aquavia-prospects${scope}-${stamp}.xlsx"`,
        },
      });
    }

    if (format === 'mymaps') {
      const result = toGoogleMyMapsCsv(companies);
      if (result.includedCount === 0) {
        return fail(
          'None of the selected companies have coordinates, so a Google My Maps import would be empty.',
          422,
        );
      }
      return new Response(result.csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="aquavia-google-my-maps${scope}-${stamp}.csv"`,
          // Surfaced in the UI so silently-dropped rows are never a surprise.
          'X-Skipped-Count': String(result.skipped.length),
        },
      });
    }

    if (format === 'csv') {
      return new Response(toCsv(companies, 'full'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="aquavia-prospects${scope}-${stamp}.csv"`,
        },
      });
    }

    return fail(`Unsupported export format "${format}". Use csv, xlsx or mymaps.`, 400);
  } catch (err) {
    return handleError(err);
  }
}
