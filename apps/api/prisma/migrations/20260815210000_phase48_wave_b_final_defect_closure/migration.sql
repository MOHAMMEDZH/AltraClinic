-- Phase 48 Wave B — final defect closure (additive)
-- WB-PA-03 idempotency ownership/CAS; WB-PA-05 allocation association integrity

-- Idempotency ownership / CAS reclaim
ALTER TABLE "portal_scheduling_idempotency_ledger"
  ADD COLUMN IF NOT EXISTS "attemptVersion" BIGINT NOT NULL DEFAULT 0;

ALTER TABLE "portal_scheduling_idempotency_ledger"
  ADD COLUMN IF NOT EXISTS "ownerToken" UUID;

UPDATE "portal_scheduling_idempotency_ledger"
SET "ownerToken" = gen_random_uuid()
WHERE "ownerToken" IS NULL AND "status" = 'IN_PROGRESS';

CREATE INDEX IF NOT EXISTS "portal_scheduling_idempotency_ledger_ownerToken_idx"
  ON "portal_scheduling_idempotency_ledger"("ownerToken");

-- AppointmentResourceAllocation cross-tenant association integrity (DB-level)
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
  ON "appointment_resource_allocations";
CREATE TRIGGER appointment_resource_allocations_integrity
  BEFORE INSERT OR UPDATE ON "appointment_resource_allocations"
  FOR EACH ROW EXECUTE FUNCTION enforce_appointment_resource_allocation_integrity();
