-- Phase 48 Wave F Round 3 remediation
-- R3-F3A: invoice_line_items.servicePerformanceId immutability once set
-- R3-F5A: optional overlap guard helper (app-layer remains authoritative)

CREATE OR REPLACE FUNCTION enforce_invoice_line_service_performance_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."servicePerformanceId" IS NOT NULL
     AND NEW."servicePerformanceId" IS DISTINCT FROM OLD."servicePerformanceId" THEN
    RAISE EXCEPTION 'invoice_line_items: servicePerformanceId reassignment forbidden once set'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoice_line_items_service_performance_immutable ON "invoice_line_items";
CREATE TRIGGER invoice_line_items_service_performance_immutable
  BEFORE UPDATE ON "invoice_line_items"
  FOR EACH ROW EXECUTE FUNCTION enforce_invoice_line_service_performance_immutable();

-- Keep Round 2 tenant integrity trigger for servicePerformanceId (already present).
-- Ensure settlement allocation RLS remains FORCE (idempotent).
ALTER TABLE "commission_settlement_allocations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commission_settlement_allocations" FORCE ROW LEVEL SECURITY;
