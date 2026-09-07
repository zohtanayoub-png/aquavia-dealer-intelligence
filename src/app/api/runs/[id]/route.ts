import { prisma } from '@/lib/db';
import { fail, handleError, ok } from '@/lib/api';
import { phaseLabel } from '@/lib/pipeline/runner';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const run = await prisma.searchRun.findUnique({
      where: { id },
      include: { logs: { orderBy: { at: 'desc' }, take: 60 } },
    });
    if (!run) return fail('Run not found.', 404);

    return ok({
      ...run,
      phase: phaseLabel(run.status),
      done: ['COMPLETED', 'FAILED', 'CANCELLED'].includes(run.status),
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await prisma.searchRun.update({
      where: { id },
      data: { status: 'CANCELLED', finishedAt: new Date() },
    });
    return ok({ cancelled: true });
  } catch (err) {
    return handleError(err);
  }
}
