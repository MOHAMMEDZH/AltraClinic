#!/usr/bin/env node
/**
 * Clean-path validation for Flexible Step 17 Tenant Creation and Provisioning.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const cleanDb = 'booking_test_tenant_provisioning_clean';

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

  console.log('Step 17 clean migrate deploy...');
  run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: cleanUrl });

  const prisma = new PrismaClient({ datasources: { db: { url: cleanUrl } } });
  await prisma.$connect();
  try {
    await prisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;

    for (const table of STEP17_TABLES) {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
      );
      if (!rows[0]?.present) throw new Error(`Missing Step 17 table: ${table}`);
    }

    for (const table of [...BILLING_FORBIDDEN, ...STEP19_FORBIDDEN]) {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
      );
      if (rows[0]?.present) throw new Error(`Forbidden table present: ${table}`);
    }

    const catalogItems = await prisma.healthcareCatalogItem.count();
    const translations = await prisma.healthcareCatalogTranslation.count();
    const aliases = await prisma.healthcareCatalogAlias.count();
    const rules = await prisma.healthcareCatalogCompatibilityRule.count();
    // Catalog seed may be migration-time or app seed — if zero, seed then re-check.
    if (catalogItems === 0) {
      console.log('Catalog empty after migrate; running healthcare catalog seed...');
      run('npm', ['run', 'seed:healthcare-catalog'], { DATABASE_URL: cleanUrl });
    }
    const itemsAfter = await prisma.healthcareCatalogItem.count();
    const translationsAfter = await prisma.healthcareCatalogTranslation.count();
    const aliasesAfter = await prisma.healthcareCatalogAlias.count();
    const rulesAfter = await prisma.healthcareCatalogCompatibilityRule.count();
    console.log(
      `Catalog counts: items=${itemsAfter} translations=${translationsAfter} aliases=${aliasesAfter} rules=${rulesAfter}`,
    );
    if (
      itemsAfter !== 68 ||
      translationsAfter !== 136 ||
      aliasesAfter !== 68 ||
      rulesAfter !== 13
    ) {
      throw new Error('Catalog inventory must be 68/136/68/13 after clean migrate (+seed if needed).');
    }

    const tenants = await prisma.tenant.count();
    const requests = await prisma.platformTenantProvisioningRequest.count();
    const commercials = await prisma.platformSubscriptionCommercialConfig.count();
    const invitations = await prisma.staffInvitation.count();
    const usageObs = await prisma.platformUsageObservation.count();
    const usageCounters = await prisma.platformUsageCounter.count({
      where: { NOT: { currentValue: '0' } },
    });

    console.log(
      JSON.stringify({
        tenants,
        provisioningRequests: requests,
        commercialConfigs: commercials,
        invitations,
        usageObservations: usageObs,
        nonzeroUsageCounters: usageCounters,
      }),
    );

    if (tenants !== 0) throw new Error('Clean migrate must create 0 tenants');
    if (requests !== 0) throw new Error('Clean migrate must create 0 provisioning requests');
    if (commercials !== 0) throw new Error('Clean migrate must create 0 commercial configs');
    if (invitations !== 0) throw new Error('Clean migrate must create 0 invitations');
    if (usageObs !== 0) throw new Error('Clean migrate must create 0 usage observations');
    if (usageCounters !== 0) throw new Error('Clean migrate must create 0 nonzero usage counters');

    console.log('Step 17 clean migration validator PASSED');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
