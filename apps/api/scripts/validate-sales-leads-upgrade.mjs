#!/usr/bin/env node
/**
 * Flexible Step 24 — Leads and Sales Pipeline upgrade validator.
 * Proves: full migrate deploy chain is idempotent with Step 23+24 schema present;
 * Catalog 68/136/68/13 preserved; no invented sales audits/records from migration;
 * no billing/trials/opportunities/pipeline_stages.
 */
import { spawnSync } from 'child_process';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const upgradeDb = `test_sales24_upgrade_${Date.now()}`;

const BILLING_FORBIDDEN = [
  'platform_billing_runtime',
  'platform_billing_invoices',
  'platform_billing_charges',
  'platform_billing_payments',
  'platform_overage_charges',
];

const STEP23_ALLOWED = [
  'platform_sales_representatives',
  'platform_sales_customer_ownership',
  'platform_sales_customer_ownership_history',
  'platform_sales_idempotency',
];

const STEP24_ALLOWED = [
  'platform_sales_leads',
  'platform_sales_lead_stage_history',
  'platform_sales_lead_ownership_history',
  'platform_sales_lead_notes',
];

const STEP25_PLUS_FORBIDDEN = [
  'platform_sales_opportunities',
  'platform_sales_pipeline_stages',
  'platform_sales_trials',
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

async function auditDigest(prisma) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT "id"::text AS id, "action", "createdAt"::text AS created_at, "correlationId"::text AS corr
    FROM "audit_entries"
    ORDER BY "id"
    LIMIT 5000
  `);
  return crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}

async function snapshot(prisma) {
  return {
    items: await prisma.healthcareCatalogItem.count(),
    translations: await prisma.healthcareCatalogTranslation.count(),
    aliases: await prisma.healthcareCatalogAlias.count(),
    rules: await prisma.healthcareCatalogCompatibilityRule.count(),
    audits: await prisma.auditEntry.count(),
    salesAudits: await prisma.auditEntry.count({
      where: { category: { in: ['sales_representative_management', 'sales_pipeline_management'] } },
    }),
    digest: await auditDigest(prisma),
    salesReps: await prisma.platformSalesRepresentative.count().catch(() => 0),
    salesLeads: await prisma.platformSalesLead.count().catch(() => 0),
    leadStageHistory: await prisma.platformSalesLeadStageHistory.count().catch(() => 0),
    leadOwnershipHistory: await prisma.platformSalesLeadOwnershipHistory.count().catch(() => 0),
    leadNotes: await prisma.platformSalesLeadNote.count().catch(() => 0),
    salesIdempotency: await prisma.platformSalesIdempotencyRecord.count().catch(() => 0),
  };
}

async function main() {
  await withAdmin(async (admin) => {
    await admin.$executeRawUnsafe(`SET lock_timeout = '10000'`);
    await admin.$executeRawUnsafe(`SET statement_timeout = 30000`);
    await admin.$executeRawUnsafe(`CREATE DATABASE ${upgradeDb}`);
  });
  console.log(`Step 24 upgrade validator using db=${upgradeDb}`);

  console.log('Step 24 upgrade: migrate deploy (full chain)...');
  run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: upgradeUrl });

  const prisma = new PrismaClient({ datasources: { db: { url: upgradeUrl } } });
  await prisma.$connect();
  try {
    await prisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
    if ((await prisma.healthcareCatalogItem.count()) === 0) {
      run('npm', ['run', 'seed:healthcare-catalog'], { DATABASE_URL: upgradeUrl });
    }

    const before = await snapshot(prisma);
    console.log('Before idempotent re-deploy', before);

    console.log('Step 24 upgrade: migrate deploy again (idempotent; no new schema)...');
    run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: upgradeUrl });

    const after = await snapshot(prisma);
    console.log('After idempotent re-deploy', after);

    const expect = (name, actual, want) => {
      if (actual !== want) throw new Error(`${name}: expected ${want}, got ${actual}`);
      console.log(`OK ${name}=${actual}`);
    };

    expect('Catalog Items', after.items, 68);
    expect('Catalog Translations', after.translations, 136);
    expect('Catalog Aliases', after.aliases, 68);
    expect('Catalog Compatibility rules', after.rules, 13);
    expect('audit count preserved', after.audits, before.audits);
    expect('sales audits (no invent)', after.salesAudits, 0);
    expect('sales audits preserved', after.salesAudits, before.salesAudits);
    expect('audit digest preserved', after.digest, before.digest);
    expect('sales representatives preserved (no auto invent)', after.salesReps, before.salesReps);
    expect('sales leads preserved (no auto invent)', after.salesLeads, before.salesLeads);
    expect('lead stage history preserved', after.leadStageHistory, before.leadStageHistory);
    expect('lead ownership history preserved', after.leadOwnershipHistory, before.leadOwnershipHistory);
    expect('lead notes preserved', after.leadNotes, before.leadNotes);
    expect('sales idempotency records preserved (no auto invent)', after.salesIdempotency, before.salesIdempotency);

    for (const table of [...BILLING_FORBIDDEN, ...STEP25_PLUS_FORBIDDEN]) {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
      );
      if (rows[0]?.present) throw new Error(`Forbidden table present: ${table}`);
    }

    for (const table of [...STEP23_ALLOWED, ...STEP24_ALLOWED]) {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
      );
      if (!rows[0]?.present) throw new Error(`Missing Step 23/24 table after upgrade: ${table}`);
    }

    console.log('OK no billing/trials schema');
    console.log('OK Step 24 sales lead schema present and stable across re-deploy');
    console.log('Step 24 upgrade migration validator passed.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
