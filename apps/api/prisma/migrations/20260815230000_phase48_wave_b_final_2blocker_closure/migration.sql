-- Phase 48 Wave B — final 2-blocker closure (additive)
-- WB-PA-07: persisted snapshot-backfill cutover watermark (deterministic, migration-owned)
-- WB-PA-02: series peer discovery supporting index (tenant + series + start)

-- Frozen cutover aligned to Wave B booking-integrity migration boundary 20260815010000.
-- Appointments created before this watermark without a snapshot are LEGACY_BACKFILL_ELIGIBLE.
-- Appointments created at/after this watermark without a snapshot are CANONICAL_INTEGRITY_FAILURE.

CREATE TABLE IF NOT EXISTS "phase48_wave_b_runtime_markers" (
  "key" TEXT PRIMARY KEY,
  "valueTimestamptz" TIMESTAMPTZ NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO "phase48_wave_b_runtime_markers" ("key", "valueTimestamptz", "note")
VALUES (
  'snapshot_backfill_cutover_at',
  TIMESTAMPTZ '2026-08-15 01:00:00+00',
  'Frozen to Wave B booking integrity migration boundary 20260815010000; not CLI runtime clock'
)
ON CONFLICT ("key") DO NOTHING;

CREATE INDEX IF NOT EXISTS "appointments_tenant_series_start_idx"
  ON "appointments" ("tenantId", "recurrenceSeriesId", "scheduledStart", "id")
  WHERE "deletedAt" IS NULL AND "recurrenceSeriesId" IS NOT NULL;
