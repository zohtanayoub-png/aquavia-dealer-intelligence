import { prisma } from '@/lib/db';
import { handleError, ok } from '@/lib/api';
import { buildOrderBy, buildWhere, parseFilters } from '@/lib/companyQuery';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const filters = parseFilters(url.searchParams);
    const take = Math.min(Number(url.searchParams.get('take') ?? 100) || 100, 500);
    const skip = Math.max(Number(url.searchParams.get('skip') ?? 0) || 0, 0);

    const where = buildWhere(filters);
    const [items, total] = await Promise.all([
      prisma.company.findMany({
        where,
        orderBy: buildOrderBy(filters),
        take,
        skip,
        include: {
          decisionMakers: { orderBy: { confidence: 'asc' }, take: 3 },
          _count: { select: { sources: true, decisionMakers: true } },
        },
      }),
      prisma.company.count({ where }),
    ]);

    return ok({ items, total, take, skip });
  } catch (err) {
    return handleError(err);
  }
}
