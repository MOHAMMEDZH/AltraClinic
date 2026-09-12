#!/usr/bin/env node
/**
 * Phase 48 Wave D — upgrade from frozen Wave C schema.
 * Park Wave D → deploy through Wave C → restore Wave D → assert additive.
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
const parkDir = path.join(apiRoot, 'prisma', '_parked_phase48_wave_d_upgrade');
const parkLaterDir = path.join(apiRoot, 'prisma', '_parked_phase48_wave_d_upgrade_later');
const upgradeDb = `test_p48wd_upgrade_${Date.now()}`;
const WAVE_D_SUFFIX = '_phase48_wave_d_';

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

function listWaveDMigrations() {
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.includes(WAVE_D_SUFFIX))
    .map((entry) => entry.name)
    .sort();
}

function park() {
  const waveDMigrations = listWaveDMigrations();
  if (!waveDMigrations.length) {
    throw new Error('Missing Wave D migration directories');
  }
  fs.mkdirSync(parkDir, { recursive: true });
  for (const migration of waveDMigrations) {
    const src = path.join(migrationsDir, migration);
    const dest = path.join(parkDir, migration);
    if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
    fs.renameSync(src, dest);
  }
  parkLaterPhase48Migrations(migrationsDir, parkLaterDir, waveDMigrations);
  return waveDMigrations;
}

function restore(expectedMigrations) {
  for (const migration of expectedMigrations) {
    const src = path.join(parkDir, migration);
    const dest = path.join(migrationsDir, migration);
    if (!fs.existsSync(src)) throw new Error(`Parked Wave D migration missing: ${migration}`);
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
    const waveDPre = await pre.$queryRawUnsafe(
      `SELECT to_regclass('public.dental_lab_cases') IS NOT NULL AS present`,
    );
    if (waveDPre[0]?.present) throw new Error('Wave D table present before restore — park failed');
    const waveC = await pre.$queryRawUnsafe(
      `SELECT to_regclass('public.clinical_form_templates') IS NOT NULL AS present`,
    );
    if (!waveC[0]?.present) throw new Error('Wave C table missing before Wave D upgrade');
    const itemCount = await pre.treatmentPlanItem.count();
    await pre.$disconnect();

    restore(parkedMigrations);
    parked = false;
    run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: upgradeUrl });

    const post = new PrismaClient({ datasources: { db: { url: upgradeUrl } } });
    await post.$connect();
    await post.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
    const waveDPost = await post.$queryRawUnsafe(
      `SELECT to_regclass('public.dental_lab_cases') IS NOT NULL AS present`,
    );
    if (!waveDPost[0]?.present) throw new Error('Wave D table missing after upgrade');
    const itemCountAfter = await post.treatmentPlanItem.count();
    if (itemCountAfter !== itemCount) throw new Error('treatment_plan_items count changed');
    const col = await post.$queryRawUnsafe(`
      SELECT is_nullable FROM information_schema.columns
      WHERE table_name = 'treatment_plan_items' AND column_name = 'clinicalServiceId'
    `);
    if (col[0]?.is_nullable !== 'YES') throw new Error('clinicalServiceId must remain nullable');
    await post.$disconnect();
    console.log('PHASE48_WAVE_D_UPGRADE_VALIDATOR_PASSED');
  } catch (err) {
    if (parked) {
      try {
        restore(parkedMigrations);
      } catch {
        /* still fail */
      }
    }
    throw err;
  } finally {
    restoreLaterPhase48Migrations(migrationsDir, parkLaterDir);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
