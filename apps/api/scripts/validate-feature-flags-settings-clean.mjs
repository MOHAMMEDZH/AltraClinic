#!/usr/bin/env node
/**
 * Flexible Step 20 — clean migration validator.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const cleanDb = 'booking_test_feature_flags_settings_clean';

const STEP20_TABLES = [
  'platform_feature_flags',
  'platform_feature_flag_targets',
  'platform_feature_flag_history',
  'platform_feature_flag_idempotency',
  'platform_global_settings',
  'platform_global_setting_history',
  'platform_global_setting_idempotency',
];

const BILLING_FORBIDDEN = [
  'platform_billing_runtime',
  'platform_billing_invoices',
  'platform_billing_charges',
  'platform_billing_payments',
  'platform_overage_charges',
];

const STEP21_FORBIDDEN = [
  'platform_audit_center_exports',
  'platform_audit_search_index',
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

  console.log('Step 20 clean migrate deploy...');
  run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: cleanUrl });

  const prisma = new PrismaClient({ datasources: { db: { url: cleanUrl } } });
  await prisma.$connect();
  try {
    await prisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;

    for (const table of STEP20_TABLES) {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
      );
      if (!rows[0]?.present) throw new Error(`Missing Step 20 table: ${table}`);
    }

    for (const table of [...BILLING_FORBIDDEN, ...STEP21_FORBIDDEN]) {
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

    const [
      items,
      translations,
      aliases,
      rules,
      flags,
      settings,
      activeKill,
      tenants,
      flagIdemp,
      settingIdemp,
    ] = await Promise.all([
      prisma.healthcareCatalogItem.count(),
      prisma.healthcareCatalogTranslation.count(),
      prisma.healthcareCatalogAlias.count(),
      prisma.healthcareCatalogCompatibilityRule.count(),
      prisma.platformFeatureFlag.count(),
      prisma.platformGlobalSetting.count(),
      prisma.platformFeatureFlag.count({ where: { killSwitchActive: true } }),
      prisma.platformTenant.count(),
      prisma.platformFeatureFlagIdempotencyRecord.count(),
      prisma.platformGlobalSettingIdempotencyRecord.count(),
    ]);

    const expect = (name, actual, want) => {
      if (actual !== want) throw new Error(`${name}: expected ${want}, got ${actual}`);
      console.log(`OK ${name}=${actual}`);
    };

    expect('Catalog Items', items, 68);
    expect('Catalog Translations', translations, 136);
    expect('Catalog Aliases', aliases, 68);
    expect('Catalog Compatibility rules', rules, 13);
    expect('feature flags', flags, 0);
    expect('global settings', settings, 0);
    expect('active kill switches', activeKill, 0);
    expect('tenants', tenants, 0);
    expect('flag idempotency', flagIdemp, 0);
    expect('setting idempotency', settingIdemp, 0);

    console.log('OK no billing/Step 21 schema tables detected');
    console.log('OK zero automatic flag/settings/secret seeds');
    console.log('Step 20 clean migration validator passed.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
