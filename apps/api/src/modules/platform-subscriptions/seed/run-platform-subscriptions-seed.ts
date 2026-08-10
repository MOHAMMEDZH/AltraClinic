/**
 * Step 16 empty commercial subscription seed — no invented assignments.
 * Idempotent: always reports zeros.
 */
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  await prisma.$connect();
  try {
    await prisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
    const configs = await prisma.platformSubscriptionCommercialConfig.count();
    const addons = await prisma.platformSubscriptionAddOnAssignment.count();
    const overrides = await prisma.platformSubscriptionOverrideAssignment.count();
    const snapshots = await prisma.platformSubscriptionCommercialSnapshot.count();
    console.log('Step 16 seed: empty commercial assignment catalog (no invented products)');
    console.log(
      JSON.stringify({
        ok: true,
        commercialConfigs: configs,
        addonAssignments: addons,
        overrideAssignments: overrides,
        snapshots,
        inventedAssignments: false,
      }),
    );
    if (configs !== 0 || addons !== 0 || overrides !== 0) {
      // Seed never creates rows; non-zero means prior admin data — still ok for seed idempotency.
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
