-- Phase 48 Wave F Round 4 remediation
-- R4-F3: durable invoice-line provenance + ACTIVE binding uniqueness for corrections
-- R4-F4A: correctionEventId on accruals (refundId optional for correction path)
-- R4-PACKAGE: explicit course/package session revenue allocations
-- R4-HYGIENE: additive only; does not rewrite R0–R3

-- ── Invoice line provenance + binding lifecycle ──────────────────────────────
ALTER TABLE "invoice_line_items"
  ADD COLUMN IF NOT EXISTS "appointmentId" UUID,
  ADD COLUMN IF NOT EXISTS "clinicalServiceId" UUID,
  ADD COLUMN IF NOT EXISTS "snapshotRevisionId" UUID,
  ADD COLUMN IF NOT EXISTS "courseSessionId" UUID,
  ADD COLUMN IF NOT EXISTS "performanceBindingStatus" TEXT NOT NULL DEFAULT 'ACTIVE';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoice_line_items_appointmentId_fkey'
  ) THEN
    ALTER TABLE "invoice_line_items"
      ADD CONSTRAINT "invoice_line_items_appointmentId_fkey"
      FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoice_line_items_clinicalServiceId_fkey'
  ) THEN
    ALTER TABLE "invoice_line_items"
      ADD CONSTRAINT "invoice_line_items_clinicalServiceId_fkey"
      FOREIGN KEY ("clinicalServiceId") REFERENCES "canonical_clinical_service_definitions"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoice_line_items_snapshotRevisionId_fkey'
  ) THEN
    ALTER TABLE "invoice_line_items"
      ADD CONSTRAINT "invoice_line_items_snapshotRevisionId_fkey"
      FOREIGN KEY ("snapshotRevisionId") REFERENCES "appointment_service_snapshot_revisions"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoice_line_items_courseSessionId_fkey'
  ) THEN
    ALTER TABLE "invoice_line_items"
      ADD CONSTRAINT "invoice_line_items_courseSessionId_fkey"
      FOREIGN KEY ("courseSessionId") REFERENCES "course_sessions"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Replace absolute unique with ACTIVE-only unique (correction may SUPERSEDE prior binding)
DROP INDEX IF EXISTS "invoice_line_items_servicePerformanceId_uidx";
CREATE UNIQUE INDEX IF NOT EXISTS "invoice_line_items_active_servicePerformanceId_uidx"
  ON "invoice_line_items" ("servicePerformanceId")
  WHERE "servicePerformanceId" IS NOT NULL AND "performanceBindingStatus" = 'ACTIVE';

CREATE INDEX IF NOT EXISTS "invoice_line_items_appointmentId_idx"
  ON "invoice_line_items" ("tenantId", "appointmentId");
CREATE INDEX IF NOT EXISTS "invoice_line_items_courseSessionId_idx"
  ON "invoice_line_items" ("tenantId", "courseSessionId");

-- Immutability: once servicePerformanceId set, cannot change id; ACTIVE→SUPERSEDED allowed
CREATE OR REPLACE FUNCTION enforce_invoice_line_service_performance_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."servicePerformanceId" IS NOT NULL
     AND NEW."servicePerformanceId" IS DISTINCT FROM OLD."servicePerformanceId" THEN
    RAISE EXCEPTION 'invoice_line_items: servicePerformanceId reassignment forbidden once set'
      USING ERRCODE = '23514';
  END IF;
  IF OLD."performanceBindingStatus" = 'SUPERSEDED'
     AND NEW."performanceBindingStatus" IS DISTINCT FROM OLD."performanceBindingStatus" THEN
    RAISE EXCEPTION 'invoice_line_items: SUPERSEDED performance binding cannot change'
      USING ERRCODE = '23514';
  END IF;
  IF OLD."performanceBindingStatus" = 'ACTIVE'
     AND NEW."performanceBindingStatus" IS DISTINCT FROM OLD."performanceBindingStatus"
     AND NEW."performanceBindingStatus" IS DISTINCT FROM 'SUPERSEDED' THEN
    RAISE EXCEPTION 'invoice_line_items: performanceBindingStatus may only move ACTIVE→SUPERSEDED'
      USING ERRCODE = '23514';
  END IF;
  -- Provenance frozen once set (non-null → different value forbidden)
  IF OLD."appointmentId" IS NOT NULL AND NEW."appointmentId" IS DISTINCT FROM OLD."appointmentId" THEN
    RAISE EXCEPTION 'invoice_line_items: appointmentId immutable once set' USING ERRCODE = '23514';
  END IF;
  IF OLD."clinicalServiceId" IS NOT NULL AND NEW."clinicalServiceId" IS DISTINCT FROM OLD."clinicalServiceId" THEN
    RAISE EXCEPTION 'invoice_line_items: clinicalServiceId immutable once set' USING ERRCODE = '23514';
  END IF;
  IF OLD."snapshotRevisionId" IS NOT NULL AND NEW."snapshotRevisionId" IS DISTINCT FROM OLD."snapshotRevisionId" THEN
    RAISE EXCEPTION 'invoice_line_items: snapshotRevisionId immutable once set' USING ERRCODE = '23514';
  END IF;
  IF OLD."courseSessionId" IS NOT NULL AND NEW."courseSessionId" IS DISTINCT FROM OLD."courseSessionId" THEN
    RAISE EXCEPTION 'invoice_line_items: courseSessionId immutable once set' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoice_line_items_service_performance_immutable ON "invoice_line_items";
CREATE TRIGGER invoice_line_items_service_performance_immutable
  BEFORE UPDATE ON "invoice_line_items"
  FOR EACH ROW EXECUTE FUNCTION enforce_invoice_line_service_performance_immutable();

-- Tenant integrity for new provenance FKs
CREATE OR REPLACE FUNCTION enforce_invoice_line_provenance_tenant()
RETURNS TRIGGER AS $$
DECLARE
  ref_tenant UUID;
BEGIN
  IF NEW."appointmentId" IS NOT NULL THEN
    SELECT "tenantId" INTO ref_tenant FROM "appointments" WHERE "id" = NEW."appointmentId";
    IF ref_tenant IS NULL OR ref_tenant IS DISTINCT FROM NEW."tenantId" THEN
      RAISE EXCEPTION 'invoice_line_items: appointmentId tenant mismatch' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW."clinicalServiceId" IS NOT NULL THEN
    -- Canonical clinical services are global catalog; presence check only
    IF NOT EXISTS (
      SELECT 1 FROM "canonical_clinical_service_definitions" WHERE "id" = NEW."clinicalServiceId"
    ) THEN
      RAISE EXCEPTION 'invoice_line_items: clinicalServiceId not found' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW."snapshotRevisionId" IS NOT NULL THEN
    SELECT "tenantId" INTO ref_tenant FROM "appointment_service_snapshot_revisions" WHERE "id" = NEW."snapshotRevisionId";
    IF ref_tenant IS NULL OR ref_tenant IS DISTINCT FROM NEW."tenantId" THEN
      RAISE EXCEPTION 'invoice_line_items: snapshotRevisionId tenant mismatch' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW."courseSessionId" IS NOT NULL THEN
    SELECT tc."tenantId" INTO ref_tenant
    FROM "course_sessions" cs
    JOIN "treatment_courses" tc ON tc."id" = cs."courseId"
    WHERE cs."id" = NEW."courseSessionId";
    IF ref_tenant IS NULL OR ref_tenant IS DISTINCT FROM NEW."tenantId" THEN
      RAISE EXCEPTION 'invoice_line_items: courseSessionId tenant mismatch' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoice_line_items_provenance_tenant ON "invoice_line_items";
CREATE TRIGGER invoice_line_items_provenance_tenant
  BEFORE INSERT OR UPDATE ON "invoice_line_items"
  FOR EACH ROW EXECUTE FUNCTION enforce_invoice_line_provenance_tenant();

-- ── Commission accrual: correction event identity ────────────────────────────
ALTER TABLE "commission_accruals"
  ADD COLUMN IF NOT EXISTS "correctionEventId" UUID,
  ADD COLUMN IF NOT EXISTS "packageAllocationId" UUID;

CREATE INDEX IF NOT EXISTS "commission_accruals_correctionEventId_idx"
  ON "commission_accruals" ("tenantId", "correctionEventId");
CREATE INDEX IF NOT EXISTS "commission_accruals_packageAllocationId_idx"
  ON "commission_accruals" ("tenantId", "packageAllocationId");

-- ── Explicit course/package session revenue allocation ───────────────────────
CREATE TABLE IF NOT EXISTS "commission_package_session_allocations" (
  "id" UUID PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  "treatmentCourseId" UUID NOT NULL,
  "courseSessionId" UUID NOT NULL,
  "servicePerformanceId" UUID NOT NULL,
  "invoiceLineId" UUID,
  "allocatedRevenueAmount" DECIMAL(18,4) NOT NULL,
  "packageCommercialBasisAmount" DECIMAL(18,4) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "idempotencyKey" VARCHAR(200) NOT NULL,
  "reason" TEXT,
  "createdBy" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "financiallyConsumedAt" TIMESTAMPTZ,
  CONSTRAINT "commission_package_session_allocations_tenant_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "commission_package_session_allocations_course_fkey"
    FOREIGN KEY ("treatmentCourseId") REFERENCES "treatment_courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "commission_package_session_allocations_session_fkey"
    FOREIGN KEY ("courseSessionId") REFERENCES "course_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "commission_package_session_allocations_perf_fkey"
    FOREIGN KEY ("servicePerformanceId") REFERENCES "service_performances"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "commission_package_session_allocations_line_fkey"
    FOREIGN KEY ("invoiceLineId") REFERENCES "invoice_line_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "commission_package_session_allocations_creator_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "commission_package_session_allocations_tenant_idem_uidx"
  ON "commission_package_session_allocations" ("tenantId", "idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "commission_package_session_allocations_session_uidx"
  ON "commission_package_session_allocations" ("tenantId", "courseSessionId");
CREATE UNIQUE INDEX IF NOT EXISTS "commission_package_session_allocations_perf_uidx"
  ON "commission_package_session_allocations" ("tenantId", "servicePerformanceId");
CREATE INDEX IF NOT EXISTS "commission_package_session_allocations_course_idx"
  ON "commission_package_session_allocations" ("tenantId", "treatmentCourseId");

ALTER TABLE "commission_accruals"
  DROP CONSTRAINT IF EXISTS "commission_accruals_packageAllocationId_fkey";
ALTER TABLE "commission_accruals"
  ADD CONSTRAINT "commission_accruals_packageAllocationId_fkey"
  FOREIGN KEY ("packageAllocationId") REFERENCES "commission_package_session_allocations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Append-only + consume-only for allocations
CREATE OR REPLACE FUNCTION enforce_commission_package_allocation_append_only()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'commission_package_session_allocations: DELETE forbidden' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW."id" IS DISTINCT FROM OLD."id"
       OR NEW."tenantId" IS DISTINCT FROM OLD."tenantId"
       OR NEW."treatmentCourseId" IS DISTINCT FROM OLD."treatmentCourseId"
       OR NEW."courseSessionId" IS DISTINCT FROM OLD."courseSessionId"
       OR NEW."servicePerformanceId" IS DISTINCT FROM OLD."servicePerformanceId"
       OR NEW."allocatedRevenueAmount" IS DISTINCT FROM OLD."allocatedRevenueAmount"
       OR NEW."packageCommercialBasisAmount" IS DISTINCT FROM OLD."packageCommercialBasisAmount"
       OR NEW."currency" IS DISTINCT FROM OLD."currency"
       OR NEW."idempotencyKey" IS DISTINCT FROM OLD."idempotencyKey"
       OR NEW."createdBy" IS DISTINCT FROM OLD."createdBy"
       OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
      RAISE EXCEPTION 'commission_package_session_allocations: financial fields immutable' USING ERRCODE = '23514';
    END IF;
    -- Allow first financial consume stamp + invoiceLineId bind-once
    IF OLD."financiallyConsumedAt" IS NOT NULL
       AND NEW."financiallyConsumedAt" IS DISTINCT FROM OLD."financiallyConsumedAt" THEN
      RAISE EXCEPTION 'commission_package_session_allocations: financiallyConsumedAt immutable once set' USING ERRCODE = '23514';
    END IF;
    IF OLD."invoiceLineId" IS NOT NULL
       AND NEW."invoiceLineId" IS DISTINCT FROM OLD."invoiceLineId" THEN
      RAISE EXCEPTION 'commission_package_session_allocations: invoiceLineId immutable once set' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS commission_package_session_allocations_append_only ON "commission_package_session_allocations";
CREATE TRIGGER commission_package_session_allocations_append_only
  BEFORE UPDATE OR DELETE ON "commission_package_session_allocations"
  FOR EACH ROW EXECUTE FUNCTION enforce_commission_package_allocation_append_only();

CREATE OR REPLACE FUNCTION enforce_commission_package_allocation_tenant()
RETURNS TRIGGER AS $$
DECLARE
  ref_tenant UUID;
BEGIN
  SELECT "tenantId" INTO ref_tenant FROM "treatment_courses" WHERE "id" = NEW."treatmentCourseId";
  IF ref_tenant IS NULL OR ref_tenant IS DISTINCT FROM NEW."tenantId" THEN
    RAISE EXCEPTION 'commission_package_session_allocations: treatmentCourseId tenant mismatch' USING ERRCODE = '23514';
  END IF;
  SELECT tc."tenantId" INTO ref_tenant
  FROM "course_sessions" cs
  JOIN "treatment_courses" tc ON tc."id" = cs."courseId"
  WHERE cs."id" = NEW."courseSessionId";
  IF ref_tenant IS NULL OR ref_tenant IS DISTINCT FROM NEW."tenantId" THEN
    RAISE EXCEPTION 'commission_package_session_allocations: courseSessionId tenant mismatch' USING ERRCODE = '23514';
  END IF;
  SELECT "tenantId" INTO ref_tenant FROM "service_performances" WHERE "id" = NEW."servicePerformanceId";
  IF ref_tenant IS NULL OR ref_tenant IS DISTINCT FROM NEW."tenantId" THEN
    RAISE EXCEPTION 'commission_package_session_allocations: servicePerformanceId tenant mismatch' USING ERRCODE = '23514';
  END IF;
  IF NEW."invoiceLineId" IS NOT NULL THEN
    SELECT "tenantId" INTO ref_tenant FROM "invoice_line_items" WHERE "id" = NEW."invoiceLineId";
    IF ref_tenant IS NULL OR ref_tenant IS DISTINCT FROM NEW."tenantId" THEN
      RAISE EXCEPTION 'commission_package_session_allocations: invoiceLineId tenant mismatch' USING ERRCODE = '23514';
    END IF;
  END IF;
  SELECT "tenantId" INTO ref_tenant FROM "users" WHERE "id" = NEW."createdBy";
  IF ref_tenant IS NULL OR ref_tenant IS DISTINCT FROM NEW."tenantId" THEN
    RAISE EXCEPTION 'commission_package_session_allocations: createdBy tenant mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS commission_package_session_allocations_tenant_refs ON "commission_package_session_allocations";
CREATE TRIGGER commission_package_session_allocations_tenant_refs
  BEFORE INSERT OR UPDATE ON "commission_package_session_allocations"
  FOR EACH ROW EXECUTE FUNCTION enforce_commission_package_allocation_tenant();

ALTER TABLE "commission_package_session_allocations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commission_package_session_allocations" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commission_package_session_allocations_tenant_isolation ON "commission_package_session_allocations";
CREATE POLICY commission_package_session_allocations_tenant_isolation
  ON "commission_package_session_allocations"
  USING ("tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
