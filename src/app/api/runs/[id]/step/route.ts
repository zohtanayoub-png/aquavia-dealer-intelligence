import { stepRun } from '@/lib/pipeline/runner';
import { handleError, ok } from '@/lib/api';

export const dynamic = 'force-dynamic';
/** Discovery + enrichment call external APIs; give the step room to breathe. */
export const maxDuration = 60;

/**
 * Advance a run by ONE bounded chunk.
 *
 * The client polls this until `done` is true. Keeping the unit of work small
 * is what lets the pipeline run on serverless platforms with per-request time
 * limits, and lets a run survive a redeploy mid-search.
 */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    return ok(await stepRun(id));
  } catch (err) {
    return handleError(err);
  }
}
