/** Shared API helpers: consistent JSON shapes and error handling. */
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

/**
 * Turn any thrown value into an honest HTTP response.
 * Database connectivity problems are called out explicitly, because
 * "something went wrong" is useless when the real cause is a missing
 * DATABASE_URL on a fresh deployment.
 */
export function handleError(err: unknown) {
  if (err instanceof ZodError) {
    return fail('Invalid request.', 422, {
      issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  if (err instanceof Prisma.PrismaClientInitializationError) {
    return fail(
      'Cannot connect to the database. Check that DATABASE_URL is set and that migrations have been applied (`npm run db:deploy`).',
      503,
    );
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return fail('That record already exists.', 409);
    if (err.code === 'P2025') return fail('Record not found.', 404);
    if (err.code === 'P2021' || err.code === 'P2022') {
      return fail('Database schema is out of date. Run `npm run db:deploy`.', 503);
    }
    return fail(`Database error (${err.code}).`, 500);
  }
  const message = err instanceof Error ? err.message : String(err);
  return fail(message, 500);
}
