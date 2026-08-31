/**
 * Verify the licensing Playwright E2E seed fixture is present.
 * Invoked from .github/workflows/phase28-licensing-ci.yml (working-directory: apps/api).
 *
 * Expects DATABASE_URL and a seeded user with email expired@lic-e2e.clinic.
 * Never logs credentials, connection strings, or full user records.
 */
import { PrismaClient } from '@prisma/client';

const LICENSING_E2E_SEED_EMAIL = 'expired@lic-e2e.clinic';

const prisma = new PrismaClient();
let exitCode = 0;

try {
  const user = await prisma.user.findFirst({
    where: { email: LICENSING_E2E_SEED_EMAIL },
    select: { id: true },
  });

  if (!user) {
    console.error(
      `Licensing E2E seed missing: expected user with email ${LICENSING_E2E_SEED_EMAIL}`,
    );
    exitCode = 1;
  }
} catch (err) {
  const message = err instanceof Error ? err.message : 'unknown error';
  console.error(`Licensing E2E seed verification failed: ${message}`);
  exitCode = 1;
} finally {
  await prisma.$disconnect();
}

process.exit(exitCode);
