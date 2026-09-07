#!/usr/bin/env node
/**
 * Phase 48 Wave B — TEST-ONLY snapshot backfill runner.
 * Safety: refuses unless ALLOW_TEST_DATABASE_RESET=true and DATABASE_URL is local/test.
 * Production backfill: use backfill-phase48-wave-b-snapshots-production.mjs
 */
import { PrismaClient } from '@prisma/client';
import {
  assertSafeTestDatabaseUrl,
  runPhase48WaveBSnapshotBackfill,
} from './lib/phase48-wave-b-snapshot-backfill.mjs';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}
assertSafeTestDatabaseUrl(url);

const prisma = new PrismaClient({ datasources: { db: { url } } });

async function main() {
  await prisma.$connect();
  const report = await runPhase48WaveBSnapshotBackfill(prisma);
  console.log(JSON.stringify(report));
  console.log('PHASE48_WAVE_B_BACKFILL_PASSED');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
    process.exit(process.exitCode ?? 0);
  });
