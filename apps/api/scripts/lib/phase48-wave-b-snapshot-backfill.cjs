/**
 * Phase 48 Wave B — AUTHORITATIVE snapshot backfill implementation (single source of truth).
 *
 * Consumed by:
 * - production CLI: backfill-phase48-wave-b-snapshots-production.mjs
 * - test CLI: backfill-phase48-wave-b-snapshots.mjs
 * - Jest / Nest via thin TypeScript re-export
 *
 * Do NOT duplicate this business logic elsewhere.
 */
'use strict';

const { randomUUID } = require('crypto');

const LEGACY_APPOINTMENT_SERVICE_TYPE = 'LEGACY_APPOINTMENT_SERVICE_TYPE';
const DEFAULT_BATCH_SIZE = 1000;
const CUTOVER_MARKER_KEY = 'snapshot_backfill_cutover_at';
/** Known pseudo-cutover from 20260815230000 — must never be used as live classification boundary. */
const PSEUDO_CUTOVER_FORBIDDEN = new Date('2026-08-15T01:00:00.000Z');

const CLASS = {
  LEGACY_BACKFILL_ELIGIBLE: 'LEGACY_BACKFILL_ELIGIBLE',
  CANONICAL_INTEGRITY_FAILURE: 'CANONICAL_INTEGRITY_FAILURE',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
};

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   actorId?: string;
 *   progressEvery?: number;
 *   onProgress?: (n: number, meta?: object) => void;
 *   batchSize?: number;
 *   maxBatches?: number;
 *   allowIncomplete?: boolean;
 *   tenantId?: string;
 * }} [opts]
 */
async function runPhase48WaveBSnapshotBackfill(prisma, opts = {}) {
  const actorId =
    opts.actorId ||
    process.env.WAVE_B_BACKFILL_ACTOR_ID ||
    '00000000-0000-4000-8000-000000000048';
  const progressEvery = opts.progressEvery ?? 100;
  const batchSize = Math.max(
    1,
    Number(opts.batchSize ?? process.env.WAVE_B_BACKFILL_BATCH_SIZE ?? DEFAULT_BATCH_SIZE) ||
      DEFAULT_BATCH_SIZE,
  );
  const maxBatches =
    opts.maxBatches == null ? Number.POSITIVE_INFINITY : Math.max(0, Number(opts.maxBatches));
  const allowIncomplete = Boolean(opts.allowIncomplete);
  const tenantScope = opts.tenantId ? { tenantId: opts.tenantId } : {};

  // Cutover marker remains operational/diagnostic metadata — NOT the provenance classifier.
  let cutoverAt = null;
  try {
    cutoverAt = await loadCutoverWatermark(prisma);
  } catch {
    cutoverAt = null;
  }

  let mapped = 0;
  let unmapped = 0;
  let skippedAmbiguous = 0;
  let rejectedCrossTenant = 0;
  let processed = 0;
  let batches = 0;
  let cursorId = null;
  let canonicalIntegritySeen = 0;

  while (batches < maxBatches) {
    const batchResult = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', true)`;

      // Scan missing-snapshot rows; classify by persisted snapshotWriteMode.
      const batch = await tx.appointment.findMany({
        where: {
          deletedAt: null,
          effectiveSnapshotRevisionId: null,
          ...tenantScope,
          ...(cursorId ? { id: { gt: cursorId } } : {}),
        },
        orderBy: { id: 'asc' },
        take: batchSize,
        select: {
          id: true,
          tenantId: true,
          serviceType: true,
          clinicalServiceId: true,
          createdAt: true,
          snapshotWriteMode: true,
          effectiveSnapshotRevisionId: true,
        },
      });

      if (batch.length === 0) {
        return { empty: true, lastId: cursorId, canonicalHits: 0 };
      }

      let canonicalHits = 0;
      for (const appt of batch) {
        const classification = classifyMissingSnapshotAppointment(appt);
        if (classification === CLASS.NOT_APPLICABLE) continue;
        if (classification === CLASS.CANONICAL_INTEGRITY_FAILURE) {
          canonicalHits += 1;
          continue;
        }

        const resolved = await resolveCommercialIdentity(tx, appt);
        if (resolved.kind === 'mapped') mapped += 1;
        else if (resolved.kind === 'ambiguous') {
          skippedAmbiguous += 1;
          unmapped += 1;
        } else if (resolved.kind === 'cross_tenant') {
          rejectedCrossTenant += 1;
          unmapped += 1;
        } else {
          unmapped += 1;
        }

        const existing = await tx.appointment.findFirst({
          where: { id: appt.id },
          select: { effectiveSnapshotRevisionId: true },
        });
        if (existing?.effectiveSnapshotRevisionId) continue;

        const revisionId = randomUUID();
        await tx.appointmentServiceSnapshotRevision.create({
          data: {
            id: revisionId,
            tenantId: appt.tenantId,
            appointmentId: appt.id,
            revisionNumber: 1,
            clinicalServiceId: resolved.clinicalServiceId,
            stableKey: resolved.stableKey,
            displayNameAr: resolved.displayNameAr,
            displayNameEn: resolved.displayNameEn,
            pricingUnit: 'PER_VISIT',
            quantity: 1,
            currency: 'SYP',
            unitPrice: 0,
            taxPercent: 0,
            lineBasisAmount: 0,
            commercialReason: resolved.commercialReason,
            actorId,
            changeCommandContext: 'migration.backfill',
          },
        });
        await tx.appointment.update({
          where: { id: appt.id },
          data: {
            effectiveSnapshotRevisionId: revisionId,
            ...(resolved.clinicalServiceId && !appt.clinicalServiceId
              ? { clinicalServiceId: resolved.clinicalServiceId }
              : {}),
          },
        });

        processed += 1;
        if (opts.onProgress && processed % progressEvery === 0) {
          opts.onProgress(processed, { batches: batches + 1, batchSize });
        }
      }

      return {
        empty: false,
        lastId: batch[batch.length - 1].id,
        size: batch.length,
        canonicalHits,
      };
    });

    if (batchResult.empty) break;
    cursorId = batchResult.lastId;
    canonicalIntegritySeen += batchResult.canonicalHits || 0;
    batches += 1;
    if (opts.onProgress) {
      opts.onProgress(processed, {
        batches,
        batchSize,
        lastBatchSize: batchResult.size,
      });
    }
  }

  const counts = await countClassifiedRemaining(prisma, opts.tenantId, batchSize);
  const report = {
    ok: counts.legacyEligibleRemaining === 0 && counts.canonicalIntegrityFailures === 0,
    processed,
    processedLegacy: processed,
    mapped,
    unmapped,
    skippedAmbiguous,
    rejectedCrossTenant,
    batches,
    batchSize,
    cutoverAt: cutoverAt ? cutoverAt.toISOString() : null,
    remainingEligible: counts.legacyEligibleRemaining,
    legacyEligibleRemaining: counts.legacyEligibleRemaining,
    canonicalIntegrityFailures: counts.canonicalIntegrityFailures,
    notApplicable: counts.notApplicable,
    canonicalIntegritySeen,
  };

  if (!report.ok && !allowIncomplete) {
    const err = new Error(
      `Wave B snapshot backfill incomplete: legacyEligibleRemaining=${counts.legacyEligibleRemaining} canonicalIntegrityFailures=${counts.canonicalIntegrityFailures}`,
    );
    err.report = report;
    throw err;
  }

  return report;
}

async function loadCutoverWatermark(prisma) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', true)`;
    const row = await tx.phase48WaveBRuntimeMarker.findUnique({
      where: { key: CUTOVER_MARKER_KEY },
    });
    if (!row?.valueTimestamptz) {
      throw new Error(
        'Missing phase48_wave_b_runtime_markers.snapshot_backfill_cutover_at — apply Wave B cutover migrations (20260815240000+)',
      );
    }
    const cutover = new Date(row.valueTimestamptz);
    if (cutover.getTime() === PSEUDO_CUTOVER_FORBIDDEN.getTime()) {
      throw new Error(
        'snapshot_backfill_cutover_at still holds migration-filename pseudo timestamp 2026-08-15T01:00:00.000Z — apply 20260815240000_phase48_wave_b_cutover_execution_time',
      );
    }
    return cutover;
  });
}

/**
 * Deterministic classification for missing-snapshot appointments.
 * Authoritative discriminator = persisted snapshotWriteMode (NOT createdAt/cutover).
 * @param {{
 *   snapshotWriteMode?: string | null;
 *   effectiveSnapshotRevisionId?: string | null;
 * }} appt
 * @param {Date} [_ignoredCutover] retained for call-site compatibility only
 */
function classifyMissingSnapshotAppointment(appt, _ignoredCutover) {
  if (appt.effectiveSnapshotRevisionId) return CLASS.NOT_APPLICABLE;
  const mode = String(appt.snapshotWriteMode || 'LEGACY').toUpperCase();
  if (mode === 'CANONICAL_REQUIRED') return CLASS.CANONICAL_INTEGRITY_FAILURE;
  return CLASS.LEGACY_BACKFILL_ELIGIBLE;
}

/**
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {{ id: string; tenantId: string; serviceType: string | null; clinicalServiceId: string | null }} appt
 */
async function resolveCommercialIdentity(tx, appt) {
  let clinicalServiceId = appt.clinicalServiceId;
  let stableKey = 'LEGACY_UNMAPPED';
  let displayNameEn = appt.serviceType?.trim() || 'Legacy unmapped service';
  let displayNameAr = displayNameEn;
  let commercialReason = 'LEGACY_UNMAPPED';
  let kind = 'unmapped';

  if (!clinicalServiceId && appt.serviceType?.trim()) {
    const mappings = await tx.legacyClinicalServiceMapping.findMany({
      where: {
        sourceSystem: LEGACY_APPOINTMENT_SERVICE_TYPE,
        sourceCode: appt.serviceType.trim(),
        status: 'MAPPED',
        clinicalServiceId: { not: null },
        OR: [{ tenantId: appt.tenantId }, { tenantId: null }],
      },
    });
    const uniqueIds = [
      ...new Set(mappings.map((m) => m.clinicalServiceId).filter(Boolean)),
    ];
    if (uniqueIds.length === 1) {
      clinicalServiceId = uniqueIds[0];
    } else if (uniqueIds.length > 1) {
      return {
        kind: 'ambiguous',
        clinicalServiceId: null,
        stableKey,
        displayNameEn: appt.serviceType.trim(),
        displayNameAr: appt.serviceType.trim(),
        commercialReason: 'LEGACY_UNMAPPED',
      };
    }
  }

  if (clinicalServiceId) {
    const svc = await tx.canonicalClinicalServiceDefinition.findFirst({
      where: { id: clinicalServiceId },
      include: { translations: true },
    });

    if (
      svc &&
      svc.provenance === 'TENANT_CUSTOM' &&
      svc.tenantId &&
      svc.tenantId !== appt.tenantId
    ) {
      return {
        kind: 'cross_tenant',
        clinicalServiceId: null,
        stableKey: 'LEGACY_UNMAPPED',
        displayNameEn: appt.serviceType?.trim() || 'Legacy unmapped service',
        displayNameAr: appt.serviceType?.trim() || 'Legacy unmapped service',
        commercialReason: 'LEGACY_UNMAPPED',
      };
    }

    if (svc) {
      stableKey = svc.stableKey ?? clinicalServiceId;
      displayNameEn =
        svc.translations.find((t) => t.locale.startsWith('en'))?.displayName ?? stableKey;
      displayNameAr =
        svc.translations.find((t) => t.locale.startsWith('ar'))?.displayName ?? displayNameEn;
      commercialReason = 'LEGACY_SYNTHETIC_MAPPED';
      kind = 'mapped';
    } else {
      clinicalServiceId = null;
      kind = 'unmapped';
    }
  }

  return {
    kind,
    clinicalServiceId,
    stableKey,
    displayNameEn,
    displayNameAr,
    commercialReason,
  };
}

async function countClassifiedRemaining(prisma, tenantId, countBatchSize) {
  const batchSize = Math.max(
    1,
    Number(countBatchSize ?? process.env.WAVE_B_BACKFILL_BATCH_SIZE ?? DEFAULT_BATCH_SIZE) ||
      DEFAULT_BATCH_SIZE,
  );
  let legacyEligibleRemaining = 0;
  let canonicalIntegrityFailures = 0;
  let notApplicable = 0;
  let cursorId = null;

  for (;;) {
    const batch = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', true)`;
      return tx.appointment.findMany({
        where: {
          deletedAt: null,
          effectiveSnapshotRevisionId: null,
          ...(tenantId ? { tenantId } : {}),
          ...(cursorId ? { id: { gt: cursorId } } : {}),
        },
        orderBy: { id: 'asc' },
        take: batchSize,
        select: {
          id: true,
          snapshotWriteMode: true,
          effectiveSnapshotRevisionId: true,
        },
      });
    });
    if (batch.length === 0) break;
    for (const row of batch) {
      const c = classifyMissingSnapshotAppointment(row);
      if (c === CLASS.LEGACY_BACKFILL_ELIGIBLE) legacyEligibleRemaining += 1;
      else if (c === CLASS.CANONICAL_INTEGRITY_FAILURE) canonicalIntegrityFailures += 1;
      else notApplicable += 1;
    }
    cursorId = batch[batch.length - 1].id;
    if (batch.length < batchSize) break;
  }

  return { legacyEligibleRemaining, canonicalIntegrityFailures, notApplicable };
}

async function countEligibleRemaining(prisma, tenantId) {
  const counts = await countClassifiedRemaining(prisma, tenantId);
  return counts.legacyEligibleRemaining;
}

function assertSafeTestDatabaseUrl(url) {
  if (process.env.ALLOW_TEST_DATABASE_RESET !== 'true') {
    throw new Error('Refusing backfill: ALLOW_TEST_DATABASE_RESET=true is required');
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid DATABASE_URL');
  }
  const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, '').split('/')[0] ?? '');
  const okName =
    dbName === 'booking_test' ||
    /_(test|integration)$/i.test(dbName) ||
    /^test_/i.test(dbName);
  if (!okName) {
    throw new Error(`Refusing unsafe database name "${dbName}" for Wave B test backfill`);
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host !== 'localhost' &&
    host !== '127.0.0.1' &&
    host !== '::1' &&
    host !== 'postgres-test'
  ) {
    throw new Error(`Refusing non-local host "${host}" for Wave B test backfill`);
  }
}

function printSafeDatabaseIdentity(url) {
  try {
    const parsed = new URL(url);
    const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, '').split('/')[0] ?? '');
    return {
      host: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'postgresql:' ? '5432' : ''),
      database: dbName,
      user: parsed.username || null,
    };
  } catch {
    return { host: null, port: null, database: null, user: null };
  }
}

module.exports = {
  LEGACY_APPOINTMENT_SERVICE_TYPE,
  DEFAULT_BATCH_SIZE,
  CUTOVER_MARKER_KEY,
  PSEUDO_CUTOVER_FORBIDDEN,
  CLASS,
  runPhase48WaveBSnapshotBackfill,
  classifyMissingSnapshotAppointment,
  assertSafeTestDatabaseUrl,
  printSafeDatabaseIdentity,
  countEligibleRemaining,
  countClassifiedRemaining,
  loadCutoverWatermark,
};
