#!/usr/bin/env node
/**
 * Phase 48 Wave A — upgrade migration validator.
 * Deploy prior chain (park Wave A migration) → capture ServicePrice digests → restore + deploy Wave A → assert non-destructive.
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
const gateDirNames = [
  '20260814010000_phase48_wave_a_clinical_catalog',
  '20260814140000_phase48_wave_a_price_commercial_checks',
  '20260814150000_phase48_wave_a_price_scheduled_status',
];
const parkDir = path.join(apiRoot, 'prisma', '_parked_phase48_wave_a_upgrade');
const upgradeDb = `test_p48wa_upgrade_${Date.now()}`;

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
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

function digestRows(rows) {
  const normalized = rows
    .map((r) =>
      [
        r.id,
        r.tenantId,
        r.serviceCode,
        r.nameEn,
        String(r.unitPrice),
        r.currency,
        String(r.taxPercent),
        String(r.isActive),
      ].join('|'),
    )
    .sort();
  return crypto.createHash('sha256').update(normalized.join('\n')).digest('hex');
}

function parkMigration() {
  fs.mkdirSync(parkDir, { recursive: true });
  for (const gateDirName of gateDirNames) {
    const src = path.join(migrationsDir, gateDirName);
    const dest = path.join(parkDir, gateDirName);
    if (!fs.existsSync(src)) throw new Error(`Missing migration ${gateDirName}`);
    if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
    fs.renameSync(src, dest);
  }
}

function restoreMigration() {
  for (const gateDirName of gateDirNames) {
    const src = path.join(parkDir, gateDirName);
    const dest = path.join(migrationsDir, gateDirName);
    if (!fs.existsSync(src)) throw new Error(`Parked Wave A migration missing: ${gateDirName}`);
    if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
    fs.renameSync(src, dest);
  }
  try {
    fs.rmSync(parkDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

async function main() {
  let parked = false;
  try {
    await withAdmin(async (admin) => {
      await admin.$executeRawUnsafe(`CREATE DATABASE ${upgradeDb}`);
    });

    parkMigration();
    parked = true;

    run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: upgradeUrl });

    const prismaPre = new PrismaClient({ datasources: { db: { url: upgradeUrl } } });
    await prismaPre.$connect();
    await prismaPre.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;

    // Seed a representative ServicePrice if none (synthetic tenant may be absent — skip seed if tenants empty)
    const tenant = await prismaPre.tenant.findFirst({ where: { deletedAt: null } });
    let preDigest = null;
    let preCount = 0;
    if (tenant) {
      await prismaPre.servicePrice.upsert({
        where: {
          tenantId_serviceCode: { tenantId: tenant.id, serviceCode: 'consultation' },
        },
        create: {
          tenantId: tenant.id,
          serviceCode: 'consultation',
          nameEn: 'Consultation',
          nameAr: 'استشارة',
          unitPrice: 100,
          currency: 'SYP',
          taxPercent: 0,
          isActive: true,
        },
        update: {},
      });
      const rows = await prismaPre.servicePrice.findMany({ orderBy: { id: 'asc' } });
      preCount = rows.length;
      preDigest = digestRows(rows);
    }
    await prismaPre.$disconnect();

    restoreMigration();
    parked = false;

    run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: upgradeUrl });

    const prismaPost = new PrismaClient({ datasources: { db: { url: upgradeUrl } } });
    await prismaPost.$connect();
    await prismaPost.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;

    const tables = [
      'canonical_clinical_service_definitions',
      'clinical_service_price_versions',
      'tenant_service_configurations',
      'legacy_clinical_service_mappings',
      'legacy_clinical_price_mappings',
    ];
    for (const table of tables) {
      const rows = await prismaPost.$queryRawUnsafe(
        `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
      );
      if (!rows[0]?.present) throw new Error(`Missing after upgrade: ${table}`);
    }

    if (preDigest) {
      const postRows = await prismaPost.servicePrice.findMany({ orderBy: { id: 'asc' } });
      const postDigest = digestRows(postRows);
      if (postRows.length !== preCount || postDigest !== preDigest) {
        throw new Error('ServicePrice mutated during Wave A upgrade — forbidden');
      }
      console.log('OK ServicePrice digest preserved');
    } else {
      console.log('OK no tenants present — ServicePrice digest skipped');
    }

    // Appointment.serviceType column still present
    const col = await prismaPost.$queryRawUnsafe(`
      SELECT 1 AS ok FROM information_schema.columns
      WHERE table_name = 'appointments' AND column_name = 'serviceType'
    `);
    if (!col.length) throw new Error('Appointment.serviceType dropped — forbidden');
    console.log('OK Appointment.serviceType preserved');

    run('node', ['scripts/phase48-wave-a-backfill.mjs'], { DATABASE_URL: upgradeUrl });

    const canonical = await prismaPost.canonicalClinicalServiceDefinition.findMany({
      where: { provenance: 'SYSTEM_CANONICAL' },
    });
    if (canonical.some((c) => c.tenantId !== null)) {
      throw new Error('Upgrade backfill created tenant-scoped SYSTEM_CANONICAL clones');
    }
    if (canonical.length !== 7) {
      throw new Error(`Expected 7 SYSTEM_CANONICAL after upgrade backfill, got ${canonical.length}`);
    }
    console.log('OK upgrade backfill shared SYSTEM_CANONICAL');

    await prismaPost.$disconnect();
    console.log('PHASE48_WAVE_A_UPGRADE_VALIDATOR_PASSED');
  } catch (err) {
    if (parked) {
      try {
        restoreMigration();
      } catch (restoreErr) {
        console.error('Failed to restore parked migration:', restoreErr);
      }
    }
    throw err;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => process.exit(process.exitCode ?? 0));
