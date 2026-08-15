-- Phase 48 Wave B — appointment snapshot write provenance (additive)
-- WB-PA-07: persisted LEGACY vs CANONICAL_REQUIRED replaces createdAt/cutover classification.
-- Historical rows + DB default = LEGACY (safe under rolling deploy / flag-OFF legacy writers).
-- Canonical Wave B writers must set CANONICAL_REQUIRED explicitly when revision 1 is created atomically.
-- Prisma @@map name: appointment_snapshot_write_mode

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'appointment_snapshot_write_mode'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM pg_type WHERE typname = 'AppointmentSnapshotWriteMode'
    ) THEN
      ALTER TYPE "AppointmentSnapshotWriteMode" RENAME TO "appointment_snapshot_write_mode";
    ELSE
      CREATE TYPE "appointment_snapshot_write_mode" AS ENUM ('LEGACY', 'CANONICAL_REQUIRED');
    END IF;
  END IF;
END $$;

ALTER TABLE "appointments"
  ADD COLUMN IF NOT EXISTS "snapshotWriteMode" "appointment_snapshot_write_mode" NOT NULL DEFAULT 'LEGACY';

-- Explicit historical safety (no-op when DEFAULT already applied).
UPDATE "appointments"
SET "snapshotWriteMode" = 'LEGACY'
WHERE "snapshotWriteMode" IS NULL;

CREATE INDEX IF NOT EXISTS "appointments_tenant_snapshot_write_mode_idx"
  ON "appointments" ("tenantId", "snapshotWriteMode", "effectiveSnapshotRevisionId");
