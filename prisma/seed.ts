/**
 * Seed script.
 *
 * Seeds ONLY reference data the business owns — the four exclusion lists and
 * market notes. It deliberately does NOT create fake companies: inventing
 * prospects would violate the data-quality contract this product is built on.
 * Real companies only ever enter the database through a real search.
 */
import { PrismaClient } from '@prisma/client';
import { companyNameKey } from '../src/lib/utils';
import { COMPETITOR_BRANDS } from '../src/lib/discovery/brands';

const prisma = new PrismaClient();

async function main() {
  // The competing manufacturers themselves are not prospects.
  for (const brand of COMPETITOR_BRANDS) {
    const nameKey = companyNameKey(brand.name);
    const existing = await prisma.exclusionEntry.findFirst({
      where: { kind: 'KNOWN_COMPETITOR', nameKey },
    });
    if (existing) continue;

    await prisma.exclusionEntry.create({
      data: {
        kind: 'KNOWN_COMPETITOR',
        name: brand.name,
        nameKey,
        note: 'Competing spa manufacturer — not a dealer prospect.',
      },
    });
  }

  const count = await prisma.exclusionEntry.count({ where: { kind: 'KNOWN_COMPETITOR' } });
  console.log(`Seeded exclusion lists. Known competitors: ${count}.`);
  console.log('No companies were seeded — prospects only enter via a real search.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
