#!/usr/bin/env node
/** Flexible Step 26 — Sales Productivity and Commission Snapshot PostgreSQL suites. */
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
  'Step 26 runner: M01–M20 + T01–T12 + PA01–PA08 + V01–V16 + REC01–REC12 + CS01–CS16 + EX01–EX12 + A/I/C/F/H/P matrices + query/index + period.util',
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
const patternArgs = extraArgs.some((a) => a.startsWith('--testPathPattern'))
  ? []
  : ['--testPathPattern', 'platform-sales-productivity/.*\\.spec\\.ts$'];
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
