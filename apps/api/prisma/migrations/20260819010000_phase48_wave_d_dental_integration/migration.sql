-- Phase 48 Wave D — Dental Integration (AR-08/12/16/21 start, P0-05, P1-02/03/07)
-- Additive: enums, nullable historical clinicalServiceId, new tenant-owned tables, RLS, triggers.
-- Does not invent historical plan links or performers.

-- ---------------------------------------------------------------------------
-- A. Enums
-- ---------------------------------------------------------------------------
ALTER TYPE "scheduling_resource_type" ADD VALUE IF NOT EXISTS 'OPERATORY';

ALTER TYPE "ClinicalPricingUnit" ADD VALUE IF NOT EXISTS 'PER_SURFACE';
ALTER TYPE "ClinicalPricingUnit" ADD VALUE IF NOT EXISTS 'PER_QUADRANT';
ALTER TYPE "ClinicalPricingUnit" ADD VALUE IF NOT EXISTS 'PER_ARCH';
ALTER TYPE "ClinicalPricingUnit" ADD VALUE IF NOT EXISTS 'PER_AREA';
ALTER TYPE "ClinicalPricingUnit" ADD VALUE IF NOT EXISTS 'PER_COURSE';
ALTER TYPE "ClinicalPricingUnit" ADD VALUE IF NOT EXISTS 'PER_PACKAGE';

CREATE TYPE "TreatmentPlanItemAppointmentLinkRole" AS ENUM ('PRIMARY', 'SUPPORTING');
CREATE TYPE "DentalLabCaseStatus" AS ENUM ('DRAFT', 'SENT', 'IN_LAB', 'RECEIVED', 'SEATED', 'CANCELLED');
CREATE TYPE "ServicePerformanceStatus" AS ENUM ('DRAFT', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ServicePerformanceParticipantRole" AS ENUM ('PRIMARY', 'ASSISTING');

-- ---------------------------------------------------------------------------
-- B. Scheduling resource display subtype (AR-12 optional label)
-- ---------------------------------------------------------------------------
ALTER TABLE "scheduling_resources"
  ADD COLUMN IF NOT EXISTS "displaySubtype" VARCHAR(80);

-- ---------------------------------------------------------------------------
-- C. Nullable historical dental service FK on plan items
-- ---------------------------------------------------------------------------
ALTER TABLE "treatment_plan_items"
  ADD COLUMN IF NOT EXISTS "clinicalServiceId" UUID;

ALTER TABLE "treatment_plan_items"
  DROP CONSTRAINT IF EXISTS "treatment_plan_items_clinicalServiceId_fkey";
ALTER TABLE "treatment_plan_items"
  ADD CONSTRAINT "treatment_plan_items_clinicalServiceId_fkey"
  FOREIGN KEY ("clinicalServiceId") REFERENCES "canonical_clinical_service_definitions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "treatment_plan_items_tenantId_clinicalServiceId_idx"
  ON "treatment_plan_items" ("tenantId", "clinicalServiceId");

-- ---------------------------------------------------------------------------
-- D. TreatmentPlanItemAppointment (AR-08)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "treatment_plan_item_appointments" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "planItemId" UUID NOT NULL,
  "appointmentId" UUID NOT NULL,
  "linkRole" "TreatmentPlanItemAppointmentLinkRole" NOT NULL DEFAULT 'PRIMARY',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" UUID NOT NULL,
  CONSTRAINT "treatment_plan_item_appointments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "treatment_plan_item_appointments_planItemId_appointmentId_key"
  ON "treatment_plan_item_appointments" ("planItemId", "appointmentId");
CREATE INDEX IF NOT EXISTS "treatment_plan_item_appointments_tenantId_appointmentId_idx"
  ON "treatment_plan_item_appointments" ("tenantId", "appointmentId");
CREATE INDEX IF NOT EXISTS "treatment_plan_item_appointments_tenantId_planItemId_idx"
  ON "treatment_plan_item_appointments" ("tenantId", "planItemId");

ALTER TABLE "treatment_plan_item_appointments"
  DROP CONSTRAINT IF EXISTS "treatment_plan_item_appointments_tenantId_fkey";
ALTER TABLE "treatment_plan_item_appointments"
  ADD CONSTRAINT "treatment_plan_item_appointments_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "treatment_plan_item_appointments"
  DROP CONSTRAINT IF EXISTS "treatment_plan_item_appointments_planItemId_fkey";
ALTER TABLE "treatment_plan_item_appointments"
  ADD CONSTRAINT "treatment_plan_item_appointments_planItemId_fkey"
  FOREIGN KEY ("planItemId") REFERENCES "treatment_plan_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "treatment_plan_item_appointments"
  DROP CONSTRAINT IF EXISTS "treatment_plan_item_appointments_appointmentId_fkey";
ALTER TABLE "treatment_plan_item_appointments"
  ADD CONSTRAINT "treatment_plan_item_appointments_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- E. DentalLabCase (AR-16)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "dental_lab_cases" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "branchId" UUID,
  "patientId" UUID NOT NULL,
  "providerId" UUID NOT NULL,
  "planItemId" UUID,
  "labVendor" VARCHAR(200) NOT NULL,
  "caseType" VARCHAR(80) NOT NULL,
  "toothOrArch" VARCHAR(80),
  "shade" VARCHAR(80),
  "specs" TEXT,
  "sentAt" TIMESTAMP(3),
  "expectedAt" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3),
  "status" "DentalLabCaseStatus" NOT NULL DEFAULT 'DRAFT',
  "notes" TEXT,
  "costRef" VARCHAR(120),
  "createdBy" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "dental_lab_cases_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "dental_lab_cases_tenantId_patientId_idx"
  ON "dental_lab_cases" ("tenantId", "patientId");
CREATE INDEX IF NOT EXISTS "dental_lab_cases_tenantId_status_idx"
  ON "dental_lab_cases" ("tenantId", "status");
CREATE INDEX IF NOT EXISTS "dental_lab_cases_tenantId_planItemId_idx"
  ON "dental_lab_cases" ("tenantId", "planItemId");

ALTER TABLE "dental_lab_cases"
  DROP CONSTRAINT IF EXISTS "dental_lab_cases_tenantId_fkey";
ALTER TABLE "dental_lab_cases"
  ADD CONSTRAINT "dental_lab_cases_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dental_lab_cases"
  DROP CONSTRAINT IF EXISTS "dental_lab_cases_patientId_fkey";
ALTER TABLE "dental_lab_cases"
  ADD CONSTRAINT "dental_lab_cases_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dental_lab_cases"
  DROP CONSTRAINT IF EXISTS "dental_lab_cases_planItemId_fkey";
ALTER TABLE "dental_lab_cases"
  ADD CONSTRAINT "dental_lab_cases_planItemId_fkey"
  FOREIGN KEY ("planItemId") REFERENCES "treatment_plan_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "dental_lab_case_attachments" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "labCaseId" UUID NOT NULL,
  "mediaAssetId" UUID NOT NULL,
  "attachedBy" UUID NOT NULL,
  "attachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dental_lab_case_attachments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "dental_lab_case_attachments_labCaseId_mediaAssetId_key"
  ON "dental_lab_case_attachments" ("labCaseId", "mediaAssetId");
CREATE INDEX IF NOT EXISTS "dental_lab_case_attachments_tenantId_labCaseId_idx"
  ON "dental_lab_case_attachments" ("tenantId", "labCaseId");

ALTER TABLE "dental_lab_case_attachments"
  DROP CONSTRAINT IF EXISTS "dental_lab_case_attachments_tenantId_fkey";
ALTER TABLE "dental_lab_case_attachments"
  ADD CONSTRAINT "dental_lab_case_attachments_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dental_lab_case_attachments"
  DROP CONSTRAINT IF EXISTS "dental_lab_case_attachments_labCaseId_fkey";
ALTER TABLE "dental_lab_case_attachments"
  ADD CONSTRAINT "dental_lab_case_attachments_labCaseId_fkey"
  FOREIGN KEY ("labCaseId") REFERENCES "dental_lab_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dental_lab_case_attachments"
  DROP CONSTRAINT IF EXISTS "dental_lab_case_attachments_mediaAssetId_fkey";
ALTER TABLE "dental_lab_case_attachments"
  ADD CONSTRAINT "dental_lab_case_attachments_mediaAssetId_fkey"
  FOREIGN KEY ("mediaAssetId") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- F. ServicePerformance (AR-21 start)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "service_performances" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "branchId" UUID,
  "appointmentId" UUID,
  "encounterId" UUID,
  "patientId" UUID,
  "clinicalServiceId" UUID NOT NULL,
  "snapshotRevisionId" UUID,
  "performedAt" TIMESTAMP(3) NOT NULL,
  "status" "ServicePerformanceStatus" NOT NULL DEFAULT 'DRAFT',
  "createdBy" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "completedBy" UUID,
  "cancelledAt" TIMESTAMP(3),
  "cancelledBy" UUID,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "service_performances_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "service_performances_tenantId_status_idx"
  ON "service_performances" ("tenantId", "status");
CREATE INDEX IF NOT EXISTS "service_performances_tenantId_appointmentId_idx"
  ON "service_performances" ("tenantId", "appointmentId");
CREATE INDEX IF NOT EXISTS "service_performances_tenantId_clinicalServiceId_idx"
  ON "service_performances" ("tenantId", "clinicalServiceId");

ALTER TABLE "service_performances"
  DROP CONSTRAINT IF EXISTS "service_performances_tenantId_fkey";
ALTER TABLE "service_performances"
  ADD CONSTRAINT "service_performances_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_performances"
  DROP CONSTRAINT IF EXISTS "service_performances_appointmentId_fkey";
ALTER TABLE "service_performances"
  ADD CONSTRAINT "service_performances_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_performances"
  DROP CONSTRAINT IF EXISTS "service_performances_patientId_fkey";
ALTER TABLE "service_performances"
  ADD CONSTRAINT "service_performances_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_performances"
  DROP CONSTRAINT IF EXISTS "service_performances_clinicalServiceId_fkey";
ALTER TABLE "service_performances"
  ADD CONSTRAINT "service_performances_clinicalServiceId_fkey"
  FOREIGN KEY ("clinicalServiceId") REFERENCES "canonical_clinical_service_definitions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_performances"
  DROP CONSTRAINT IF EXISTS "service_performances_snapshotRevisionId_fkey";
ALTER TABLE "service_performances"
  ADD CONSTRAINT "service_performances_snapshotRevisionId_fkey"
  FOREIGN KEY ("snapshotRevisionId") REFERENCES "appointment_service_snapshot_revisions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "service_performance_participants" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "performanceId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "role" "ServicePerformanceParticipantRole" NOT NULL,
  "attributionShare" DECIMAL(5, 2),
  "recordedBy" UUID NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_performance_participants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "service_performance_participants_share_range"
    CHECK ("attributionShare" IS NULL OR ("attributionShare" >= 0 AND "attributionShare" <= 100))
);

CREATE UNIQUE INDEX IF NOT EXISTS "service_performance_participants_performanceId_userId_key"
  ON "service_performance_participants" ("performanceId", "userId");
CREATE INDEX IF NOT EXISTS "service_performance_participants_tenantId_userId_idx"
  ON "service_performance_participants" ("tenantId", "userId");

ALTER TABLE "service_performance_participants"
  DROP CONSTRAINT IF EXISTS "service_performance_participants_tenantId_fkey";
ALTER TABLE "service_performance_participants"
  ADD CONSTRAINT "service_performance_participants_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_performance_participants"
  DROP CONSTRAINT IF EXISTS "service_performance_participants_performanceId_fkey";
ALTER TABLE "service_performance_participants"
  ADD CONSTRAINT "service_performance_participants_performanceId_fkey"
  FOREIGN KEY ("performanceId") REFERENCES "service_performances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "service_performance_corrections" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "performanceId" UUID NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "actorId" UUID NOT NULL,
  "previousParticipants" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_performance_corrections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "service_performance_corrections_tenantId_performanceId_idx"
  ON "service_performance_corrections" ("tenantId", "performanceId");

ALTER TABLE "service_performance_corrections"
  DROP CONSTRAINT IF EXISTS "service_performance_corrections_tenantId_fkey";
ALTER TABLE "service_performance_corrections"
  ADD CONSTRAINT "service_performance_corrections_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_performance_corrections"
  DROP CONSTRAINT IF EXISTS "service_performance_corrections_performanceId_fkey";
ALTER TABLE "service_performance_corrections"
  ADD CONSTRAINT "service_performance_corrections_performanceId_fkey"
  FOREIGN KEY ("performanceId") REFERENCES "service_performances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- G. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE treatment_plan_item_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_plan_item_appointments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON treatment_plan_item_appointments;
CREATE POLICY tenant_select ON treatment_plan_item_appointments FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON treatment_plan_item_appointments;
CREATE POLICY tenant_insert ON treatment_plan_item_appointments FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON treatment_plan_item_appointments;
CREATE POLICY tenant_update ON treatment_plan_item_appointments FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON treatment_plan_item_appointments;
CREATE POLICY tenant_delete ON treatment_plan_item_appointments FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

ALTER TABLE dental_lab_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE dental_lab_cases FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON dental_lab_cases;
CREATE POLICY tenant_select ON dental_lab_cases FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON dental_lab_cases;
CREATE POLICY tenant_insert ON dental_lab_cases FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON dental_lab_cases;
CREATE POLICY tenant_update ON dental_lab_cases FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON dental_lab_cases;
CREATE POLICY tenant_delete ON dental_lab_cases FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

ALTER TABLE dental_lab_case_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE dental_lab_case_attachments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON dental_lab_case_attachments;
CREATE POLICY tenant_select ON dental_lab_case_attachments FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON dental_lab_case_attachments;
CREATE POLICY tenant_insert ON dental_lab_case_attachments FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON dental_lab_case_attachments;
CREATE POLICY tenant_update ON dental_lab_case_attachments FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON dental_lab_case_attachments;
CREATE POLICY tenant_delete ON dental_lab_case_attachments FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

ALTER TABLE service_performances ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_performances FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON service_performances;
CREATE POLICY tenant_select ON service_performances FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON service_performances;
CREATE POLICY tenant_insert ON service_performances FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON service_performances;
CREATE POLICY tenant_update ON service_performances FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON service_performances;
CREATE POLICY tenant_delete ON service_performances FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

ALTER TABLE service_performance_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_performance_participants FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON service_performance_participants;
CREATE POLICY tenant_select ON service_performance_participants FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON service_performance_participants;
CREATE POLICY tenant_insert ON service_performance_participants FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON service_performance_participants;
CREATE POLICY tenant_update ON service_performance_participants FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON service_performance_participants;
CREATE POLICY tenant_delete ON service_performance_participants FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

ALTER TABLE service_performance_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_performance_corrections FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON service_performance_corrections;
CREATE POLICY tenant_select ON service_performance_corrections FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON service_performance_corrections;
CREATE POLICY tenant_insert ON service_performance_corrections FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON service_performance_corrections;
CREATE POLICY tenant_update ON service_performance_corrections FOR UPDATE USING (false);
DROP POLICY IF EXISTS tenant_delete ON service_performance_corrections;
CREATE POLICY tenant_delete ON service_performance_corrections FOR DELETE USING (false);

-- ---------------------------------------------------------------------------
-- H. Completed performance immutability (correction hatch)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_completed_service_performance_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('app.wave_d_performance_correction', true) = 'true' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" = 'COMPLETED' THEN
      RAISE EXCEPTION 'service_performances COMPLETED rows cannot be deleted'
        USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD."status" = 'COMPLETED' THEN
    RAISE EXCEPTION 'service_performances COMPLETED rows are immutable except audited correction'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS service_performances_completed_immutable ON service_performances;
CREATE TRIGGER service_performances_completed_immutable
  BEFORE UPDATE OR DELETE ON service_performances
  FOR EACH ROW EXECUTE FUNCTION prevent_completed_service_performance_mutation();

CREATE OR REPLACE FUNCTION prevent_completed_service_performance_participant_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  parent_status "ServicePerformanceStatus";
BEGIN
  IF current_setting('app.wave_d_performance_correction', true) = 'true' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    SELECT p."status" INTO parent_status FROM service_performances p WHERE p.id = OLD."performanceId";
    IF parent_status = 'COMPLETED' THEN
      RAISE EXCEPTION 'service_performance_participants locked after COMPLETED'
        USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN OLD;
  END IF;
  SELECT p."status" INTO parent_status FROM service_performances p WHERE p.id = NEW."performanceId";
  IF parent_status = 'COMPLETED' THEN
    RAISE EXCEPTION 'service_performance_participants locked after COMPLETED'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS service_performance_participants_completed_immutable ON service_performance_participants;
CREATE TRIGGER service_performance_participants_completed_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON service_performance_participants
  FOR EACH ROW EXECUTE FUNCTION prevent_completed_service_performance_participant_mutation();
