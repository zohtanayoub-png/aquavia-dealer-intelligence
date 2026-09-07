import { NextResponse } from 'next/server';
import { buildOrderBy, SORTABLE_FIELDS } from '@/lib/companyQuery';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Build identity + live self-check.
 *
 * Exists because "the deployment says commit X, but production behaves like
 * commit Y" is otherwise unfalsifiable from the outside. This endpoint reports
 * which commit is actually answering the request AND executes the real
 * `buildOrderBy` so the caller can see the exact orderBy the running code
 * produces — no log archaeology, no guessing.
 *
 * If `orderBy.default` here shows `{"score":"desc"}`, the fixed code is live.
 * If it ever shows `{"score":{"sort":...,"nulls":...}}`, the old code is live
 * and the deployment genuinely did not take effect.
 */
export async function GET() {
  const defaultOrderBy = buildOrderBy({});
  const scoreTerm = (defaultOrderBy[0] as Record<string, unknown>)?.score;
  const scoreIsBareSortOrder = typeof scoreTerm === 'string';

  return NextResponse.json(
    {
      ok: true,
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? 'unknown (not running on Vercel)',
      ref: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? null,
      deploymentUrl: process.env.VERCEL_URL ?? null,
      servedAt: new Date().toISOString(),
      orderBy: {
        default: defaultOrderBy,
        sortableFields: SORTABLE_FIELDS,
        // The single fact this whole endpoint exists to answer.
        scoreIsBareSortOrder,
        verdict: scoreIsBareSortOrder
          ? 'OK — score uses a bare SortOrder, as Prisma requires for a non-nullable column.'
          : 'STALE BUILD — score is using the { sort, nulls } object form. This deployment is NOT running the fix.',
      },
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
