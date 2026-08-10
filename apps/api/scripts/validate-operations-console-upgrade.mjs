#!/usr/bin/env node
/**
 * Flexible Step 22 — isolated upgrade validator.
 * Step 22 adds no Prisma schema migration (flag/API/adapters only).
 * Proves: full migrate deploy is idempotent; Catalog 68/136/68/13 preserved;
 * no invented ops audits/jobs/cache invalidations; no billing/Step 23 schema.
 */
import { spawnSync } from 'child_process';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const upgradeDb = `test_ops22_upgrade_${Date.now()}`;

const BILLING_FORBIDDEN = [
  'platform_billing_runtime',
  'platform_billing_invoices',
  'platform_billing_charges',
  'platform_billing_payments',
  'platform_overage_charges',
];

const STEP23_FORBIDDEN = [
  'platform_sales_representatives',
  'platform_sales_leads',
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
    opsAudits: await prisma.auditEntry.count({
      where: { category: 'operations_console' },
    }),
    digest: await auditDigest(prisma),
    provisioning: await prisma.platformTenantProvisioningRequest.count().catch(() => 0),
    exports: await prisma.platformAuditExportRecord.count().catch(() => 0),
  };
}

async function main() {
  await withAdmin(async (admin) => {
    await admin.$executeRawUnsafe(`SET lock_timeout = '10000'`);
    await admin.$executeRawUnsafe(`SET statement_timeout = 30000`);
    await admin.$executeRawUnsafe(`CREATE DATABASE ${upgradeDb}`);
  });
  console.log(`Step 22 upgrade validator using db=${upgradeDb}`);

  console.log('Step 22 upgrade: migrate deploy (full chain)...');
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

    console.log('Step 22 upgrade: migrate deploy again (idempotent; no Step 22 schema)...');
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
    expect('ops console audits (no invent)', after.opsAudits, 0);
    expect('ops console audits preserved', after.opsAudits, before.opsAudits);
    expect('audit digest preserved', after.digest, before.digest);
    expect('provisioning count preserved', after.provisioning, before.provisioning);
    expect('export records (no auto invent)', after.exports, 0);

    for (const table of [...BILLING_FORBIDDEN, ...STEP23_FORBIDDEN]) {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
      );
      if (rows[0]?.present) throw new Error(`Forbidden table present: ${table}`);
    }

    console.log('OK no billing schema');
    console.log('OK no Step 23 sales schema');
    const opsIdem = await prisma.$queryRawUnsafe(
      `SELECT to_regclass('public.platform_operations_idempotency') IS NOT NULL AS present`,
    );
    if (!opsIdem[0]?.present) {
      throw new Error('Missing platform_operations_idempotency after upgrade');
    }
    console.log('OK platform_operations_idempotency present');
    console.log('Step 22 upgrade migration validator passed.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
