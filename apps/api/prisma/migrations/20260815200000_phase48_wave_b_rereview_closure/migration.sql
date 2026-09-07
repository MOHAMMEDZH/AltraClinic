-- Phase 48 Wave B — final external re-review closure (additive)
-- WB-PA-01 commercialLockedAt; WB-PA-03 idempotency state machine fields

-- Irreversible commercial lock (CONFIRMED is global lock point)
ALTER TABLE "appointments"
  ADD COLUMN IF NOT EXISTS "commercialLockedAt" TIMESTAMP(3);

-- Backfill for appointments currently in confirmed-or-beyond statuses
UPDATE "appointments"
SET "commercialLockedAt" = COALESCE("updatedAt", "createdAt", NOW())
WHERE "commercialLockedAt" IS NULL
  AND "status" IN ('CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'NO_SHOW');

CREATE INDEX IF NOT EXISTS "appointments_tenantId_commercialLockedAt_idx"
  ON "appointments"("tenantId", "commercialLockedAt");

-- Portal idempotency ledger state machine
ALTER TABLE "portal_scheduling_idempotency_ledger"
  ADD COLUMN IF NOT EXISTS "status" VARCHAR(32) NOT NULL DEFAULT 'IN_PROGRESS';

ALTER TABLE "portal_scheduling_idempotency_ledger"
  ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

ALTER TABLE "portal_scheduling_idempotency_ledger"
  ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

ALTER TABLE "portal_scheduling_idempotency_ledger"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "portal_scheduling_idempotency_ledger"
SET
  "status" = CASE WHEN "responseJson" IS NOT NULL THEN 'COMPLETED' ELSE 'IN_PROGRESS' END,
  "completedAt" = CASE WHEN "responseJson" IS NOT NULL THEN "createdAt" ELSE NULL END,
  "expiresAt" = COALESCE("expiresAt", "createdAt" + INTERVAL '5 minutes')
WHERE TRUE;

CREATE INDEX IF NOT EXISTS "portal_scheduling_idempotency_ledger_status_expiresAt_idx"
  ON "portal_scheduling_idempotency_ledger"("status", "expiresAt");
