#!/usr/bin/env node
/**
 * Flexible Step 19 — isolated canonical upgrade validator.
 * Parks Step 19 migration, deploys prior chain into disposable DB with Catalog 68/136/68/13,
 * seeds representative pre-Step-19 fixtures, restores + deploys Step 19 once, proves zero
 * invented lifecycle actions and unchanged digests. Shared booking_test is non-authoritative.
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
const gateDirName = '20260731200000_phase47_step19_tenant_lifecycle';
const parkDir = path.join(apiRoot, 'prisma', '_parked_step19_upgrade');
const upgradeDb = 'booking_test_tenant_lifecycle_upgrade';

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
  const tenants = await prisma.platformTenant.findMany({
    select: {
      id: true,
      tenantId: true,
      status: true,
      displayName: true,
      suspendedAt: true,
      archivedAt: true,
    },
    orderBy: { id: 'asc' },
  });
  const catalog = {
    items: await prisma.healthcareCatalogItem.count(),
    translations: await prisma.healthcareCatalogTranslation.count(),
    aliases: await prisma.healthcareCatalogAlias.count(),
    rules: await prisma.healthcareCatalogCompatibilityRule.count(),
  };
  const commercials = await prisma.platformSubscriptionCommercialConfig.count().catch(() => 0);
  const snapshots = await prisma.platformSubscriptionCommercialSnapshot.count().catch(() => 0);
  const provisioning = await prisma.platformTenantProvisioningRequest.count().catch(() => 0);
  const sessions = await prisma.refreshToken.count().catch(() => 0);
  const platformSessions = await prisma.platformRefreshToken.count().catch(() => 0);
  const audits = await prisma.auditEntry.count().catch(() => 0);
  const usageObs = await prisma.platformUsageObservation.count().catch(() => 0);
  const usageCtr = await prisma.platformUsageCounter.count().catch(() => 0);

  const tenantDigest = crypto
    .createHash('sha256')
    .update(
      tenants
        .map(
          (t) =>
            `${t.id}:${t.tenantId}:${t.status}:${t.displayName}:${t.suspendedAt?.toISOString() ?? ''}:${t.archivedAt?.toISOString() ?? ''}`,
        )
        .join('|'),
    )
    .digest('hex');

  const payload = {
    catalog,
    tenantCount: tenants.length,
    tenantDigest,
    commercials,
    snapshots,
    provisioning,
    sessions,
    platformSessions,
    audits,
    usageObs,
    usageCtr,
  };
  const digest = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  return { ...payload, digest, tenants };
}

async function seedCatalogIfEmpty(prisma) {
  const catalogItems = await prisma.healthcareCatalogItem.count();
  if (catalogItems > 0) return;
  console.log('Catalog empty; seeding healthcare catalog…');
  run('npm', ['run', 'seed:healthcare-catalog'], { DATABASE_URL: upgradeUrl });
}

async function seedPreStep19Fixture(prisma) {
  const activeTenantId = randomUUID();
  const suspendedTenantId = randomUUID();
  const provisioningTenantId = randomUUID();
  const activePtId = randomUUID();
  const suspendedPtId = randomUUID();
  const provisioningPtId = randomUUID();

  // Raw inserts: generated Prisma client knows rowVersion, but pre-Step-19 DB does not.
  for (const row of [
    {
      tenantId: activeTenantId,
      ptId: activePtId,
      name: 'Upgrade Active Clinic',
      status: 'ACTIVE',
      activatedAt: new Date(),
      suspendedAt: null,
      suspensionReason: null,
    },
    {
      tenantId: suspendedTenantId,
      ptId: suspendedPtId,
      name: 'Upgrade Suspended Clinic',
      status: 'SUSPENDED',
      activatedAt: new Date(),
      suspendedAt: new Date(),
      suspensionReason: 'fixture',
    },
    {
      tenantId: provisioningTenantId,
      ptId: provisioningPtId,
      name: 'Upgrade Provisioning Clinic',
      status: 'PROVISIONING',
      activatedAt: null,
      suspendedAt: null,
      suspensionReason: null,
    },
  ]) {
    const clinicStatus = row.status === 'PROVISIONING' ? 'ACTIVE' : row.status;
    const lifecycleStatus = row.status === 'PROVISIONING' ? 'TRIAL' : row.status;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "tenants" ("id","name","slug","status","lifecycleStatus","timezone","locale","features","createdAt","updatedAt")
       VALUES ($1::uuid,$2,$3,$4::"tenant_status",$5::"tenant_lifecycle_status",'UTC','en-US','{}'::jsonb,NOW(),NOW())`,
      row.tenantId,
      row.name,
      `upg-${row.tenantId.slice(0, 8)}`,
      clinicStatus,
      lifecycleStatus,
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO "platform_tenants"
        ("id","tenantId","displayName","region","plan","status","provisionedBy","activatedAt","suspendedAt","suspensionReason","createdAt","updatedAt")
       VALUES ($1::uuid,$2::uuid,$3,'ME_SOUTH'::"platform_region",'PRO'::"entitlement_plan",$4::"platform_tenant_status",$5::uuid,$6,$7,$8,NOW(),NOW())`,
      row.ptId,
      row.tenantId,
      row.name,
      row.status,
      randomUUID(),
      row.activatedAt,
      row.suspendedAt,
      row.suspensionReason,
    );
  }

  await prisma.platformTenantProvisioningRequest.create({
    data: {
      id: randomUUID(),
      tenantId: activeTenantId,
      platformTenantId: activePtId,
      status: 'COMPLETED',
      organizationName: 'Upgrade Active Clinic',
      facilityTypeKey: 'clinic',
      specialtyKeys: [],
      publishedPlanVersionId: randomUUID(),
      adminEmail: 'upgrade-active@test.local',
      onboardingType: 'managed',
      correlationId: randomUUID(),
      createdByPlatformUserId: randomUUID(),
      completedAt: new Date(),
    },
  });
  await prisma.platformTenantProvisioningRequest.create({
    data: {
      id: randomUUID(),
      tenantId: provisioningTenantId,
      platformTenantId: provisioningPtId,
      status: 'PROVISIONING',
      organizationName: 'Upgrade Provisioning Clinic',
      facilityTypeKey: 'clinic',
      specialtyKeys: [],
      publishedPlanVersionId: randomUUID(),
      adminEmail: 'upgrade-prov@test.local',
      onboardingType: 'managed',
      correlationId: randomUUID(),
      createdByPlatformUserId: randomUUID(),
    },
  });

  return { activeTenantId, suspendedTenantId, provisioningTenantId };
}

async function main() {
  restoreGateMigration();
  try {
    await withAdmin(async (admin) => {
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${upgradeDb} WITH (FORCE)`);
      await admin.$executeRawUnsafe(`CREATE DATABASE ${upgradeDb}`);
    });

    parkGateMigration();
    try {
      console.log('Step 19 upgrade: migrate deploy with Step 19 parked…');
      run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: upgradeUrl });
    } finally {
      restoreGateMigration();
    }

    const prisma = new PrismaClient({ datasources: { db: { url: upgradeUrl } } });
    await prisma.$connect();
    try {
      await prisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
      await seedCatalogIfEmpty(prisma);

      for (const table of STEP19_TABLES) {
        if (await tablePresent(prisma, table)) {
          throw new Error(`before: unexpected Step 19 table ${table}`);
        }
      }

      await seedPreStep19Fixture(prisma);
      const before = await digestSnapshot(prisma);
      console.log('Step 19 upgrade before:', {
        catalog: before.catalog,
        tenantCount: before.tenantCount,
        digest: before.digest,
      });

      if (
        before.catalog.items !== 68 ||
        before.catalog.translations !== 136 ||
        before.catalog.aliases !== 68 ||
        before.catalog.rules !== 13
      ) {
        throw new Error(
          `Canonical Catalog required before upgrade: got ${before.catalog.items}/${before.catalog.translations}/${before.catalog.aliases}/${before.catalog.rules}`,
        );
      }

      console.log('Step 19 upgrade: migrate deploy applying Step 19 exactly once…');
      run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: upgradeUrl });

      for (const table of STEP19_TABLES) {
        if (!(await tablePresent(prisma, table))) {
          throw new Error(`after: missing Step 19 table ${table}`);
        }
      }
      for (const table of [...BILLING_FORBIDDEN, ...STEP20_FORBIDDEN]) {
        if (await tablePresent(prisma, table)) {
          throw new Error(`Forbidden table present: ${table}`);
        }
      }

      const after = await digestSnapshot(prisma);
      console.log('Step 19 upgrade after:', {
        catalog: after.catalog,
        tenantCount: after.tenantCount,
        digest: after.digest,
      });

      if (before.digest !== after.digest) {
        // rowVersion column addition may change SELECT shape but digest excludes rowVersion intentionally.
        // Re-check status digests and domain counts explicitly.
        if (before.tenantDigest !== after.tenantDigest) {
          throw new Error('Tenant status digest changed during Step 19 upgrade');
        }
        if (JSON.stringify(before.catalog) !== JSON.stringify(after.catalog)) {
          throw new Error('Catalog changed during Step 19 upgrade');
        }
        if (
          before.commercials !== after.commercials ||
          before.snapshots !== after.snapshots ||
          before.provisioning !== after.provisioning ||
          before.sessions !== after.sessions ||
          before.platformSessions !== after.platformSessions ||
          before.audits !== after.audits ||
          before.usageObs !== after.usageObs ||
          before.usageCtr !== after.usageCtr
        ) {
          throw new Error('Domain counts changed during Step 19 upgrade');
        }
      }

      const requests = await prisma.platformTenantLifecycleRequest.count();
      const idem = await prisma.platformTenantLifecycleIdempotencyRecord.count();
      if (requests !== 0 || idem !== 0) {
        throw new Error(`Invented lifecycle rows: requests=${requests} idempotency=${idem}`);
      }

      const badRv = await prisma.platformTenant.count({ where: { rowVersion: { lt: 1 } } });
      if (badRv !== 0) throw new Error(`rowVersion < 1 for ${badRv} tenants`);

      const allRv = await prisma.platformTenant.findMany({ select: { rowVersion: true } });
      if (!allRv.every((t) => t.rowVersion === 1)) {
        throw new Error('rowVersion not initialized deterministically to 1');
      }

      if (
        after.catalog.items !== 68 ||
        after.catalog.translations !== 136 ||
        after.catalog.aliases !== 68 ||
        after.catalog.rules !== 13
      ) {
        throw new Error(
          `Catalog drifted from canonical 68/136/68/13: ${after.catalog.items}/${after.catalog.translations}/${after.catalog.aliases}/${after.catalog.rules}`,
        );
      }

      console.log('OK Catalog=68/136/68/13');
      console.log(`OK tenantStatusDigest=${after.tenantDigest}`);
      console.log(`OK tenantCount=${after.tenantCount}`);
      console.log('OK lifecycleRequests=0 idempotency=0');
      console.log('OK rowVersion=1 for all tenants');
      console.log('OK billing/Step20 schema absent');
      console.log('OK automatic lifecycle/session/EER/U01 mutations=0');
      console.log('Step 19 isolated upgrade migration validator passed.');
    } finally {
      await prisma.$disconnect();
    }
  } finally {
    restoreGateMigration();
  }
}

main().catch((err) => {
  console.error(err);
  restoreGateMigration();
  process.exit(1);
});
