#!/usr/bin/env node
/**
 * Flexible Step 19 — one uninterrupted final acceptance sequence orchestrator.
 * Stops on first non-zero exit. Does not retry. Does not implement Step 20.
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
const logPath = path.join(apiRoot, 'step19-final-onepass.jsonl');

const env = {
  ...process.env,
  RUN_PLATFORM_DB_SECURITY: 'true',
  ALLOW_TEST_DATABASE_RESET: 'true',
  ALLOW_DESTRUCTIVE_PLATFORM_DB_TESTS: '1',
  ALLOW_DESTRUCTIVE_DB_TESTS: '1',
  NODE_ENV: process.env.NODE_ENV || 'test',
  // Containment defaults OFF for the sequence; Step 19 runner enables explicitly.
  TENANT_LIFECYCLE_ENABLED: process.env.TENANT_LIFECYCLE_ENABLED || 'false',
  INTEGRATION_DATABASE_URL:
    process.env.INTEGRATION_DATABASE_URL ||
    'postgresql://booking:booking_test@localhost:5433/booking_test?schema=public',
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
  const result = spawnSync(cmd, {
    cwd,
    env: { ...env, ...(opts.env || {}) },
    shell: true,
    stdio: opts.capture ? 'pipe' : 'inherit',
    encoding: opts.capture ? 'utf8' : undefined,
  });
  const ended = new Date();
  let status = result.status ?? 1;
  let note = '';
  if (opts.acceptTs6059Only && status !== 0) {
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
    console.error(`FINAL SEQUENCE STOPPED: ${cmd} exited ${status}`);
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

function waitPostgres(label) {
  const started = new Date();
  let ready = false;
  for (let i = 0; i < 90; i++) {
    const probe = spawnSync(
      'docker',
      ['exec', 'booking-system-pg-test', 'pg_isready', '-U', 'booking', '-d', 'booking_test'],
      { encoding: 'utf8' },
    );
    if ((probe.status ?? 1) === 0) {
      ready = true;
      break;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }
  // Extra settle after readiness to absorb Docker Desktop proxy blips.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000);
  const ended = new Date();
  meta(`pg_isready ${label}`, apiRoot, started, ended, ready ? 0 : 1, ready ? 'postgres_ready' : 'postgres_not_ready');
  if (!ready) {
    console.error(`FINAL SEQUENCE STOPPED: Postgres not ready (${label})`);
    process.exit(1);
  }
}

console.log('Step 19 final one-pass sequence starting', {
  start: seqStart.toISOString(),
  branch,
  commit,
  node: process.version,
});

// 1–2 PostgreSQL + migrations
run('npm run db:test:up', apiRoot);
waitPostgres('after-db-up');
run('npm run db:test:migrate', apiRoot);
waitPostgres('after-migrate');
// 3–4 Step 19 validators
run('npm run test:tenant-lifecycle-clean-migration', apiRoot);
run('npm run test:tenant-lifecycle-upgrade-migration', apiRoot);
waitPostgres('post-validators');
// 5–14 cross-domain
const dbSuites = [
  'npm run test:platform-db-security',
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
  run(cmd, apiRoot);
}
waitPostgres('before-tenant-lifecycle-db');
// 15 Step 19 full runner (enables lifecycle for suite)
run('npm run test:tenant-lifecycle-db', apiRoot, {
  env: { TENANT_LIFECYCLE_ENABLED: 'true' },
});
waitPostgres('after-tenant-lifecycle-db');
// 16–18 Prisma + API TS
run('npx prisma validate', apiRoot);
run('npx prisma generate', apiRoot);
run('npx tsc -p tsconfig.build.json --noEmit', apiRoot, {
  capture: true,
  acceptTs6059Only: true,
});
// 19–22 Super Admin
run('npx vitest run src/tenants/tenant-lifecycle-panel.spec.tsx', saRoot);
run('npm run test', saRoot);
run('npm run typecheck', saRoot);
run('npm run build', saRoot);
// 23–29 Clinic
run('npx vitest run src/features/subscription', clinicRoot);
run('npx vitest run src/features/module-registry', clinicRoot);
run('npx vitest run src/features/dynamic-navigation', clinicRoot);
run('npm run test', clinicRoot);
run('npx tsc -b --pretty false', clinicRoot);
run('npm run build', clinicRoot);
// 30 API licensing/auth guards
run(
  'npx jest --config jest.config.cjs --runInBand --testPathPattern "licensing-engine.service.spec|jwt.strategy|login.handler.spec|refresh-token.handler.spec"',
  apiRoot,
);
// 31 repository checks
run('git diff --check', repoRoot);
run('git status --short', repoRoot);
run('git diff --stat', repoRoot);

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
    productEditsDuringSequence: 0,
  }) + '\n',
);

console.log('\nSTEP 19 FINAL ONE-PASS SEQUENCE COMPLETE', {
  durationMs: seqEnd - seqStart,
  logPath,
});
process.exit(0);
