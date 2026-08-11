#!/usr/bin/env node
/**
 * Flexible Step 26 — Sales Productivity / Commission Snapshot upgrade validator.
 * Proves: migrate deploy chain is idempotent with Step 26 schema present;
 * Catalog 68/136/68/13 preserved; migration never invents snapshots or commission audits;
 * no Step 27 / payroll / billing tables.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const upgradeDb = `test_sales26_upgrade_${Date.now()}`;

const BILLING_FORBIDDEN = [
  'platform_billing_runtime',
  'platform_billing_invoices',
  'platform_billing_charges',
  'platform_billing_payments',
  'platform_overage_charges',
];

const STEP26_REQUIRED = ['platform_sales_commission_snapshots'];

const STEP27_AND_PAYROLL_FORBIDDEN = [
  'platform_sales_opportunities',
  'platform_sales_pipeline_stages',
  'platform_sales_commissions',
  'platform_sales_commission_rules',
  'platform_sales_productivity_snapshots',
  'platform_payroll_runs',
  'platform_payslips',
  'platform_sales_notification_templates',
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
  console.log(`[sales26-upgrade] CREATE DATABASE ${upgradeDb}`);
  await withAdmin(async (admin) => {
    await admin.$executeRawUnsafe(`CREATE DATABASE ${upgradeDb}`);
  });

  console.log('[sales26-upgrade] first migrate deploy...');
  run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: upgradeUrl });

  console.log('[sales26-upgrade] second migrate deploy (idempotent)...');
  run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: upgradeUrl });

  const prisma = new PrismaClient({ datasources: { db: { url: upgradeUrl } } });
  await prisma.$connect();
  try {
    await prisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;

    for (const table of STEP26_REQUIRED) {
      if (!(await tablePresent(prisma, table))) {
        throw new Error(`Missing required Step 26 table: ${table}`);
      }
    }
    for (const table of [...BILLING_FORBIDDEN, ...STEP27_AND_PAYROLL_FORBIDDEN]) {
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

    const [items, translations, aliases, rules, snapshots, commissionAudits] = await Promise.all([
      prisma.healthcareCatalogItem.count(),
      prisma.healthcareCatalogTranslation.count(),
      prisma.healthcareCatalogAlias.count(),
      prisma.healthcareCatalogCompatibilityRule.count(),
      prisma.platformSalesCommissionSnapshot.count(),
      prisma.auditEntry.count({ where: { category: 'sales_commission_management' } }),
    ]);

    const expect = (name, actual, want) => {
      if (actual !== want) throw new Error(`${name}: expected ${want}, got ${actual}`);
      console.log(`OK ${name}=${actual}`);
    };

    expect('Catalog Items', items, 68);
    expect('Catalog Translations', translations, 136);
    expect('Catalog Aliases', aliases, 68);
    expect('Catalog Compatibility rules', rules, 13);
    expect('commission snapshots (empty after migrate)', snapshots, 0);
    expect('commission audits (empty after migrate)', commissionAudits, 0);

    const idx = await prisma.$queryRawUnsafe(
      `SELECT indexdef FROM pg_indexes WHERE tablename = 'platform_sales_commission_snapshots'`,
    );
    const defs = idx.map((r) => r.indexdef).join('\n');
    if (!defs.includes('platform_sales_commission_snapshots_active_unique')) {
      throw new Error('Missing partial unique index platform_sales_commission_snapshots_active_unique');
    }
    console.log('OK partial unique index retained after upgrade deploy');
    console.log(`[sales26-upgrade] passed (db=${upgradeDb}).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
