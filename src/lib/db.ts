import { PrismaClient } from '@prisma/client';

/**
 * Prisma singleton.
 *
 * Next.js dev-mode hot reload and serverless warm starts both re-evaluate
 * modules, so the client is cached on globalThis to avoid exhausting the
 * Postgres connection pool.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
