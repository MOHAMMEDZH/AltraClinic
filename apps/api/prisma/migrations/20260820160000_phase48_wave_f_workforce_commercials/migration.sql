-- Phase 48 Wave F — Workforce Commercials (AR-22 / P1-14)
-- Upgrade from frozen Wave E checkpoint. Additive; preserves legacy commission_* tables.
-- commissionEnabled default OFF; no fabricated historical accruals.

-- User eligibility (default OFF)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "commissionEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "defaultCommissionPercent" DECIMAL(5,2);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "commissionEffectiveFrom" DATE;

DO $$ BEGIN
  CREATE TYPE "staff_commission_plan_status" AS ENUM ('DRAFT', 'ACTIVE', 'SUPERSEDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "commission_calculation_basis" AS ENUM (
    'SERVICE_GROSS',
    'SERVICE_NET_AFTER_DISCOUNT',
    'SERVICE_NET_EXCLUDING_TAX',
    'COLLECTED_REVENUE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "commission_earning_trigger" AS ENUM (
    'INVOICE_OR_CHARGE_FINALIZED',
    'PAYMENT_COLLECTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "commission_accrual_status" AS ENUM ('PENDING', 'EARNED', 'SETTLED', 'REVERSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "staff_commission_plan_versions" (
  "id" UUID PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "branchId" UUID,
  "clinicalServiceId" UUID,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "percentage" DECIMAL(5,2) NOT NULL,
  "rateType" "commission_rate_type" NOT NULL DEFAULT 'PERCENTAGE',
  "calculationBasis" "commission_calculation_basis" NOT NULL DEFAULT 'SERVICE_NET_AFTER_DISCOUNT',
  "earningTrigger" "commission_earning_trigger" NOT NULL DEFAULT 'INVOICE_OR_CHARGE_FINALIZED',
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  "status" "staff_commission_plan_status" NOT NULL DEFAULT 'DRAFT',
  "createdBy" UUID NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "publishedBy" UUID,
  "supersededAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "staff_commission_plan_versions_percentage_chk"
    CHECK ("percentage" >= 0 AND "percentage" <= 100)
);

CREATE INDEX IF NOT EXISTS "staff_commission_plan_versions_tenantId_userId_status_idx"
  ON "staff_commission_plan_versions" ("tenantId", "userId", "status");
CREATE INDEX IF NOT EXISTS "staff_commission_plan_versions_tenantId_effectiveFrom_idx"
  ON "staff_commission_plan_versions" ("tenantId", "effectiveFrom");
CREATE INDEX IF NOT EXISTS "staff_commission_plan_versions_tenantId_branchId_idx"
  ON "staff_commission_plan_versions" ("tenantId", "branchId");
CREATE INDEX IF NOT EXISTS "staff_commission_plan_versions_tenantId_clinicalServiceId_idx"
  ON "staff_commission_plan_versions" ("tenantId", "clinicalServiceId");

ALTER TABLE "staff_commission_plan_versions"
  DROP CONSTRAINT IF EXISTS "staff_commission_plan_versions_tenantId_fkey";
ALTER TABLE "staff_commission_plan_versions"
  ADD CONSTRAINT "staff_commission_plan_versions_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "staff_commission_plan_versions"
  DROP CONSTRAINT IF EXISTS "staff_commission_plan_versions_userId_fkey";
ALTER TABLE "staff_commission_plan_versions"
  ADD CONSTRAINT "staff_commission_plan_versions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "commission_accruals" (
  "id" UUID PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  "branchId" UUID,
  "userId" UUID NOT NULL,
  "servicePerformanceId" UUID NOT NULL,
  "appointmentId" UUID,
  "clinicalServiceId" UUID NOT NULL,
  "snapshotRevisionId" UUID,
  "invoiceId" UUID,
  "invoiceLineId" UUID,
  "paymentId" UUID,
  "refundId" UUID,
  "commissionPlanVersionId" UUID NOT NULL,
  "calculationBasis" "commission_calculation_basis" NOT NULL,
  "attributedRevenueAmount" DECIMAL(18,4) NOT NULL,
  "commissionPercent" DECIMAL(5,2) NOT NULL,
  "commissionAmount" DECIMAL(18,4) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "status" "commission_accrual_status" NOT NULL DEFAULT 'EARNED',
  "earnedAt" TIMESTAMP(3),
  "settledAt" TIMESTAMP(3),
  "settlementReference" VARCHAR(255),
  "reversalOfAccrualId" UUID,
  "idempotencyKey" VARCHAR(200) NOT NULL,
  "reason" TEXT,
  "createdBy" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "commission_accruals_tenantId_idempotencyKey_key"
  ON "commission_accruals" ("tenantId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "commission_accruals_tenantId_userId_status_idx"
  ON "commission_accruals" ("tenantId", "userId", "status");
CREATE INDEX IF NOT EXISTS "commission_accruals_tenantId_servicePerformanceId_idx"
  ON "commission_accruals" ("tenantId", "servicePerformanceId");
CREATE INDEX IF NOT EXISTS "commission_accruals_tenantId_invoiceLineId_idx"
  ON "commission_accruals" ("tenantId", "invoiceLineId");
CREATE INDEX IF NOT EXISTS "commission_accruals_tenantId_commissionPlanVersionId_idx"
  ON "commission_accruals" ("tenantId", "commissionPlanVersionId");
CREATE INDEX IF NOT EXISTS "commission_accruals_tenantId_reversalOfAccrualId_idx"
  ON "commission_accruals" ("tenantId", "reversalOfAccrualId");

ALTER TABLE "commission_accruals"
  DROP CONSTRAINT IF EXISTS "commission_accruals_tenantId_fkey";
ALTER TABLE "commission_accruals"
  ADD CONSTRAINT "commission_accruals_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commission_accruals"
  DROP CONSTRAINT IF EXISTS "commission_accruals_userId_fkey";
ALTER TABLE "commission_accruals"
  ADD CONSTRAINT "commission_accruals_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commission_accruals"
  DROP CONSTRAINT IF EXISTS "commission_accruals_servicePerformanceId_fkey";
ALTER TABLE "commission_accruals"
  ADD CONSTRAINT "commission_accruals_servicePerformanceId_fkey"
  FOREIGN KEY ("servicePerformanceId") REFERENCES "service_performances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commission_accruals"
  DROP CONSTRAINT IF EXISTS "commission_accruals_commissionPlanVersionId_fkey";
ALTER TABLE "commission_accruals"
  ADD CONSTRAINT "commission_accruals_commissionPlanVersionId_fkey"
  FOREIGN KEY ("commissionPlanVersionId") REFERENCES "staff_commission_plan_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commission_accruals"
  DROP CONSTRAINT IF EXISTS "commission_accruals_reversalOfAccrualId_fkey";
ALTER TABLE "commission_accruals"
  ADD CONSTRAINT "commission_accruals_reversalOfAccrualId_fkey"
  FOREIGN KEY ("reversalOfAccrualId") REFERENCES "commission_accruals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Child/parent tenant integrity: plan.user same tenant
CREATE OR REPLACE FUNCTION enforce_staff_commission_plan_tenant_refs()
RETURNS TRIGGER AS $$
DECLARE
  user_tenant UUID;
  branch_tenant UUID;
  svc_tenant UUID;
  created_tenant UUID;
  published_tenant UUID;
BEGIN
  SELECT "tenantId" INTO user_tenant FROM "users" WHERE "id" = NEW."userId";
  IF user_tenant IS NULL OR user_tenant <> NEW."tenantId" THEN
    RAISE EXCEPTION 'staff_commission_plan_versions: userId tenant mismatch'
      USING ERRCODE = '23514';
  END IF;
  SELECT "tenantId" INTO created_tenant FROM "users" WHERE "id" = NEW."createdBy";
  IF created_tenant IS NULL OR created_tenant <> NEW."tenantId" THEN
    RAISE EXCEPTION 'staff_commission_plan_versions: createdBy tenant mismatch'
      USING ERRCODE = '23514';
  END IF;
  IF NEW."publishedBy" IS NOT NULL THEN
    SELECT "tenantId" INTO published_tenant FROM "users" WHERE "id" = NEW."publishedBy";
    IF published_tenant IS NULL OR published_tenant <> NEW."tenantId" THEN
      RAISE EXCEPTION 'staff_commission_plan_versions: publishedBy tenant mismatch'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW."branchId" IS NOT NULL THEN
    SELECT "tenantId" INTO branch_tenant FROM "branches" WHERE "id" = NEW."branchId";
    IF branch_tenant IS NULL OR branch_tenant <> NEW."tenantId" THEN
      RAISE EXCEPTION 'staff_commission_plan_versions: branchId tenant mismatch'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW."clinicalServiceId" IS NOT NULL THEN
    SELECT "tenantId" INTO svc_tenant FROM "canonical_clinical_service_definitions" WHERE "id" = NEW."clinicalServiceId";
    IF svc_tenant IS NOT NULL AND svc_tenant <> NEW."tenantId" THEN
      RAISE EXCEPTION 'staff_commission_plan_versions: clinicalServiceId tenant mismatch'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS staff_commission_plan_versions_tenant_refs ON "staff_commission_plan_versions";
CREATE TRIGGER staff_commission_plan_versions_tenant_refs
  BEFORE INSERT OR UPDATE ON "staff_commission_plan_versions"
  FOR EACH ROW EXECUTE FUNCTION enforce_staff_commission_plan_tenant_refs();

-- Published plans immutable except supersede path fields
CREATE OR REPLACE FUNCTION enforce_staff_commission_plan_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."status" = 'ACTIVE' AND NEW."status" = 'ACTIVE' THEN
    IF NEW."percentage" IS DISTINCT FROM OLD."percentage"
      OR NEW."calculationBasis" IS DISTINCT FROM OLD."calculationBasis"
      OR NEW."earningTrigger" IS DISTINCT FROM OLD."earningTrigger"
      OR NEW."rateType" IS DISTINCT FROM OLD."rateType"
      OR NEW."userId" IS DISTINCT FROM OLD."userId"
      OR NEW."enabled" IS DISTINCT FROM OLD."enabled"
      OR NEW."effectiveFrom" IS DISTINCT FROM OLD."effectiveFrom"
      OR NEW."branchId" IS DISTINCT FROM OLD."branchId"
      OR NEW."clinicalServiceId" IS DISTINCT FROM OLD."clinicalServiceId"
    THEN
      RAISE EXCEPTION 'staff_commission_plan_versions: ACTIVE plan immutable — publish a new version'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  IF OLD."status" = 'SUPERSEDED' THEN
    RAISE EXCEPTION 'staff_commission_plan_versions: SUPERSEDED plan immutable'
      USING ERRCODE = '23514';
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
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS commission_accruals_tenant_refs ON "commission_accruals";
CREATE TRIGGER commission_accruals_tenant_refs
  BEFORE INSERT OR UPDATE ON "commission_accruals"
  FOR EACH ROW EXECUTE FUNCTION enforce_commission_accrual_tenant_refs();

-- Append-only amounts; allow only EARNED -> SETTLED settle fields
CREATE OR REPLACE FUNCTION enforce_commission_accrual_append_only()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'commission_accruals: hard delete forbidden' USING ERRCODE = '23514';
  END IF;
  IF OLD."status" = 'REVERSED' THEN
    RAISE EXCEPTION 'commission_accruals: REVERSED row immutable' USING ERRCODE = '23514';
  END IF;
  IF OLD."commissionAmount" IS DISTINCT FROM NEW."commissionAmount"
    OR OLD."attributedRevenueAmount" IS DISTINCT FROM NEW."attributedRevenueAmount"
    OR OLD."commissionPercent" IS DISTINCT FROM NEW."commissionPercent"
    OR OLD."commissionPlanVersionId" IS DISTINCT FROM NEW."commissionPlanVersionId"
    OR OLD."userId" IS DISTINCT FROM NEW."userId"
    OR OLD."servicePerformanceId" IS DISTINCT FROM NEW."servicePerformanceId"
    OR OLD."idempotencyKey" IS DISTINCT FROM NEW."idempotencyKey"
    OR OLD."reversalOfAccrualId" IS DISTINCT FROM NEW."reversalOfAccrualId"
  THEN
    RAISE EXCEPTION 'commission_accruals: financial fields immutable — reverse + re-post'
      USING ERRCODE = '23514';
  END IF;
  IF OLD."status" = 'EARNED' AND NEW."status" = 'SETTLED' THEN
    RETURN NEW;
  END IF;
  IF OLD."status" IS DISTINCT FROM NEW."status"
    OR OLD."settledAt" IS DISTINCT FROM NEW."settledAt"
    OR OLD."settlementReference" IS DISTINCT FROM NEW."settlementReference"
  THEN
    IF NOT (OLD."status" = 'EARNED' AND NEW."status" = 'SETTLED') THEN
      RAISE EXCEPTION 'commission_accruals: only EARNED→SETTLED status transition allowed on update'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS commission_accruals_append_only ON "commission_accruals";
CREATE TRIGGER commission_accruals_append_only
  BEFORE UPDATE OR DELETE ON "commission_accruals"
  FOR EACH ROW EXECUTE FUNCTION enforce_commission_accrual_append_only();

-- RLS
ALTER TABLE staff_commission_plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_commission_plan_versions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON staff_commission_plan_versions;
CREATE POLICY tenant_select ON staff_commission_plan_versions FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON staff_commission_plan_versions;
CREATE POLICY tenant_insert ON staff_commission_plan_versions FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON staff_commission_plan_versions;
CREATE POLICY tenant_update ON staff_commission_plan_versions FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON staff_commission_plan_versions;
CREATE POLICY tenant_delete ON staff_commission_plan_versions FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

ALTER TABLE commission_accruals ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_accruals FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON commission_accruals;
CREATE POLICY tenant_select ON commission_accruals FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON commission_accruals;
CREATE POLICY tenant_insert ON commission_accruals FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON commission_accruals;
CREATE POLICY tenant_update ON commission_accruals FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON commission_accruals;
CREATE POLICY tenant_delete ON commission_accruals FOR DELETE USING (false);
