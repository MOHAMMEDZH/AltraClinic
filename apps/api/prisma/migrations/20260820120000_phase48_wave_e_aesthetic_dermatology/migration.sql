-- Phase 48 Wave E — Aesthetic / Dermatology (AR-13, AR-14, AR-15, P1-04/05/06/09)
-- Upgrade from frozen Wave D checkpoint. Non-destructive; preserves beauty free-text history.

DO $$ BEGIN
  CREATE TYPE "TreatmentCourseStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CourseSessionStatus" AS ENUM ('PLANNED', 'BOOKED', 'COMPLETED', 'SKIPPED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "treatment_courses" (
  "id" UUID PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  "patientId" UUID NOT NULL,
  "clinicalServiceId" UUID NOT NULL,
  "plannedSessions" INTEGER NOT NULL,
  "intervalMinDays" INTEGER,
  "intervalMaxDays" INTEGER,
  "packagePriceVersionId" UUID,
  "status" "TreatmentCourseStatus" NOT NULL DEFAULT 'DRAFT',
  "createdBy" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3)
);

CREATE INDEX IF NOT EXISTS "treatment_courses_tenantId_patientId_idx"
  ON "treatment_courses" ("tenantId", "patientId");
CREATE INDEX IF NOT EXISTS "treatment_courses_tenantId_clinicalServiceId_idx"
  ON "treatment_courses" ("tenantId", "clinicalServiceId");
CREATE INDEX IF NOT EXISTS "treatment_courses_tenantId_status_idx"
  ON "treatment_courses" ("tenantId", "status");

ALTER TABLE "treatment_courses"
  DROP CONSTRAINT IF EXISTS "treatment_courses_tenantId_fkey";
ALTER TABLE "treatment_courses"
  ADD CONSTRAINT "treatment_courses_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "treatment_courses"
  DROP CONSTRAINT IF EXISTS "treatment_courses_patientId_fkey";
ALTER TABLE "treatment_courses"
  ADD CONSTRAINT "treatment_courses_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "course_sessions" (
  "id" UUID PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  "courseId" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "appointmentId" UUID,
  "status" "CourseSessionStatus" NOT NULL DEFAULT 'PLANNED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3)
);

CREATE UNIQUE INDEX IF NOT EXISTS "course_sessions_courseId_sequence_key"
  ON "course_sessions" ("courseId", "sequence");
CREATE INDEX IF NOT EXISTS "course_sessions_tenantId_courseId_idx"
  ON "course_sessions" ("tenantId", "courseId");
CREATE INDEX IF NOT EXISTS "course_sessions_tenantId_appointmentId_idx"
  ON "course_sessions" ("tenantId", "appointmentId");

ALTER TABLE "course_sessions"
  DROP CONSTRAINT IF EXISTS "course_sessions_tenantId_fkey";
ALTER TABLE "course_sessions"
  ADD CONSTRAINT "course_sessions_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "course_sessions"
  DROP CONSTRAINT IF EXISTS "course_sessions_courseId_fkey";
ALTER TABLE "course_sessions"
  ADD CONSTRAINT "course_sessions_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "treatment_courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "device_treatment_records" (
  "id" UUID PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  "deviceId" UUID,
  "deviceType" VARCHAR(80) NOT NULL,
  "clinicalServiceId" UUID NOT NULL,
  "bodyArea" VARCHAR(120),
  "parameterPayload" JSONB NOT NULL DEFAULT '{}',
  "parameterSchemaKey" VARCHAR(120) NOT NULL,
  "patientId" UUID NOT NULL,
  "providerId" UUID NOT NULL,
  "branchId" UUID,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "recordedBy" UUID NOT NULL,
  "beautyAnnotationId" UUID,
  "encounterId" UUID,
  "correctionReason" VARCHAR(500),
  "correctedAt" TIMESTAMP(3),
  "correctedBy" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3)
);

CREATE INDEX IF NOT EXISTS "device_treatment_records_tenantId_patientId_idx"
  ON "device_treatment_records" ("tenantId", "patientId");
CREATE INDEX IF NOT EXISTS "device_treatment_records_tenantId_clinicalServiceId_idx"
  ON "device_treatment_records" ("tenantId", "clinicalServiceId");
CREATE INDEX IF NOT EXISTS "device_treatment_records_tenantId_deviceType_idx"
  ON "device_treatment_records" ("tenantId", "deviceType");
CREATE INDEX IF NOT EXISTS "device_treatment_records_tenantId_encounterId_idx"
  ON "device_treatment_records" ("tenantId", "encounterId");

ALTER TABLE "device_treatment_records"
  DROP CONSTRAINT IF EXISTS "device_treatment_records_tenantId_fkey";
ALTER TABLE "device_treatment_records"
  ADD CONSTRAINT "device_treatment_records_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "device_treatment_records"
  DROP CONSTRAINT IF EXISTS "device_treatment_records_patientId_fkey";
ALTER TABLE "device_treatment_records"
  ADD CONSTRAINT "device_treatment_records_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Child/parent tenant integrity (Wave D Round 2 standard)
CREATE OR REPLACE FUNCTION enforce_course_session_tenant_integrity()
RETURNS TRIGGER AS $$
DECLARE
  course_tenant UUID;
  appt_tenant UUID;
BEGIN
  SELECT "tenantId" INTO course_tenant FROM "treatment_courses" WHERE "id" = NEW."courseId";
  IF course_tenant IS NULL THEN
    RAISE EXCEPTION 'course_sessions: course % not found', NEW."courseId"
      USING ERRCODE = '23503';
  END IF;
  IF course_tenant <> NEW."tenantId" THEN
    RAISE EXCEPTION 'course_sessions: tenantId must match course.tenantId'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."appointmentId" IS NOT NULL THEN
    SELECT "tenantId" INTO appt_tenant FROM "appointments" WHERE "id" = NEW."appointmentId";
    IF appt_tenant IS NULL THEN
      RAISE EXCEPTION 'course_sessions: appointment % not found', NEW."appointmentId"
        USING ERRCODE = '23503';
    END IF;
    IF appt_tenant <> NEW."tenantId" THEN
      RAISE EXCEPTION 'course_sessions: tenantId must match appointment.tenantId'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS course_sessions_tenant_integrity ON "course_sessions";
CREATE TRIGGER course_sessions_tenant_integrity
  BEFORE INSERT OR UPDATE ON "course_sessions"
  FOR EACH ROW EXECUTE FUNCTION enforce_course_session_tenant_integrity();

CREATE OR REPLACE FUNCTION enforce_device_treatment_record_tenant_integrity()
RETURNS TRIGGER AS $$
DECLARE
  patient_tenant UUID;
  provider_tenant UUID;
  service_tenant UUID;
  branch_tenant UUID;
  encounter_tenant UUID;
  annotation_tenant UUID;
BEGIN
  SELECT "tenantId" INTO patient_tenant FROM "patients" WHERE "id" = NEW."patientId";
  IF patient_tenant IS NULL THEN
    RAISE EXCEPTION 'device_treatment_records: patient % not found', NEW."patientId"
      USING ERRCODE = '23503';
  END IF;
  IF patient_tenant <> NEW."tenantId" THEN
    RAISE EXCEPTION 'device_treatment_records: tenantId must match patient.tenantId'
      USING ERRCODE = '23514';
  END IF;

  SELECT "tenantId" INTO provider_tenant FROM "users" WHERE "id" = NEW."providerId";
  IF provider_tenant IS NULL THEN
    RAISE EXCEPTION 'device_treatment_records: provider % not found', NEW."providerId"
      USING ERRCODE = '23503';
  END IF;
  IF provider_tenant <> NEW."tenantId" THEN
    RAISE EXCEPTION 'device_treatment_records: tenantId must match provider.tenantId'
      USING ERRCODE = '23514';
  END IF;

  SELECT "tenantId" INTO service_tenant FROM "canonical_clinical_service_definitions"
    WHERE "id" = NEW."clinicalServiceId";
  IF service_tenant IS NULL THEN
    -- SYSTEM_CANONICAL may have null tenantId; accept when row exists with null tenant
    IF NOT EXISTS (
      SELECT 1 FROM "canonical_clinical_service_definitions" WHERE "id" = NEW."clinicalServiceId"
    ) THEN
      RAISE EXCEPTION 'device_treatment_records: clinicalService % not found', NEW."clinicalServiceId"
        USING ERRCODE = '23503';
    END IF;
  ELSIF service_tenant <> NEW."tenantId" THEN
    RAISE EXCEPTION 'device_treatment_records: tenantId must match clinicalService.tenantId'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."branchId" IS NOT NULL THEN
    SELECT "tenantId" INTO branch_tenant FROM "branches" WHERE "id" = NEW."branchId";
    IF branch_tenant IS NULL THEN
      RAISE EXCEPTION 'device_treatment_records: branch % not found', NEW."branchId"
        USING ERRCODE = '23503';
    END IF;
    IF branch_tenant <> NEW."tenantId" THEN
      RAISE EXCEPTION 'device_treatment_records: tenantId must match branch.tenantId'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW."encounterId" IS NOT NULL THEN
    SELECT "tenantId" INTO encounter_tenant FROM "encounters" WHERE "id" = NEW."encounterId";
    IF encounter_tenant IS NULL THEN
      RAISE EXCEPTION 'device_treatment_records: encounter % not found', NEW."encounterId"
        USING ERRCODE = '23503';
    END IF;
    IF encounter_tenant <> NEW."tenantId" THEN
      RAISE EXCEPTION 'device_treatment_records: tenantId must match encounter.tenantId'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW."beautyAnnotationId" IS NOT NULL THEN
    SELECT "tenantId" INTO annotation_tenant FROM "beauty_annotations" WHERE "id" = NEW."beautyAnnotationId";
    IF annotation_tenant IS NULL THEN
      RAISE EXCEPTION 'device_treatment_records: beautyAnnotation % not found', NEW."beautyAnnotationId"
        USING ERRCODE = '23503';
    END IF;
    IF annotation_tenant <> NEW."tenantId" THEN
      RAISE EXCEPTION 'device_treatment_records: tenantId must match beautyAnnotation.tenantId'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS device_treatment_records_tenant_integrity ON "device_treatment_records";
CREATE TRIGGER device_treatment_records_tenant_integrity
  BEFORE INSERT OR UPDATE ON "device_treatment_records"
  FOR EACH ROW EXECUTE FUNCTION enforce_device_treatment_record_tenant_integrity();

CREATE OR REPLACE FUNCTION enforce_treatment_course_tenant_integrity()
RETURNS TRIGGER AS $$
DECLARE
  patient_tenant UUID;
  service_tenant UUID;
  price_tenant UUID;
BEGIN
  SELECT "tenantId" INTO patient_tenant FROM "patients" WHERE "id" = NEW."patientId";
  IF patient_tenant IS NULL THEN
    RAISE EXCEPTION 'treatment_courses: patient % not found', NEW."patientId"
      USING ERRCODE = '23503';
  END IF;
  IF patient_tenant <> NEW."tenantId" THEN
    RAISE EXCEPTION 'treatment_courses: tenantId must match patient.tenantId'
      USING ERRCODE = '23514';
  END IF;

  SELECT "tenantId" INTO service_tenant FROM "canonical_clinical_service_definitions"
    WHERE "id" = NEW."clinicalServiceId";
  IF service_tenant IS NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM "canonical_clinical_service_definitions" WHERE "id" = NEW."clinicalServiceId"
    ) THEN
      RAISE EXCEPTION 'treatment_courses: clinicalService % not found', NEW."clinicalServiceId"
        USING ERRCODE = '23503';
    END IF;
  ELSIF service_tenant <> NEW."tenantId" THEN
    RAISE EXCEPTION 'treatment_courses: tenantId must match clinicalService.tenantId'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."packagePriceVersionId" IS NOT NULL THEN
    SELECT "tenantId" INTO price_tenant FROM "clinical_service_price_versions"
      WHERE "id" = NEW."packagePriceVersionId";
    IF price_tenant IS NULL THEN
      RAISE EXCEPTION 'treatment_courses: packagePriceVersion % not found', NEW."packagePriceVersionId"
        USING ERRCODE = '23503';
    END IF;
    IF price_tenant <> NEW."tenantId" THEN
      RAISE EXCEPTION 'treatment_courses: tenantId must match packagePriceVersion.tenantId'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS treatment_courses_tenant_integrity ON "treatment_courses";
CREATE TRIGGER treatment_courses_tenant_integrity
  BEFORE INSERT OR UPDATE ON "treatment_courses"
  FOR EACH ROW EXECUTE FUNCTION enforce_treatment_course_tenant_integrity();

-- RLS
ALTER TABLE treatment_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_courses FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON treatment_courses;
CREATE POLICY tenant_select ON treatment_courses FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON treatment_courses;
CREATE POLICY tenant_insert ON treatment_courses FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON treatment_courses;
CREATE POLICY tenant_update ON treatment_courses FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON treatment_courses;
CREATE POLICY tenant_delete ON treatment_courses FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

ALTER TABLE course_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_sessions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON course_sessions;
CREATE POLICY tenant_select ON course_sessions FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON course_sessions;
CREATE POLICY tenant_insert ON course_sessions FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON course_sessions;
CREATE POLICY tenant_update ON course_sessions FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON course_sessions;
CREATE POLICY tenant_delete ON course_sessions FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

ALTER TABLE device_treatment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_treatment_records FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON device_treatment_records;
CREATE POLICY tenant_select ON device_treatment_records FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON device_treatment_records;
CREATE POLICY tenant_insert ON device_treatment_records FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON device_treatment_records;
CREATE POLICY tenant_update ON device_treatment_records FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON device_treatment_records;
CREATE POLICY tenant_delete ON device_treatment_records FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
