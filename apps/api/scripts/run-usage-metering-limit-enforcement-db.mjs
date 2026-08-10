#!/usr/bin/env node
/**
 * Runs Supplemental Capability U01 Usage Metering & Limit Enforcement PostgreSQL integration suites.
 * Enables USAGE_METERING_* flags for the suite (defaults are OFF).
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
process.env.ALLOW_DESTRUCTIVE_PLATFORM_DB_TESTS = '1';
process.env.ALLOW_DESTRUCTIVE_DB_TESTS = '1';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.USAGE_METERING_ENABLED = process.env.USAGE_METERING_ENABLED || 'true';
process.env.USAGE_METERING_ENFORCEMENT_ENABLED = process.env.USAGE_METERING_ENFORCEMENT_ENABLED || 'true';
process.env.USAGE_METERING_INGESTION_ENABLED = process.env.USAGE_METERING_INGESTION_ENABLED || 'true';
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
    'usage-metering/.*\\.spec\\.ts$',
  ],
  { cwd: apiRoot, env: process.env, stdio: 'inherit' },
);

process.exit(result.status ?? 1);
