import { z } from 'zod';
import { reclassifyAll } from '@/lib/relevance/reclassify';
import { fail, handleError, ok } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Trigger a reclassification of companies already in the database.
 *
 * WHY THIS IS GATED
 * -----------------
 * The rest of the application is read-mostly and unauthenticated. This
 * endpoint mutates many rows and can spend Tavily credits, so it stays
 * DISABLED unless an ADMIN_TOKEN is configured. No token, no endpoint —
 * it cannot be triggered by accident or by a stranger who finds the URL.
 *
 * Enable it by setting ADMIN_TOKEN in your hosting environment, then:
 *
 *   curl -X POST https://<host>/api/relevance/reclassify \
 *        -H "x-admin-token: $ADMIN_TOKEN" \
 *        -H 'content-type: application/json' \
 *        -d '{"countryCode":"MA","dryRun":true}'
 *
 * The equivalent CLI (`npm run db:reclassify`) needs no token because it
 * already requires database credentials.
 */
const BodySchema = z.object({
  countryCode: z.string().length(2).optional(),
  allowTavily: z.boolean().optional().default(false),
  maxTavilyCalls: z.number().int().min(1).max(200).optional().default(40),
  dryRun: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  try {
    const expected = process.env.ADMIN_TOKEN?.trim();
    if (!expected) {
      return fail(
        'Reclassification over HTTP is disabled because ADMIN_TOKEN is not configured. ' +
          'Set ADMIN_TOKEN in your hosting environment to enable it, or run `npm run db:reclassify` instead.',
        503,
      );
    }

    const provided = request.headers.get('x-admin-token');
    if (!provided || !timingSafeEqual(provided, expected)) {
      return fail('Invalid or missing x-admin-token header.', 401);
    }

    const raw = await request.json().catch(() => ({}));
    const body = BodySchema.parse(raw);

    const report = await reclassifyAll({
      countryCode: body.countryCode,
      allowTavily: body.allowTavily,
      maxTavilyCalls: body.maxTavilyCalls,
      dryRun: body.dryRun,
    });

    return ok({
      ...report,
      // Keep the response small; the full list is on the Companies page.
      topProspects: report.topProspects.slice(0, 15),
      demoted: report.demoted.slice(0, 10),
      note: body.dryRun
        ? 'Dry run — nothing was written.'
        : 'Companies were reclassified. No company was deleted; CRM status, sales notes and the general opportunity score were not modified.',
    });
  } catch (err) {
    return handleError(err);
  }
}

/** Constant-time comparison so the token cannot be guessed by timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
