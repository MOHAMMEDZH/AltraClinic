-- Phase 48 Wave D Round 2 — child/parent tenant consistency (DB-enforced)
-- Rejects mixed-tenant parent references even when child.tenantId matches current tenant.

CREATE OR REPLACE FUNCTION enforce_treatment_plan_item_appointment_tenant_integrity()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  item_tenant UUID;
  appt_tenant UUID;
BEGIN
  SELECT "tenantId" INTO item_tenant FROM "treatment_plan_items" WHERE "id" = NEW."planItemId";
  IF item_tenant IS NULL THEN
    RAISE EXCEPTION 'treatment_plan_item_appointments: planItem % not found', NEW."planItemId"
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF item_tenant <> NEW."tenantId" THEN
    RAISE EXCEPTION 'treatment_plan_item_appointments: tenantId must match planItem.tenantId'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT "tenantId" INTO appt_tenant FROM "appointments" WHERE "id" = NEW."appointmentId";
  IF appt_tenant IS NULL THEN
    RAISE EXCEPTION 'treatment_plan_item_appointments: appointment % not found', NEW."appointmentId"
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF appt_tenant <> NEW."tenantId" THEN
    RAISE EXCEPTION 'treatment_plan_item_appointments: tenantId must match appointment.tenantId'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS treatment_plan_item_appointments_tenant_integrity
  ON "treatment_plan_item_appointments";
CREATE TRIGGER treatment_plan_item_appointments_tenant_integrity
  BEFORE INSERT OR UPDATE ON "treatment_plan_item_appointments"
  FOR EACH ROW EXECUTE FUNCTION enforce_treatment_plan_item_appointment_tenant_integrity();

CREATE OR REPLACE FUNCTION enforce_dental_lab_case_attachment_tenant_integrity()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  case_tenant UUID;
  media_tenant UUID;
BEGIN
  SELECT "tenantId" INTO case_tenant FROM "dental_lab_cases" WHERE "id" = NEW."labCaseId";
  IF case_tenant IS NULL THEN
    RAISE EXCEPTION 'dental_lab_case_attachments: labCase % not found', NEW."labCaseId"
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF case_tenant <> NEW."tenantId" THEN
    RAISE EXCEPTION 'dental_lab_case_attachments: tenantId must match labCase.tenantId'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT "tenantId" INTO media_tenant FROM "media_assets" WHERE "id" = NEW."mediaAssetId";
  IF media_tenant IS NULL THEN
    RAISE EXCEPTION 'dental_lab_case_attachments: mediaAsset % not found', NEW."mediaAssetId"
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF media_tenant <> NEW."tenantId" THEN
    RAISE EXCEPTION 'dental_lab_case_attachments: tenantId must match mediaAsset.tenantId'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dental_lab_case_attachments_tenant_integrity
  ON "dental_lab_case_attachments";
CREATE TRIGGER dental_lab_case_attachments_tenant_integrity
  BEFORE INSERT OR UPDATE ON "dental_lab_case_attachments"
  FOR EACH ROW EXECUTE FUNCTION enforce_dental_lab_case_attachment_tenant_integrity();

CREATE OR REPLACE FUNCTION enforce_service_performance_participant_tenant_integrity()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  perf_tenant UUID;
  user_tenant UUID;
BEGIN
  SELECT "tenantId" INTO perf_tenant FROM "service_performances" WHERE "id" = NEW."performanceId";
  IF perf_tenant IS NULL THEN
    RAISE EXCEPTION 'service_performance_participants: performance % not found', NEW."performanceId"
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF perf_tenant <> NEW."tenantId" THEN
    RAISE EXCEPTION 'service_performance_participants: tenantId must match performance.tenantId'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT "tenantId" INTO user_tenant FROM "users" WHERE "id" = NEW."userId";
  IF user_tenant IS NULL THEN
    RAISE EXCEPTION 'service_performance_participants: user % not found', NEW."userId"
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF user_tenant <> NEW."tenantId" THEN
    RAISE EXCEPTION 'service_performance_participants: tenantId must match user.tenantId'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS service_performance_participants_tenant_integrity
  ON "service_performance_participants";
CREATE TRIGGER service_performance_participants_tenant_integrity
  BEFORE INSERT OR UPDATE ON "service_performance_participants"
  FOR EACH ROW EXECUTE FUNCTION enforce_service_performance_participant_tenant_integrity();

CREATE OR REPLACE FUNCTION enforce_service_performance_correction_tenant_integrity()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  perf_tenant UUID;
  actor_tenant UUID;
BEGIN
  SELECT "tenantId" INTO perf_tenant FROM "service_performances" WHERE "id" = NEW."performanceId";
  IF perf_tenant IS NULL THEN
    RAISE EXCEPTION 'service_performance_corrections: performance % not found', NEW."performanceId"
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF perf_tenant <> NEW."tenantId" THEN
    RAISE EXCEPTION 'service_performance_corrections: tenantId must match performance.tenantId'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT "tenantId" INTO actor_tenant FROM "users" WHERE "id" = NEW."actorId";
  IF actor_tenant IS NULL THEN
    RAISE EXCEPTION 'service_performance_corrections: actor % not found', NEW."actorId"
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF actor_tenant <> NEW."tenantId" THEN
    RAISE EXCEPTION 'service_performance_corrections: tenantId must match actor.tenantId'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS service_performance_corrections_tenant_integrity
  ON "service_performance_corrections";
CREATE TRIGGER service_performance_corrections_tenant_integrity
  BEFORE INSERT OR UPDATE ON "service_performance_corrections"
  FOR EACH ROW EXECUTE FUNCTION enforce_service_performance_correction_tenant_integrity();
