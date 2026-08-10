#!/usr/bin/env node
/**
 * Deterministic representative upgrade validation for Flexible Step 17.
 * Parks Step 17 migration, deploys prior chain into an isolated DB, records
 * digests, restores + deploys Step 17 once, proves zero automatic provisioning
 * state and unchanged accepted domain counts.
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
const gateDirName = '20260730230000_phase47_step17_tenant_provisioning';
const parkDir = path.join(apiRoot, 'prisma', '_parked_step17_upgrade');
const upgradeDb = 'booking_test_tenant_provisioning_upgrade';

const STEP17_TABLES = [
  'platform_tenant_provisioning_requests',
  'platform_tenant_provisioning_checkpoints',
  'platform_tenant_provisioning_owned_resources',
  'platform_tenant_provisioning_idempotency',
];

const BILLING_FORBIDDEN = [
  'platform_billing_runtime',
  'platform_billing_invoices',
  'platform_billing_charges',
  'platform_billing_payments',
  'platform_overage_charges',
];

const STEP19_FORBIDDEN = [
  'platform_tenant_lifecycle_actions',
  'platform_tenant_archive_requests',
  'platform_tenant_deletion_requests',
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

async function withAdmin(fn) {
  const admin = new PrismaClient({ datasources: { db: { url: adminUrl } } });
  try {
    await admin.$connect();
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

async function digestCounts(prisma) {
  const catalogItems = await prisma.healthcareCatalogItem.count();
  const translations = await prisma.healthcareCatalogTranslation.count();
  const aliases = await prisma.healthcareCatalogAlias.count();
  const rules = await prisma.healthcareCatalogCompatibilityRule.count();
  const tenants = await prisma.tenant.count();
  const platformTenants = await prisma.platformTenant.count();
  const plans = await prisma.platformPlan.count();
  const planVersions = await prisma.platformPlanVersion.count();
  const commercials = await prisma.platformSubscriptionCommercialConfig.count();
  const snapshots = await prisma.platformSubscriptionCommercialSnapshot.count();
  const invitations = await prisma.staffInvitation.count();
  const usageObservations = await prisma.platformUsageObservation.count().catch(() => 0);
  const usageNonzero = await prisma.platformUsageCounter
    .count({
      where: {
        OR: [{ currentValue: { not: '0' } }, { reservedValue: { not: '0' } }],
      },
    })
    .catch(() => 0);

  const payload = {
    catalogItems,
    translations,
    aliases,
    rules,
    tenants,
    platformTenants,
    plans,
    planVersions,
    commercials,
    snapshots,
    invitations,
    usageObservations,
    usageNonzero,
  };
  const digest = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  return { ...payload, digest };
}

async function seedCatalogIfEmpty(prisma) {
  const catalogItems = await prisma.healthcareCatalogItem.count();
  if (catalogItems > 0) return;
  console.log('Catalog empty; seeding healthcare catalog…');
  run('npm', ['run', 'seed:healthcare-catalog'], { DATABASE_URL: upgradeUrl });
  const after = await prisma.healthcareCatalogItem.count();
  if (after === 0) {
    throw new Error('Healthcare catalog seed produced zero items on upgrade fixture DB');
  }
}

async function main() {
  restoreGateMigration();
  try {
    await withAdmin(async (admin) => {
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${upgradeDb}`);
      await admin.$executeRawUnsafe(`CREATE DATABASE ${upgradeDb}`);
    });

    parkGateMigration();
    try {
      console.log('Step 17 upgrade: migrate deploy with Step 17 parked…');
      run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: upgradeUrl });
    } finally {
      restoreGateMigration();
    }

    const prisma = new PrismaClient({ datasources: { db: { url: upgradeUrl } } });
    await prisma.$connect();
    try {
      await prisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
      await seedCatalogIfEmpty(prisma);

      for (const table of STEP17_TABLES) {
        if (await tablePresent(prisma, table)) {
          throw new Error(`before: unexpected Step 17 table ${table}`);
        }
      }

      const before = await digestCounts(prisma);
      console.log('Step 17 upgrade before:', before);

      console.log('Step 17 upgrade: migrate deploy applying Step 17 exactly once…');
      run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: upgradeUrl });

      for (const table of STEP17_TABLES) {
        if (!(await tablePresent(prisma, table))) {
          throw new Error(`after: missing Step 17 table ${table}`);
        }
      }
      for (const table of [...BILLING_FORBIDDEN, ...STEP19_FORBIDDEN]) {
        if (await tablePresent(prisma, table)) {
          throw new Error(`Forbidden table present: ${table}`);
        }
      }

      const after = await digestCounts(prisma);
      console.log('Step 17 upgrade after:', after);

      const unchangedKeys = [
        'catalogItems',
        'translations',
        'aliases',
        'rules',
        'tenants',
        'platformTenants',
        'plans',
        'planVersions',
        'commercials',
        'snapshots',
        'invitations',
        'usageObservations',
        'usageNonzero',
      ];
      for (const key of unchangedKeys) {
        if (after[key] !== before[key]) {
          throw new Error(`Upgrade mutated ${key}: ${before[key]} → ${after[key]}`);
        }
      }
      if (after.digest !== before.digest) {
        throw new Error('Upgrade changed representative digest');
      }

      // Prefer raw SQL so a stale generated client still validates empty Step 17 tables.
      const step17Counts = await prisma.$queryRawUnsafe(`
        SELECT
          (SELECT COUNT(*)::int FROM platform_tenant_provisioning_requests) AS requests,
          (SELECT COUNT(*)::int FROM platform_tenant_provisioning_checkpoints) AS checkpoints,
          (SELECT COUNT(*)::int FROM platform_tenant_provisioning_owned_resources) AS owned,
          (SELECT COUNT(*)::int FROM platform_tenant_provisioning_idempotency) AS idem
      `);
      const provisioningRequests = step17Counts[0]?.requests ?? -1;
      const checkpoints = step17Counts[0]?.checkpoints ?? -1;
      const owned = step17Counts[0]?.owned ?? -1;
      const idem = step17Counts[0]?.idem ?? -1;
      if (provisioningRequests !== 0) throw new Error('automatic provisioning requests must be 0');
      if (checkpoints !== 0) throw new Error('automatic checkpoints must be 0');
      if (owned !== 0) throw new Error('automatic owned resources must be 0');
      if (idem !== 0) throw new Error('automatic idempotency rows must be 0');

      // Exact Catalog inventory required on representative fixture after seed.
      if (
        after.catalogItems !== 68 ||
        after.translations !== 136 ||
        after.aliases !== 68 ||
        after.rules !== 13
      ) {
        throw new Error(
          `Catalog inventory mismatch: ${after.catalogItems}/${after.translations}/${after.aliases}/${after.rules} (expected 68/136/68/13)`,
        );
      }

      console.log(
        JSON.stringify({
          ok: true,
          fixtureDb: upgradeDb,
          beforeDigest: before.digest,
          afterDigest: after.digest,
          automaticProvisioningRequests: 0,
          automaticTenants: 0,
          automaticCommercials: 0,
          automaticInvitations: 0,
          automaticUsageObservations: after.usageObservations,
          billingSchemaAbsent: true,
          step19SchemaAbsent: true,
          catalog: {
            items: after.catalogItems,
            translations: after.translations,
            aliases: after.aliases,
            rules: after.rules,
          },
        }),
      );
      console.log('Step 17 deterministic representative upgrade validator PASSED');
    } finally {
      await prisma.$disconnect();
    }
  } catch (err) {
    restoreGateMigration();
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
