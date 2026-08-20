-- =============================================================================
-- Database Triggers
-- Run after every `prisma migrate deploy` in all environments.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Audit entries immutability guard
--    Prevents any UPDATE or DELETE on audit_entries (append-only enforcement).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION
    'audit_entries is append-only. Operation % is forbidden on this table.',
    TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

DROP TRIGGER IF EXISTS audit_entries_immutable ON audit_entries;
CREATE TRIGGER audit_entries_immutable
  BEFORE UPDATE OR DELETE ON audit_entries
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

-- ---------------------------------------------------------------------------
-- 2. Appointment service snapshot revisions immutability (Wave B PA)
--    Escape hatch: SET LOCAL app.wave_b_snapshot_migration = 'true'
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_appointment_snapshot_revision_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('app.wave_b_snapshot_migration', true) = 'true' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION
    'appointment_service_snapshot_revisions is append-only. Operation % is forbidden.',
    TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

DROP TRIGGER IF EXISTS appointment_service_snapshot_revisions_immutable
  ON appointment_service_snapshot_revisions;
CREATE TRIGGER appointment_service_snapshot_revisions_immutable
  BEFORE UPDATE OR DELETE ON appointment_service_snapshot_revisions
  FOR EACH ROW EXECUTE FUNCTION prevent_appointment_snapshot_revision_mutation();

-- ---------------------------------------------------------------------------
-- 3. Appointment resource allocation tenant/branch association integrity
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_appointment_resource_allocation_integrity()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  appt_tenant UUID;
  res_tenant UUID;
  appt_branch UUID;
  res_branch UUID;
BEGIN
  SELECT "tenantId", "branchId" INTO appt_tenant, appt_branch
  FROM "appointments"
  WHERE "id" = NEW."appointmentId";

  IF appt_tenant IS NULL THEN
    RAISE EXCEPTION 'appointment_resource_allocations: appointment % not found', NEW."appointmentId"
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF appt_tenant <> NEW."tenantId" THEN
    RAISE EXCEPTION 'appointment_resource_allocations: tenantId must match appointment.tenantId'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT "tenantId", "branchId" INTO res_tenant, res_branch
  FROM "scheduling_resources"
  WHERE "id" = NEW."schedulingResourceId";

  IF res_tenant IS NULL THEN
    RAISE EXCEPTION 'appointment_resource_allocations: scheduling resource % not found', NEW."schedulingResourceId"
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF res_tenant <> NEW."tenantId" THEN
    RAISE EXCEPTION 'appointment_resource_allocations: tenantId must match scheduling_resources.tenantId'
      USING ERRCODE = 'check_violation';
  END IF;

  IF res_branch IS NOT NULL AND appt_branch IS NOT NULL AND res_branch <> appt_branch THEN
    RAISE EXCEPTION 'appointment_resource_allocations: branch mismatch between appointment and resource'
      USING ERRCODE = 'check_violation';
  END IF;

  IF res_branch IS NOT NULL AND appt_branch IS NULL THEN
    RAISE EXCEPTION 'appointment_resource_allocations: branch-scoped resource requires appointment.branchId'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appointment_resource_allocations_integrity
  ON appointment_resource_allocations;
CREATE TRIGGER appointment_resource_allocations_integrity
  BEFORE INSERT OR UPDATE ON appointment_resource_allocations
  FOR EACH ROW EXECUTE FUNCTION enforce_appointment_resource_allocation_integrity();

-- ---------------------------------------------------------------------------
-- 4. Appointment.snapshotWriteMode immutability (Wave B provenance)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_appointment_snapshot_write_mode_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."snapshotWriteMode" IS DISTINCT FROM NEW."snapshotWriteMode" THEN
    RAISE EXCEPTION 'appointments.snapshotWriteMode is immutable after insert'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appointments_snapshot_write_mode_immutable ON appointments;
CREATE TRIGGER appointments_snapshot_write_mode_immutable
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION prevent_appointment_snapshot_write_mode_mutation();

-- ---------------------------------------------------------------------------
-- 5. Inventory usage ledger append-only (Wave C · AR-20)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_inventory_usage_ledger_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  invoice_link_changed boolean;
  clinical_changed boolean;
  allow_invoice_link boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'inventory_consumption_logs is append-only. DELETE is forbidden.'
      USING ERRCODE = 'restrict_violation';
  END IF;

  invoice_link_changed :=
    NEW."invoiceId" IS DISTINCT FROM OLD."invoiceId"
    OR NEW."invoiceLineItemId" IS DISTINCT FROM OLD."invoiceLineItemId";

  allow_invoice_link :=
    coalesce(current_setting('app.allow_inventory_usage_invoice_link', true), '') = 'true';

  -- Invoice linkage is post-posting billing metadata (not clinical truth).
  -- Mutations allowed ONLY when trusted billing path sets the session flag.
  IF invoice_link_changed AND NOT allow_invoice_link THEN
    RAISE EXCEPTION 'inventory_consumption_logs invoice linkage may only change via trusted billing path'
      USING ERRCODE = 'restrict_violation';
  END IF;

  clinical_changed :=
       NEW."tenantId" IS DISTINCT FROM OLD."tenantId"
    OR NEW."inventoryItemId" IS DISTINCT FROM OLD."inventoryItemId"
    OR NEW."inventoryBatchId" IS DISTINCT FROM OLD."inventoryBatchId"
    OR NEW."quantityUsed" IS DISTINCT FROM OLD."quantityUsed"
    OR NEW."usageType" IS DISTINCT FROM OLD."usageType"
    OR NEW."usedByUserId" IS DISTINCT FROM OLD."usedByUserId"
    OR NEW."recordedByUserId" IS DISTINCT FROM OLD."recordedByUserId"
    OR NEW."consumedBy" IS DISTINCT FROM OLD."consumedBy"
    OR NEW."sourceStockMovementId" IS DISTINCT FROM OLD."sourceStockMovementId"
    OR NEW."reversalOfUsageId" IS DISTINCT FROM OLD."reversalOfUsageId"
    OR NEW."patientId" IS DISTINCT FROM OLD."patientId"
    OR NEW."encounterId" IS DISTINCT FROM OLD."encounterId"
    OR NEW."appointmentId" IS DISTINCT FROM OLD."appointmentId"
    OR NEW."clinicalServiceId" IS DISTINCT FROM OLD."clinicalServiceId"
    OR NEW."warehouseId" IS DISTINCT FROM OLD."warehouseId"
    OR NEW."branchId" IS DISTINCT FROM OLD."branchId"
    OR NEW."unit" IS DISTINCT FROM OLD."unit"
    OR NEW."reasonCode" IS DISTINCT FROM OLD."reasonCode"
    OR NEW."occurredAt" IS DISTINCT FROM OLD."occurredAt"
    OR NEW."attributionStatus" IS DISTINCT FROM OLD."attributionStatus"
    OR NEW."procedureCode" IS DISTINCT FROM OLD."procedureCode"
    OR NEW."beautyAnnotationId" IS DISTINCT FROM OLD."beautyAnnotationId"
    OR NEW."notes" IS DISTINCT FROM OLD."notes"
    OR NEW."consumedAt" IS DISTINCT FROM OLD."consumedAt"
    OR NEW."recordedAt" IS DISTINCT FROM OLD."recordedAt";

  IF OLD."status" = 'REVERSED' THEN
    -- Reversed clinical truth is immutable; invoice unlink may still clear linkage.
    IF clinical_changed OR NEW."status" IS DISTINCT FROM OLD."status" THEN
      RAISE EXCEPTION 'inventory_consumption_logs reversed rows are immutable'
        USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD."status" = 'POSTED' THEN
    IF NEW."status" IS DISTINCT FROM OLD."status"
       AND NOT (OLD."status" = 'POSTED' AND NEW."status" = 'REVERSED') THEN
      RAISE EXCEPTION 'inventory_consumption_logs status transition % → % forbidden',
        OLD."status", NEW."status"
        USING ERRCODE = 'restrict_violation';
    END IF;

    IF clinical_changed THEN
      RAISE EXCEPTION 'inventory_consumption_logs posted critical fields are immutable'
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inventory_consumption_logs_append_only ON inventory_consumption_logs;
CREATE TRIGGER inventory_consumption_logs_append_only
  BEFORE UPDATE OR DELETE ON inventory_consumption_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_inventory_usage_ledger_mutation();

-- ---------------------------------------------------------------------------
-- 5b. Injectable usage detail append-only (Wave C · AR-11)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_injectable_usage_detail_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'injectable_usage_details is append-only. DELETE is forbidden.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RAISE EXCEPTION 'injectable_usage_details is append-only. UPDATE is forbidden.'
    USING ERRCODE = 'restrict_violation';
END;
$$;

DROP TRIGGER IF EXISTS injectable_usage_details_append_only ON injectable_usage_details;
CREATE TRIGGER injectable_usage_details_append_only
  BEFORE UPDATE OR DELETE ON injectable_usage_details
  FOR EACH ROW EXECUTE FUNCTION prevent_injectable_usage_detail_mutation();

-- ---------------------------------------------------------------------------
-- 6. Clinical form version immutability after PUBLISHED (Wave C · AR-09)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_clinical_form_version_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" = 'PUBLISHED' OR OLD."status" = 'SUPERSEDED' THEN
      RAISE EXCEPTION 'clinical_form_versions: DELETE forbidden after publish'
        USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD."status" = 'PUBLISHED' OR OLD."status" = 'SUPERSEDED' THEN
    IF OLD."status" = 'PUBLISHED'
       AND NEW."status" = 'SUPERSEDED'
       AND NEW."contentEn" IS NOT DISTINCT FROM OLD."contentEn"
       AND NEW."contentAr" IS NOT DISTINCT FROM OLD."contentAr"
       AND NEW."version" IS NOT DISTINCT FROM OLD."version"
       AND NEW."templateId" IS NOT DISTINCT FROM OLD."templateId"
       AND NEW."publishedAt" IS NOT DISTINCT FROM OLD."publishedAt"
       AND NEW."publishedByUserId" IS NOT DISTINCT FROM OLD."publishedByUserId"
    THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'clinical_form_versions content is immutable after PUBLISHED'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clinical_form_versions_immutable ON clinical_form_versions;
CREATE TRIGGER clinical_form_versions_immutable
  BEFORE UPDATE OR DELETE ON clinical_form_versions
  FOR EACH ROW EXECUTE FUNCTION prevent_clinical_form_version_mutation();

-- ---------------------------------------------------------------------------
-- 7. Patient form instance signed immutability (Wave C · AR-09)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_patient_form_instance_signed_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Once ever signed (signedAt set) or currently SIGNED/VOID, historical evidence is retained.
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" IN ('SIGNED', 'VOID') OR OLD."signedAt" IS NOT NULL THEN
      RAISE EXCEPTION 'patient_form_instances: DELETE forbidden after signed history'
        USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD."status" = 'VOID' OR (OLD."signedAt" IS NOT NULL AND OLD."status" <> 'SIGNED') THEN
    RAISE EXCEPTION 'patient_form_instances voided/signed history is immutable'
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF OLD."status" = 'SIGNED' OR OLD."signedAt" IS NOT NULL THEN
    IF NEW."status" = 'VOID'
       AND OLD."status" = 'SIGNED'
       AND NEW."signedContentEn" IS NOT DISTINCT FROM OLD."signedContentEn"
       AND NEW."signedContentAr" IS NOT DISTINCT FROM OLD."signedContentAr"
       AND NEW."versionId" IS NOT DISTINCT FROM OLD."versionId"
       AND NEW."patientId" IS NOT DISTINCT FROM OLD."patientId"
       AND NEW."signedAt" IS NOT DISTINCT FROM OLD."signedAt"
       AND NEW."signerUserId" IS NOT DISTINCT FROM OLD."signerUserId"
       AND NEW."signerPatientId" IS NOT DISTINCT FROM OLD."signerPatientId"
       AND NEW."method" IS NOT DISTINCT FROM OLD."method"
       AND NEW."tenantId" IS NOT DISTINCT FROM OLD."tenantId"
       AND NEW."appointmentId" IS NOT DISTINCT FROM OLD."appointmentId"
       AND NEW."clinicalServiceId" IS NOT DISTINCT FROM OLD."clinicalServiceId"
       AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt"
       AND NEW."createdByUserId" IS NOT DISTINCT FROM OLD."createdByUserId"
       AND NEW."voidReason" IS NOT NULL
       AND length(trim(NEW."voidReason")) > 0
       AND NEW."voidedAt" IS NOT NULL
       AND NEW."voidedByUserId" IS NOT NULL
    THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'patient_form_instances signed snapshot is immutable'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS patient_form_instances_signed_immutable ON patient_form_instances;
CREATE TRIGGER patient_form_instances_signed_immutable
  BEFORE UPDATE OR DELETE ON patient_form_instances
  FOR EACH ROW EXECUTE FUNCTION prevent_patient_form_instance_signed_mutation();

-- ---------------------------------------------------------------------------
-- Wave D — ServicePerformance COMPLETED immutability (AR-21)
-- Escape hatch: SET LOCAL app.wave_d_performance_correction = 'true'
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

-- ---------------------------------------------------------------------------
-- 6. Wave D Round 2 — child/parent tenant consistency
-- ---------------------------------------------------------------------------
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

RAISE NOTICE 'Triggers applied successfully.';
