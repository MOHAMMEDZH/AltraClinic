#!/usr/bin/env node
/**
 * Flexible Step 21 — isolated representative upgrade validator.
 * Parks Step 21 migration, deploys prior chain, captures audit digests, restores + deploys Step 21.
 */
import { spawnSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const migrationsDir = path.join(apiRoot, 'prisma', 'migrations');
const gateDirName = '20260805010000_phase47_step21_audit_center';
const parkDir = path.join(apiRoot, 'prisma', '_parked_step21_upgrade');
const upgradeDb = `test_ac_upgrade_${Date.now()}`;

const BILLING_FORBIDDEN = [
  'platform_billing_runtime',
  'platform_billing_invoices',
  'platform_billing_charges',
  'platform_billing_payments',
  'platform_overage_charges',
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

function parkMigration() {
  fs.mkdirSync(parkDir, { recursive: true });
  const src = path.join(migrationsDir, gateDirName);
  const dest = path.join(parkDir, gateDirName);
  if (!fs.existsSync(src)) throw new Error(`Missing migration ${gateDirName}`);
  if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
  // Prefer copy+remove over rename — Windows often EPERM on rename while tools hold handles.
  fs.cpSync(src, dest, { recursive: true });
  fs.rmSync(src, { recursive: true, force: true });
}

function restoreMigration() {
  const src = path.join(parkDir, gateDirName);
  const dest = path.join(migrationsDir, gateDirName);
  if (!fs.existsSync(src)) throw new Error('Parked migration missing');
  if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true });
  try {
    fs.rmSync(parkDir, { recursive: true, force: true });
  } catch {
    /* ignore */
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

async function catalogCounts(prisma) {
  return {
    items: await prisma.healthcareCatalogItem.count(),
    translations: await prisma.healthcareCatalogTranslation.count(),
    aliases: await prisma.healthcareCatalogAlias.count(),
    rules: await prisma.healthcareCatalogCompatibilityRule.count(),
  };
}

async function main() {
  let parked = false;
  try {
    await withAdmin(async (admin) => {
      // Unique DB name per run — avoid DROP DATABASE WITH (FORCE) on a fixed shared name
      // (FORCE can block indefinitely when backends are non-terminable / CheckpointDone).
      await admin.$executeRawUnsafe(`SET lock_timeout = '10000'`);
      await admin.$executeRawUnsafe(`SET statement_timeout = 30000`);
      await admin.$executeRawUnsafe(`CREATE DATABASE ${upgradeDb}`);
    });
    console.log(`Step 21 upgrade validator using db=${upgradeDb}`);

    parkMigration();
    parked = true;
    console.log('Step 21 upgrade: migrate prior chain (Step 21 parked)...');
    run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: upgradeUrl });

    const beforePrisma = new PrismaClient({ datasources: { db: { url: upgradeUrl } } });
    await beforePrisma.$connect();
    let before;
    try {
      await beforePrisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
      if ((await beforePrisma.healthcareCatalogItem.count()) === 0) {
        run('npm', ['run', 'seed:healthcare-catalog'], { DATABASE_URL: upgradeUrl });
      }
      const catalog = await catalogCounts(beforePrisma);
      before = {
        ...catalog,
        audits: await beforePrisma.auditEntry.count(),
        digest: await auditDigest(beforePrisma),
        flagHistory: await beforePrisma.platformFeatureFlagHistory.count(),
        settingHistory: await beforePrisma.platformGlobalSettingHistory.count(),
      };
      console.log('Before Step 21 upgrade', before);
    } finally {
      await beforePrisma.$disconnect();
    }

    restoreMigration();
    parked = false;
    console.log('Step 21 upgrade: deploy Step 21 migration...');
    run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: upgradeUrl });

    const afterPrisma = new PrismaClient({ datasources: { db: { url: upgradeUrl } } });
    await afterPrisma.$connect();
    try {
      await afterPrisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
      const catalog = await catalogCounts(afterPrisma);
      const after = {
        ...catalog,
        audits: await afterPrisma.auditEntry.count(),
        digest: await auditDigest(afterPrisma),
        flagHistory: await afterPrisma.platformFeatureFlagHistory.count(),
        settingHistory: await afterPrisma.platformGlobalSettingHistory.count(),
        exports: await afterPrisma.platformAuditExportRecord.count(),
      };
      console.log('After Step 21 upgrade', after);

      const expect = (name, actual, want) => {
        if (actual !== want) throw new Error(`${name}: expected ${want}, got ${actual}`);
        console.log(`OK ${name}=${actual}`);
      };

      expect('Catalog Items', after.items, 68);
      expect('Catalog Translations', after.translations, 136);
      expect('Catalog Aliases', after.aliases, 68);
      expect('Catalog Compatibility rules', after.rules, 13);
      expect('audit count preserved', after.audits, before.audits);
      expect('audit digest preserved', after.digest, before.digest);
      expect('flag history preserved', after.flagHistory, before.flagHistory);
      expect('setting history preserved', after.settingHistory, before.settingHistory);
      expect('export records (no auto invent)', after.exports, 0);

      for (const table of BILLING_FORBIDDEN) {
        const rows = await afterPrisma.$queryRawUnsafe(
          `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
        );
        if (rows[0]?.present) throw new Error(`Forbidden billing table: ${table}`);
      }

      const exportPresent = await afterPrisma.$queryRawUnsafe(
        `SELECT to_regclass('public.platform_audit_export_records') IS NOT NULL AS present`,
      );
      if (!exportPresent[0]?.present) throw new Error('Missing platform_audit_export_records');

      console.log('Step 21 upgrade migration validator passed.');
    } finally {
      await afterPrisma.$disconnect();
    }
  } catch (err) {
    if (parked) {
      try {
        restoreMigration();
      } catch (restoreErr) {
        console.error('Failed to restore parked migration', restoreErr);
      }
    }
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
