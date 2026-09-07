#!/usr/bin/env node
/**
 * Phase 48 Wave D — clean migration validator.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const cleanDb = `test_p48wd_clean_${Date.now()}`;
const WAVE_D_TABLES = [
  'treatment_plan_item_appointments',
  'dental_lab_cases',
  'dental_lab_case_attachments',
  'service_performances',
  'service_performance_participants',
  'service_performance_corrections',
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
    for (const table of WAVE_D_TABLES) {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
      );
      if (!rows[0]?.present) throw new Error(`Missing Wave D table: ${table}`);
      console.log(`OK table ${table}`);
    }
    const enumRow = await prisma.$queryRawUnsafe(`
      SELECT 1 AS ok FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'scheduling_resource_type' AND e.enumlabel = 'OPERATORY'
    `);
    if (!enumRow.length) throw new Error('OPERATORY enum value missing');
    const col = await prisma.$queryRawUnsafe(`
      SELECT is_nullable FROM information_schema.columns
      WHERE table_name = 'treatment_plan_items' AND column_name = 'clinicalServiceId'
    `);
    if (col[0]?.is_nullable !== 'YES') throw new Error('clinicalServiceId must be nullable');
    const rls = await prisma.$queryRawUnsafe(`
      SELECT relrowsecurity FROM pg_class WHERE relname = 'dental_lab_cases'
    `);
    if (!rls[0]?.relrowsecurity) throw new Error('dental_lab_cases RLS not enabled');
    console.log('PHASE48_WAVE_D_CLEAN_VALIDATOR_PASSED');
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
