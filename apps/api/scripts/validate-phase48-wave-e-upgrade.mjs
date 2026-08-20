#!/usr/bin/env node
/**
 * Phase 48 Wave E — upgrade from frozen Wave D schema.
 * Park Wave E → deploy through Wave D → restore Wave E → assert additive.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const migrationsDir = path.join(apiRoot, 'prisma', 'migrations');
const parkDir = path.join(apiRoot, 'prisma', '_parked_phase48_wave_e_upgrade');
const upgradeDb = `test_p48we_upgrade_${Date.now()}`;
const WAVE_E_SUFFIX = '_phase48_wave_e_';

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

function listWaveEMigrations() {
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.includes(WAVE_E_SUFFIX))
    .map((entry) => entry.name)
    .sort();
}

function park() {
  const waveEMigrations = listWaveEMigrations();
  if (!waveEMigrations.length) {
    throw new Error('Missing Wave E migration directories');
  }
  fs.mkdirSync(parkDir, { recursive: true });
  for (const migration of waveEMigrations) {
    const src = path.join(migrationsDir, migration);
    const dest = path.join(parkDir, migration);
    if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
    fs.renameSync(src, dest);
  }
  return waveEMigrations;
}

function restore(expectedMigrations) {
  for (const migration of expectedMigrations) {
    const src = path.join(parkDir, migration);
    const dest = path.join(migrationsDir, migration);
    if (!fs.existsSync(src)) throw new Error(`Parked Wave E migration missing: ${migration}`);
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
    const waveEPre = await pre.$queryRawUnsafe(
      `SELECT to_regclass('public.treatment_courses') IS NOT NULL AS present`,
    );
    if (waveEPre[0]?.present) throw new Error('Wave E table present before restore — park failed');
    const waveD = await pre.$queryRawUnsafe(
      `SELECT to_regclass('public.dental_lab_cases') IS NOT NULL AS present`,
    );
    if (!waveD[0]?.present) throw new Error('Wave D table missing before Wave E upgrade');
    const labCount = await pre.dentalLabCase.count();
    await pre.$disconnect();

    restore(parkedMigrations);
    parked = false;
    run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: upgradeUrl });

    const post = new PrismaClient({ datasources: { db: { url: upgradeUrl } } });
    await post.$connect();
    await post.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
    const waveEPost = await post.$queryRawUnsafe(
      `SELECT to_regclass('public.treatment_courses') IS NOT NULL AS present`,
    );
    if (!waveEPost[0]?.present) throw new Error('Wave E table missing after upgrade');
    const labCountAfter = await post.dentalLabCase.count();
    if (labCountAfter !== labCount) throw new Error('dental_lab_cases count changed');
    const sessions = await post.$queryRawUnsafe(
      `SELECT to_regclass('public.course_sessions') IS NOT NULL AS present`,
    );
    if (!sessions[0]?.present) throw new Error('course_sessions missing after upgrade');
    const devices = await post.$queryRawUnsafe(
      `SELECT to_regclass('public.device_treatment_records') IS NOT NULL AS present`,
    );
    if (!devices[0]?.present) throw new Error('device_treatment_records missing after upgrade');
    const noDerm = await post.$queryRawUnsafe(
      `SELECT to_regclass('public.dermatology_records') IS NOT NULL AS present`,
    );
    if (noDerm[0]?.present) throw new Error('DermatologyRecord must not appear after upgrade');
    console.log('PHASE48_WAVE_E_UPGRADE_VALIDATOR_PASSED');
    await post.$disconnect();
  } catch (err) {
    if (parked) {
      try {
        restore(parkedMigrations);
      } catch (restoreErr) {
        console.error('Failed to restore parked Wave E migrations:', restoreErr);
      }
    }
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
