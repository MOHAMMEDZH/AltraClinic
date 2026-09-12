#!/usr/bin/env node
/**
 * Phase 48 Wave G — clean migration validator.
 * Asserts G1–G3 tables + RLS on a fresh migrate deploy (no stub).
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const cleanDb = `test_p48wg_clean_${Date.now()}`;
const WAVE_G_TABLES = [
  'availability_exceptions',
  'waitlist_offers',
  'recall_rules',
  'patient_recall_instances',
];
const WAVE_G_ENUMS = [
  'availability_exception_type',
  'waitlist_offer_status',
  'patient_recall_status',
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
    for (const table of WAVE_G_TABLES) {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
      );
      if (!rows[0]?.present) throw new Error(`Missing Wave G table: ${table}`);
      console.log(`OK table ${table}`);
    }
    for (const table of WAVE_G_TABLES) {
      const rls = await prisma.$queryRawUnsafe(
        `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = '${table}'`,
      );
      if (!rls[0]?.relrowsecurity) throw new Error(`${table} RLS not enabled`);
      if (!rls[0]?.relforcerowsecurity) throw new Error(`${table} FORCE RLS not set`);
      console.log(`OK RLS ${table}`);
    }
    for (const enumName of WAVE_G_ENUMS) {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT EXISTS (
           SELECT 1 FROM pg_type t
           JOIN pg_namespace n ON n.oid = t.typnamespace
           WHERE n.nspname = 'public' AND t.typname = '${enumName}'
         ) AS present`,
      );
      if (!rows[0]?.present) throw new Error(`Missing Wave G enum: ${enumName}`);
      console.log(`OK enum ${enumName}`);
    }
    const migs = await prisma.$queryRawUnsafe(`
      SELECT migration_name FROM _prisma_migrations
      WHERE finished_at IS NOT NULL
        AND (
          migration_name LIKE '%phase48_wave_g1_availability_exception%'
          OR migration_name LIKE '%phase48_wave_g2_waitlist_offer%'
          OR migration_name LIKE '%phase48_wave_g3_recall_sor%'
        )
    `);
    if (migs.length < 3) {
      throw new Error(`Expected 3 Wave G migrations applied, got ${migs.length}`);
    }
    console.log('PHASE48_WAVE_G_CLEAN_VALIDATOR_PASSED');
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
