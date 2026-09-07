/**
 * Thin TypeScript re-export — NO business logic.
 * Authoritative implementation: apps/api/scripts/lib/phase48-wave-b-snapshot-backfill.cjs
 * (same module imported by production CLI).
 */
import { createRequire } from 'module';
import * as fs from 'fs';
import * as path from 'path';
import type { PrismaClient } from '@prisma/client';

const nodeRequire = createRequire(__filename);

function loadAuthoritativeBackfill() {
  const candidates = [
    path.resolve(process.cwd(), 'scripts/lib/phase48-wave-b-snapshot-backfill.cjs'),
    path.resolve(__dirname, '../../../../../scripts/lib/phase48-wave-b-snapshot-backfill.cjs'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return nodeRequire(candidate);
    }
  }
  throw new Error(
    `Authoritative Wave B backfill module not found. Tried:\n${candidates.join('\n')}`,
  );
}

const impl = loadAuthoritativeBackfill();

export const LEGACY_APPOINTMENT_SERVICE_TYPE: string = impl.LEGACY_APPOINTMENT_SERVICE_TYPE;
export const DEFAULT_BATCH_SIZE: number = impl.DEFAULT_BATCH_SIZE;
export const CUTOVER_MARKER_KEY: string = impl.CUTOVER_MARKER_KEY;
export const PSEUDO_CUTOVER_FORBIDDEN: Date = new Date(impl.PSEUDO_CUTOVER_FORBIDDEN);
export const CLASS = impl.CLASS as {
  LEGACY_BACKFILL_ELIGIBLE: string;
  CANONICAL_INTEGRITY_FAILURE: string;
  NOT_APPLICABLE: string;
};

export type WaveBBackfillReport = {
  ok: boolean;
  processed: number;
  processedLegacy?: number;
  mapped: number;
  unmapped: number;
  skippedAmbiguous: number;
  rejectedCrossTenant: number;
  batches: number;
  batchSize: number;
  remainingEligible: number;
  legacyEligibleRemaining?: number;
  canonicalIntegrityFailures?: number;
  notApplicable?: number;
  cutoverAt?: string;
};

export type WaveBBackfillOpts = {
  actorId?: string;
  progressEvery?: number;
  onProgress?: (n: number, meta?: Record<string, unknown>) => void;
  batchSize?: number;
  maxBatches?: number;
  allowIncomplete?: boolean;
  tenantId?: string;
};

export async function runPhase48WaveBSnapshotBackfill(
  prisma: PrismaClient,
  opts: WaveBBackfillOpts = {},
): Promise<WaveBBackfillReport> {
  return impl.runPhase48WaveBSnapshotBackfill(prisma, opts);
}

export function classifyMissingSnapshotAppointment(
  appt: {
    snapshotWriteMode?: string | null;
    createdAt?: Date;
    effectiveSnapshotRevisionId?: string | null;
  },
  cutoverAt?: Date,
): string {
  return impl.classifyMissingSnapshotAppointment(appt, cutoverAt);
}

export async function countClassifiedRemaining(
  prisma: PrismaClient,
  tenantId?: string,
  countBatchSize?: number,
): Promise<{
  legacyEligibleRemaining: number;
  canonicalIntegrityFailures: number;
  notApplicable: number;
}> {
  return impl.countClassifiedRemaining(prisma, tenantId, countBatchSize);
}

export function assertSafeTestDatabaseUrl(url: string): void {
  return impl.assertSafeTestDatabaseUrl(url);
}

export function printSafeDatabaseIdentity(url: string): {
  host: string | null;
  port: string | null;
  database: string | null;
  user: string | null;
} {
  return impl.printSafeDatabaseIdentity(url);
}

export async function countEligibleRemaining(
  prisma: PrismaClient,
  tenantId?: string,
): Promise<number> {
  return impl.countEligibleRemaining(prisma, tenantId);
}

export async function loadCutoverWatermark(prisma: PrismaClient): Promise<Date> {
  return impl.loadCutoverWatermark(prisma);
}
