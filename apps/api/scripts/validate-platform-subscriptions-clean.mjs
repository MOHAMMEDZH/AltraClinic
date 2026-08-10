#!/usr/bin/env node
/**
 * Clean-path validation for Phase 47 Step 16 Subscription Commercial Assignment.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const cleanDb = 'booking_test_subscriptions_clean';

const EXPECTED_CATALOG_ITEMS = 68;
const EXPECTED_CATALOG_TRANSLATIONS = 136;
const EXPECTED_CATALOG_ALIASES = 68;
const EXPECTED_CATALOG_RULES = 13;

const STEP16_TABLES = [
  'platform_subscription_commercial_configs',
  'platform_subscription_addon_assignments',
  'platform_subscription_override_assignments',
  'platform_subscription_commercial_snapshots',
  'platform_subscription_commercial_changes',
  'platform_subscription_commercial_idempotency',
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

  console.log('Clean migrate deploy (full chain including Step 16)...');
  run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: cleanUrl });

  const prisma = new PrismaClient({ datasources: { db: { url: cleanUrl } } });
  await prisma.$connect();
  try {
    await prisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
    process.env.DATABASE_URL = cleanUrl;

    run(
      'npx',
      ['ts-node', '--transpile-only', 'src/modules/platform-healthcare-catalog/seed/run-healthcare-catalog-seed.ts'],
      { DATABASE_URL: cleanUrl },
    );
    run(
      'npx',
      ['ts-node', '--transpile-only', 'src/modules/platform-plans/seed/run-platform-plans-seed.ts'],
      { DATABASE_URL: cleanUrl },
    );
    run(
      'npx',
      ['ts-node', '--transpile-only', 'src/modules/platform-addons/seed/run-platform-addons-seed.ts'],
      { DATABASE_URL: cleanUrl },
    );
    run(
      'npx',
      ['ts-node', '--transpile-only', 'src/modules/platform-subscriptions/seed/run-platform-subscriptions-seed.ts'],
      { DATABASE_URL: cleanUrl },
    );
    run(
      'npx',
      ['ts-node', '--transpile-only', 'src/modules/platform-subscriptions/seed/run-platform-subscriptions-seed.ts'],
      { DATABASE_URL: cleanUrl },
    );

    // Prefer raw SQL counts so clean validator does not depend on delegate naming drift.
    const catalogCounts = await prisma.$queryRawUnsafe(`
      SELECT
        (SELECT COUNT(*)::int FROM healthcare_catalog_items) AS items,
        (SELECT COUNT(*)::int FROM healthcare_catalog_translations) AS translations,
        (SELECT COUNT(*)::int FROM healthcare_catalog_aliases) AS aliases,
        (SELECT COUNT(*)::int FROM healthcare_catalog_compatibility_rules) AS rules
    `);
    const items = catalogCounts[0].items;
    const translations = catalogCounts[0].translations;
    const aliases = catalogCounts[0].aliases;
    const rules = catalogCounts[0].rules;
    if (
      items !== EXPECTED_CATALOG_ITEMS ||
      translations !== EXPECTED_CATALOG_TRANSLATIONS ||
      aliases !== EXPECTED_CATALOG_ALIASES ||
      rules !== EXPECTED_CATALOG_RULES
    ) {
      throw new Error(`Catalog inventory mismatch: ${items}/${translations}/${aliases}/${rules}`);
    }

    for (const table of STEP16_TABLES) {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
      );
      if (!rows[0]?.present) throw new Error(`Missing Step 16 table: ${table}`);
    }

    const step17 = await prisma.$queryRawUnsafe(
      `SELECT to_regclass('public.platform_effective_entitlement_runtime') IS NOT NULL AS present`,
    );
    if (step17[0]?.present) throw new Error('Step 17 schema must not exist');

    const configCountRows = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS count FROM platform_subscription_commercial_configs`,
    );
    const configs = configCountRows[0].count;
    if (configs !== 0) throw new Error('Step 16 seed must not invent commercial configs');

    const currentIdx = await prisma.$queryRawUnsafe(`
      SELECT indexname FROM pg_indexes
      WHERE indexname = 'platform_subscription_commercial_one_current_per_tenant'
    `);
    if (!currentIdx.length) throw new Error('Missing one-current-per-tenant index');

    console.log(
      JSON.stringify({
        ok: true,
        catalog: { items, translations, aliases, rules },
        step16Configs: configs,
        noStep17: true,
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
