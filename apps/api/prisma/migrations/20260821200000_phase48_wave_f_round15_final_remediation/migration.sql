-- Phase 48 Wave F Round 15 — final three-blocker remediation.
-- R15-A: REVERSED economic shape allows one-zero tails (not zero/zero).
-- R15-B: commission_correction_lineages tenant + selected-accrual provenance integrity.
-- R15-C: zero-history fail-fast — abort if correction economics exist without lineage.

-- ---------------------------------------------------------------------------
-- R15-C — ZERO-HISTORY FAIL-FAST PRECONDITION (must run before schema mutations
-- that could leave an ambiguous historical state). PostgreSQL migrate deploy
-- runs each migration file in a transaction by default for Prisma; RAISE aborts
-- the transaction so no partial Round 15 objects remain.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  orphan_events INT;
  orphan_accrual_rows INT;
BEGIN
  SELECT COUNT(*)::int INTO orphan_events
  FROM (
    SELECT DISTINCT a."tenantId", a."correctionEventId"
    FROM "commission_accruals" a
    WHERE a."correctionEventId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM "commission_correction_lineages" l
        WHERE l."tenantId" = a."tenantId"
          AND l."correctionEventId" = a."correctionEventId"
      )
  ) orphans;

  SELECT COUNT(*)::int INTO orphan_accrual_rows
  FROM "commission_accruals" a
  WHERE a."correctionEventId" IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM "commission_correction_lineages" l
      WHERE l."tenantId" = a."tenantId"
        AND l."correctionEventId" = a."correctionEventId"
    );

  IF orphan_events > 0 OR orphan_accrual_rows > 0 THEN
    RAISE EXCEPTION
      'Wave F Round 15 zero-history contract violated: % distinct correctionEventId(s) and % commission_accruals row(s) have correctionEventId without commission_correction_lineages. Refusing to deploy; never fabricate lineage.'
      , orphan_events, orphan_accrual_rows
      USING ERRCODE = 'P0001';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- R15-A — DB-level REVERSED economic shape (one-zero tails allowed; zero/zero forbidden)
-- ---------------------------------------------------------------------------
ALTER TABLE "commission_accruals"
  DROP CONSTRAINT IF EXISTS "commission_accruals_reversed_economic_shape_chk";

ALTER TABLE "commission_accruals"
  ADD CONSTRAINT "commission_accruals_reversed_economic_shape_chk" CHECK (
    "status" <> 'REVERSED'::"commission_accrual_status"
    OR (
      "attributedRevenueAmount" <= 0
      AND "commissionAmount" <= 0
      AND (
        "attributedRevenueAmount" < 0
        OR "commissionAmount" < 0
      )
    )
  );

-- ---------------------------------------------------------------------------
-- R15-B — lineage tenant + selected-accrual provenance integrity trigger
-- (replacement line: tenant-only at INSERT; ACTIVE/performance binding happens later)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_commission_correction_lineage_provenance()
RETURNS TRIGGER AS $$
DECLARE
  acc RECORD;
  ref_tenant UUID;
BEGIN
  SELECT
    a."tenantId",
    a."invoiceLineId",
    a."servicePerformanceId",
    a."calculationBasis",
    a."packageAllocationId"
  INTO acc
  FROM "commission_accruals" a
  WHERE a."id" = NEW."selectedAccrualId";

  IF NOT FOUND THEN
    RAISE EXCEPTION 'commission_correction_lineages: selectedAccrualId missing'
      USING ERRCODE = '23514';
  END IF;
  IF acc."tenantId" IS DISTINCT FROM NEW."tenantId" THEN
    RAISE EXCEPTION 'commission_correction_lineages: selectedAccrualId tenant mismatch'
      USING ERRCODE = '23514';
  END IF;
  IF acc."invoiceLineId" IS DISTINCT FROM NEW."sourceInvoiceLineId" THEN
    RAISE EXCEPTION 'commission_correction_lineages: selectedAccrual invoiceLineId/sourceInvoiceLineId mismatch'
      USING ERRCODE = '23514';
  END IF;
  IF acc."servicePerformanceId" IS DISTINCT FROM NEW."servicePerformanceId" THEN
    RAISE EXCEPTION 'commission_correction_lineages: selectedAccrual servicePerformanceId mismatch'
      USING ERRCODE = '23514';
  END IF;
  IF acc."calculationBasis" IS DISTINCT FROM NEW."calculationBasis" THEN
    RAISE EXCEPTION 'commission_correction_lineages: selectedAccrual calculationBasis mismatch'
      USING ERRCODE = '23514';
  END IF;
  IF acc."packageAllocationId" IS DISTINCT FROM NEW."packageAllocationId" THEN
    RAISE EXCEPTION 'commission_correction_lineages: selectedAccrual packageAllocationId NULL/value parity mismatch'
      USING ERRCODE = '23514';
  END IF;

  SELECT "tenantId" INTO ref_tenant
  FROM "invoice_line_items" WHERE "id" = NEW."sourceInvoiceLineId";
  IF ref_tenant IS NULL OR ref_tenant IS DISTINCT FROM NEW."tenantId" THEN
    RAISE EXCEPTION 'commission_correction_lineages: sourceInvoiceLineId tenant mismatch'
      USING ERRCODE = '23514';
  END IF;

  SELECT "tenantId" INTO ref_tenant
  FROM "invoice_line_items" WHERE "id" = NEW."replacementInvoiceLineId";
  IF ref_tenant IS NULL OR ref_tenant IS DISTINCT FROM NEW."tenantId" THEN
    RAISE EXCEPTION 'commission_correction_lineages: replacementInvoiceLineId tenant mismatch'
      USING ERRCODE = '23514';
  END IF;

  SELECT "tenantId" INTO ref_tenant
  FROM "service_performances" WHERE "id" = NEW."servicePerformanceId";
  IF ref_tenant IS NULL OR ref_tenant IS DISTINCT FROM NEW."tenantId" THEN
    RAISE EXCEPTION 'commission_correction_lineages: servicePerformanceId tenant mismatch'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."packageAllocationId" IS NOT NULL THEN
    SELECT "tenantId" INTO ref_tenant
    FROM "commission_package_session_allocations" WHERE "id" = NEW."packageAllocationId";
    IF ref_tenant IS NULL OR ref_tenant IS DISTINCT FROM NEW."tenantId" THEN
      RAISE EXCEPTION 'commission_correction_lineages: packageAllocationId tenant mismatch'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- Canonical createdBy tenancy: users.tenantId membership (same as commission_accruals).
  SELECT "tenantId" INTO ref_tenant FROM "users" WHERE "id" = NEW."createdBy";
  IF ref_tenant IS NULL OR ref_tenant IS DISTINCT FROM NEW."tenantId" THEN
    RAISE EXCEPTION 'commission_correction_lineages: createdBy tenant mismatch'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS commission_correction_lineages_provenance ON "commission_correction_lineages";
CREATE TRIGGER commission_correction_lineages_provenance
  BEFORE INSERT OR UPDATE ON "commission_correction_lineages"
  FOR EACH ROW EXECUTE FUNCTION enforce_commission_correction_lineage_provenance();

-- Append-only already denies UPDATE/DELETE; keep provenance on INSERT path primary.
-- Re-assert ENABLE/FORCE RLS + policies (idempotent; app.current_tenant_id only).
ALTER TABLE "commission_correction_lineages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commission_correction_lineages" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_select ON "commission_correction_lineages";
CREATE POLICY tenant_select ON "commission_correction_lineages" FOR SELECT
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.platform_rls_bypass', true) = 'true'
  );

DROP POLICY IF EXISTS tenant_insert ON "commission_correction_lineages";
CREATE POLICY tenant_insert ON "commission_correction_lineages" FOR INSERT
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.platform_rls_bypass', true) = 'true'
  );

DROP POLICY IF EXISTS tenant_update ON "commission_correction_lineages";
CREATE POLICY tenant_update ON "commission_correction_lineages" FOR UPDATE USING (false);

DROP POLICY IF EXISTS tenant_delete ON "commission_correction_lineages";
CREATE POLICY tenant_delete ON "commission_correction_lineages" FOR DELETE USING (false);
