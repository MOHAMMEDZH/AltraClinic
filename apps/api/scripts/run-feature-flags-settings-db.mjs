#!/usr/bin/env node
/**
 * Flexible Step 20 — Feature Flags and Global Settings PostgreSQL suites.
 * Reports F15–F20 independently by name; no silent skips.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(apiRoot, '../..');

process.env.RUN_PLATFORM_DB_SECURITY = 'true';
process.env.ALLOW_TEST_DATABASE_RESET = 'true';
process.env.ALLOW_DESTRUCTIVE_PLATFORM_DB_TESTS = '1';
process.env.ALLOW_DESTRUCTIVE_DB_TESTS = '1';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.INTEGRATION_DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ||
  'postgresql://booking:booking_test@localhost:5433/booking_test?schema=public';
process.env.FEATURE_FLAGS_SETTINGS_ENABLED =
  process.env.FEATURE_FLAGS_SETTINGS_ENABLED || 'true';

const jestCandidates = [
  path.join(apiRoot, 'node_modules/jest/bin/jest.js'),
  path.join(repoRoot, 'node_modules/jest/bin/jest.js'),
];
const jestBin = jestCandidates.find((p) => fs.existsSync(p));
if (!jestBin) {
  console.error('Unable to locate jest.js');
  process.exit(1);
}

const jsonOut = path.join(os.tmpdir(), `step20-ff-jest-${process.pid}.json`);

const result = spawnSync(
  process.execPath,
  [
    jestBin,
    '--config',
    path.join(apiRoot, 'jest.integration.config.cjs'),
    '--runInBand',
    '--rootDir',
    apiRoot,
    '--testPathPattern',
    'feature-flags-settings/.*\\.spec\\.ts$',
    '--json',
    `--outputFile=${jsonOut}`,
  ],
  { cwd: apiRoot, env: process.env, stdio: 'inherit' },
);

const exitCode = result.status ?? 1;

/** @type {Array<{ id: string, name: string, status: string }>} */
const f15f20 = [];
/** @type {Array<{ id: string, name: string, status: string }>} */
const p01p12 = [];
let suites = 0;
let tests = 0;
let failures = 0;
let skips = 0;

try {
  if (fs.existsSync(jsonOut)) {
    const report = JSON.parse(fs.readFileSync(jsonOut, 'utf8'));
    suites = report.numTotalTestSuites ?? 0;
    tests = report.numTotalTests ?? 0;
    failures = report.numFailedTests ?? 0;
    skips = report.numPendingTests ?? 0;
    const requiredF = [
      { id: 'F15', match: /^F15\b/ },
      { id: 'F16', match: /^F16\b/ },
      { id: 'F17', match: /^F17\b/ },
      { id: 'F18', match: /^F18\b/ },
      { id: 'F19', match: /^F19\b/ },
      { id: 'F20', match: /^F20\b/ },
    ];
    const requiredP = [
      { id: 'P01', match: /^P01\b/ },
      { id: 'P02', match: /^P02\b/ },
      { id: 'P03', match: /^P03\b/ },
      { id: 'P04', match: /^P04\b/ },
      { id: 'P05', match: /^P05\b/ },
      { id: 'P06', match: /^P06\b/ },
      { id: 'P07', match: /^P07\b/ },
      { id: 'P08', match: /^P08\b/ },
      { id: 'P09', match: /^P09\b/ },
      { id: 'P10', match: /^P10\b/ },
      { id: 'P11', match: /^P11\b/ },
      { id: 'P12', match: /^P12\b/ },
    ];
    const assertions = [];
    for (const suite of report.testResults ?? []) {
      for (const a of suite.assertionResults ?? []) {
        assertions.push(a);
      }
    }
    /** @type {Array<{ id: string, name: string, status: string }>} */
    const named = [];
    for (const req of [...requiredF, ...requiredP]) {
      const hit = assertions.find((a) => req.match.test(a.title ?? a.fullName ?? ''));
      if (!hit) {
        named.push({ id: req.id, name: '(missing)', status: 'MISSING' });
        continue;
      }
      const status = String(hit.status || 'unknown').toUpperCase();
      named.push({
        id: req.id,
        name: hit.title ?? hit.fullName,
        status: status === 'PASSED' ? 'PASSED' : status,
      });
    }
    for (const row of named) {
      if (row.id.startsWith('F')) f15f20.push(row);
      else p01p12.push(row);
    }
  }
} catch (err) {
  console.error('Failed to parse Step 20 jest JSON report:', err?.message ?? err);
} finally {
  try {
    if (fs.existsSync(jsonOut)) fs.unlinkSync(jsonOut);
  } catch {
    /* ignore */
  }
}

console.log('\n=== Step 20 DB runner summary ===');
console.log(`suites=${suites} tests=${tests} failures=${failures} skips=${skips} retries=0 exitCode=${exitCode}`);
console.log('--- F15–F20 ---');
for (const row of f15f20) {
  console.log(`${row.id}: ${row.status} — ${row.name}`);
}
console.log('--- P01–P12 ---');
for (const row of p01p12) {
  console.log(`${row.id}: ${row.status} — ${row.name}`);
}

const missingOrFailed = [...f15f20, ...p01p12].filter((r) => r.status !== 'PASSED');
if (missingOrFailed.length > 0) {
  console.error(
    'Step 20 named-gate failed:',
    missingOrFailed.map((r) => `${r.id}=${r.status}`).join(', '),
  );
  process.exit(exitCode !== 0 ? exitCode : 1);
}

process.exit(exitCode);
