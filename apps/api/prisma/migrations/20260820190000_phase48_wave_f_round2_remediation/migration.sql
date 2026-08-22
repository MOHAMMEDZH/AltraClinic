-- Phase 48 Wave F Round 2 remediation (F3–F7)
-- F3: durable InvoiceLine ↔ ServicePerformance FK
-- F5: close prior plan effectiveTo on supersede (app-side; index support)
-- F6: expand tenant-ref coverage notes (same trigger family)
-- F7: append-only settlement allocation ledger

-- ── F3 durable attribution on invoice lines ─────────────────────────────────
ALTER TABLE "invoice_line_items"
  ADD COLUMN IF NOT EXISTS "servicePerformanceId" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoice_line_items_servicePerformanceId_fkey'
  ) THEN
    ALTER TABLE "invoice_line_items"
      ADD CONSTRAINT "invoice_line_items_servicePerformanceId_fkey"
      FOREIGN KEY ("servicePerformanceId") REFERENCES "service_performances"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "invoice_line_items_servicePerformanceId_uidx"
  ON "invoice_line_items" ("servicePerformanceId")
  WHERE "servicePerformanceId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "invoice_line_items_tenant_servicePerformanceId_idx"
  ON "invoice_line_items" ("tenantId", "servicePerformanceId");

-- Tenant integrity: invoice line servicePerformanceId must match line tenant
CREATE OR REPLACE FUNCTION enforce_invoice_line_service_performance_tenant()
RETURNS TRIGGER AS $$
DECLARE
  perf_tenant UUID;
BEGIN
  IF NEW."servicePerformanceId" IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT "tenantId" INTO perf_tenant FROM "service_performances" WHERE "id" = NEW."servicePerformanceId";
  IF perf_tenant IS NULL OR perf_tenant <> NEW."tenantId" THEN
    RAISE EXCEPTION 'invoice_line_items: servicePerformanceId tenant mismatch'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoice_line_items_service_performance_tenant ON "invoice_line_items";
CREATE TRIGGER invoice_line_items_service_performance_tenant
  BEFORE INSERT OR UPDATE ON "invoice_line_items"
  FOR EACH ROW EXECUTE FUNCTION enforce_invoice_line_service_performance_tenant();

-- ── F7 settlement allocation ledger (append-only) ───────────────────────────
CREATE TABLE IF NOT EXISTS "commission_settlement_allocations" (
  "id" UUID PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  "accrualId" UUID NOT NULL,
  "amount" DECIMAL(18,4) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "settlementReference" VARCHAR(255) NOT NULL,
  "idempotencyKey" VARCHAR(200) NOT NULL,
  "reason" TEXT,
  "createdBy" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "commission_settlement_allocations_tenant_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "commission_settlement_allocations_accrual_fkey"
    FOREIGN KEY ("accrualId") REFERENCES "commission_accruals"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "commission_settlement_allocations_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "commission_settlement_allocations_amount_positive"
    CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "commission_settlement_allocations_tenant_idem_uidx"
  ON "commission_settlement_allocations" ("tenantId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "commission_settlement_allocations_tenant_accrual_idx"
  ON "commission_settlement_allocations" ("tenantId", "accrualId");

CREATE OR REPLACE FUNCTION enforce_commission_settlement_allocation_tenant_refs()
RETURNS TRIGGER AS $$
DECLARE
  accrual_tenant UUID;
  created_tenant UUID;
  accrual_currency VARCHAR(3);
BEGIN
  SELECT "tenantId", "currency" INTO accrual_tenant, accrual_currency
  FROM "commission_accruals" WHERE "id" = NEW."accrualId";
  IF accrual_tenant IS NULL OR accrual_tenant <> NEW."tenantId" THEN
    RAISE EXCEPTION 'commission_settlement_allocations: accrualId tenant mismatch'
      USING ERRCODE = '23514';
  END IF;
  IF accrual_currency IS DISTINCT FROM NEW."currency" THEN
    RAISE EXCEPTION 'commission_settlement_allocations: currency must match accrual'
      USING ERRCODE = '23514';
  END IF;
  SELECT "tenantId" INTO created_tenant FROM "users" WHERE "id" = NEW."createdBy";
  IF created_tenant IS NULL OR created_tenant <> NEW."tenantId" THEN
    RAISE EXCEPTION 'commission_settlement_allocations: createdBy tenant mismatch'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS commission_settlement_allocations_tenant_refs ON "commission_settlement_allocations";
CREATE TRIGGER commission_settlement_allocations_tenant_refs
  BEFORE INSERT OR UPDATE ON "commission_settlement_allocations"
  FOR EACH ROW EXECUTE FUNCTION enforce_commission_settlement_allocation_tenant_refs();

CREATE OR REPLACE FUNCTION enforce_commission_settlement_allocation_append_only()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'commission_settlement_allocations: hard delete forbidden'
      USING ERRCODE = '23514';
  END IF;
  RAISE EXCEPTION 'commission_settlement_allocations: append-only — UPDATE forbidden'
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS commission_settlement_allocations_append_only ON "commission_settlement_allocations";
CREATE TRIGGER commission_settlement_allocations_append_only
  BEFORE UPDATE OR DELETE ON "commission_settlement_allocations"
  FOR EACH ROW EXECUTE FUNCTION enforce_commission_settlement_allocation_append_only();

ALTER TABLE "commission_settlement_allocations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commission_settlement_allocations" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON "commission_settlement_allocations";
CREATE POLICY tenant_select ON "commission_settlement_allocations" FOR SELECT
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON "commission_settlement_allocations";
CREATE POLICY tenant_insert ON "commission_settlement_allocations" FOR INSERT
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON "commission_settlement_allocations";
CREATE POLICY tenant_update ON "commission_settlement_allocations" FOR UPDATE
  USING (false);
DROP POLICY IF EXISTS tenant_delete ON "commission_settlement_allocations";
CREATE POLICY tenant_delete ON "commission_settlement_allocations" FOR DELETE
  USING (false);

-- F5: allow closing effectiveTo when ACTIVE → SUPERSEDED (historical interval preservation)
CREATE OR REPLACE FUNCTION enforce_staff_commission_plan_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."status" = 'SUPERSEDED' THEN
    RAISE EXCEPTION 'staff_commission_plan_versions: SUPERSEDED plan immutable'
      USING ERRCODE = '23514';
  END IF;

  IF OLD."status" = 'ACTIVE' THEN
    IF NEW."status" = 'SUPERSEDED' THEN
      -- Supersession may close effectiveTo + set supersededAt; financial fields stay immutable.
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
        RAISE EXCEPTION 'staff_commission_plan_versions: ACTIVE plan immutable on supersede except effectiveTo/status'
          USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END IF;

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

    IF NEW."status" IS DISTINCT FROM OLD."status" AND NEW."status" <> 'SUPERSEDED' THEN
      RAISE EXCEPTION 'staff_commission_plan_versions: ACTIVE plan may only transition to SUPERSEDED'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
