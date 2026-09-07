-- Phase 48 Wave E Round 1 remediation
-- Accountability DB tenant integrity + opaque deviceId + strengthen device trigger.

-- E3-E: deviceId is opaque external identifier (not UUID FK)
ALTER TABLE "device_treatment_records"
  ALTER COLUMN "deviceId" TYPE VARCHAR(120) USING ("deviceId"::text);

-- E5: Accountability refs — createdBy / recordedBy / correctedBy tenant integrity
CREATE OR REPLACE FUNCTION enforce_treatment_course_accountability_tenant()
RETURNS TRIGGER AS $$
DECLARE
  creator_tenant UUID;
BEGIN
  SELECT "tenantId" INTO creator_tenant FROM "users" WHERE "id" = NEW."createdBy";
  IF creator_tenant IS NULL THEN
    RAISE EXCEPTION 'treatment_courses: createdBy % not found', NEW."createdBy"
      USING ERRCODE = '23503';
  END IF;
  IF creator_tenant <> NEW."tenantId" THEN
    RAISE EXCEPTION 'treatment_courses: tenantId must match createdBy.tenantId'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS treatment_courses_accountability_tenant ON "treatment_courses";
CREATE TRIGGER treatment_courses_accountability_tenant
  BEFORE INSERT OR UPDATE ON "treatment_courses"
  FOR EACH ROW EXECUTE FUNCTION enforce_treatment_course_accountability_tenant();

CREATE OR REPLACE FUNCTION enforce_device_treatment_accountability_tenant()
RETURNS TRIGGER AS $$
DECLARE
  recorded_tenant UUID;
  corrected_tenant UUID;
BEGIN
  SELECT "tenantId" INTO recorded_tenant FROM "users" WHERE "id" = NEW."recordedBy";
  IF recorded_tenant IS NULL THEN
    RAISE EXCEPTION 'device_treatment_records: recordedBy % not found', NEW."recordedBy"
      USING ERRCODE = '23503';
  END IF;
  IF recorded_tenant <> NEW."tenantId" THEN
    RAISE EXCEPTION 'device_treatment_records: tenantId must match recordedBy.tenantId'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."correctedBy" IS NOT NULL THEN
    SELECT "tenantId" INTO corrected_tenant FROM "users" WHERE "id" = NEW."correctedBy";
    IF corrected_tenant IS NULL THEN
      RAISE EXCEPTION 'device_treatment_records: correctedBy % not found', NEW."correctedBy"
        USING ERRCODE = '23503';
    END IF;
    IF corrected_tenant <> NEW."tenantId" THEN
      RAISE EXCEPTION 'device_treatment_records: tenantId must match correctedBy.tenantId'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS device_treatment_records_accountability_tenant ON "device_treatment_records";
CREATE TRIGGER device_treatment_records_accountability_tenant
  BEFORE INSERT OR UPDATE ON "device_treatment_records"
  FOR EACH ROW EXECUTE FUNCTION enforce_device_treatment_accountability_tenant();
