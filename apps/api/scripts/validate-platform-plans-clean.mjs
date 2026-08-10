#!/usr/bin/env node
/**
 * Clean-path validation for Phase 47 Platform Plans migration.
 * Creates isolated booking_test_plans_clean, applies all migrations, seeds twice.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const cleanDb = 'booking_test_plans_clean';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.RUN_PLATFORM_DB_SECURITY = 'true';
process.env.ALLOW_TEST_DATABASE_RESET = 'true';

const adminUrl =
  process.env.INTEGRATION_ADMIN_DATABASE_URL ||
  'postgresql://booking:booking_test@localhost:5433/postgres';
const cleanUrl = `postgresql://booking:booking_test@localhost:5433/${cleanDb}?schema=public`;

function run(cmd, args, env = {}) {
  const result = spawnSync(cmd, args, {
    cwd: apiRoot,
    env: { ...process.env, ...env },
    stdio: 'inherit',
    shell: true,
  });
  if ((result.status ?? 1) !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}`);
  }
}

async function withAdmin(fn) {
  const admin = new PrismaClient({ datasources: { db: { url: adminUrl } } });
  try {
    await admin.$connect();
    return await fn(admin);
  } finally {
    await admin.$disconnect();
  }
}

async function main() {
  await withAdmin(async (admin) => {
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${cleanDb}`);
    await admin.$executeRawUnsafe(`CREATE DATABASE ${cleanDb}`);
  });

  console.log('Clean migrate deploy...');
  run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: cleanUrl });

  const prisma = new PrismaClient({ datasources: { db: { url: cleanUrl } } });
  await prisma.$connect();
  try {
    await prisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;

    // Verify Plans + Step 14 entitlement/limit tables exist
    const tables = await prisma.$queryRawUnsafe(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'platform_plan%'`,
    );
    const names = tables.map((t) => t.tablename);
    for (const required of [
      'platform_plans',
      'platform_plan_translations',
      'platform_plan_aliases',
      'platform_plan_versions',
      'platform_plan_version_translations',
      'platform_plan_idempotency',
      'platform_plan_version_entitlements',
      'platform_plan_version_limits',
    ]) {
      if (!names.includes(required)) throw new Error(`Missing table ${required}`);
    }
    const ownershipCol = await prisma.$queryRawUnsafe(
      `SELECT 1 FROM information_schema.columns
       WHERE table_name = 'platform_plan_versions'
         AND column_name = 'commercialDefinitionOwnership'`,
    );
    if (!ownershipCol.length) {
      throw new Error('Missing commercialDefinitionOwnership column on platform_plan_versions');
    }
    const forbidden = await prisma.$queryRawUnsafe(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND (
         tablename LIKE '%effective_entitlement%' OR
         tablename LIKE '%runtime_entitlement%'
       )`,
    );
    if (forbidden.length) throw new Error(`Forbidden Step 18+ runtime tables present: ${JSON.stringify(forbidden)}`);

    const fk = await prisma.$queryRawUnsafe(
      `SELECT 1 FROM information_schema.columns
       WHERE table_name = 'platform_subscriptions' AND column_name = 'planVersionId'`,
    );
    if (fk.length) throw new Error('subscription planVersionId FK must not exist');

    process.env.DATABASE_URL = cleanUrl;
    run('npx', [
      'ts-node',
      '--transpile-only',
      'src/modules/platform-healthcare-catalog/seed/run-healthcare-catalog-seed.ts',
    ], { DATABASE_URL: cleanUrl });
    run('npx', [
      'ts-node',
      '--transpile-only',
      'src/modules/platform-plans/seed/run-platform-plans-seed.ts',
    ], { DATABASE_URL: cleanUrl });
    run('npx', [
      'ts-node',
      '--transpile-only',
      'src/modules/platform-plans/seed/run-platform-plans-seed.ts',
    ], { DATABASE_URL: cleanUrl });

    const plans = await prisma.platformPlan.count();
    const aliases = await prisma.platformPlanAlias.count({ where: { lifecycle: 'ACTIVE' } });
    const businessActive = await prisma.platformPlanAlias.count({
      where: { aliasValue: 'business', lifecycle: 'ACTIVE' },
    });
    const drafts = await prisma.platformPlanVersion.count({ where: { lifecycle: 'DRAFT' } });
    const published = await prisma.platformPlanVersion.count({ where: { lifecycle: 'PUBLISHED' } });
    const entitlements = await prisma.platformPlanVersionEntitlement.count();
    const limits = await prisma.platformPlanVersionLimit.count();
    const seedInitialized = await prisma.platformPlanVersion.count({
      where: { commercialDefinitionOwnership: 'SEED_INITIALIZED' },
    });
    const dupEnt = await prisma.$queryRawUnsafe(
      `SELECT "planVersionId", "catalogItemId", COUNT(*)::int AS c
       FROM platform_plan_version_entitlements
       GROUP BY 1, 2 HAVING COUNT(*) > 1`,
    );
    const dupLim = await prisma.$queryRawUnsafe(
      `SELECT "planVersionId", "catalogItemId", COUNT(*)::int AS c
       FROM platform_plan_version_limits
       GROUP BY 1, 2 HAVING COUNT(*) > 1`,
    );
    if (plans !== 3) throw new Error(`Expected 3 plans, got ${plans}`);
    if (businessActive !== 0) throw new Error('business must not be an active Plan alias');
    if (drafts !== 3) throw new Error(`Expected 3 Draft versions, got ${drafts}`);
    if (published !== 0) throw new Error(`Expected 0 Published versions, got ${published}`);
    if (seedInitialized !== 3) {
      throw new Error(`Expected 3 SEED_INITIALIZED drafts, got ${seedInitialized}`);
    }
    if (entitlements !== 16 + 33 + 42) {
      throw new Error(`Expected 91 entitlements (16+33+42), got ${entitlements}`);
    }
    if (limits !== 36) throw new Error(`Expected 36 Limits (12*3), got ${limits}`);
    if (dupEnt.length || dupLim.length) {
      throw new Error('Duplicate entitlement or Limit rows after double seed');
    }
    console.log(
      JSON.stringify({
        ok: true,
        plans,
        aliases,
        businessActive,
        drafts,
        published,
        entitlements,
        limits,
        seedInitialized,
      }),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
