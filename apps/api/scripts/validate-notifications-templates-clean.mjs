#!/usr/bin/env node
/**
 * Flexible Step 27 — Notifications and Templates clean migration validator.
 * Fresh DB: migrate deploy → Catalog 68/136/68/13 → platform_notification_preferences
 * present & empty → no auto-created preferences → no second engine / Step 28 tables.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const cleanDb = `test_notif27_clean_${Date.now()}`;

const OVERALL_DEADLINE_MS = 10 * 60 * 1000;
const MIGRATE_TIMEOUT_MS = 5 * 60 * 1000;
const SEED_TIMEOUT_MS = 3 * 60 * 1000;
const ADMIN_STATEMENT_TIMEOUT_MS = 30_000;
const CONNECT_ATTEMPTS = 30;

const STEP27_REQUIRED = ['platform_notification_preferences'];

/** Phase 41d engine tables must remain the sole delivery SoR (present from prior migrations). */
const ENGINE_TABLES = [
  'notification_intents',
  'notification_messages',
  'notification_delivery_jobs',
  'notification_delivery_attempts',
  'notification_receipts',
];

/** No second engine / Step 28–29 / CMS template tables. */
const FORBIDDEN = [
  'platform_notification_templates',
  'platform_notification_template_versions',
  'platform_notification_engine',
  'platform_notification_engine_jobs',
  'platform_sales_notification_templates',
  'platform_hardening_runs',
  'platform_release_gates',
  'platform_step28_artifacts',
  'platform_step29_artifacts',
  'platform_billing_runtime',
  'platform_billing_invoices',
  'platform_payroll_runs',
  'platform_payslips',
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
  console.log(`[notif27-clean-validator +${Date.now() - startedAt}ms] ${msg}`);
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

    for (const table of STEP27_REQUIRED) {
      if (!(await tablePresent(prisma, table))) {
        throw new Error(`Missing Step 27 table: ${table}`);
      }
    }
    for (const table of ENGINE_TABLES) {
      if (!(await tablePresent(prisma, table))) {
        throw new Error(`Missing Phase 41d engine table (sole delivery SoR): ${table}`);
      }
    }
    for (const table of FORBIDDEN) {
      if (await tablePresent(prisma, table)) {
        throw new Error(`Forbidden second-engine / Step 28 table present: ${table}`);
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
      assertWithinDeadline('catalog + preference counts');
      try {
        const [items, translations, aliases, rules, prefs, notifAudits] = await Promise.all([
          prisma.healthcareCatalogItem.count(),
          prisma.healthcareCatalogTranslation.count(),
          prisma.healthcareCatalogAlias.count(),
          prisma.healthcareCatalogCompatibilityRule.count(),
          prisma.platformNotificationPreference.count(),
          prisma.auditEntry.count({ where: { category: 'platform_notification_management' } }),
        ]);
        counts = { items, translations, aliases, rules, prefs, notifAudits };
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
    expect('platform_notification_preferences (no auto invent)', counts.prefs, 0);
    expect('notification audit entries (no invented audits)', counts.notifAudits, 0);

    const prefIndexes = await indexDefs(prisma, 'platform_notification_preferences');
    for (const fragment of [
      'platformUserId',
      'category',
      'channel',
      'platform_notification_preferences_user_cat_ch_uidx',
    ]) {
      if (!prefIndexes.includes(fragment)) {
        throw new Error(
          `platform_notification_preferences missing expected index coverage: ${fragment}`,
        );
      }
    }
    console.log('OK preference indexes + unique (user, category, channel) present');
    console.log('OK Phase 41d engine tables present; no second engine / Step 28 tables');
    console.log('OK Step 27 preferences schema present and empty');
    log(`Step 27 clean migration validator passed (db=${cleanDb}).`);
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
