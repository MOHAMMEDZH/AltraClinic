#!/usr/bin/env node
/**
 * Flexible Step 27 — Notifications and Templates upgrade validator.
 * Proves: migrate deploy chain is idempotent with Step 27 schema present;
 * Catalog 68/136/68/13 preserved; migration never invents preferences or audits;
 * Phase 41d engine remains sole delivery SoR; no Step 28 / second-engine tables.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const upgradeDb = `test_notif27_upgrade_${Date.now()}`;

const STEP27_REQUIRED = ['platform_notification_preferences'];

const ENGINE_TABLES = [
  'notification_intents',
  'notification_messages',
  'notification_delivery_jobs',
  'notification_delivery_attempts',
  'notification_receipts',
];

const FORBIDDEN = [
  'platform_notification_templates',
  'platform_notification_template_versions',
  'platform_notification_engine',
  'platform_notification_engine_jobs',
  'platform_sales_notification_templates',
  'platform_hardening_runs',
  'platform_release_gates',
  'platform_step28_artifacts',
  'platform_step29_artifacts',
  'platform_billing_runtime',
  'platform_billing_invoices',
  'platform_payroll_runs',
  'platform_payslips',
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

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

async function connectWithRetry(url, attempts = 30) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
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

async function tablePresent(prisma, table) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
  );
  return Boolean(rows[0]?.present);
}

async function main() {
  console.log(`[notif27-upgrade] CREATE DATABASE ${upgradeDb}`);
  await withAdmin(async (admin) => {
    await admin.$executeRawUnsafe(`CREATE DATABASE ${upgradeDb}`);
  });

  console.log('[notif27-upgrade] first migrate deploy...');
  run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: upgradeUrl });

  console.log('[notif27-upgrade] second migrate deploy (idempotent)...');
  run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: upgradeUrl });

  const prisma = new PrismaClient({ datasources: { db: { url: upgradeUrl } } });
  await prisma.$connect();
  try {
    await prisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;

    for (const table of STEP27_REQUIRED) {
      if (!(await tablePresent(prisma, table))) {
        throw new Error(`Missing required Step 27 table: ${table}`);
      }
    }
    for (const table of ENGINE_TABLES) {
      if (!(await tablePresent(prisma, table))) {
        throw new Error(`Missing Phase 41d engine table: ${table}`);
      }
    }
    for (const table of FORBIDDEN) {
      if (await tablePresent(prisma, table)) {
        throw new Error(`Forbidden table present: ${table}`);
      }
    }

    const catalogItems = await prisma.healthcareCatalogItem.count();
    if (catalogItems === 0) {
      await prisma.$disconnect();
      run('npm', ['run', 'seed:healthcare-catalog'], { DATABASE_URL: upgradeUrl });
      await prisma.$connect();
    }

    const [items, translations, aliases, rules, prefs, notifAudits] = await Promise.all([
      prisma.healthcareCatalogItem.count(),
      prisma.healthcareCatalogTranslation.count(),
      prisma.healthcareCatalogAlias.count(),
      prisma.healthcareCatalogCompatibilityRule.count(),
      prisma.platformNotificationPreference.count(),
      prisma.auditEntry.count({ where: { category: 'platform_notification_management' } }),
    ]);

    const expect = (name, actual, want) => {
      if (actual !== want) throw new Error(`${name}: expected ${want}, got ${actual}`);
      console.log(`OK ${name}=${actual}`);
    };

    expect('Catalog Items', items, 68);
    expect('Catalog Translations', translations, 136);
    expect('Catalog Aliases', aliases, 68);
    expect('Catalog Compatibility rules', rules, 13);
    expect('preferences (empty after migrate)', prefs, 0);
    expect('notification audits (empty after migrate)', notifAudits, 0);

    const idx = await prisma.$queryRawUnsafe(
      `SELECT indexdef FROM pg_indexes WHERE tablename = 'platform_notification_preferences'`,
    );
    const defs = idx.map((r) => r.indexdef).join('\n');
    if (!defs.includes('platform_notification_preferences_user_cat_ch_uidx')) {
      throw new Error(
        'Missing unique index platform_notification_preferences_user_cat_ch_uidx',
      );
    }
    console.log('OK preference unique index retained after upgrade deploy');
    console.log(`[notif27-upgrade] passed (db=${upgradeDb}).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
