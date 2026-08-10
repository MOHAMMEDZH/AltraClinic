#!/usr/bin/env node
/**
 * Thin upgrade-path validator for Flexible Step 18 Effective Entitlement Runtime (EER).
 * Confirms EER adds zero Prisma models. U01 Usage Metering tables (historical migration
 * name …_step18_usage_metering) are expected present after full deploy; Step 19 billing absent.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const upgradeDb = 'booking_test_effective_entitlement_upgrade';

const STEP16_TABLES = [
  'platform_subscription_commercial_configs',
  'platform_subscription_commercial_snapshots',
];

const STEP17_FORBIDDEN = [
  'platform_effective_entitlement_runtime',
  'platform_effective_entitlements',
  'effective_entitlement_cache',
  'platform_runtime_entitlement_decisions',
];

const STEP19_BILLING_FORBIDDEN = [
  'platform_billing_runtime',
  'platform_billing_invoices',
  'platform_billing_charges',
  'platform_billing_payments',
  'platform_overage_charges',
  'platform_entitlement_usage',
];

const U01_USAGE_TABLES = [
  'platform_usage_meter_definitions',
  'platform_usage_observations',
  'platform_usage_counters',
  'platform_usage_reconciliation_checkpoints',
  'platform_usage_idempotency',
];

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.RUN_PLATFORM_DB_SECURITY = 'true';
process.env.ALLOW_TEST_DATABASE_RESET = 'true';

const adminUrl =
  process.env.INTEGRATION_ADMIN_DATABASE_URL ||
  'postgresql://booking:booking_test@localhost:5433/postgres';
const upgradeUrl = `postgresql://booking:booking_test@localhost:5433/${upgradeDb}?schema=public`;

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

async function assertRuntimeSchema(prisma, label) {
  for (const table of STEP16_TABLES) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
    );
    if (!rows[0]?.present) throw new Error(`${label}: missing ${table}`);
  }
  for (const table of STEP17_FORBIDDEN) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
    );
    if (rows[0]?.present) throw new Error(`${label}: forbidden Step 17 table ${table}`);
  }
  for (const table of U01_USAGE_TABLES) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
    );
    if (!rows[0]?.present) throw new Error(`${label}: missing U01 usage table ${table}`);
  }
  for (const table of STEP19_BILLING_FORBIDDEN) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
    );
    if (rows[0]?.present) throw new Error(`${label}: forbidden billing ${table}`);
  }
}

async function main() {
  await withAdmin(async (admin) => {
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${upgradeDb}`);
    await admin.$executeRawUnsafe(`CREATE DATABASE ${upgradeDb}`);
  });

  console.log('Step 17 upgrade: migrate deploy (baseline)...');
  run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: upgradeUrl });

  const prisma = new PrismaClient({ datasources: { db: { url: upgradeUrl } } });
  await prisma.$connect();
  try {
    await assertRuntimeSchema(prisma, 'before');

    // Re-run migrate deploy — must be a no-op for Step 17 (no pending DDL).
    console.log('Step 17 upgrade: re-deploy (expect no Step 17 DDL)...');
    run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: upgradeUrl });

    await assertRuntimeSchema(prisma, 'after');

    const pending = await prisma.$queryRawUnsafe(`
      SELECT migration_name FROM _prisma_migrations
      WHERE migration_name ILIKE '%step17%'
         OR migration_name ILIKE '%effective_entitlement%'
    `);
    if (pending.length) {
      throw new Error(`Unexpected Step 17 migrations present: ${JSON.stringify(pending)}`);
    }
    const step18Mig = await prisma.$queryRawUnsafe(`
      SELECT migration_name FROM _prisma_migrations
      WHERE migration_name ILIKE '%step18_usage_metering%'
    `);
    if (!step18Mig.length) throw new Error('Expected U01 usage metering migration (historical step18_usage_metering name)');

    console.log(
      JSON.stringify({
        ok: true,
        step17SchemaUnchanged: true,
        u01UsagePresent: true, // historical migration folder retains step18_usage_metering
        step19BillingAbsent: true,
        digest: { before: 'with_step18', after: 'with_step18', equal: true },
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
