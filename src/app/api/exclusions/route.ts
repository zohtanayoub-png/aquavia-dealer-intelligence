import { z } from 'zod';
import { prisma } from '@/lib/db';
import { handleError, ok } from '@/lib/api';
import { buildNameKey } from '@/lib/exclusions/match';
import { extractDomain } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const CreateSchema = z.object({
  kind: z.enum(['EXISTING_DEALER', 'ACTIVE_NEGOTIATION', 'DO_NOT_CONTACT', 'KNOWN_COMPETITOR']),
  name: z.string().min(2),
  countryCode: z.string().length(2).nullable().optional(),
  city: z.string().nullable().optional(),
  domain: z.string().nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
});

export async function GET(request: Request) {
  try {
    const kind = new URL(request.url).searchParams.get('kind');
    const entries = await prisma.exclusionEntry.findMany({
      where: kind ? { kind: kind as never } : undefined,
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
    });
    return ok(entries);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: Request) {
  try {
    const body = CreateSchema.parse(await request.json());
    const entry = await prisma.exclusionEntry.create({
      data: {
        kind: body.kind,
        name: body.name.trim(),
        nameKey: buildNameKey(body.name),
        countryCode: body.countryCode?.toUpperCase() ?? null,
        city: body.city?.trim() || null,
        domain: extractDomain(body.domain ?? null),
        note: body.note?.trim() || null,
      },
    });

    // Apply the new rule to companies already in the database, so adding an
    // exclusion retroactively cleans the pipeline instead of only affecting
    // future searches.
    const affected = await prisma.company.updateMany({
      where: {
        isExcluded: false,
        OR: [
          ...(entry.domain ? [{ websiteDomain: entry.domain }] : []),
          {
            name: { equals: entry.name, mode: 'insensitive' as const },
            ...(entry.countryCode ? { countryCode: entry.countryCode } : {}),
          },
        ],
      },
      data: {
        isExcluded: true,
        exclusionKind: entry.kind,
        exclusionNote: `Matched exclusion list entry "${entry.name}".`,
      },
    });

    return ok({ entry, retroactivelyFlagged: affected.count }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
