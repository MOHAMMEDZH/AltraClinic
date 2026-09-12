#!/usr/bin/env node
/**
 * Phase 48 Wave G — upgrade from frozen Wave F schema.
 * Park Wave G → deploy through Wave F → restore Wave G → assert additive.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const migrationsDir = path.join(apiRoot, 'prisma', 'migrations');
const parkDir = path.join(apiRoot, 'prisma', '_parked_phase48_wave_g_upgrade');
const upgradeDb = `test_p48wg_upgrade_${Date.now()}`;
const WAVE_G_SUFFIX = '_phase48_wave_g';
const WAVE_G_TABLES = [
  'availability_exceptions',
  'waitlist_offers',
  'recall_rules',
  'patient_recall_instances',
];

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
  if ((result.status ?? 1) !== 0) throw new Error(`Command failed: ${cmd} ${args.join(' ')}`);
}

async function withAdmin(fn) {
  const admin = new PrismaClient({ datasources: { db: { url: adminUrl } } });
  await admin.$connect();
  try {
    return await fn(admin);
  } finally {
    await admin.$disconnect().catch(() => undefined);
  }
}

function listWaveGMigrations() {
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.includes(WAVE_G_SUFFIX))
    .map((entry) => entry.name)
    .sort();
}

function park() {
  const waveGMigrations = listWaveGMigrations();
  if (waveGMigrations.length < 3) {
    throw new Error(`Expected ≥3 Wave G migration folders, found ${waveGMigrations.length}`);
  }
  fs.mkdirSync(parkDir, { recursive: true });
  for (const migration of waveGMigrations) {
    const src = path.join(migrationsDir, migration);
    const dest = path.join(parkDir, migration);
    if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
    fs.renameSync(src, dest);
  }
  return waveGMigrations;
}

function restore(expectedMigrations) {
  for (const migration of expectedMigrations) {
    const src = path.join(parkDir, migration);
    const dest = path.join(migrationsDir, migration);
    if (!fs.existsSync(src)) throw new Error(`Parked Wave G migration missing: ${migration}`);
    if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
    fs.renameSync(src, dest);
  }
  fs.rmSync(parkDir, { recursive: true, force: true });
}

async function main() {
  let parked = false;
  let parkedMigrations = [];
  try {
    await withAdmin(async (admin) => {
      await admin.$executeRawUnsafe(`CREATE DATABASE ${upgradeDb}`);
    });
    parkedMigrations = park();
    parked = true;
    run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: upgradeUrl });
    const pre = new PrismaClient({ datasources: { db: { url: upgradeUrl } } });
    await pre.$connect();
    await pre.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
    const waveFPre = await pre.$queryRawUnsafe(
      `SELECT to_regclass('public.staff_commission_plan_versions') IS NOT NULL AS present`,
    );
    if (!waveFPre[0]?.present) throw new Error('Wave F table missing before Wave G upgrade');
    for (const table of WAVE_G_TABLES) {
      const gPre = await pre.$queryRawUnsafe(
        `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
      );
      if (gPre[0]?.present) throw new Error(`${table} present before restore — park failed`);
    }
    const commissionCount = await pre.commissionAccrual.count();
    await pre.$disconnect();

    restore(parkedMigrations);
    parked = false;
    run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: upgradeUrl });

    const post = new PrismaClient({ datasources: { db: { url: upgradeUrl } } });
    await post.$connect();
    await post.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
    for (const table of WAVE_G_TABLES) {
      const gPost = await post.$queryRawUnsafe(
        `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
      );
      if (!gPost[0]?.present) throw new Error(`${table} missing after Wave G upgrade`);
      const rls = await post.$queryRawUnsafe(
        `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = '${table}'`,
      );
      if (!rls[0]?.relrowsecurity) throw new Error(`${table} RLS not enabled after upgrade`);
      if (!rls[0]?.relforcerowsecurity) throw new Error(`${table} FORCE RLS not set after upgrade`);
      console.log(`OK upgrade table+RLS ${table}`);
    }
    const commissionCountAfter = await post.commissionAccrual.count();
    if (commissionCountAfter !== commissionCount) {
      throw new Error('commission_accruals count changed during Wave G upgrade');
    }
    const migs = await post.$queryRawUnsafe(`
      SELECT migration_name FROM _prisma_migrations
      WHERE finished_at IS NOT NULL
        AND (
          migration_name LIKE '%phase48_wave_g1_availability_exception%'
          OR migration_name LIKE '%phase48_wave_g2_waitlist_offer%'
          OR migration_name LIKE '%phase48_wave_g3_recall_sor%'
        )
    `);
    if (migs.length < 3) {
      throw new Error(`Expected 3 Wave G migrations after upgrade, got ${migs.length}`);
    }
    console.log('PHASE48_WAVE_G_UPGRADE_VALIDATOR_PASSED');
    await post.$disconnect();
  } catch (err) {
    if (parked) {
      try {
        restore(parkedMigrations);
      } catch (restoreErr) {
        console.error('FAILED to restore parked Wave G migrations:', restoreErr);
      }
    }
    throw err;
  } finally {
    await withAdmin(async (admin) => {
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${upgradeDb} WITH (FORCE)`);
    }).catch(() => undefined);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
