import { prisma } from '@/lib/db';
import { integrationStatuses } from '@/lib/env';
import { handleError, ok } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * Integration status. Reports ONLY whether each key is present — key values
 * are never returned to the browser.
 */
export async function GET() {
  const integrations = integrationStatuses();

  let databaseReachable = false;
  let databaseError: string | null = null;
  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseReachable = true;
  } catch (err) {
    databaseError = err instanceof Error ? err.message : String(err);
  }

  try {
    return ok({
      integrations: integrations.map((i) =>
        i.id === 'database' ? { ...i, configured: databaseReachable } : i,
      ),
      databaseReachable,
      databaseError,
      readyToProspect: integrations.find((i) => i.id === 'googlePlaces')?.configured === true && databaseReachable,
    });
  } catch (err) {
    return handleError(err);
  }
}
