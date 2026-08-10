#!/usr/bin/env node
/**
 * Upgrade-path validation for Supplemental Capability U01 Usage Metering.
 * Parks U01 migration (historical dir 20260730120000_phase47_step18_usage_metering),
 * deploys prior chain (tables absent), restores + deploy,
 * asserts 8 meter defs / 0 observations / 0 nonzero counters / no billing.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const migrationsDir = path.join(apiRoot, 'prisma', 'migrations');
const gateDirName = '20260730120000_phase47_step18_usage_metering';
const parkDir = path.join(apiRoot, 'prisma', '_parked_step18_upgrade');
const upgradeDb = 'booking_test_usage_metering_upgrade';

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

function parkGateMigration() {
  fs.mkdirSync(parkDir, { recursive: true });
  const from = path.join(migrationsDir, gateDirName);
  const to = path.join(parkDir, gateDirName);
  if (!fs.existsSync(from)) throw new Error(`Missing migration ${gateDirName}`);
  if (fs.existsSync(to)) fs.rmSync(to, { recursive: true, force: true });
  fs.renameSync(from, to);
}

function restoreGateMigration() {
  const from = path.join(parkDir, gateDirName);
  const to = path.join(migrationsDir, gateDirName);
  if (fs.existsSync(from)) {
    if (fs.existsSync(to)) fs.rmSync(to, { recursive: true, force: true });
    fs.renameSync(from, to);
  }
  if (fs.existsSync(parkDir) && fs.readdirSync(parkDir).length === 0) {
    fs.rmdirSync(parkDir);
  }
}

async function assertUsageAbsent(prisma, label) {
  for (const table of USAGE_TABLES) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
    );
    if (rows[0]?.present) throw new Error(`${label}: unexpected table ${table}`);
  }
}

async function assertUsageSeed(prisma, label) {
  for (const table of USAGE_TABLES) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
    );
    if (!rows[0]?.present) throw new Error(`${label}: missing ${table}`);
  }
  for (const table of BILLING_FORBIDDEN) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
    );
    if (rows[0]?.present) throw new Error(`${label}: forbidden billing ${table}`);
  }
  const counts = await prisma.$queryRawUnsafe(`
    SELECT
      (SELECT COUNT(*)::int FROM platform_usage_meter_definitions) AS meter_defs,
      (SELECT COUNT(*)::int FROM platform_usage_observations) AS observations,
      (SELECT COUNT(*)::int FROM platform_usage_counters
        WHERE "currentValue" <> '0' OR COALESCE("reservedValue", '0') <> '0') AS nonzero_counters
  `);
  const c = counts[0];
  if (c.meter_defs !== 8) throw new Error(`${label}: meter defs ${c.meter_defs}`);
  if (c.observations !== 0) throw new Error(`${label}: observations ${c.observations}`);
  if (c.nonzero_counters !== 0) throw new Error(`${label}: nonzero counters ${c.nonzero_counters}`);
  return c;
}

async function main() {
  restoreGateMigration();
  try {
    await withAdmin(async (admin) => {
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${upgradeDb}`);
      await admin.$executeRawUnsafe(`CREATE DATABASE ${upgradeDb}`);
    });

    parkGateMigration();
    try {
      console.log('U01 upgrade: migrate deploy with U01 parked (historical step18 folder)...');
      run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: upgradeUrl });
    } finally {
      restoreGateMigration();
    }

    const prisma = new PrismaClient({ datasources: { db: { url: upgradeUrl } } });
    await prisma.$connect();
    try {
      await prisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
      await assertUsageAbsent(prisma, 'before-step18');

      console.log('U01 upgrade: migrate deploy applying U01...');
      run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: upgradeUrl });

      const after = await assertUsageSeed(prisma, 'after-step18');
      console.log(
        JSON.stringify({
          ok: true,
          upgradeApplied: true,
          meterDefinitions: after.meter_defs,
          observations: after.observations,
          nonzeroCounters: after.nonzero_counters,
          billingTablesAbsent: true,
        }),
      );
    } finally {
      await prisma.$disconnect();
    }
  } catch (err) {
    restoreGateMigration();
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
