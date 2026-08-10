#!/usr/bin/env node
/**
 * Clean-path validation for Supplemental Capability U01 Usage Metering.
 * Historical migration folder: 20260730120000_phase47_step18_usage_metering (name retained for integrity).
 * Full migrate deploy → 8 meter definitions, 0 observations, 0 nonzero counters, no billing tables.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const cleanDb = 'booking_test_usage_metering_clean';

const USAGE_TABLES = [
  'platform_usage_meter_definitions',
  'platform_usage_observations',
  'platform_usage_counters',
  'platform_usage_reconciliation_checkpoints',
  'platform_usage_idempotency',
];

const BILLING_FORBIDDEN = [
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

  console.log('U01 clean migrate deploy...');
  run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: cleanUrl });

  const prisma = new PrismaClient({ datasources: { db: { url: cleanUrl } } });
  await prisma.$connect();
  try {
    await prisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;

    for (const table of USAGE_TABLES) {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
      );
      if (!rows[0]?.present) throw new Error(`Missing U01 usage table: ${table}`);
    }

    for (const table of BILLING_FORBIDDEN) {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
      );
      if (rows[0]?.present) throw new Error(`Forbidden billing table present: ${table}`);
    }

    const counts = await prisma.$queryRawUnsafe(`
      SELECT
        (SELECT COUNT(*)::int FROM platform_usage_meter_definitions) AS meter_defs,
        (SELECT COUNT(*)::int FROM platform_usage_observations) AS observations,
        (SELECT COUNT(*)::int FROM platform_usage_counters
          WHERE "currentValue" <> '0' OR COALESCE("reservedValue", '0') <> '0') AS nonzero_counters,
        (SELECT COUNT(*)::int FROM platform_usage_counters) AS counter_rows,
        (SELECT COUNT(*)::int FROM platform_usage_reconciliation_checkpoints) AS checkpoints,
        (SELECT COUNT(*)::int FROM platform_usage_idempotency) AS idempotency_rows
    `);
    const c = counts[0];
    if (c.meter_defs !== 8) throw new Error(`Expected 8 meter definitions, got ${c.meter_defs}`);
    if (c.observations !== 0) throw new Error(`Expected 0 observations, got ${c.observations}`);
    if (c.nonzero_counters !== 0) {
      throw new Error(`Expected 0 nonzero counters, got ${c.nonzero_counters}`);
    }

    const step18Mig = await prisma.$queryRawUnsafe(`
      SELECT migration_name FROM _prisma_migrations
      WHERE migration_name ILIKE '%step18_usage_metering%'
      ORDER BY finished_at
    `);
    if (!step18Mig.length) throw new Error('U01 usage metering migration not applied (historical step18_usage_metering name)');

    console.log(
      JSON.stringify({
        ok: true,
        meterDefinitions: c.meter_defs,
        observations: c.observations,
        nonzeroCounters: c.nonzero_counters,
        counterRows: c.counter_rows,
        checkpoints: c.checkpoints,
        idempotencyRows: c.idempotency_rows,
        billingTablesAbsent: true,
        migration: step18Mig[0].migration_name,
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
