-- Phase 48 Wave D Round 1 remediation
-- Add DB-level reference integrity for ServicePerformance encounter/branch links.

ALTER TABLE "service_performances"
  DROP CONSTRAINT IF EXISTS "service_performances_branchId_fkey";
ALTER TABLE "service_performances"
  ADD CONSTRAINT "service_performances_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "branches"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "service_performances"
  DROP CONSTRAINT IF EXISTS "service_performances_encounterId_fkey";
ALTER TABLE "service_performances"
  ADD CONSTRAINT "service_performances_encounterId_fkey"
  FOREIGN KEY ("encounterId") REFERENCES "encounters"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "service_performances_tenantId_encounterId_idx"
  ON "service_performances" ("tenantId", "encounterId");
