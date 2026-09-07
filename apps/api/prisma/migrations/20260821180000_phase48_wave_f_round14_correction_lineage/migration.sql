-- Phase 48 Wave F Round 14 — durable correction request lineage (mixed-cohort rem=0 replay).
-- Append-only; unique (tenantId, correctionEventId); ENABLE/FORCE RLS on app.current_tenant_id.

CREATE TABLE IF NOT EXISTS "commission_correction_lineages" (
  "id" UUID PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  "correctionEventId" UUID NOT NULL,
  "selectedAccrualId" UUID NOT NULL,
  "sourceInvoiceLineId" UUID NOT NULL,
  "replacementInvoiceLineId" UUID NOT NULL,
  "servicePerformanceId" UUID NOT NULL,
  "calculationBasis" "commission_calculation_basis" NOT NULL,
  "packageAllocationId" UUID,
  "createdBy" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "commission_correction_lineages_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "commission_correction_lineages_selectedAccrualId_fkey"
    FOREIGN KEY ("selectedAccrualId") REFERENCES "commission_accruals"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "commission_correction_lineages_sourceInvoiceLineId_fkey"
    FOREIGN KEY ("sourceInvoiceLineId") REFERENCES "invoice_line_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "commission_correction_lineages_replacementInvoiceLineId_fkey"
    FOREIGN KEY ("replacementInvoiceLineId") REFERENCES "invoice_line_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "commission_correction_lineages_servicePerformanceId_fkey"
    FOREIGN KEY ("servicePerformanceId") REFERENCES "service_performances"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "commission_correction_lineages_tenant_event_uidx"
  ON "commission_correction_lineages" ("tenantId", "correctionEventId");

CREATE INDEX IF NOT EXISTS "commission_correction_lineages_tenant_sp_idx"
  ON "commission_correction_lineages" ("tenantId", "servicePerformanceId");

CREATE INDEX IF NOT EXISTS "commission_correction_lineages_tenant_selected_idx"
  ON "commission_correction_lineages" ("tenantId", "selectedAccrualId");

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

CREATE OR REPLACE FUNCTION enforce_commission_correction_lineage_append_only()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'commission_correction_lineages: hard delete forbidden' USING ERRCODE = '23514';
  END IF;
  RAISE EXCEPTION 'commission_correction_lineages: append-only — updates forbidden' USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS commission_correction_lineages_append_only ON "commission_correction_lineages";
CREATE TRIGGER commission_correction_lineages_append_only
  BEFORE UPDATE OR DELETE ON "commission_correction_lineages"
  FOR EACH ROW EXECUTE FUNCTION enforce_commission_correction_lineage_append_only();
