#!/usr/bin/env node
/**
 * Phase 48 Wave B — clean migration validator.
 * Fresh DB: migrate deploy → assert Wave B tables/columns → backfill smoke → idempotent.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const cleanDb = `test_p48wb_clean_${Date.now()}`;

const OVERALL_DEADLINE_MS = 10 * 60 * 1000;
const MIGRATE_TIMEOUT_MS = 5 * 60 * 1000;
const BACKFILL_TIMEOUT_MS = 3 * 60 * 1000;

const WAVE_B_TABLES = [
  'appointment_service_snapshot_revisions',
  'provider_service_eligibilities',
  'service_resource_requirements',
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
  console.log(`[phase48-wave-b-clean +${Date.now() - startedAt}ms] ${msg}`);
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
    console.error(`Wave B clean validator hard deadline exceeded.`);
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

    for (const table of WAVE_B_TABLES) {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
      );
      if (!rows[0]?.present) throw new Error(`Missing Wave B table: ${table}`);
      log(`OK table ${table}`);
    }

    const cols = await prisma.$queryRawUnsafe(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'appointments'
        AND column_name IN ('clinicalServiceId', 'effectiveSnapshotRevisionId', 'clinical_service_id', 'effective_snapshot_revision_id')
    `);
    // Prisma maps camelCase → snake in DB typically; accept either naming.
    const colNames = cols.map((c) => c.column_name);
    const hasClinical =
      colNames.includes('clinicalServiceId') || colNames.includes('clinical_service_id');
    const hasSnap =
      colNames.includes('effectiveSnapshotRevisionId') ||
      colNames.includes('effective_snapshot_revision_id');
    if (!hasClinical || !hasSnap) {
      throw new Error(`appointments missing Wave B columns; found=${colNames.join(',')}`);
    }
    log('OK appointments Wave B columns');

    // Wave A tables still present (non-destructive)
    const wa = await prisma.$queryRawUnsafe(
      `SELECT to_regclass('public.canonical_clinical_service_definitions') IS NOT NULL AS present`,
    );
    if (!wa[0]?.present) throw new Error('Wave A canonical table missing');
    log('OK Wave A catalog preserved');

    run(
      'node',
      ['scripts/backfill-phase48-wave-b-snapshots.mjs'],
      { DATABASE_URL: cleanUrl, ALLOW_TEST_DATABASE_RESET: 'true' },
      BACKFILL_TIMEOUT_MS,
    );
    run(
      'node',
      ['scripts/backfill-phase48-wave-b-snapshots.mjs'],
      { DATABASE_URL: cleanUrl, ALLOW_TEST_DATABASE_RESET: 'true' },
      BACKFILL_TIMEOUT_MS,
    );
    log('OK backfill idempotent');

    console.log('PHASE48_WAVE_B_CLEAN_VALIDATOR_PASSED');
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
