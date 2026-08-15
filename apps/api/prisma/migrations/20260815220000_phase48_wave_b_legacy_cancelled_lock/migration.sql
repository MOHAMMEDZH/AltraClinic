-- Phase 48 Wave B — final 3-blocker closure (additive)
-- WB-PA-01: legacy CANCELLED commercialLockedAt backfill from evidence / commercial artifacts

-- 1) Operational evidence: queue progressed (implies confirmed-or-beyond lifecycle)
UPDATE "appointments" a
SET "commercialLockedAt" = COALESCE(
  q."checkedInAt",
  q."calledAt",
  q."servedAt",
  q."completedAt",
  a."updatedAt",
  a."createdAt",
  NOW()
)
FROM "queue_tickets" q
WHERE a."id" = q."appointmentId"
  AND a."commercialLockedAt" IS NULL
  AND a."status" = 'CANCELLED'
  AND a."deletedAt" IS NULL
  AND (
    q."checkedInAt" IS NOT NULL
    OR q."calledAt" IS NOT NULL
    OR q."servedAt" IS NOT NULL
    OR q."completedAt" IS NOT NULL
  );

-- 2) Operational evidence: encounter linked to appointment
UPDATE "appointments" a
SET "commercialLockedAt" = COALESCE(e."createdAt", a."updatedAt", a."createdAt", NOW())
FROM "encounters" e
WHERE e."appointmentId" = a."id"
  AND a."commercialLockedAt" IS NULL
  AND a."status" = 'CANCELLED'
  AND a."deletedAt" IS NULL;

-- 3) Fail-safe commercial artifact: effective snapshot or any snapshot revision.
-- Deterministic fail-safe: do not unlock commercial history.
-- PENDING to CANCELLED with a snapshot artifact also locks.
UPDATE "appointments" a
SET "commercialLockedAt" = COALESCE(
  (
    SELECT MIN(r."capturedAt")
    FROM "appointment_service_snapshot_revisions" r
    WHERE r."appointmentId" = a."id"
  ),
  a."updatedAt",
  a."createdAt",
  NOW()
)
WHERE a."commercialLockedAt" IS NULL
  AND a."status" = 'CANCELLED'
  AND a."deletedAt" IS NULL
  AND (
    a."effectiveSnapshotRevisionId" IS NOT NULL
    OR EXISTS (
      SELECT 1
      FROM "appointment_service_snapshot_revisions" r
      WHERE r."appointmentId" = a."id"
    )
  );
