#!/usr/bin/env node
/** Flexible Step 21 — Audit Center PostgreSQL suites. */
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
process.env.AUDIT_CENTER_ENABLED = process.env.AUDIT_CENTER_ENABLED || 'true';
process.env.INTEGRATION_DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ||
  'postgresql://booking:booking_test@localhost:5433/booking_test?schema=public';

console.log(
  'Step 21 runner: A01-A18 real-domain + A01-D/A02-D + A03-A15 durability + A08-D11.1-D11.10 + CORR01-CORR15 + coverage, I/Q/E/C/F, exhaustive H-matrix, P01-P16 query plans',
);
console.log(
  'Named cases: A01 A02 A03 A04 A05 A06 A07 A08 A09 A10 A11 A12 A13 A14 A15 A16 A17 A18',
);
console.log(
  'Durability: A01-D01..D12 A02-D01..D12 A03-A15 Model A; A08-D11.1..D11.10; Correlation: CORR01..CORR15',
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
    'platform-audit-center/.*\\.spec\\.ts$',
  ],
  { cwd: apiRoot, env: process.env, stdio: 'inherit' },
);

process.exit(result.status ?? 1);
