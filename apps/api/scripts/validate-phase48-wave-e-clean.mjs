#!/usr/bin/env node
/**
 * Phase 48 Wave E — clean migration validator.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const cleanDb = `test_p48we_clean_${Date.now()}`;
const WAVE_E_TABLES = [
  'treatment_courses',
  'course_sessions',
  'device_treatment_records',
];

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.ALLOW_TEST_DATABASE_RESET = 'true';

const adminUrl =
  process.env.INTEGRATION_ADMIN_DATABASE_URL ||
  'postgresql://booking:booking_test@localhost:5433/postgres';
const cleanUrl = `postgresql://booking:booking_test@localhost:5433/${cleanDb}?schema=public`;

function run(cmd, args, env = {}, timeout = 5 * 60 * 1000) {
  const result = spawnSync(cmd, args, {
    cwd: apiRoot,
    env: { ...process.env, ...env },
    stdio: 'inherit',
    shell: true,
    timeout,
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

async function main() {
  await withAdmin(async (admin) => {
    await admin.$executeRawUnsafe(`CREATE DATABASE ${cleanDb}`);
  });
  run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: cleanUrl });
  const prisma = new PrismaClient({ datasources: { db: { url: cleanUrl } } });
  await prisma.$connect();
  try {
    await prisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
    for (const table of WAVE_E_TABLES) {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
      );
      if (!rows[0]?.present) throw new Error(`Missing Wave E table: ${table}`);
      console.log(`OK table ${table}`);
    }
    for (const table of WAVE_E_TABLES) {
      const rls = await prisma.$queryRawUnsafe(
        `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = '${table}'`,
      );
      if (!rls[0]?.relrowsecurity) throw new Error(`${table} RLS not enabled`);
      if (!rls[0]?.relforcerowsecurity) throw new Error(`${table} FORCE RLS not set`);
      console.log(`OK RLS ${table}`);
    }
    const trig = await prisma.$queryRawUnsafe(`
      SELECT tgname FROM pg_trigger
      WHERE tgname IN (
        'course_sessions_tenant_integrity',
        'device_treatment_records_tenant_integrity',
        'treatment_courses_tenant_integrity',
        'treatment_courses_accountability_tenant',
        'device_treatment_records_accountability_tenant'
      )
    `);
    if (trig.length < 5) throw new Error('Wave E tenant/accountability integrity triggers missing');
    const noDerm = await prisma.$queryRawUnsafe(
      `SELECT to_regclass('public.dermatology_records') IS NOT NULL AS present`,
    );
    if (noDerm[0]?.present) throw new Error('DermatologyRecord table must NOT exist (AR-15)');
    console.log('PHASE48_WAVE_E_CLEAN_VALIDATOR_PASSED');
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
