#!/usr/bin/env node
/**
 * Phase 48 Wave A — clean migration validator.
 * Fresh DB: migrate deploy → assert Wave A tables/indexes/invariants → backfill → shared SYSTEM_CANONICAL.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const cleanDb = `test_p48wa_clean_${Date.now()}`;

const OVERALL_DEADLINE_MS = 10 * 60 * 1000;
const MIGRATE_TIMEOUT_MS = 5 * 60 * 1000;
const BACKFILL_TIMEOUT_MS = 3 * 60 * 1000;
const CONNECT_ATTEMPTS = 30;

const WAVE_A_TABLES = [
  'canonical_clinical_service_definitions',
  'clinical_service_translations',
  'clinical_service_aliases',
  'tenant_service_presentation_overrides',
  'tenant_service_configurations',
  'clinical_service_price_versions',
  'legacy_clinical_service_mappings',
  'legacy_clinical_price_mappings',
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
  console.log(`[phase48-wave-a-clean +${Date.now() - startedAt}ms] ${msg}`);
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

async function connectWithRetry(url, attempts = CONNECT_ATTEMPTS) {
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
    console.error(`Wave A clean validator hard deadline exceeded.`);
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

    for (const table of WAVE_A_TABLES) {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
      );
      if (!rows[0]?.present) throw new Error(`Missing Wave A table: ${table}`);
      log(`OK table ${table}`);
    }

    // ServicePrice must still exist (non-destructive).
    const sp = await prisma.$queryRawUnsafe(
      `SELECT to_regclass('public.service_prices') IS NOT NULL AS present`,
    );
    if (!sp[0]?.present) throw new Error('service_prices missing — destructive regression');
    log('OK service_prices preserved');

    // Partial unique indexes for NULL-safe tenant default config
    const idx = await prisma.$queryRawUnsafe(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'tenant_service_configurations'
        AND indexname IN (
          'tenant_service_configurations_tenant_default_uidx',
          'tenant_service_configurations_tenant_branch_uidx'
        )
    `);
    if (idx.length < 2) {
      throw new Error('Missing tenant_service_configurations NULL-safe unique indexes');
    }
    log('OK tenant config unique indexes');

    run('node', ['scripts/phase48-wave-a-backfill.mjs'], { DATABASE_URL: cleanUrl }, BACKFILL_TIMEOUT_MS);

    const canonical = await prisma.canonicalClinicalServiceDefinition.findMany({
      where: { provenance: 'SYSTEM_CANONICAL' },
    });
    if (canonical.length !== 7) {
      throw new Error(`Expected 7 SYSTEM_CANONICAL seeds, got ${canonical.length}`);
    }
    const tenantScopedCanonical = canonical.filter((c) => c.tenantId !== null);
    if (tenantScopedCanonical.length > 0) {
      throw new Error('SYSTEM_CANONICAL must have tenantId=null (no tenant clones)');
    }
    log('OK shared SYSTEM_CANONICAL seeds (7)');

    // Idempotent re-run
    run('node', ['scripts/phase48-wave-a-backfill.mjs'], { DATABASE_URL: cleanUrl }, BACKFILL_TIMEOUT_MS);
    const canonical2 = await prisma.canonicalClinicalServiceDefinition.count({
      where: { provenance: 'SYSTEM_CANONICAL' },
    });
    if (canonical2 !== 7) throw new Error(`Idempotent backfill drifted: ${canonical2}`);
    log('OK backfill idempotent');

    // HealthcareCatalog still separate
    const hc = await prisma.healthcareCatalogItem.count().catch(() => 0);
    log(`OK HealthcareCatalog items untouched count=${hc} (separate SoR)`);

    console.log('PHASE48_WAVE_A_CLEAN_VALIDATOR_PASSED');
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
