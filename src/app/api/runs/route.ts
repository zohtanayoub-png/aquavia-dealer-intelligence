import { z } from 'zod';
import { prisma } from '@/lib/db';
import { createRun } from '@/lib/pipeline/runner';
import { fail, handleError, ok } from '@/lib/api';
import { getCountry } from '@/lib/geo/countries';

export const dynamic = 'force-dynamic';

const CreateRunSchema = z.object({
  country: z.string().min(2, 'Country is required.'),
  city: z.string().trim().optional().nullable(),
  depth: z.enum(['QUICK', 'DEEP']).default('QUICK'),
});

export async function POST(request: Request) {
  try {
    const body = CreateRunSchema.parse(await request.json());

    const country = getCountry(body.country);
    if (!country) {
      return fail(
        `"${body.country}" is not a country we hold search vocabulary for. Pick one from the country list.`,
        422,
      );
    }

    const run = await createRun({
      country: country.code,
      city: body.city?.trim() || null,
      depth: body.depth,
    });

    return ok(run, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

export async function GET() {
  try {
    const runs = await prisma.searchRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
    return ok(runs);
  } catch (err) {
    return handleError(err);
  }
}
