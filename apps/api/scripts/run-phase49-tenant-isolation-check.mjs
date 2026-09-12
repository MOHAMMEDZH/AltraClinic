#!/usr/bin/env node
/**
 * Phase 49 K6 — tenant isolation production-check packaging.
 * Reuses existing runners/specs only. No second isolation framework.
 *
 * Steps:
 *   1) Probe test Postgres (fail closed if unreachable)
 *   2) npm-equivalent: scripts/run-platform-db-security.mjs
 *   3) tenant-isolation.postgres.integration.spec.ts (clinic RLS / booking_app)
 *   4) clinical-catalog.cross-tenant.api.postgres (thin Wave pack pattern reuse)
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(apiRoot, '../..');

const ADMIN_URL =
  process.env.INTEGRATION_ADMIN_DATABASE_URL ||
  'postgresql://booking:booking_test@localhost:5433/booking_test';
const APP_URL =
  process.env.PHASE49_K6_APP_DATABASE_URL ||
  'postgresql://booking_app:booking_app@localhost:5433/booking_test';
const PLATFORM_URL =
  process.env.INTEGRATION_DATABASE_URL ||
  'postgresql://booking:booking_test@localhost:5433/booking_test?schema=public';

function parseHostPort(url) {
  try {
    const u = new URL(url);
    return { host: u.hostname || 'localhost', port: Number(u.port || 5432) };
  } catch {
    return { host: 'localhost', port: 5433 };
  }
}

function probePostgres(label, url) {
  const { host, port } = parseHostPort(url);
  return new Promise((resolve) => {
    const socket = net.connect({ host, port }, () => {
      socket.end();
      resolve({ ok: true, label, host, port });
    });
    socket.setTimeout(3000);
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ ok: false, label, host, port, error: 'timeout' });
    });
    socket.on('error', (err) => {
      resolve({ ok: false, label, host, port, error: err.message });
    });
  });
}

function findJest() {
  const candidates = [
    path.join(apiRoot, 'node_modules/jest/bin/jest.js'),
    path.join(repoRoot, 'node_modules/jest/bin/jest.js'),
  ];
  return candidates.find((p) => fs.existsSync(p));
}

function runNode(scriptRel, env, label) {
  console.log(`\n=== Phase 49 K6: ${label} ===`);
  const result = spawnSync(process.execPath, [path.join(apiRoot, scriptRel)], {
    cwd: apiRoot,
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });
  if ((result.status ?? 1) !== 0) {
    console.error(`FAIL: ${label} exited ${result.status ?? 1}`);
    process.exit(result.status ?? 1);
  }
}

function runJest(testPathPattern, env, label) {
  console.log(`\n=== Phase 49 K6: ${label} ===`);
  const jestBin = findJest();
  if (!jestBin) {
    console.error('Unable to locate jest.js under apps/api or repo root node_modules.');
    process.exit(1);
  }
  const result = spawnSync(
    process.execPath,
    [
      jestBin,
      '--config',
      path.join(apiRoot, 'jest.integration.config.cjs'),
      '--runInBand',
      '--forceExit',
      '--rootDir',
      apiRoot,
      '--testPathPattern',
      testPathPattern,
    ],
    {
      cwd: apiRoot,
      env: { ...process.env, ...env },
      stdio: 'inherit',
    },
  );
  if ((result.status ?? 1) !== 0) {
    console.error(`FAIL: ${label} exited ${result.status ?? 1}`);
    process.exit(result.status ?? 1);
  }
}

const probe = await probePostgres('test-postgres', PLATFORM_URL);
if (!probe.ok) {
  console.error(
    `STOP: test Postgres unreachable for Phase 49 K6 (${probe.host}:${probe.port}) — ${probe.error}. Do not fake PASS.`,
  );
  process.exit(2);
}
console.log(`OK: Postgres reachable at ${probe.host}:${probe.port}`);

const baseEnv = {
  NODE_ENV: process.env.NODE_ENV || 'test',
  RUN_PLATFORM_DB_SECURITY: 'true',
  ALLOW_TEST_DATABASE_RESET: 'true',
  DATABASE_URL: process.env.DATABASE_URL || PLATFORM_URL,
  INTEGRATION_DATABASE_URL: PLATFORM_URL,
};

runNode('scripts/run-platform-db-security.mjs', baseEnv, 'platform-db-security (primary)');

runJest(
  'tenant-isolation\\.postgres\\.integration\\.spec',
  {
    ...baseEnv,
    RUN_INTEGRATION: 'true',
    INTEGRATION_ADMIN_DATABASE_URL: ADMIN_URL,
    INTEGRATION_DATABASE_URL: APP_URL,
  },
  'tenant-isolation.postgres.integration (clinic RLS)',
);

runJest(
  'clinical-catalog\\.cross-tenant\\.api\\.postgres',
  baseEnv,
  'clinical-catalog.cross-tenant.api.postgres (thin reuse)',
);

console.log('\nPhase 49 K6 tenant-isolation-check: ALL STEPS PASS');
process.exit(0);
