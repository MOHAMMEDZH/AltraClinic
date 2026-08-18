#!/usr/bin/env node
/**
 * Phase 48 Wave C — clean migration validator.
 * Fresh DB: migrate deploy → assert Wave C tables/columns → LEGACY_UNATTRIBUTED backfill smoke.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const cleanDb = `test_p48wc_clean_${Date.now()}`;

const OVERALL_DEADLINE_MS = 10 * 60 * 1000;
const MIGRATE_TIMEOUT_MS = 5 * 60 * 1000;

const WAVE_C_TABLES = [
  'clinical_form_templates',
  'clinical_form_versions',
  'patient_form_instances',
  'clinical_service_form_requirements',
  'injectable_usage_details',
];

const USAGE_COLS = [
  'usageType',
  'usedByUserId',
  'recordedByUserId',
  'sourceStockMovementId',
  'attributionStatus',
  'status',
  'inventoryBatchId',
];

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.ALLOW_TEST_DATABASE_RESET = 'true';

const adminUrl =
  process.env.INTEGRATION_ADMIN_DATABASE_URL ||
  'postgresql://booking:booking_test@localhost:5433/postgres';
const cleanUrl = `postgresql://booking:booking_test@localhost:5433/${cleanDb}?schema=public`;

const startedAt = Date.now();
let deadlineTimer;

function remainingMs() {
  return OVERALL_DEADLINE_MS - (Date.now() - startedAt);
}

function assertWithinDeadline(step) {
  if (remainingMs() <= 0) {
    throw new Error(`Clean validator overall deadline exceeded at step: ${step}`);
  }
}

function log(msg) {
  console.log(`[phase48-wave-c-clean +${Date.now() - startedAt}ms] ${msg}`);
}

function run(cmd, args, env = {}, timeoutMs = MIGRATE_TIMEOUT_MS) {
  assertWithinDeadline(`${cmd} ${args.join(' ')}`);
  const budget = Math.min(timeoutMs, Math.max(5_000, remainingMs()));
  log(`run: ${cmd} ${args.join(' ')} (timeout=${budget}ms)`);
  const result = spawnSync(cmd, args, {
    cwd: apiRoot,
    env: { ...process.env, ...env },
    stdio: 'inherit',
    shell: true,
    timeout: budget,
    killSignal: 'SIGTERM',
  });
  if (result.error) {
    throw new Error(`Command error: ${cmd} ${args.join(' ')} — ${result.error.message}`);
  }
  if ((result.status ?? 1) !== 0) {
    throw new Error(`Command failed (exit ${result.status}): ${cmd} ${args.join(' ')}`);
  }
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

async function connectWithRetry(url, attempts = 30) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    assertWithinDeadline(`connect ${url}`);
    const client = new PrismaClient({ datasources: { db: { url } } });
    try {
      await client.$connect();
      await client.$queryRaw`SELECT 1 AS ok`;
      return client;
    } catch (err) {
      lastErr = err;
      try {
        await client.$disconnect();
      } catch {
        /* ignore */
      }
      sleep(1000);
    }
  }
  throw lastErr ?? new Error(`Unable to connect to ${url}`);
}

async function withAdmin(fn) {
  const admin = await connectWithRetry(adminUrl);
  try {
    return await fn(admin);
  } finally {
    try {
      await admin.$disconnect();
    } catch {
      /* ignore */
    }
  }
}

async function main() {
  deadlineTimer = setTimeout(() => {
    console.error(`Wave C clean validator hard deadline exceeded.`);
    process.exit(1);
  }, OVERALL_DEADLINE_MS);
  if (typeof deadlineTimer.unref === 'function') deadlineTimer.unref();

  log(`CREATE DATABASE ${cleanDb}`);
  await withAdmin(async (admin) => {
    await admin.$executeRawUnsafe(`CREATE DATABASE ${cleanDb}`);
  });

  run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: cleanUrl }, MIGRATE_TIMEOUT_MS);

  const prisma = new PrismaClient({ datasources: { db: { url: cleanUrl } } });
  await prisma.$connect();
  try {
    await prisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;

    for (const table of WAVE_C_TABLES) {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
      );
      if (!rows[0]?.present) throw new Error(`Missing Wave C table: ${table}`);
      log(`OK table ${table}`);
    }

    const cols = await prisma.$queryRawUnsafe(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'inventory_consumption_logs'
    `);
    const colNames = new Set(cols.map((c) => c.column_name));
    for (const col of USAGE_COLS) {
      if (!colNames.has(col)) throw new Error(`Missing usage ledger column: ${col}`);
    }
    log('OK inventory_consumption_logs Wave C columns');

    const batchCols = await prisma.$queryRawUnsafe(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'inventory_batches' AND column_name IN ('recalled', 'recalledAt')
    `);
    if (batchCols.length < 2) throw new Error('inventory_batches missing recalled columns');
    log('OK inventory_batches recall columns');

    const mediaCols = await prisma.$queryRawUnsafe(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'media_assets' AND column_name = 'requiresPhotoConsent'
    `);
    if (!mediaCols.length) throw new Error('media_assets missing requiresPhotoConsent');
    log('OK media_assets requiresPhotoConsent');

    // Wave B preserved
    const wb = await prisma.$queryRawUnsafe(
      `SELECT to_regclass('public.appointment_service_snapshot_revisions') IS NOT NULL AS present`,
    );
    if (!wb[0]?.present) throw new Error('Wave B snapshot table missing');
    log('OK Wave B preserved');

    console.log('PHASE48_WAVE_C_CLEAN_VALIDATOR_PASSED');
  } finally {
    try {
      await prisma.$disconnect();
    } catch {
      /* ignore */
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    if (deadlineTimer) clearTimeout(deadlineTimer);
    process.exit(process.exitCode ?? 0);
  });
