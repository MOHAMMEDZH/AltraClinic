-- Phase 48 Wave F Round 1 remediation (F5/F6)
-- Strengthen published plan immutability, accrual append-only settle whitelist,
-- and expanded tenant-ref checks for optional financial FKs.

CREATE OR REPLACE FUNCTION enforce_staff_commission_plan_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."status" = 'SUPERSEDED' THEN
    RAISE EXCEPTION 'staff_commission_plan_versions: SUPERSEDED plan immutable'
      USING ERRCODE = '23514';
  END IF;

  IF OLD."status" = 'ACTIVE' THEN
    IF NEW."percentage" IS DISTINCT FROM OLD."percentage"
      OR NEW."calculationBasis" IS DISTINCT FROM OLD."calculationBasis"
      OR NEW."earningTrigger" IS DISTINCT FROM OLD."earningTrigger"
      OR NEW."rateType" IS DISTINCT FROM OLD."rateType"
      OR NEW."userId" IS DISTINCT FROM OLD."userId"
      OR NEW."enabled" IS DISTINCT FROM OLD."enabled"
      OR NEW."effectiveFrom" IS DISTINCT FROM OLD."effectiveFrom"
      OR NEW."effectiveTo" IS DISTINCT FROM OLD."effectiveTo"
      OR NEW."branchId" IS DISTINCT FROM OLD."branchId"
      OR NEW."clinicalServiceId" IS DISTINCT FROM OLD."clinicalServiceId"
    THEN
      RAISE EXCEPTION 'staff_commission_plan_versions: ACTIVE plan immutable — publish a new version'
        USING ERRCODE = '23514';
    END IF;

    -- Only status ACTIVE→SUPERSEDED (+ supersededAt) is allowed after publish.
    IF NEW."status" IS DISTINCT FROM OLD."status" AND NEW."status" <> 'SUPERSEDED' THEN
      RAISE EXCEPTION 'staff_commission_plan_versions: ACTIVE plan may only transition to SUPERSEDED'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS staff_commission_plan_versions_immutability ON "staff_commission_plan_versions";
CREATE TRIGGER staff_commission_plan_versions_immutability
  BEFORE UPDATE ON "staff_commission_plan_versions"
  FOR EACH ROW EXECUTE FUNCTION enforce_staff_commission_plan_immutability();

CREATE OR REPLACE FUNCTION enforce_commission_accrual_tenant_refs()
RETURNS TRIGGER AS $$
DECLARE
  user_tenant UUID;
  perf_tenant UUID;
  plan_tenant UUID;
  created_tenant UUID;
  rev_tenant UUID;
  ref_tenant UUID;
BEGIN
  SELECT "tenantId" INTO user_tenant FROM "users" WHERE "id" = NEW."userId";
  IF user_tenant IS NULL OR user_tenant <> NEW."tenantId" THEN
    RAISE EXCEPTION 'commission_accruals: userId tenant mismatch' USING ERRCODE = '23514';
  END IF;
  SELECT "tenantId" INTO perf_tenant FROM "service_performances" WHERE "id" = NEW."servicePerformanceId";
  IF perf_tenant IS NULL OR perf_tenant <> NEW."tenantId" THEN
    RAISE EXCEPTION 'commission_accruals: servicePerformanceId tenant mismatch' USING ERRCODE = '23514';
  END IF;
  SELECT "tenantId" INTO plan_tenant FROM "staff_commission_plan_versions" WHERE "id" = NEW."commissionPlanVersionId";
  IF plan_tenant IS NULL OR plan_tenant <> NEW."tenantId" THEN
    RAISE EXCEPTION 'commission_accruals: commissionPlanVersionId tenant mismatch' USING ERRCODE = '23514';
  END IF;
  SELECT "tenantId" INTO created_tenant FROM "users" WHERE "id" = NEW."createdBy";
  IF created_tenant IS NULL OR created_tenant <> NEW."tenantId" THEN
    RAISE EXCEPTION 'commission_accruals: createdBy tenant mismatch' USING ERRCODE = '23514';
  END IF;
  IF NEW."reversalOfAccrualId" IS NOT NULL THEN
    SELECT "tenantId" INTO rev_tenant FROM "commission_accruals" WHERE "id" = NEW."reversalOfAccrualId";
    IF rev_tenant IS NULL OR rev_tenant <> NEW."tenantId" THEN
      RAISE EXCEPTION 'commission_accruals: reversalOfAccrualId tenant mismatch' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW."invoiceId" IS NOT NULL THEN
    SELECT "tenantId" INTO ref_tenant FROM "invoices" WHERE "id" = NEW."invoiceId";
    IF ref_tenant IS NULL OR ref_tenant <> NEW."tenantId" THEN
      RAISE EXCEPTION 'commission_accruals: invoiceId tenant mismatch' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW."invoiceLineId" IS NOT NULL THEN
    SELECT "tenantId" INTO ref_tenant FROM "invoice_line_items" WHERE "id" = NEW."invoiceLineId";
    IF ref_tenant IS NULL OR ref_tenant <> NEW."tenantId" THEN
      RAISE EXCEPTION 'commission_accruals: invoiceLineId tenant mismatch' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW."paymentId" IS NOT NULL THEN
    SELECT "tenantId" INTO ref_tenant FROM "invoice_payments" WHERE "id" = NEW."paymentId";
    IF ref_tenant IS NULL OR ref_tenant <> NEW."tenantId" THEN
      RAISE EXCEPTION 'commission_accruals: paymentId tenant mismatch' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW."refundId" IS NOT NULL THEN
    SELECT "tenantId" INTO ref_tenant FROM "invoice_refunds" WHERE "id" = NEW."refundId";
    IF ref_tenant IS NULL OR ref_tenant <> NEW."tenantId" THEN
      RAISE EXCEPTION 'commission_accruals: refundId tenant mismatch' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW."appointmentId" IS NOT NULL THEN
    SELECT "tenantId" INTO ref_tenant FROM "appointments" WHERE "id" = NEW."appointmentId";
    IF ref_tenant IS NULL OR ref_tenant <> NEW."tenantId" THEN
      RAISE EXCEPTION 'commission_accruals: appointmentId tenant mismatch' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW."branchId" IS NOT NULL THEN
    SELECT "tenantId" INTO ref_tenant FROM "branches" WHERE "id" = NEW."branchId";
    IF ref_tenant IS NULL OR ref_tenant <> NEW."tenantId" THEN
      RAISE EXCEPTION 'commission_accruals: branchId tenant mismatch' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW."clinicalServiceId" IS NOT NULL THEN
    SELECT "tenantId" INTO ref_tenant FROM "canonical_clinical_service_definitions" WHERE "id" = NEW."clinicalServiceId";
    -- SYSTEM_CANONICAL services may have null tenantId (readable); tenant-owned must match.
    IF ref_tenant IS NOT NULL AND ref_tenant <> NEW."tenantId" THEN
      RAISE EXCEPTION 'commission_accruals: clinicalServiceId tenant mismatch' USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM "canonical_clinical_service_definitions" WHERE "id" = NEW."clinicalServiceId"
    ) THEN
      RAISE EXCEPTION 'commission_accruals: clinicalServiceId missing' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW."snapshotRevisionId" IS NOT NULL THEN
    SELECT "tenantId" INTO ref_tenant FROM "appointment_service_snapshot_revisions" WHERE "id" = NEW."snapshotRevisionId";
    IF ref_tenant IS NULL OR ref_tenant <> NEW."tenantId" THEN
      RAISE EXCEPTION 'commission_accruals: snapshotRevisionId tenant mismatch' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS commission_accruals_tenant_refs ON "commission_accruals";
CREATE TRIGGER commission_accruals_tenant_refs
  BEFORE INSERT OR UPDATE ON "commission_accruals"
  FOR EACH ROW EXECUTE FUNCTION enforce_commission_accrual_tenant_refs();

-- Append-only: only EARNED→SETTLED may change status/settledAt/settlementReference; all else immutable.
CREATE OR REPLACE FUNCTION enforce_commission_accrual_append_only()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'commission_accruals: hard delete forbidden' USING ERRCODE = '23514';
  END IF;

  IF OLD."status" = 'REVERSED' THEN
    RAISE EXCEPTION 'commission_accruals: REVERSED row immutable' USING ERRCODE = '23514';
  END IF;

  IF OLD."status" = 'EARNED' AND NEW."status" = 'SETTLED' THEN
    IF NEW."id" IS DISTINCT FROM OLD."id"
      OR NEW."tenantId" IS DISTINCT FROM OLD."tenantId"
      OR NEW."branchId" IS DISTINCT FROM OLD."branchId"
      OR NEW."userId" IS DISTINCT FROM OLD."userId"
      OR NEW."servicePerformanceId" IS DISTINCT FROM OLD."servicePerformanceId"
      OR NEW."appointmentId" IS DISTINCT FROM OLD."appointmentId"
      OR NEW."clinicalServiceId" IS DISTINCT FROM OLD."clinicalServiceId"
      OR NEW."snapshotRevisionId" IS DISTINCT FROM OLD."snapshotRevisionId"
      OR NEW."invoiceId" IS DISTINCT FROM OLD."invoiceId"
      OR NEW."invoiceLineId" IS DISTINCT FROM OLD."invoiceLineId"
      OR NEW."paymentId" IS DISTINCT FROM OLD."paymentId"
      OR NEW."refundId" IS DISTINCT FROM OLD."refundId"
      OR NEW."commissionPlanVersionId" IS DISTINCT FROM OLD."commissionPlanVersionId"
      OR NEW."calculationBasis" IS DISTINCT FROM OLD."calculationBasis"
      OR NEW."attributedRevenueAmount" IS DISTINCT FROM OLD."attributedRevenueAmount"
      OR NEW."commissionPercent" IS DISTINCT FROM OLD."commissionPercent"
      OR NEW."commissionAmount" IS DISTINCT FROM OLD."commissionAmount"
      OR NEW."currency" IS DISTINCT FROM OLD."currency"
      OR NEW."earnedAt" IS DISTINCT FROM OLD."earnedAt"
      OR NEW."reversalOfAccrualId" IS DISTINCT FROM OLD."reversalOfAccrualId"
      OR NEW."idempotencyKey" IS DISTINCT FROM OLD."idempotencyKey"
      OR NEW."reason" IS DISTINCT FROM OLD."reason"
      OR NEW."createdBy" IS DISTINCT FROM OLD."createdBy"
      OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
    THEN
      RAISE EXCEPTION 'commission_accruals: only status/settledAt/settlementReference may change on settle'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'commission_accruals: append-only — only EARNED→SETTLED settle update allowed'
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS commission_accruals_append_only ON "commission_accruals";
CREATE TRIGGER commission_accruals_append_only
  BEFORE UPDATE OR DELETE ON "commission_accruals"
  FOR EACH ROW EXECUTE FUNCTION enforce_commission_accrual_append_only();
