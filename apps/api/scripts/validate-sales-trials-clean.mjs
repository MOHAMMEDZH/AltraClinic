#!/usr/bin/env node
/**
 * Flexible Step 25 — Trial Creation and Customer Conversion clean migration validator.
 * Fresh DB: migrate deploy → Catalog 68/136/68/13 → Step 23/24/25 tables present & empty →
 * no auto-created trials → no Step 26 tables → no billing tables.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const cleanDb = `test_sales25_clean_${Date.now()}`;

const OVERALL_DEADLINE_MS = 10 * 60 * 1000;
const MIGRATE_TIMEOUT_MS = 5 * 60 * 1000;
const SEED_TIMEOUT_MS = 3 * 60 * 1000;
const ADMIN_STATEMENT_TIMEOUT_MS = 30_000;
const CONNECT_ATTEMPTS = 30;

const STEP23_TABLES = [
  'platform_sales_representatives',
  'platform_sales_customer_ownership',
  'platform_sales_customer_ownership_history',
  'platform_sales_idempotency',
];

const STEP24_TABLES = [
  'platform_sales_leads',
  'platform_sales_lead_stage_history',
  'platform_sales_lead_ownership_history',
  'platform_sales_lead_notes',
];

const STEP25_TABLES = [
  'platform_sales_trials',
  'platform_sales_trial_extension_history',
  'platform_sales_trial_conversions',
];

const BILLING_FORBIDDEN = [
  'platform_billing_runtime',
  'platform_billing_invoices',
  'platform_billing_charges',
  'platform_billing_payments',
  'platform_overage_charges',
];

/**
 * Step 26 commission snapshot table is legitimately present once Step 26 ships.
 * Still forbid invented payroll/pipeline/commission-rule surfaces.
 */
const STEP26_COMMISSION_SNAPSHOT_ALLOWED = ['platform_sales_commission_snapshots'];

const STEP26_PLUS_FORBIDDEN = [
  'platform_sales_opportunities',
  'platform_sales_pipeline_stages',
  'platform_sales_commissions',
  'platform_sales_commission_rules',
  'platform_sales_productivity_snapshots',
];

/** Trial entitlements stay Step 16/18 authority: no parallel trial entitlement engine. */
const PARALLEL_ENGINE_FORBIDDEN = [
  'platform_sales_trial_entitlements',
  'platform_sales_trial_limits',
  'platform_sales_trial_usage',
  'platform_trial_entitlement_snapshots',
];

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.RUN_PLATFORM_DB_SECURITY = 'true';
process.env.ALLOW_TEST_DATABASE_RESET = 'true';

const adminUrl =
  process.env.INTEGRATION_ADMIN_DATABASE_URL ||
  'postgresql://booking:booking_test@localhost:5433/postgres';
const cleanUrl = `postgresql://booking:booking_test@localhost:5433/${cleanDb}?schema=public`;

const startedAt = Date.now();
let deadlineTimer;

function remainingMs() {
  return OVERALL_DEADLINE_MS - (Date.now() - startedAt);
}

function assertWithinDeadline(step) {
  if (remainingMs() <= 0) {
    throw new Error(
      `Clean validator overall deadline exceeded (${OVERALL_DEADLINE_MS}ms) at step: ${step}`,
    );
  }
}

function log(msg) {
  console.log(`[sales25-clean-validator +${Date.now() - startedAt}ms] ${msg}`);
}

function run(cmd, args, env = {}, timeoutMs = MIGRATE_TIMEOUT_MS) {
  assertWithinDeadline(`${cmd} ${args.join(' ')}`);
  const budget = Math.min(timeoutMs, Math.max(5_000, remainingMs()));
  log(`run: ${cmd} ${args.join(' ')} (timeout=${budget}ms)`);
  const result = spawnSync(cmd, args, {
    cwd: apiRoot,
    env: { ...process.env, ...env },
    stdio: 'inherit',
    shell: true,
    timeout: budget,
    killSignal: 'SIGTERM',
  });
  if (result.error) {
    throw new Error(`Command error: ${cmd} ${args.join(' ')} — ${result.error.message}`);
  }
  if (result.signal) {
    throw new Error(
      `Command killed by ${result.signal}: ${cmd} ${args.join(' ')} (timeout=${budget}ms)`,
    );
  }
  if ((result.status ?? 1) !== 0) {
    throw new Error(`Command failed (exit ${result.status}): ${cmd} ${args.join(' ')}`);
  }
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

async function connectWithRetry(url, attempts = CONNECT_ATTEMPTS) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    assertWithinDeadline(`connect ${url}`);
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
    await admin.$executeRawUnsafe(`SET lock_timeout = '10000'`);
    await admin.$executeRawUnsafe(`SET statement_timeout = ${ADMIN_STATEMENT_TIMEOUT_MS}`);
    return await fn(admin);
  } finally {
    try {
      await admin.$disconnect();
    } catch {
      /* ignore */
    }
  }
}

async function tablePresent(prisma, table) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
  );
  return Boolean(rows[0]?.present);
}

async function indexDefs(prisma, table) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT indexdef FROM pg_indexes WHERE tablename = '${table}'`,
  );
  return rows.map((r) => r.indexdef).join('\n');
}

async function main() {
  deadlineTimer = setTimeout(() => {
    console.error(
      `Clean validator hard deadline ${OVERALL_DEADLINE_MS}ms exceeded — exiting nonzero.`,
    );
    process.exit(1);
  }, OVERALL_DEADLINE_MS);
  if (typeof deadlineTimer.unref === 'function') deadlineTimer.unref();

  log(`CREATE DATABASE ${cleanDb}`);
  await withAdmin(async (admin) => {
    await admin.$executeRawUnsafe(`CREATE DATABASE ${cleanDb}`);
  });

  log('prisma migrate deploy...');
  run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: cleanUrl }, MIGRATE_TIMEOUT_MS);

  const prisma = new PrismaClient({ datasources: { db: { url: cleanUrl } } });
  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1 AS ok`;
  try {
    await prisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;

    for (const table of [
      ...STEP23_TABLES,
      ...STEP24_TABLES,
      ...STEP25_TABLES,
      ...STEP26_COMMISSION_SNAPSHOT_ALLOWED,
    ]) {
      if (!(await tablePresent(prisma, table))) {
        throw new Error(`Missing Step 23/24/25/26 table: ${table}`);
      }
    }
    for (const table of [
      ...BILLING_FORBIDDEN,
      ...STEP26_PLUS_FORBIDDEN,
      ...PARALLEL_ENGINE_FORBIDDEN,
    ]) {
      if (await tablePresent(prisma, table)) {
        throw new Error(`Forbidden table present: ${table}`);
      }
    }

    const catalogItems = await prisma.healthcareCatalogItem.count();
    if (catalogItems === 0) {
      log('Catalog empty after migrate; running healthcare catalog seed...');
      await prisma.$disconnect();
      run('npm', ['run', 'seed:healthcare-catalog'], { DATABASE_URL: cleanUrl }, SEED_TIMEOUT_MS);
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1 AS ok`;
    }

    let counts;
    let lastCountErr;
    for (let i = 0; i < 10; i++) {
      assertWithinDeadline('catalog + trial counts');
      try {
        const [
          items,
          translations,
          aliases,
          rules,
          salesReps,
          leads,
          trials,
          extensions,
          conversions,
          idempotency,
          trialAudits,
        ] = await Promise.all([
          prisma.healthcareCatalogItem.count(),
          prisma.healthcareCatalogTranslation.count(),
          prisma.healthcareCatalogAlias.count(),
          prisma.healthcareCatalogCompatibilityRule.count(),
          prisma.platformSalesRepresentative.count(),
          prisma.platformSalesLead.count(),
          prisma.platformSalesTrial.count(),
          prisma.platformSalesTrialExtensionHistory.count(),
          prisma.platformSalesTrialConversion.count(),
          prisma.platformSalesIdempotencyRecord.count(),
          prisma.auditEntry.count({ where: { category: 'sales_trial_management' } }),
        ]);
        counts = {
          items,
          translations,
          aliases,
          rules,
          salesReps,
          leads,
          trials,
          extensions,
          conversions,
          idempotency,
          trialAudits,
        };
        lastCountErr = undefined;
        break;
      } catch (err) {
        lastCountErr = err;
        sleep(1000);
        try {
          await prisma.$connect();
        } catch {
          /* ignore */
        }
      }
    }
    if (lastCountErr) throw lastCountErr;

    const expect = (name, actual, want) => {
      if (actual !== want) throw new Error(`${name}: expected ${want}, got ${actual}`);
      console.log(`OK ${name}=${actual}`);
    };

    expect('Catalog Items', counts.items, 68);
    expect('Catalog Translations', counts.translations, 136);
    expect('Catalog Aliases', counts.aliases, 68);
    expect('Catalog Compatibility rules', counts.rules, 13);
    expect('sales representatives (no auto invent)', counts.salesReps, 0);
    expect('sales leads (no auto invent)', counts.leads, 0);
    expect('sales trials (no auto-created trials)', counts.trials, 0);
    expect('trial extension history (empty)', counts.extensions, 0);
    expect('trial conversions (empty)', counts.conversions, 0);
    expect('sales idempotency records (empty)', counts.idempotency, 0);
    expect('trial audit entries (no invented audits)', counts.trialAudits, 0);

    // Governance queries the contract requires must be index-backed from migration time.
    const trialIndexes = await indexDefs(prisma, 'platform_sales_trials');
    for (const column of [
      'status',
      'expiresAt',
      'ownerRepresentativeId',
      'platformTenantId',
      'originatingLeadId',
      'trialPlanVersionId',
      'createdAt',
    ]) {
      if (!trialIndexes.includes(column)) {
        throw new Error(`platform_sales_trials missing an index covering ${column}`);
      }
    }
    console.log('OK platform_sales_trials indexes cover owner/status/expiry/tenant/lead/plan');

    for (const table of [
      'platform_sales_trial_extension_history',
      'platform_sales_trial_conversions',
    ]) {
      const defs = await indexDefs(prisma, table);
      if (!defs.includes('trialId')) throw new Error(`${table} missing a trialId index`);
    }
    console.log('OK trial history/conversion tables indexed by trialId');

    const snapshotCount = await prisma.platformSalesCommissionSnapshot.count();
    if (snapshotCount !== 0) {
      throw new Error(`commission snapshots must be empty after migrate, got ${snapshotCount}`);
    }
    console.log('OK commission snapshots empty (no auto invent)');
    console.log('OK no billing / Step 26+ payroll-pipeline / parallel trial entitlement engine tables');
    console.log('OK Step 25 trial schema present and empty');
    log(`Step 25 clean migration validator passed (db=${cleanDb}).`);
  } finally {
    try {
      await prisma.$disconnect();
    } catch {
      /* ignore */
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    if (deadlineTimer) clearTimeout(deadlineTimer);
    process.exit(process.exitCode ?? 0);
  });
