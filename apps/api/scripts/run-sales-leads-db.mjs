#!/usr/bin/env node
/** Flexible Step 24 — Leads and Sales Pipeline PostgreSQL suites. */
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
  'Step 24 runner: visibility + stage/ownership + plan-fit safety + won safety + HTTP (H01–H18 + H19–H50) + concurrency (C01–C10 + C11–C24) + failure injection (F01–F12 + F13–F30) + privacy P01–P12 + query/index',
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
    'platform-sales-leads/.*\\.spec\\.ts$',
  ],
  { cwd: apiRoot, env: process.env, stdio: 'inherit' },
);

process.exit(result.status ?? 1);
