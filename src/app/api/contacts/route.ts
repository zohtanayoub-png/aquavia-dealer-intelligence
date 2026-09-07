import { prisma } from '@/lib/db';
import { handleError, ok } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get('q')?.trim();
    const country = url.searchParams.get('country');
    const role = url.searchParams.get('role');
    const withEmail = url.searchParams.get('withEmail') === 'true';
    const withLinkedIn = url.searchParams.get('withLinkedIn') === 'true';

    const contacts = await prisma.decisionMaker.findMany({
      where: {
        ...(q
          ? {
              OR: [
                { fullName: { contains: q, mode: 'insensitive' } },
                { position: { contains: q, mode: 'insensitive' } },
                { company: { name: { contains: q, mode: 'insensitive' } } },
              ],
            }
          : {}),
        ...(role ? { roleBucket: role } : {}),
        ...(withEmail ? { email: { not: null } } : {}),
        ...(withLinkedIn ? { linkedinUrl: { not: null } } : {}),
        ...(country ? { company: { countryCode: country.toUpperCase() } } : {}),
      },
      include: {
        company: {
          select: {
            id: true, name: true, city: true, countryName: true, countryCode: true,
            score: true, priority: true, crmStatus: true, phone: true, website: true,
          },
        },
      },
      orderBy: [{ confidence: 'asc' }, { fullName: 'asc' }],
      take: 500,
    });

    return ok(contacts);
  } catch (err) {
    return handleError(err);
  }
}
