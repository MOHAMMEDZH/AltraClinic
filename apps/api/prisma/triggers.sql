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

RAISE NOTICE 'Triggers applied successfully.';
