#!/usr/bin/env node
/**
 * Phase 48 Wave B — PRODUCTION-CAPABLE snapshot backfill.
 *
 * Does NOT reset the database.
 * Requires explicit confirmation flag:
 *   --confirm-production-backfill
 *
 * Optional:
 *   --dry-run   (report candidates only; no writes)
 *
 * Authoritative business logic: ./lib/phase48-wave-b-snapshot-backfill.cjs
 */
import { PrismaClient } from '@prisma/client';
import {
  runPhase48WaveBSnapshotBackfill,
  printSafeDatabaseIdentity,
  countEligibleRemaining,
  loadCutoverWatermark,
  countClassifiedRemaining,
  DEFAULT_BATCH_SIZE,
} from './lib/phase48-wave-b-snapshot-backfill.mjs';

const args = new Set(process.argv.slice(2));
const confirmed = args.has('--confirm-production-backfill');
const dryRun = args.has('--dry-run');

if (!confirmed && !dryRun) {
  console.error(
    'Refusing production backfill without --confirm-production-backfill (or use --dry-run).',
  );
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });

async function main() {
  await prisma.$connect();

  const identity = printSafeDatabaseIdentity(url);
  console.error(
    JSON.stringify({
      target: identity,
      batchSizeDefault: DEFAULT_BATCH_SIZE,
      note: 'password omitted',
    }),
  );

  if (dryRun) {
    let cutoverAt = null;
    try {
      cutoverAt = await loadCutoverWatermark(prisma);
    } catch {
      cutoverAt = null;
    }
    const classified = await countClassifiedRemaining(prisma, undefined);
    const legacyCandidates = await countEligibleRemaining(prisma);
    console.log(
      JSON.stringify({
        ok: true,
        dryRun: true,
        cutoverAt: cutoverAt ? cutoverAt.toISOString() : null,
        note: 'cutoverAt is operational metadata; classification uses snapshotWriteMode',
        legacyCandidates,
        ...classified,
      }),
    );
    console.log('PHASE48_WAVE_B_BACKFILL_DRY_RUN');
    return;
  }

  const report = await runPhase48WaveBSnapshotBackfill(prisma, {
    onProgress: (n, meta) =>
      console.error(`progress=${n} batches=${meta?.batches ?? '?'} batchSize=${meta?.batchSize ?? '?'}`),
  });

  console.log(JSON.stringify(report));

  if (
    (report.legacyEligibleRemaining ?? report.remainingEligible) > 0 ||
    (report.canonicalIntegrityFailures ?? 0) > 0 ||
    !report.ok
  ) {
    console.error(
      `PHASE48_WAVE_B_PRODUCTION_BACKFILL_FAILED legacyEligibleRemaining=${report.legacyEligibleRemaining ?? report.remainingEligible} canonicalIntegrityFailures=${report.canonicalIntegrityFailures ?? 0}`,
    );
    process.exitCode = 1;
    return;
  }

  console.log('PHASE48_WAVE_B_PRODUCTION_BACKFILL_PASSED');
}

main()
  .catch((err) => {
    console.error(err);
    if (err?.report) console.error(JSON.stringify(err.report));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
    process.exit(process.exitCode ?? 0);
  });
