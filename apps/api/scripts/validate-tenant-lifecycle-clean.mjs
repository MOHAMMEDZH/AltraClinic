#!/usr/bin/env node
/**
 * Flexible Step 19 — clean migration validator.
 * Isolated DB: migrate deploy → seed catalog → assert zero lifecycle side effects.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const cleanDb = 'booking_test_tenant_lifecycle_clean';

const STEP19_TABLES = [
  'platform_tenant_lifecycle_requests',
  'platform_tenant_lifecycle_idempotency',
];

const BILLING_FORBIDDEN = [
  'platform_billing_runtime',
  'platform_billing_invoices',
  'platform_billing_charges',
  'platform_billing_payments',
  'platform_overage_charges',
];

const STEP20_FORBIDDEN = [
  'platform_tenant_lifecycle_actions',
  'platform_billing_accounts',
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

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

async function connectWithRetry(url, attempts = 30) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    // Direct Prisma connect only — do not gate on Docker CLI (may hang/500 while TCP is healthy).
    const client = new PrismaClient({ datasources: { db: { url } } });
    try {
      await client.$connect();
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
    await admin.$disconnect();
  }
}

async function main() {
  await withAdmin(async (admin) => {
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${cleanDb} WITH (FORCE)`);
    await admin.$executeRawUnsafe(`CREATE DATABASE ${cleanDb}`);
  });

  console.log('Step 19 clean migrate deploy...');
  run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: cleanUrl });

  const prisma = new PrismaClient({ datasources: { db: { url: cleanUrl } } });
  await prisma.$connect();
  try {
    await prisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;

    for (const table of STEP19_TABLES) {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
      );
      if (!rows[0]?.present) throw new Error(`Missing Step 19 table: ${table}`);
    }

    for (const table of [...BILLING_FORBIDDEN, ...STEP20_FORBIDDEN]) {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
      );
      if (rows[0]?.present) throw new Error(`Forbidden table present: ${table}`);
    }

    const catalogItems = await prisma.healthcareCatalogItem.count();
    if (catalogItems === 0) {
      console.log('Catalog empty after migrate; running healthcare catalog seed...');
      run('npm', ['run', 'seed:healthcare-catalog'], { DATABASE_URL: cleanUrl });
    }

    const [items, translations, aliases, rules, requests, tenants, idempotency, badRv] =
      await Promise.all([
        prisma.healthcareCatalogItem.count(),
        prisma.healthcareCatalogTranslation.count(),
        prisma.healthcareCatalogAlias.count(),
        prisma.healthcareCatalogCompatibilityRule.count(),
        prisma.platformTenantLifecycleRequest.count(),
        prisma.platformTenant.count(),
        prisma.platformTenantLifecycleIdempotencyRecord.count(),
        prisma.platformTenant.count({ where: { rowVersion: { lt: 1 } } }),
      ]);

    const expect = (name, actual, want) => {
      if (actual !== want) throw new Error(`${name}: expected ${want}, got ${actual}`);
      console.log(`OK ${name}=${actual}`);
    };

    expect('Catalog Items', items, 68);
    expect('Catalog Translations', translations, 136);
    expect('Catalog Aliases', aliases, 68);
    expect('Catalog Compatibility rules', rules, 13);
    expect('lifecycle requests', requests, 0);
    expect('lifecycle idempotency', idempotency, 0);
    expect('tenants', tenants, 0);
    expect('tenants with rowVersion < 1', badRv, 0);

    console.log('OK no billing/Step20 schema tables detected');
    console.log('OK zero automatic lifecycle mutations');
    console.log('Step 19 clean migration validator passed.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
