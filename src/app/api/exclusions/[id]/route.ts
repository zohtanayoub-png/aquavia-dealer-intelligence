import { prisma } from '@/lib/db';
import { handleError, ok } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const entry = await prisma.exclusionEntry.delete({ where: { id } });

    // Un-flag companies that were excluded solely by this rule.
    const restored = await prisma.company.updateMany({
      where: {
        isExcluded: true,
        exclusionKind: entry.kind,
        OR: [
          ...(entry.domain ? [{ websiteDomain: entry.domain }] : []),
          { name: { equals: entry.name, mode: 'insensitive' as const } },
        ],
      },
      data: { isExcluded: false, exclusionKind: null, exclusionNote: null },
    });

    return ok({ deleted: true, restored: restored.count });
  } catch (err) {
    return handleError(err);
  }
}
