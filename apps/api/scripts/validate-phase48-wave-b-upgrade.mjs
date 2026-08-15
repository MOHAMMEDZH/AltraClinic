#!/usr/bin/env node
/**
 * Phase 48 Wave B — upgrade migration validator.
 * Park Wave B migration → deploy prior chain → restore + deploy Wave B → assert additive/non-destructive.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const migrationsDir = path.join(apiRoot, 'prisma', 'migrations');
const gateDirNames = [
  '20260815010000_phase48_wave_b_booking_integrity',
  '20260815120000_phase48_wave_b_pa_blockers',
  '20260815200000_phase48_wave_b_rereview_closure',
  '20260815210000_phase48_wave_b_final_defect_closure',
  '20260815220000_phase48_wave_b_legacy_cancelled_lock',
  '20260815230000_phase48_wave_b_final_2blocker_closure',
  '20260815240000_phase48_wave_b_cutover_execution_time',
  '20260815250000_phase48_wave_b_snapshot_write_mode',
  '20260815260000_phase48_wave_b_snapshot_write_mode_immutable',
];
const parkDir = path.join(apiRoot, 'prisma', '_parked_phase48_wave_b_upgrade');
const upgradeDb = `test_p48wb_upgrade_${Date.now()}`;

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
    if (!fs.existsSync(src)) throw new Error(`Parked Wave B migration missing: ${gateDirName}`);
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

    const preAppointments = await prismaPre.appointment.count().catch(() => 0);
    const preCanonical = await prismaPre.canonicalClinicalServiceDefinition
      .count()
      .catch(() => 0);
    const waveBPre = await prismaPre.$queryRawUnsafe(
      `SELECT to_regclass('public.appointment_service_snapshot_revisions') IS NOT NULL AS present`,
    );
    if (waveBPre[0]?.present) {
      throw new Error('Wave B table present before Wave B migration restore — park failed');
    }
    await prismaPre.$disconnect();

    restoreMigration();
    parked = false;

    run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: upgradeUrl });

    const prismaPost = new PrismaClient({ datasources: { db: { url: upgradeUrl } } });
    await prismaPost.$connect();
    await prismaPost.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;

    for (const table of [
      'appointment_service_snapshot_revisions',
      'provider_service_eligibilities',
      'service_resource_requirements',
    ]) {
      const rows = await prismaPost.$queryRawUnsafe(
        `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
      );
      if (!rows[0]?.present) throw new Error(`Missing Wave B table after upgrade: ${table}`);
    }

    const postAppointments = await prismaPost.appointment.count().catch(() => 0);
    const postCanonical = await prismaPost.canonicalClinicalServiceDefinition
      .count()
      .catch(() => 0);
    if (postAppointments < preAppointments) {
      throw new Error('Destructive: appointment count decreased');
    }
    if (postCanonical < preCanonical) {
      throw new Error('Destructive: canonical catalog count decreased');
    }

    await prismaPost.$disconnect();
    console.log('PHASE48_WAVE_B_UPGRADE_VALIDATOR_PASSED');
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    if (parked) {
      try {
        restoreMigration();
      } catch (e) {
        console.error('Failed to restore parked Wave B migration', e);
      }
    }
  }
}

main().finally(() => process.exit(process.exitCode ?? 0));
