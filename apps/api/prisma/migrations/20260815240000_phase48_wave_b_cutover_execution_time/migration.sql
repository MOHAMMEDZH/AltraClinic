-- Phase 48 Wave B — narrow WB-PA-07 cutover marker correction (additive)
-- Replaces migration-filename pseudo-cutover (2026-08-15 01:00:00+00 from 20260815230000)
-- with PostgreSQL CURRENT_TIMESTAMP at ACTUAL migration execution (deployment boundary).
--
-- Deployment contract (required):
--   A. Apply this migration under write quiescence / controlled maintenance, THEN
--      deploy/enable the Wave B canonical snapshot writer immediately.
--   B. Legacy appointment writers MUST NOT create appointments after this marker.
--
-- Semantics:
--   snapshot_backfill_cutover_at = DB time when Wave B canonical snapshot enforcement
--   deployment boundary becomes active.
--   createdAt < cutover + missing snapshot → LEGACY_BACKFILL_ELIGIBLE
--   createdAt >= cutover + missing snapshot → CANONICAL_INTEGRITY_FAILURE
--
-- Idempotency:
--   First corrective write uses CURRENT_TIMESTAMP.
--   Subsequent migrate/redeploy must NOT replace a already-corrected marker
--   (only rewrite the known pseudo timestamp from 20260815230000).

INSERT INTO "phase48_wave_b_runtime_markers" ("key", "valueTimestamptz", "note")
VALUES (
  'snapshot_backfill_cutover_at',
  CURRENT_TIMESTAMP,
  'Wave B snapshot cutover = PostgreSQL CURRENT_TIMESTAMP at migration execution; migrate-then-enable-canonical-writer under write quiescence; not CLI clock; not migration folder timestamp'
)
ON CONFLICT ("key") DO NOTHING;

-- Correct environments that already applied the hard-coded pseudo-cutover from 20260815230000.
UPDATE "phase48_wave_b_runtime_markers"
SET
  "valueTimestamptz" = CURRENT_TIMESTAMP,
  "note" = 'Wave B snapshot cutover = PostgreSQL CURRENT_TIMESTAMP at corrective migration execution; migrate-then-enable-canonical-writer under write quiescence; not CLI clock; not migration folder timestamp'
WHERE "key" = 'snapshot_backfill_cutover_at'
  AND "valueTimestamptz" = TIMESTAMPTZ '2026-08-15 01:00:00+00';
