#!/usr/bin/env node
/**
 * Phase 48 Wave F — upgrade from frozen Wave E schema.
 * Park Wave F → deploy through Wave E → restore Wave F → assert additive.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import {
  parkLaterPhase48Migrations,
  restoreLaterPhase48Migrations,
} from './phase48-park-later-migrations.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const migrationsDir = path.join(apiRoot, 'prisma', 'migrations');
const parkDir = path.join(apiRoot, 'prisma', '_parked_phase48_wave_f_upgrade');
const parkLaterDir = path.join(apiRoot, 'prisma', '_parked_phase48_wave_f_upgrade_later');
const upgradeDb = `test_p48wf_upgrade_${Date.now()}`;
const WAVE_F_SUFFIX = '_phase48_wave_f_';

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

function listWaveFMigrations() {
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.includes(WAVE_F_SUFFIX))
    .map((entry) => entry.name)
    .sort();
}

function park() {
  const waveFMigrations = listWaveFMigrations();
  if (!waveFMigrations.length) {
    throw new Error('Missing Wave F migration directories');
  }
  fs.mkdirSync(parkDir, { recursive: true });
  for (const migration of waveFMigrations) {
    const src = path.join(migrationsDir, migration);
    const dest = path.join(parkDir, migration);
    if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
    fs.renameSync(src, dest);
  }
  parkLaterPhase48Migrations(migrationsDir, parkLaterDir, waveFMigrations);
  return waveFMigrations;
}

function restore(expectedMigrations) {
  for (const migration of expectedMigrations) {
    const src = path.join(parkDir, migration);
    const dest = path.join(migrationsDir, migration);
    if (!fs.existsSync(src)) throw new Error(`Parked Wave F migration missing: ${migration}`);
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
    if (waveFPre[0]?.present) throw new Error('Wave F table present before restore — park failed');
    const waveE = await pre.$queryRawUnsafe(
      `SELECT to_regclass('public.treatment_courses') IS NOT NULL AS present`,
    );
    if (!waveE[0]?.present) throw new Error('Wave E table missing before Wave F upgrade');
    const courseCount = await pre.treatmentCourse.count();
    await pre.$disconnect();

    restore(parkedMigrations);
    parked = false;
    run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: upgradeUrl });

    const post = new PrismaClient({ datasources: { db: { url: upgradeUrl } } });
    await post.$connect();
    await post.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
    const waveFPost = await post.$queryRawUnsafe(
      `SELECT to_regclass('public.staff_commission_plan_versions') IS NOT NULL AS present`,
    );
    if (!waveFPost[0]?.present) throw new Error('Wave F table missing after upgrade');
    const accruals = await post.$queryRawUnsafe(
      `SELECT to_regclass('public.commission_accruals') IS NOT NULL AS present`,
    );
    if (!accruals[0]?.present) throw new Error('commission_accruals missing after upgrade');
    const courseCountAfter = await post.treatmentCourse.count();
    if (courseCountAfter !== courseCount) throw new Error('treatment_courses count changed');
    const userCol = await post.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS n FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'commissionEnabled'
    `);
    if (!userCol[0]?.n) throw new Error('commissionEnabled column missing after upgrade');

    const round1Mig = await post.$queryRawUnsafe(`
      SELECT migration_name FROM _prisma_migrations
      WHERE migration_name LIKE '%phase48_wave_f_round1_remediation%'
        AND finished_at IS NOT NULL
    `);
    if (!round1Mig.length) {
      throw new Error('Round 1 remediation migration not applied after upgrade');
    }
    const appendSrc = await post.$queryRawUnsafe(`
      SELECT pg_get_functiondef(p.oid) AS def
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'enforce_commission_accrual_append_only'
    `);
    if (!String(appendSrc[0]?.def || '').includes('settlementReference')) {
      throw new Error('Round 1 append-only trigger missing after upgrade');
    }
    const round4Mig = await post.$queryRawUnsafe(`
      SELECT migration_name FROM _prisma_migrations
      WHERE migration_name LIKE '%phase48_wave_f_round4_remediation%'
        AND finished_at IS NOT NULL
    `);
    if (!round4Mig.length) {
      throw new Error('Round 4 remediation migration not applied after upgrade');
    }
    const pkgAlloc = await post.$queryRawUnsafe(
      `SELECT to_regclass('public.commission_package_session_allocations') IS NOT NULL AS present`,
    );
    if (!pkgAlloc[0]?.present) {
      throw new Error('commission_package_session_allocations missing after upgrade');
    }
    const round5Mig = await post.$queryRawUnsafe(`
      SELECT migration_name FROM _prisma_migrations
      WHERE migration_name LIKE '%phase48_wave_f_round5_remediation%'
        AND finished_at IS NOT NULL
    `);
    if (!round5Mig.length) {
      throw new Error('Round 5 remediation migration not applied after upgrade');
    }
    const round10Mig = await post.$queryRawUnsafe(`
      SELECT migration_name FROM _prisma_migrations
      WHERE migration_name LIKE '%phase48_wave_f_round10_remediation%'
        AND finished_at IS NOT NULL
    `);
    if (!round10Mig.length) {
      throw new Error('Round 10 remediation migration not applied after upgrade');
    }
    const rootRefundIdx = await post.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS n
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'commission_accruals_tenant_root_refund_uidx'
    `);
    if (!rootRefundIdx[0]?.n) {
      throw new Error('Round 10 root/refund unique index missing after upgrade');
    }
    const round14Mig = await post.$queryRawUnsafe(`
      SELECT migration_name FROM _prisma_migrations
      WHERE migration_name LIKE '%phase48_wave_f_round14_correction_lineage%'
        AND finished_at IS NOT NULL
    `);
    if (!round14Mig.length) {
      throw new Error('Round 14 correction lineage migration not applied after upgrade');
    }
    const round15Mig = await post.$queryRawUnsafe(`
      SELECT migration_name FROM _prisma_migrations
      WHERE migration_name LIKE '%phase48_wave_f_round15_final_remediation%'
        AND finished_at IS NOT NULL
    `);
    if (!round15Mig.length) {
      throw new Error('Round 15 final remediation migration not applied after upgrade');
    }
    const lineageProv = await post.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS n
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'enforce_commission_correction_lineage_provenance'
    `);
    if (!lineageProv[0]?.n) {
      throw new Error('Round 15 lineage provenance function missing after upgrade');
    }
    const pkgPolicies = await post.$queryRawUnsafe(`
      SELECT pg_get_expr(pol.polqual, pol.polrelid) AS using_expr,
             pg_get_expr(pol.polwithcheck, pol.polrelid) AS check_expr
      FROM pg_policy pol
      JOIN pg_class c ON c.oid = pol.polrelid
      WHERE c.relname = 'commission_package_session_allocations'
    `);
    const joined = pkgPolicies
      .map((p) => `${p.using_expr || ''} ${p.check_expr || ''}`)
      .join(' ');
    if (!joined.includes('app.current_tenant_id')) {
      throw new Error('Round 5 package allocation RLS must use app.current_tenant_id after upgrade');
    }
    console.log('PHASE48_WAVE_F_UPGRADE_VALIDATOR_PASSED');
    await post.$disconnect();

    // ── Round 15 historical negative: orphan correctionEventId must block R15 deploy ──
    const negDb = `${upgradeDb}_neg`;
    const negUrl = `postgresql://booking:booking_test@localhost:5433/${negDb}?schema=public`;
    const round15Name = listWaveFMigrations().find((m) =>
      m.includes('phase48_wave_f_round15_final_remediation'),
    );
    if (!round15Name) {
      throw new Error('Round 15 migration folder not found among Wave F migrations');
    }
    const round15Park = path.join(parkDir, round15Name);
    await withAdmin(async (admin) => {
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${negDb}`);
      await admin.$executeRawUnsafe(`CREATE DATABASE ${negDb}`);
    });
    try {
      // Park only Round 15, deploy through Round 14.
      fs.mkdirSync(parkDir, { recursive: true });
      const round15Src = path.join(migrationsDir, round15Name);
      if (fs.existsSync(round15Park)) fs.rmSync(round15Park, { recursive: true, force: true });
      fs.renameSync(round15Src, round15Park);
      run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: negUrl });

      const neg = new PrismaClient({ datasources: { db: { url: negUrl } } });
      await neg.$connect();
      await neg.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;

      const tenantId = randomUUID();
      const userId = randomUUID();
      const svcId = randomUUID();
      const perfId = randomUUID();
      const planId = randomUUID();
      const accrualId = randomUUID();
      const orphanEventId = randomUUID();
      const slug = `r15neg-${tenantId.slice(0, 8)}`;
      const email = `r15neg-${userId.slice(0, 8)}@t.local`;
      const stableKey = `tenant.${tenantId}.custom.r15neg-${svcId.slice(0, 8)}`;
      const idem = `r15-neg-orphan-${accrualId}`;

      await neg.$executeRawUnsafe(
        `INSERT INTO tenants (id, name, slug, "createdAt", "updatedAt")
         VALUES ('${tenantId}'::uuid, 'R15 neg', '${slug}', NOW(), NOW())`,
      );
      await neg.$executeRawUnsafe(
        `INSERT INTO users (id, "tenantId", email, "passwordHash", "firstName", "lastName", "createdAt", "updatedAt")
         VALUES ('${userId}'::uuid, '${tenantId}'::uuid, '${email}', 'x', 'N', 'Eg', NOW(), NOW())`,
      );
      await neg.$executeRawUnsafe(
        `INSERT INTO canonical_clinical_service_definitions
           (id, "tenantId", provenance, "stableKey", domain, lifecycle, "createdAt", "updatedAt")
         VALUES ('${svcId}'::uuid, '${tenantId}'::uuid, 'TENANT_CUSTOM', '${stableKey}', 'GENERAL', 'PUBLISHED', NOW(), NOW())`,
      );
      await neg.$executeRawUnsafe(
        `INSERT INTO service_performances
           (id, "tenantId", "clinicalServiceId", "performedAt", status, "createdBy", "completedAt", "completedBy", "createdAt", "updatedAt")
         VALUES ('${perfId}'::uuid, '${tenantId}'::uuid, '${svcId}'::uuid, NOW(), 'COMPLETED', '${userId}'::uuid, NOW(), '${userId}'::uuid, NOW(), NOW())`,
      );
      await neg.$executeRawUnsafe(
        `INSERT INTO staff_commission_plan_versions
           (id, "tenantId", "userId", percentage, "effectiveFrom", status, "createdBy", "publishedAt", "publishedBy", "createdAt", "updatedAt")
         VALUES ('${planId}'::uuid, '${tenantId}'::uuid, '${userId}'::uuid, 10, DATE '2026-01-01', 'ACTIVE', '${userId}'::uuid, NOW(), '${userId}'::uuid, NOW(), NOW())`,
      );
      await neg.$executeRawUnsafe(
        `INSERT INTO commission_accruals
           (id, "tenantId", "userId", "servicePerformanceId", "clinicalServiceId",
            "commissionPlanVersionId", "calculationBasis", "attributedRevenueAmount",
            "commissionPercent", "commissionAmount", currency, status, "earnedAt",
            "idempotencyKey", "createdBy", "correctionEventId", "createdAt")
         VALUES
           ('${accrualId}'::uuid, '${tenantId}'::uuid, '${userId}'::uuid, '${perfId}'::uuid, '${svcId}'::uuid,
            '${planId}'::uuid, 'SERVICE_NET_AFTER_DISCOUNT', 100,
            10, 10, 'SYP', 'EARNED', NOW(),
            '${idem}', '${userId}'::uuid, '${orphanEventId}'::uuid, NOW())`,
      );
      await neg.$disconnect();

      // Restore Round 15 and expect migrate deploy to fail closed on zero-history.
      fs.renameSync(round15Park, round15Src);
      const deploy = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
        cwd: apiRoot,
        env: { ...process.env, DATABASE_URL: negUrl },
        encoding: 'utf8',
        shell: true,
      });
      const combined = `${deploy.stdout || ''}\n${deploy.stderr || ''}`;
      if ((deploy.status ?? 1) === 0) {
        throw new Error('Expected Round 15 migrate deploy to fail on zero-history orphan; it succeeded');
      }
      if (!/zero-history/i.test(combined)) {
        throw new Error(
          `Expected zero-history failure in Round 15 negative deploy, got:\n${combined.slice(0, 4000)}`,
        );
      }
      console.log('PHASE48_WAVE_F_UPGRADE_HISTORICAL_NEGATIVE_PASSED');
    } finally {
      // Ensure Round 15 folder is restored even if park left it aside.
      const round15Src = path.join(migrationsDir, round15Name);
      if (!fs.existsSync(round15Src) && fs.existsSync(round15Park)) {
        fs.renameSync(round15Park, round15Src);
      }
      if (fs.existsSync(parkDir) && fs.readdirSync(parkDir).length === 0) {
        fs.rmSync(parkDir, { recursive: true, force: true });
      }
      await withAdmin(async (admin) => {
        await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${negDb}`);
      });
    }
  } catch (err) {
    if (parked) {
      try {
        restore(parkedMigrations);
      } catch (restoreErr) {
        console.error('Failed to restore parked Wave F migrations:', restoreErr);
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
