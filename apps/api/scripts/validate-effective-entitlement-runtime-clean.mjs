#!/usr/bin/env node
/**
 * Thin clean-path validator for Flexible Step 18 Effective Entitlement Runtime (EER).
 * EER adds zero Prisma models / tables — asserts schema unchanged vs Step 16 commercial surface.
 * U01 Usage Metering tables (historical migration name …_step18_usage_metering) are expected
 * present when that migration is in the deploy chain. Step 19 billing tables remain absent.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const cleanDb = 'booking_test_effective_entitlement_clean';

const STEP16_TABLES = [
  'platform_subscription_commercial_configs',
  'platform_subscription_addon_assignments',
  'platform_subscription_override_assignments',
  'platform_subscription_commercial_snapshots',
  'platform_subscription_commercial_changes',
  'platform_subscription_commercial_idempotency',
];

const STEP17_FORBIDDEN = [
  'platform_effective_entitlement_runtime',
  'platform_effective_entitlements',
  'effective_entitlement_cache',
  'platform_runtime_entitlement_decisions',
];

const U01_USAGE_TABLES = [
  'platform_usage_meter_definitions',
  'platform_usage_observations',
  'platform_usage_counters',
  'platform_usage_reconciliation_checkpoints',
  'platform_usage_idempotency',
];

/** Step 19 billing / overage — must remain absent after Flexible Step 18 (EER) + U01. */
const STEP19_BILLING_FORBIDDEN = [
  'platform_billing_runtime',
  'platform_billing_invoices',
  'platform_billing_charges',
  'platform_billing_payments',
  'platform_overage_charges',
  'platform_entitlement_usage',
];

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

  console.log('Step 17 clean migrate deploy (full chain; expect zero Step 17 DDL)...');
  run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: cleanUrl });

  const prisma = new PrismaClient({ datasources: { db: { url: cleanUrl } } });
  await prisma.$connect();
  try {
    for (const table of STEP16_TABLES) {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
      );
      if (!rows[0]?.present) throw new Error(`Missing Step 16 table: ${table}`);
    }
    for (const table of STEP17_FORBIDDEN) {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
      );
      if (rows[0]?.present) {
        throw new Error(`Forbidden Step 17 runtime table present: ${table}`);
      }
    }
    for (const table of U01_USAGE_TABLES) {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
      );
      if (!rows[0]?.present) throw new Error(`Missing U01 usage table: ${table}`);
    }
    for (const table of STEP19_BILLING_FORBIDDEN) {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
      );
      if (rows[0]?.present) {
        throw new Error(`Forbidden Step 19 billing table present: ${table}`);
      }
    }

    const migrations = await prisma.$queryRawUnsafe(`
      SELECT migration_name FROM _prisma_migrations
      WHERE migration_name ILIKE '%step17%'
         OR migration_name ILIKE '%effective_entitlement%'
      ORDER BY finished_at
    `);
    if (migrations.length) {
      throw new Error(
        `Unexpected Step 17 migration(s): ${migrations.map((m) => m.migration_name).join(', ')}`,
      );
    }
    const step18Mig = await prisma.$queryRawUnsafe(`
      SELECT migration_name FROM _prisma_migrations
      WHERE migration_name ILIKE '%step18_usage_metering%'
    `);
    if (!step18Mig.length) throw new Error('Expected U01 usage metering migration (historical step18_usage_metering name)');

    console.log(
      JSON.stringify({
        ok: true,
        step17SchemaAdditions: 0,
        u01UsagePresent: true, // historical migration folder retains step18_usage_metering
        step19BillingAbsent: true,
        step16TablesPresent: STEP16_TABLES.length,
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
