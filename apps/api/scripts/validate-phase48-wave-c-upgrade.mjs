#!/usr/bin/env node
/**
 * Phase 48 Wave C — upgrade migration validator.
 * Park Wave C migration → deploy prior chain → restore + deploy Wave C → assert additive.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import {
  parkLaterPhase48Migrations,
  restoreLaterPhase48Migrations,
} from './phase48-park-later-migrations.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const migrationsDir = path.join(apiRoot, 'prisma', 'migrations');
const gateDirNames = ['20260816010000_phase48_wave_c_clinical_safety'];
const parkDir = path.join(apiRoot, 'prisma', '_parked_phase48_wave_c_upgrade');
const parkLaterDir = path.join(apiRoot, 'prisma', '_parked_phase48_wave_c_upgrade_later');
const upgradeDb = `test_p48wc_upgrade_${Date.now()}`;

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
      await client.$queryRaw`SELECT 1 AS ok`;
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
    try {
      await admin.$disconnect();
    } catch {
      /* ignore */
    }
  }
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
  parkLaterPhase48Migrations(migrationsDir, parkLaterDir, gateDirNames);
}

function restoreMigration() {
  for (const gateDirName of gateDirNames) {
    const src = path.join(parkDir, gateDirName);
    const dest = path.join(migrationsDir, gateDirName);
    if (!fs.existsSync(src)) throw new Error(`Parked Wave C migration missing: ${gateDirName}`);
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

    const preItems = await prismaPre.inventoryItem.count().catch(() => 0);
    const waveCPre = await prismaPre.$queryRawUnsafe(
      `SELECT to_regclass('public.clinical_form_templates') IS NOT NULL AS present`,
    );
    if (waveCPre[0]?.present) {
      throw new Error('Wave C table present before Wave C migration restore — park failed');
    }

    let tenantId = (
      await prismaPre.$queryRawUnsafe(`SELECT id::text AS id FROM tenants LIMIT 1`)
    )[0]?.id;
    if (!tenantId) {
      tenantId = (await prismaPre.$queryRawUnsafe(`SELECT gen_random_uuid()::text AS id`))[0].id;
      await prismaPre.tenant.create({
        data: { id: tenantId, name: 'WC Upgrade Photo', slug: `wc-upg-${tenantId.slice(0, 8)}` },
      });
    }
    const dentalId = (await prismaPre.$queryRawUnsafe(`SELECT gen_random_uuid()::text AS id`))[0].id;
    const beautyId = (await prismaPre.$queryRawUnsafe(`SELECT gen_random_uuid()::text AS id`))[0].id;
    const attachId = (await prismaPre.$queryRawUnsafe(`SELECT gen_random_uuid()::text AS id`))[0].id;
    const invoiceMediaId = (await prismaPre.$queryRawUnsafe(`SELECT gen_random_uuid()::text AS id`))[0].id;
    const uploader = (await prismaPre.$queryRawUnsafe(`SELECT gen_random_uuid()::text AS id`))[0].id;

    const insertMedia = async (id, category) => {
      await prismaPre.$executeRawUnsafe(`
        INSERT INTO media_assets (
          id, "tenantId", category, "ownerType", "ownerId", "originalFilename",
          "mimeType", "sizeBytes", "storageKey", status, "uploadedBy", "createdAt", "updatedAt"
        ) VALUES (
          '${id}'::uuid, '${tenantId}'::uuid, '${category}', 'patient', '${id}'::uuid, 'legacy-${category}.jpg',
          'image/jpeg', 10, 'legacy/${id}', 'READY', '${uploader}'::uuid, NOW(), NOW()
        )
      `);
    };
    await insertMedia(dentalId, 'DENTAL_IMAGE');
    await insertMedia(beautyId, 'BEAUTY_BEFORE_AFTER');
    await insertMedia(attachId, 'PATIENT_ATTACHMENT');
    await insertMedia(invoiceMediaId, 'INVOICE_ATTACHMENT');

    const preCol = await prismaPre.$queryRawUnsafe(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'media_assets' AND column_name = 'requiresPhotoConsent'
    `);
    if (preCol.length) {
      throw new Error('requiresPhotoConsent already existed before Wave C upgrade — fixture is invalid');
    }
    await prismaPre.$disconnect();

    restoreMigration();
    parked = false;

    run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: upgradeUrl });

    const prismaPost = new PrismaClient({ datasources: { db: { url: upgradeUrl } } });
    await prismaPost.$connect();
    await prismaPost.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;

    for (const table of [
      'clinical_form_templates',
      'clinical_form_versions',
      'patient_form_instances',
      'clinical_service_form_requirements',
      'injectable_usage_details',
    ]) {
      const rows = await prismaPost.$queryRawUnsafe(
        `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
      );
      if (!rows[0]?.present) throw new Error(`Missing Wave C table after upgrade: ${table}`);
    }

    const postItems = await prismaPost.inventoryItem.count().catch(() => 0);
    if (postItems < preItems) {
      throw new Error(`Inventory items shrunk after Wave C upgrade: ${preItems} → ${postItems}`);
    }

    const usageCols = await prismaPost.$queryRawUnsafe(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'inventory_consumption_logs' AND column_name = 'attributionStatus'
    `);
    if (!usageCols.length) throw new Error('attributionStatus missing after upgrade');

    const migrationSql = fs.readFileSync(
      path.join(migrationsDir, '20260816010000_phase48_wave_c_clinical_safety', 'migration.sql'),
      'utf8',
    );
    if (!migrationSql.includes('SET "requiresPhotoConsent" = true')) {
      throw new Error('Wave C migration missing requiresPhotoConsent backfill');
    }
    if (!migrationSql.includes("'DENTAL_IMAGE', 'BEAUTY_BEFORE_AFTER', 'PATIENT_ATTACHMENT'")) {
      throw new Error('Wave C migration backfill categories incomplete');
    }
    if (!migrationSql.includes('app.allow_inventory_usage_invoice_link')) {
      throw new Error('Wave C migration missing trusted billing invoice-link gate');
    }

    const flags = await prismaPost.$queryRawUnsafe(`
      SELECT id::text AS id, category::text AS category, "requiresPhotoConsent" AS flag
      FROM media_assets
      WHERE id IN ('${dentalId}'::uuid, '${beautyId}'::uuid, '${attachId}'::uuid, '${invoiceMediaId}'::uuid)
    `);
    const byId = Object.fromEntries(flags.map((r) => [r.id, r]));
    if (!byId[dentalId]?.flag) throw new Error('DENTAL_IMAGE was not backfilled true by the Wave C migration');
    if (!byId[beautyId]?.flag) throw new Error('BEAUTY_BEFORE_AFTER was not backfilled true by the Wave C migration');
    if (!byId[attachId]?.flag) throw new Error('PATIENT_ATTACHMENT was not backfilled true by the Wave C migration');
    if (byId[invoiceMediaId]?.flag) {
      throw new Error('INVOICE_ATTACHMENT must remain requiresPhotoConsent=false after upgrade');
    }
    console.log('OK Wave C migration-time photo-consent backfill (no manual replay)');

    await prismaPost.$disconnect();
    console.log('PHASE48_WAVE_C_UPGRADE_VALIDATOR_PASSED');
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    if (parked) {
      try {
        restoreMigration();
      } catch (e) {
        console.error('Failed to restore parked Wave C migration', e);
      }
    }
    restoreLaterPhase48Migrations(migrationsDir, parkLaterDir);
  }
}

main();
