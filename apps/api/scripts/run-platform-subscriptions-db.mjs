#!/usr/bin/env node
/**
 * Runs Step 16 Platform Subscription Commercial PostgreSQL integration suites.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

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

async function ensurePublishedPlanFixture() {
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.INTEGRATION_DATABASE_URL } },
  });
  try {
    const published = await prisma.platformPlanVersion.count({
      where: { lifecycle: 'PUBLISHED', publicationFingerprint: { not: null } },
    });
    if (published > 0) {
      console.log(`Step 16 preflight: ${published} published Plan Version(s) present.`);
      return;
    }
    console.log('Step 16 preflight: reseeding Plans with commercial definitions...');
    const seedScript = path.join(apiRoot, 'scripts/seed-platform-plans-commercial.mjs');
    if (fs.existsSync(seedScript)) {
      const seed = spawnSync(process.execPath, [seedScript], {
        cwd: apiRoot,
        env: process.env,
        stdio: 'inherit',
      });
      if (seed.status !== 0) {
        throw new Error('Failed to seed commercial plan fixtures for Step 16.');
      }
    } else {
      throw new Error('Missing scripts/seed-platform-plans-commercial.mjs');
    }
  } finally {
    await prisma.$disconnect();
  }
}

const jestCandidates = [
  path.join(apiRoot, 'node_modules/jest/bin/jest.js'),
  path.join(repoRoot, 'node_modules/jest/bin/jest.js'),
];
const jestBin = jestCandidates.find((p) => fs.existsSync(p));
if (!jestBin) {
  console.error('Unable to locate jest.js under apps/api or repo root node_modules.');
  process.exit(1);
}

await ensurePublishedPlanFixture();

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
    'platform-subscriptions/.*\\.spec\\.ts$',
  ],
  { cwd: apiRoot, env: process.env, stdio: 'inherit' },
);

process.exit(result.status ?? 1);
