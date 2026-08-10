#!/usr/bin/env node
/**
 * Runs Step 10 platform dashboard PostgreSQL reconciliation suites.
 * Requires postgres-test (docker-compose.test.yml) and applied migrations.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(apiRoot, '../..');

process.env.RUN_PLATFORM_DB_SECURITY = 'true';
process.env.ALLOW_TEST_DATABASE_RESET = 'true';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.INTEGRATION_DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ||
  'postgresql://booking:booking_test@localhost:5433/booking_test?schema=public';

const jestCandidates = [
  path.join(apiRoot, 'node_modules/jest/bin/jest.js'),
  path.join(repoRoot, 'node_modules/jest/bin/jest.js'),
];
const jestBin = jestCandidates.find((p) => fs.existsSync(p));
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
    '--rootDir',
    apiRoot,
    '--testPathPattern',
    'platform-dashboard.*postgres\\.integration\\.spec\\.ts$',
  ],
  { cwd: apiRoot, env: process.env, stdio: 'inherit' },
);

process.exit(result.status ?? 1);
