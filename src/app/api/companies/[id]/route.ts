import { z } from 'zod';
import { prisma } from '@/lib/db';
import { fail, handleError, ok } from '@/lib/api';
import { rescoreCompany } from '@/lib/pipeline/runner';

export const dynamic = 'force-dynamic';

const UpdateSchema = z.object({
  crmStatus: z
    .enum([
      'NEW', 'TO_CONTACT', 'CONTACTED', 'REPLIED', 'MEETING', 'QUALIFIED',
      'NEGOTIATING', 'DEALER', 'NOT_INTERESTED', 'DO_NOT_CONTACT',
    ])
    .optional(),
  salesNotes: z.string().max(20_000).nullable().optional(),
  lastContactAt: z.string().datetime().nullable().optional(),
  nextFollowUpAt: z.string().datetime().nullable().optional(),
  ownerName: z.string().max(200).nullable().optional(),
  whatsapp: z.string().max(60).nullable().optional(),
  publicEmail: z.string().email().nullable().optional(),
});

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        decisionMakers: { orderBy: { createdAt: 'asc' } },
        sources: { orderBy: { retrievedAt: 'desc' } },
        runLinks: { include: { run: true }, orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!company) return fail('Company not found.', 404);
    return ok(company);
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = UpdateSchema.parse(await request.json());

    const data: Record<string, unknown> = { ...body };
    if (body.lastContactAt !== undefined) {
      data.lastContactAt = body.lastContactAt ? new Date(body.lastContactAt) : null;
    }
    if (body.nextFollowUpAt !== undefined) {
      data.nextFollowUpAt = body.nextFollowUpAt ? new Date(body.nextFollowUpAt) : null;
    }

    const updated = await prisma.company.update({ where: { id }, data });

    // A CRM status of DEALER/DO_NOT_CONTACT changes the prospecting picture,
    // so the recommended action is recomputed rather than left stale.
    if (body.crmStatus) await rescoreCompany(id);

    return ok(updated);
  } catch (err) {
    return handleError(err);
  }
}
