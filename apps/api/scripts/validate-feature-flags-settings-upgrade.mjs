#!/usr/bin/env node
/**
 * Flexible Step 20 — isolated representative upgrade validator.
 * Parks Step 20 migration, deploys prior chain, seeds fixtures, restores + deploys Step 20.
 */
import { spawnSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const migrationsDir = path.join(apiRoot, 'prisma', 'migrations');
const gateDirName = '20260803010000_phase47_step20_feature_flags_settings';
const parkDir = path.join(apiRoot, 'prisma', '_parked_step20_upgrade');
const upgradeDb = 'booking_test_feature_flags_settings_upgrade';

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

const STEP21_FORBIDDEN = ['platform_audit_center_exports', 'platform_audit_search_index'];

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

function parkGateMigration() {
  fs.mkdirSync(parkDir, { recursive: true });
  const from = path.join(migrationsDir, gateDirName);
  const to = path.join(parkDir, gateDirName);
  if (!fs.existsSync(from)) throw new Error(`Missing migration ${gateDirName}`);
  if (fs.existsSync(to)) fs.rmSync(to, { recursive: true, force: true });
  fs.renameSync(from, to);
}

function restoreGateMigration() {
  const from = path.join(parkDir, gateDirName);
  const to = path.join(migrationsDir, gateDirName);
  if (fs.existsSync(from)) {
    if (fs.existsSync(to)) fs.rmSync(to, { recursive: true, force: true });
    fs.renameSync(from, to);
  }
  if (fs.existsSync(parkDir) && fs.readdirSync(parkDir).length === 0) {
    fs.rmdirSync(parkDir);
  }
}

async function tablePresent(prisma, table) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
  );
  return Boolean(rows[0]?.present);
}

async function digestSnapshot(prisma) {
  const catalog = {
    items: await prisma.healthcareCatalogItem.count(),
    translations: await prisma.healthcareCatalogTranslation.count(),
    aliases: await prisma.healthcareCatalogAlias.count(),
    rules: await prisma.healthcareCatalogCompatibilityRule.count(),
  };
  const tenants = await prisma.platformTenant.count();
  const lifecycle = (await tablePresent(prisma, 'platform_tenant_lifecycle_requests'))
    ? await prisma.platformTenantLifecycleRequest.count()
    : 0;
  const payload = { catalog, tenants, lifecycle };
  const digest = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  return { ...payload, digest };
}

async function seedCatalogIfEmpty() {
  const prisma = new PrismaClient({ datasources: { db: { url: upgradeUrl } } });
  await prisma.$connect();
  try {
    await prisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
    if ((await prisma.healthcareCatalogItem.count()) === 0) {
      run('npm', ['run', 'seed:healthcare-catalog'], { DATABASE_URL: upgradeUrl });
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function seedFixture() {
  const prisma = new PrismaClient({ datasources: { db: { url: upgradeUrl } } });
  await prisma.$connect();
  try {
    await prisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
    const tenantId = randomUUID();
    await prisma.tenant.create({
      data: {
        id: tenantId,
        name: 'Step20 Upgrade Clinic',
        slug: `s20-${tenantId.slice(0, 8)}`,
        status: 'ACTIVE',
        lifecycleStatus: 'ACTIVE',
        timezone: 'UTC',
        locale: 'en-US',
        features: {},
      },
    });
    await prisma.platformTenant.create({
      data: {
        tenantId,
        displayName: 'Step20 Upgrade Clinic',
        region: 'ME_SOUTH',
        plan: 'PRO',
        status: 'ACTIVE',
        rowVersion: 1,
        provisionedBy: randomUUID(),
        activatedAt: new Date(),
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  let parked = false;
  try {
    parkGateMigration();
    parked = true;

    await withAdmin(async (admin) => {
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${upgradeDb} WITH (FORCE)`);
      await admin.$executeRawUnsafe(`CREATE DATABASE ${upgradeDb}`);
    });

    console.log('Deploy pre-Step-20 migrations...');
    run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: upgradeUrl });
    await seedCatalogIfEmpty();
    await seedFixture();

    const beforeClient = new PrismaClient({ datasources: { db: { url: upgradeUrl } } });
    await beforeClient.$connect();
    let before;
    try {
      await beforeClient.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
      for (const table of STEP20_TABLES) {
        if (await tablePresent(beforeClient, table)) {
          throw new Error(`Step 20 table unexpectedly present before gate: ${table}`);
        }
      }
      before = await digestSnapshot(beforeClient);
      console.log('BEFORE digest', before.digest, before.catalog);
    } finally {
      await beforeClient.$disconnect();
    }

    restoreGateMigration();
    parked = false;

    console.log('Deploy Step 20 migration...');
    run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: upgradeUrl });

    const afterClient = new PrismaClient({ datasources: { db: { url: upgradeUrl } } });
    await afterClient.$connect();
    try {
      await afterClient.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
      for (const table of STEP20_TABLES) {
        if (!(await tablePresent(afterClient, table))) {
          throw new Error(`Missing Step 20 table after upgrade: ${table}`);
        }
      }
      for (const table of [...BILLING_FORBIDDEN, ...STEP21_FORBIDDEN]) {
        if (await tablePresent(afterClient, table)) {
          throw new Error(`Forbidden table present: ${table}`);
        }
      }

      const after = await digestSnapshot(afterClient);
      console.log('AFTER digest', after.digest, after.catalog);

      if (after.catalog.items !== 68 || after.catalog.translations !== 136) {
        throw new Error('Catalog counts drifted');
      }
      if (after.catalog.aliases !== 68 || after.catalog.rules !== 13) {
        throw new Error('Catalog aliases/rules drifted');
      }
      if (after.digest !== before.digest) {
        throw new Error(`Commercial/lifecycle digest changed: ${before.digest} -> ${after.digest}`);
      }

      const flags = await afterClient.platformFeatureFlag.count();
      const settings = await afterClient.platformGlobalSetting.count();
      const kills = await afterClient.platformFeatureFlag.count({
        where: { killSwitchActive: true },
      });
      if (flags !== 0 || settings !== 0 || kills !== 0) {
        throw new Error(`Unexpected auto seed flags=${flags} settings=${settings} kills=${kills}`);
      }

      console.log('OK Catalog 68/136/68/13 preserved');
      console.log('OK zero automatic flags/settings/kill-switches');
      console.log('OK no billing/Step 21 schema');
      console.log('Step 20 upgrade migration validator passed.');
    } finally {
      await afterClient.$disconnect();
    }
  } finally {
    if (parked) restoreGateMigration();
  }
}

main().catch((err) => {
  console.error(err);
  try {
    restoreGateMigration();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
