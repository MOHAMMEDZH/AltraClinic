/**
 * Step 15 Add-ons & Overrides seed — intentionally empty catalog.
 * Does NOT invent addon.* products. Idempotent (second run same zero counts).
 */
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    await prisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
    await prisma.$executeRaw`SELECT set_config('app.current_tenant_id', '', false)`;

    const addons = await prisma.platformAddOn.count();
    const versions = await prisma.platformAddOnVersion.count();
    const overrides = await prisma.platformCommercialOverride.count();
    const effects = await prisma.platformCommercialOverrideEffect.count();
    const entitlements = await prisma.platformAddOnVersionEntitlement.count();
    const limitEffects = await prisma.platformAddOnVersionLimitEffect.count();

    if (
      addons !== 0 ||
      versions !== 0 ||
      overrides !== 0 ||
      effects !== 0 ||
      entitlements !== 0 ||
      limitEffects !== 0
    ) {
      throw new Error(
        `Step 15 seed expects empty catalog; found addons=${addons} versions=${versions} ` +
          `overrides=${overrides} effects=${effects} entitlements=${entitlements} limitEffects=${limitEffects}`,
      );
    }

    console.log('Step 15 seed: empty catalog (no invented products)');
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        addons: 0,
        versions: 0,
        overrides: 0,
        effects: 0,
        entitlements: 0,
        limitEffects: 0,
        inventedProducts: false,
      })}\n`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(async (err) => {
  process.stderr.write(`${(err as Error)?.message ?? 'seed_failed'}\n`);
  process.exit(1);
});
