#!/usr/bin/env node
/**
 * Phase 48 Wave F — clean migration validator.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const cleanDb = `test_p48wf_clean_${Date.now()}`;
const WAVE_F_TABLES = ['staff_commission_plan_versions', 'commission_accruals'];

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
    for (const table of WAVE_F_TABLES) {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
      );
      if (!rows[0]?.present) throw new Error(`Missing Wave F table: ${table}`);
      console.log(`OK table ${table}`);
    }
    for (const table of WAVE_F_TABLES) {
      const rls = await prisma.$queryRawUnsafe(
        `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = '${table}'`,
      );
      if (!rls[0]?.relrowsecurity) throw new Error(`${table} RLS not enabled`);
      if (!rls[0]?.relforcerowsecurity) throw new Error(`${table} FORCE RLS not set`);
      console.log(`OK RLS ${table}`);
    }
    const userCols = await prisma.$queryRawUnsafe(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'
        AND column_name IN ('commissionEnabled', 'defaultCommissionPercent', 'commissionEffectiveFrom')
    `);
    if (userCols.length < 3) {
      throw new Error('users Wave F commission eligibility columns missing');
    }
    console.log('OK users commission eligibility columns');

    const trig = await prisma.$queryRawUnsafe(`
      SELECT tgname FROM pg_trigger
      WHERE tgname IN (
        'staff_commission_plan_versions_tenant_refs',
        'staff_commission_plan_versions_immutability',
        'commission_accruals_tenant_refs',
        'commission_accruals_append_only'
      )
    `);
    if (trig.length < 4) throw new Error('Wave F integrity/immutability triggers missing');
    console.log('OK Wave F triggers');

    // Round 1: append-only body must whitelist settle-only columns
    const appendSrc = await prisma.$queryRawUnsafe(`
      SELECT pg_get_functiondef(p.oid) AS def
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'enforce_commission_accrual_append_only'
    `);
    const appendDef = String(appendSrc[0]?.def || '');
    if (!appendDef.includes('only EARNED') && !appendDef.includes('append-only')) {
      throw new Error('Round 1 append-only trigger definition missing');
    }
    if (!appendDef.includes('settlementReference')) {
      throw new Error('Round 1 append-only trigger must reference settlementReference whitelist');
    }
    console.log('OK Round 1 append-only trigger');

    const planImmSrc = await prisma.$queryRawUnsafe(`
      SELECT pg_get_functiondef(p.oid) AS def
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'enforce_staff_commission_plan_immutability'
    `);
    const planImmDef = String(planImmSrc[0]?.def || '');
    if (!planImmDef.includes('effectiveTo') || !planImmDef.includes('earningTrigger')) {
      throw new Error('Round 1 plan immutability must cover effectiveTo + earningTrigger');
    }
    console.log('OK Round 1 plan immutability trigger');

    const round1Mig = await prisma.$queryRawUnsafe(`
      SELECT migration_name FROM _prisma_migrations
      WHERE migration_name LIKE '%phase48_wave_f_round1_remediation%'
        AND finished_at IS NOT NULL
    `);
    if (!round1Mig.length) {
      throw new Error('Round 1 remediation migration not applied');
    }
    console.log('OK Round 1 remediation migration applied');

    const round2Mig = await prisma.$queryRawUnsafe(`
      SELECT migration_name FROM _prisma_migrations
      WHERE migration_name LIKE '%phase48_wave_f_round2_remediation%'
        AND finished_at IS NOT NULL
    `);
    if (!round2Mig.length) {
      throw new Error('Round 2 remediation migration not applied');
    }
    console.log('OK Round 2 remediation migration applied');

    const settleTable = await prisma.$queryRawUnsafe(
      `SELECT to_regclass('public.commission_settlement_allocations') IS NOT NULL AS present`,
    );
    if (!settleTable[0]?.present) {
      throw new Error('Missing Round 2 table: commission_settlement_allocations');
    }
    const settleRls = await prisma.$queryRawUnsafe(
      `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'commission_settlement_allocations'`,
    );
    if (!settleRls[0]?.relrowsecurity || !settleRls[0]?.relforcerowsecurity) {
      throw new Error('commission_settlement_allocations RLS/FORCE missing');
    }
    console.log('OK Round 2 settlement allocation table + RLS');

    const lineCol = await prisma.$queryRawUnsafe(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'invoice_line_items' AND column_name = 'servicePerformanceId'
    `);
    if (!lineCol.length) {
      throw new Error('invoice_line_items.servicePerformanceId missing');
    }
    console.log('OK Round 2 durable invoice_line_items.servicePerformanceId');

    const round3Mig = await prisma.$queryRawUnsafe(`
      SELECT migration_name FROM _prisma_migrations
      WHERE migration_name LIKE '%phase48_wave_f_round3_remediation%'
        AND finished_at IS NOT NULL
    `);
    if (!round3Mig.length) {
      throw new Error('Round 3 remediation migration not applied');
    }
    console.log('OK Round 3 remediation migration applied');

    const immTrig = await prisma.$queryRawUnsafe(`
      SELECT tgname FROM pg_trigger
      WHERE tgname = 'invoice_line_items_service_performance_immutable'
    `);
    if (!immTrig.length) {
      throw new Error('Round 3 invoice_line_items servicePerformanceId immutability trigger missing');
    }
    console.log('OK Round 3 servicePerformanceId immutability trigger');

    const round4Mig = await prisma.$queryRawUnsafe(`
      SELECT migration_name FROM _prisma_migrations
      WHERE migration_name LIKE '%phase48_wave_f_round4_remediation%'
        AND finished_at IS NOT NULL
    `);
    if (!round4Mig.length) {
      throw new Error('Round 4 remediation migration not applied');
    }
    console.log('OK Round 4 remediation migration applied');

    const allocTable = await prisma.$queryRawUnsafe(
      `SELECT to_regclass('public.commission_package_session_allocations') IS NOT NULL AS present`,
    );
    if (!allocTable[0]?.present) {
      throw new Error('Missing Round 4 table: commission_package_session_allocations');
    }
    const allocRls = await prisma.$queryRawUnsafe(
      `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'commission_package_session_allocations'`,
    );
    if (!allocRls[0]?.relrowsecurity || !allocRls[0]?.relforcerowsecurity) {
      throw new Error('commission_package_session_allocations RLS/FORCE missing');
    }
    console.log('OK Round 4 package allocation table + RLS');

    const provCols = await prisma.$queryRawUnsafe(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'invoice_line_items'
        AND column_name IN ('appointmentId','clinicalServiceId','snapshotRevisionId','courseSessionId','performanceBindingStatus')
    `);
    if (provCols.length < 5) {
      throw new Error('Round 4 invoice_line_items provenance columns missing');
    }
    console.log('OK Round 4 invoice line provenance columns');

    const round5Mig = await prisma.$queryRawUnsafe(`
      SELECT migration_name FROM _prisma_migrations
      WHERE migration_name LIKE '%phase48_wave_f_round5_remediation%'
        AND finished_at IS NOT NULL
    `);
    if (!round5Mig.length) {
      throw new Error('Round 5 remediation migration not applied');
    }
    console.log('OK Round 5 remediation migration applied');

    const round10Mig = await prisma.$queryRawUnsafe(`
      SELECT migration_name FROM _prisma_migrations
      WHERE migration_name LIKE '%phase48_wave_f_round10_remediation%'
        AND finished_at IS NOT NULL
    `);
    if (!round10Mig.length) {
      throw new Error('Round 10 remediation migration not applied');
    }
    console.log('OK Round 10 remediation migration applied');
    const rootRefundIdx = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS n
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'commission_accruals_tenant_root_refund_uidx'
    `);
    if (!rootRefundIdx[0]?.n) {
      throw new Error('Round 10 commission_accruals_tenant_root_refund_uidx missing');
    }
    console.log('OK Round 10 root/refund unique index');

    const round14Mig = await prisma.$queryRawUnsafe(`
      SELECT migration_name FROM _prisma_migrations
      WHERE migration_name LIKE '%phase48_wave_f_round14_correction_lineage%'
        AND finished_at IS NOT NULL
    `);
    if (!round14Mig.length) {
      throw new Error('Round 14 correction lineage migration not applied');
    }
    console.log('OK Round 14 correction lineage migration applied');

    const lineageTable = await prisma.$queryRawUnsafe(`
      SELECT to_regclass('public.commission_correction_lineages') IS NOT NULL AS present
    `);
    if (!lineageTable[0]?.present) {
      throw new Error('commission_correction_lineages table missing');
    }
    const lineageRls = await prisma.$queryRawUnsafe(`
      SELECT c.relrowsecurity AS rls, c.relforcerowsecurity AS force_rls
      FROM pg_class c
      WHERE c.relname = 'commission_correction_lineages'
    `);
    if (!lineageRls[0]?.rls || !lineageRls[0]?.force_rls) {
      throw new Error('commission_correction_lineages RLS/FORCE missing');
    }
    const lineageIdx = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS n
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'commission_correction_lineages_tenant_event_uidx'
    `);
    if (!lineageIdx[0]?.n) {
      throw new Error('commission_correction_lineages_tenant_event_uidx missing');
    }
    const lineageDelete = await prisma.$queryRawUnsafe(`
      SELECT pol.polname, pg_get_expr(pol.polqual, pol.polrelid) AS using_expr
      FROM pg_policy pol
      JOIN pg_class c ON c.oid = pol.polrelid
      WHERE c.relname = 'commission_correction_lineages' AND pol.polcmd = 'd'
    `);
    const lineageDenyDelete = lineageDelete.some(
      (p) => String(p.using_expr || '').includes('false') || p.using_expr === 'false',
    );
    if (!lineageDenyDelete) {
      throw new Error('commission_correction_lineages DELETE policy must deny (USING false)');
    }
    console.log('OK Round 14 commission_correction_lineages table + RLS + unique index');

    const round15Mig = await prisma.$queryRawUnsafe(`
      SELECT migration_name FROM _prisma_migrations
      WHERE migration_name LIKE '%phase48_wave_f_round15_final_remediation%'
        AND finished_at IS NOT NULL
    `);
    if (!round15Mig.length) {
      throw new Error('Round 15 final remediation migration not applied');
    }
    console.log('OK Round 15 final remediation migration applied');

    const lineageProv = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS n
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'enforce_commission_correction_lineage_provenance'
    `);
    if (!lineageProv[0]?.n) {
      throw new Error('enforce_commission_correction_lineage_provenance missing');
    }
    const revShape = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS n
      FROM pg_constraint
      WHERE conname = 'commission_accruals_reversed_economic_shape_chk'
    `);
    if (!revShape[0]?.n) {
      throw new Error('commission_accruals_reversed_economic_shape_chk missing');
    }
    console.log('OK Round 15 lineage provenance + reversed economic shape');

    const pkgPolicies = await prisma.$queryRawUnsafe(`
      SELECT pol.polname, pg_get_expr(pol.polqual, pol.polrelid) AS using_expr,
             pg_get_expr(pol.polwithcheck, pol.polrelid) AS check_expr
      FROM pg_policy pol
      JOIN pg_class c ON c.oid = pol.polrelid
      WHERE c.relname = 'commission_package_session_allocations'
    `);
    if (!pkgPolicies.length) {
      throw new Error('commission_package_session_allocations policies missing after Round 5');
    }
    const joined = pkgPolicies
      .map((p) => `${p.using_expr || ''} ${p.check_expr || ''}`)
      .join(' ');
    if (!joined.includes('app.current_tenant_id')) {
      throw new Error('Round 5 package allocation RLS must use app.current_tenant_id');
    }
    if (joined.includes("app.tenant_id") && !joined.includes('app.current_tenant_id')) {
      throw new Error('Round 5 package allocation RLS must not rely on app.tenant_id alone');
    }
    // Reject residual wrong setting key without current_ prefix
    const hasWrongTenantKey = pkgPolicies.some((p) => {
      const expr = `${p.using_expr || ''} ${p.check_expr || ''}`;
      return /app\.tenant_id/.test(expr) && !/app\.current_tenant_id/.test(expr);
    });
    if (hasWrongTenantKey) {
      throw new Error('Round 5 package allocation RLS still uses app.tenant_id');
    }
    console.log('OK Round 5 package allocation RLS uses app.current_tenant_id');

    const csvcFn = await prisma.$queryRawUnsafe(`
      SELECT pg_get_functiondef(p.oid) AS def
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'enforce_invoice_line_provenance_tenant'
    `);
    const csvcDef = String(csvcFn[0]?.def || '');
    if (!csvcDef.includes('TENANT_CUSTOM') && !csvcDef.includes('ownership mismatch')) {
      throw new Error('Round 5 clinicalServiceId ownership check missing from provenance trigger');
    }
    console.log('OK Round 5 clinicalServiceId TENANT_CUSTOM integrity');

    const legacy = await prisma.$queryRawUnsafe(`
      SELECT to_regclass('public.commission_rules') IS NOT NULL AS present
    `);
    if (!legacy[0]?.present) {
      // Legacy may use a different map name — tolerate either presence of legacy enum or table.
      const legacyAlt = await prisma.$queryRawUnsafe(`
        SELECT to_regclass('public.commission_calculations') IS NOT NULL AS present
      `);
      if (!legacyAlt[0]?.present) {
        console.log('WARN: legacy commission tables not found (acceptable if renamed)');
      }
    }

    const deletePolicy = await prisma.$queryRawUnsafe(`
      SELECT pol.polname, pg_get_expr(pol.polqual, pol.polrelid) AS using_expr
      FROM pg_policy pol
      JOIN pg_class c ON c.oid = pol.polrelid
      WHERE c.relname = 'commission_accruals' AND pol.polcmd = 'd'
    `);
    const denyDelete = deletePolicy.some(
      (p) => String(p.using_expr || '').includes('false') || p.using_expr === 'false',
    );
    if (!denyDelete) throw new Error('commission_accruals DELETE policy must deny (USING false)');
    console.log('OK commission_accruals delete denied');

    console.log('PHASE48_WAVE_F_CLEAN_VALIDATOR_PASSED');
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
