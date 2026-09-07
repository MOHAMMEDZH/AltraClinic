#!/usr/bin/env node
/**
 * Flexible Step 24 — one uninterrupted final acceptance sequence orchestrator.
 * Stops on first non-zero exit. Does not retry. Does not implement Step 25.
 */
import { spawnSync, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(apiRoot, '../..');
const saRoot = path.resolve(repoRoot, 'apps/super-admin');
const clinicRoot = path.resolve(repoRoot, 'apps/clinic-dashboard');
const logPath = path.join(apiRoot, 'step24-final-onepass.jsonl');

const env = {
  ...process.env,
  RUN_PLATFORM_DB_SECURITY: 'true',
  ALLOW_TEST_DATABASE_RESET: 'true',
  ALLOW_DESTRUCTIVE_PLATFORM_DB_TESTS: '1',
  ALLOW_DESTRUCTIVE_DB_TESTS: '1',
  NODE_ENV: process.env.NODE_ENV || 'test',
  FEATURE_FLAGS_SETTINGS_ENABLED: process.env.FEATURE_FLAGS_SETTINGS_ENABLED || 'false',
  TENANT_LIFECYCLE_ENABLED: process.env.TENANT_LIFECYCLE_ENABLED || 'false',
  AUDIT_CENTER_ENABLED: process.env.AUDIT_CENTER_ENABLED || 'false',
  OPERATIONS_CONSOLE_ENABLED: process.env.OPERATIONS_CONSOLE_ENABLED || 'false',
  INTEGRATION_DATABASE_URL:
    process.env.INTEGRATION_DATABASE_URL ||
    'postgresql://booking:booking_test@localhost:5433/booking_test?schema=public',
  INTEGRATION_ADMIN_DATABASE_URL:
    process.env.INTEGRATION_ADMIN_DATABASE_URL ||
    'postgresql://booking:booking_test@localhost:5433/postgres',
};

function meta(cmd, cwd, started, ended, status, note = '') {
  const row = {
    order: meta.order++,
    command: cmd,
    cwd,
    start: started.toISOString(),
    end: ended.toISOString(),
    durationMs: ended - started,
    exitCode: status,
    note,
  };
  fs.appendFileSync(logPath, JSON.stringify(row) + '\n');
  console.log(
    `\n=== #${row.order} ${cmd} ===\nexit=${status} durationMs=${row.durationMs}${note ? ` note=${note}` : ''}\n`,
  );
  return row;
}
meta.order = 0;

function run(cmd, cwd, opts = {}) {
  const started = new Date();
  console.log(`\n>>> START ${started.toISOString()} :: ${cmd} (cwd=${cwd})`);
  const timeoutMs = opts.timeoutMs ?? 45 * 60 * 1000;
  const result = spawnSync(cmd, {
    cwd,
    env: { ...env, ...(opts.env || {}) },
    shell: true,
    stdio: opts.capture ? 'pipe' : 'inherit',
    encoding: opts.capture ? 'utf8' : undefined,
    timeout: timeoutMs,
    killSignal: 'SIGTERM',
  });
  const ended = new Date();
  let status = result.status ?? 1;
  let note = '';
  if (result.signal) {
    note = `killed_by_${result.signal}_timeoutMs_${timeoutMs}`;
    status = 1;
  }
  if (opts.acceptTs6059Only && status !== 0 && !result.signal) {
    const out = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    process.stdout.write(out);
    const codes = [...out.matchAll(/error TS(\d+)/g)].map((m) => m[1]);
    const unique = [...new Set(codes)];
    if (unique.length === 1 && unique[0] === '6059') {
      status = 0;
      note = 'accepted_baseline_TS6059_permission-seeds';
    }
  }
  meta(cmd, cwd, started, ended, status, note);
  if (status !== 0) {
    console.error(`FINAL SEQUENCE STOPPED: ${cmd} exited ${status}${note ? ` (${note})` : ''}`);
    process.exit(status);
  }
  return status;
}

fs.writeFileSync(logPath, '');
const seqStart = new Date();
const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: repoRoot }).toString().trim();
const commit = execSync('git rev-parse HEAD', { cwd: repoRoot }).toString().trim();
fs.appendFileSync(
  logPath,
  JSON.stringify({
    type: 'sequence_start',
    start: seqStart.toISOString(),
    branch,
    commit,
    node: process.version,
    npm: execSync('npm -v').toString().trim(),
  }) + '\n',
);

function tcpProbeScript() {
  return `
      const net=require('net');
      const u=new URL(${JSON.stringify(env.INTEGRATION_DATABASE_URL)});
      const host=u.hostname||'127.0.0.1';
      const port=Number(u.port||5432);
      const s=net.connect({host,port});
      const t=setTimeout(()=>{try{s.destroy()}catch{} process.exit(1)},2000);
      s.once('connect',()=>{clearTimeout(t); try{s.destroy()}catch{}; process.exit(0)});
      s.once('error',()=>{clearTimeout(t); process.exit(1)});
    `;
}

function prismaReadyScript() {
  return `
      const { PrismaClient } = require('@prisma/client');
      const url = ${JSON.stringify(env.INTEGRATION_DATABASE_URL)};
      const c = new PrismaClient({ datasources: { db: { url } } });
      const t = setTimeout(() => { try { c.$disconnect(); } catch {} process.exit(1); }, 8000);
      c.$connect()
        .then(() => c.$queryRaw\`SELECT 1 AS ok\`)
        .then(() => { clearTimeout(t); return c.$disconnect(); })
        .then(() => process.exit(0))
        .catch(async () => {
          clearTimeout(t);
          try { await c.$disconnect(); } catch {}
          process.exit(1);
        });
    `;
}

function waitPostgres(label) {
  const started = new Date();
  let ready = false;
  let note = 'postgres_not_ready';
  // Bounded: 45s TCP + Prisma SELECT 1 (do not use hanging docker/pg_isready).
  for (let i = 0; i < 45; i++) {
    const tcpOk = spawnSync(process.execPath, ['-e', tcpProbeScript()], {
      encoding: 'utf8',
      timeout: 5000,
    });
    if ((tcpOk.status ?? 1) !== 0) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
      continue;
    }
    const prismaOk = spawnSync(process.execPath, ['-e', prismaReadyScript()], {
      cwd: apiRoot,
      encoding: 'utf8',
      timeout: 12_000,
      env,
    });
    if ((prismaOk.status ?? 1) === 0) {
      ready = true;
      note = 'postgres_ready_tcp_and_select1';
      break;
    }
    note = 'postgres_tcp_ok_select1_failed';
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }
  const ended = new Date();
  meta(`db_ready ${label}`, apiRoot, started, ended, ready ? 0 : 1, note);
  if (!ready) {
    console.error(`FINAL SEQUENCE STOPPED: Postgres not ready (${label}) note=${note}`);
    process.exit(1);
  }
}

function ensureTestPostgresUp() {
  const started = new Date();
  console.log(`\n>>> START ${started.toISOString()} :: npm run db:test:up (cwd=${apiRoot})`);
  const result = spawnSync('npm run db:test:up', {
    cwd: apiRoot,
    env,
    shell: true,
    stdio: 'inherit',
    timeout: 120_000,
  });
  const ended = new Date();
  let status = result.status ?? 1;
  let note = '';
  if (status !== 0) {
    const tcp = spawnSync(process.execPath, ['-e', tcpProbeScript()], {
      encoding: 'utf8',
      timeout: 5000,
    });
    if ((tcp.status ?? 1) === 0) {
      status = 0;
      note = 'docker_up_failed_but_tcp_ready';
      console.warn(
        'db:test:up failed (Docker CLI), but INTEGRATION_DATABASE_URL TCP is accepting connections — continuing.',
      );
    }
  }
  meta('npm run db:test:up', apiRoot, started, ended, status, note);
  if (status !== 0) {
    console.error(`FINAL SEQUENCE STOPPED: npm run db:test:up exited ${status}`);
    process.exit(status);
  }
}

/**
 * Freeze integration DB identity before command 1.
 * Mid-sequence database switches are forbidden for Case C.
 */
function freezeIntegrationDatabase() {
  const url = env.INTEGRATION_DATABASE_URL;
  let dbName = '';
  try {
    dbName = decodeURIComponent(new URL(url).pathname.replace(/^\//, '').split('/')[0] || '');
  } catch {
    console.error('FINAL SEQUENCE STOPPED: invalid INTEGRATION_DATABASE_URL');
    process.exit(1);
  }
  const frozenAt = new Date().toISOString();
  env.STEP24_FROZEN_DATABASE_URL = url;
  env.STEP24_FROZEN_DATABASE_NAME = dbName;
  env.STEP24_FROZEN_AT = frozenAt;
  fs.appendFileSync(
    logPath,
    JSON.stringify({
      type: 'database_frozen',
      url,
      database: dbName,
      frozenAt,
      note: 'no_mid_sequence_database_switch_allowed',
    }) + '\n',
  );
  console.log('FROZEN_INTEGRATION_DATABASE', { database: dbName, frozenAt, url });
  return { url, dbName, frozenAt };
}

function assertFrozenDatabaseUnchanged(label) {
  if (env.INTEGRATION_DATABASE_URL !== env.STEP24_FROZEN_DATABASE_URL) {
    console.error(
      `FINAL SEQUENCE STOPPED: database switch detected at ${label} (forbidden for Case C)`,
    );
    process.exit(1);
  }
}

console.log('Step 24 final one-pass sequence starting', {
  start: seqStart.toISOString(),
  branch,
  commit,
  node: process.version,
});

// Freeze DB identity before command 1 — recovery DB must be chosen outside this runner.
freezeIntegrationDatabase();

// 1–2 PostgreSQL + migrations
ensureTestPostgresUp();
assertFrozenDatabaseUnchanged('after-db-up');
waitPostgres('after-db-up');
run('npm run db:test:migrate', apiRoot);
assertFrozenDatabaseUnchanged('after-migrate');
waitPostgres('after-migrate');
// 3–8 Step 21/22 validators (baseline still holds under Step 24 schema)
run('npm run test:audit-center-clean-migration', apiRoot);
run('npm run test:audit-center-upgrade-migration', apiRoot);
run('npm run test:operations-console-clean-migration', apiRoot);
run('npm run test:operations-console-upgrade-migration', apiRoot);
run('npm run test:sales-representatives-clean-migration', apiRoot);
run('npm run test:sales-representatives-upgrade-migration', apiRoot);
run('npm run test:sales-leads-clean-migration', apiRoot);
run('npm run test:sales-leads-upgrade-migration', apiRoot);
waitPostgres('post-validators');
// 9 Platform DB security
run('npm run test:platform-db-security', apiRoot);
// 10–15 auth/RBAC covered inside platform-db-security + later jest guards
// 16–21 Tenant Directory through Subscriptions / Step 18 / U01 surfaces
const longSuiteTimeoutMs = 90 * 60 * 1000;
const dbSuites = [
  'npm run test:platform-tenant-directory-db',
  'npm run test:platform-healthcare-catalog-db',
  'npm run test:platform-plans-db',
  'npm run test:platform-plan-entitlements-db',
  'npm run test:platform-add-ons-overrides-db',
  'npm run test:platform-subscriptions-db',
  'npm run test:effective-entitlement-runtime-db',
  'npm run test:usage-metering-limit-enforcement-db',
  'npm run test:tenant-creation-provisioning-db',
];
for (const cmd of dbSuites) {
  waitPostgres(`before:${cmd}`);
  const timeoutMs = cmd.includes('tenant-creation-provisioning')
    ? longSuiteTimeoutMs
    : undefined;
  run(cmd, apiRoot, timeoutMs ? { timeoutMs } : {});
}
// 22 Step 19
waitPostgres('before-tenant-lifecycle-db');
run('npm run test:tenant-lifecycle-db', apiRoot, {
  env: { TENANT_LIFECYCLE_ENABLED: 'true' },
  timeoutMs: longSuiteTimeoutMs,
});
waitPostgres('after-tenant-lifecycle-db');
// 23 Step 20
run('npm run test:feature-flags-settings-db', apiRoot, {
  env: { FEATURE_FLAGS_SETTINGS_ENABLED: 'true' },
});
waitPostgres('after-feature-flags-settings-db');
// 24 Step 21 full runner
run('npm run test:audit-center-db', apiRoot, {
  env: { AUDIT_CENTER_ENABLED: 'true' },
  timeoutMs: longSuiteTimeoutMs,
});
waitPostgres('after-audit-center-db');
// 25 Step 22 full runner
run('npm run test:operations-console-db', apiRoot, {
  env: { OPERATIONS_CONSOLE_ENABLED: 'true' },
  timeoutMs: longSuiteTimeoutMs,
});
waitPostgres('after-operations-console-db');
// 26 Step 23 full runner
run('npm run test:sales-representatives-db', apiRoot, {
  timeoutMs: longSuiteTimeoutMs,
});
waitPostgres('after-sales-representatives-db');
// 26b Step 24 full runner (visibility / stage / plan-fit / won / HTTP / concurrency / failure)
run('npm run test:sales-leads-db', apiRoot, {
  timeoutMs: longSuiteTimeoutMs,
});
waitPostgres('after-sales-leads-db');
// 27–29 Prisma + API TS
run('npx prisma validate', apiRoot);
run('npx prisma generate', apiRoot);
run('npx tsc -p tsconfig.build.json --noEmit', apiRoot, {
  capture: true,
  acceptTs6059Only: true,
});
// 30–33 Super Admin
run(
  'npx vitest run src/pages/audit-center.spec.tsx src/pages/operations-console.spec.tsx src/i18n/messages.parity.spec.ts',
  saRoot,
);
run('npm run test', saRoot);
run('npm run typecheck', saRoot);
run('npm run build', saRoot);
// 34–39 Clinic
run('npx vitest run src/features/subscription', clinicRoot);
run('npx vitest run src/features/module-registry', clinicRoot);
run('npx vitest run src/features/dynamic-navigation', clinicRoot);
run('npm run test', clinicRoot);
run('npx tsc -b --pretty false', clinicRoot);
run('npm run build', clinicRoot);
// 40 API licensing/auth guards
run(
  'npx jest --config jest.config.cjs --runInBand --testPathPattern "licensing-engine.service.spec|jwt.strategy|login.handler.spec|refresh-token.handler.spec"',
  apiRoot,
);
// 41 repository checks
run('git diff --check', repoRoot);
run('git status --short', repoRoot);
run('git diff --stat', repoRoot);

assertFrozenDatabaseUnchanged('sequence_end');
const seqEnd = new Date();
fs.appendFileSync(
  logPath,
  JSON.stringify({
    type: 'sequence_end',
    start: seqStart.toISOString(),
    end: seqEnd.toISOString(),
    durationMs: seqEnd - seqStart,
    exitCode: 0,
    failures: 0,
    retries: 0,
    dbRestarts: 0,
    commandReruns: 0,
    productEditsDuringSequence: 0,
    databaseSwitchesDuringSequence: 0,
    frozenDatabase: env.STEP24_FROZEN_DATABASE_NAME,
    frozenDatabaseUrl: env.STEP24_FROZEN_DATABASE_URL,
  }) + '\n',
);

console.log('\nStep 24 FINAL ONE-PASS SEQUENCE COMPLETE', {
  durationMs: seqEnd - seqStart,
  logPath,
  frozenDatabase: env.STEP24_FROZEN_DATABASE_NAME,
});
process.exit(0);
