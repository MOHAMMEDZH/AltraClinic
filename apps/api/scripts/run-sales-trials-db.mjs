#!/usr/bin/env node
/** Flexible Step 25 — Trial Creation and Customer Conversion PostgreSQL suites. */
import { spawnSync } from 'child_process';
import fs from 'fs';
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

console.log(
  'Step 25 runner: create/visibility/plan-version + extension E01–E13 + expiry X01–X12 + conversion PV01–PV10 + preview SoR delta 0 + U25-01–U25-08 + A/I/C/F/H/P matrices + query/index',
);

const jestCandidates = [
  path.join(apiRoot, 'node_modules/jest/bin/jest.js'),
  path.join(repoRoot, 'node_modules/jest/bin/jest.js'),
];
const jestBin = jestCandidates.find((p) => fs.existsSync(p));
if (!jestBin) {
  console.error('Unable to locate jest.js');
  process.exit(1);
}

const extraArgs = process.argv.slice(2);
// A caller-supplied --testPathPattern narrows the run instead of being OR-ed with the default.
const patternArgs = extraArgs.some((a) => a.startsWith('--testPathPattern'))
  ? []
  : ['--testPathPattern', 'platform-sales-trials/.*\\.spec\\.ts$'];
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
    ...patternArgs,
    ...extraArgs,
  ],
  { cwd: apiRoot, env: process.env, stdio: 'inherit' },
);

process.exit(result.status ?? 1);
