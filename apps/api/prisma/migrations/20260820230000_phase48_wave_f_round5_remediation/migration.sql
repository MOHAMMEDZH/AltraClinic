-- Phase 48 Wave F Round 5 remediation
-- R5-PKG-3: fix package allocation RLS to use app.current_tenant_id + bypass convention
-- R5-CSVC: invoice_line_items.clinicalServiceId TENANT_CUSTOM ownership integrity
-- Additive only; does not rewrite Round 4 migration

-- ── R5-PKG-3: correct RLS policy expression ──────────────────────────────────
DROP POLICY IF EXISTS commission_package_session_allocations_tenant_isolation
  ON "commission_package_session_allocations";
DROP POLICY IF EXISTS tenant_select ON "commission_package_session_allocations";
DROP POLICY IF EXISTS tenant_insert ON "commission_package_session_allocations";
DROP POLICY IF EXISTS tenant_update ON "commission_package_session_allocations";
DROP POLICY IF EXISTS tenant_delete ON "commission_package_session_allocations";

ALTER TABLE "commission_package_session_allocations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commission_package_session_allocations" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_select ON "commission_package_session_allocations"
  FOR SELECT
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.platform_rls_bypass', true) = 'true'
  );

CREATE POLICY tenant_insert ON "commission_package_session_allocations"
  FOR INSERT
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.platform_rls_bypass', true) = 'true'
  );

CREATE POLICY tenant_update ON "commission_package_session_allocations"
  FOR UPDATE
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.platform_rls_bypass', true) = 'true'
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.platform_rls_bypass', true) = 'true'
  );

CREATE POLICY tenant_delete ON "commission_package_session_allocations"
  FOR DELETE
  USING (false);

-- ── R5-CSVC: clinicalServiceId tenant ownership (SYSTEM_CANONICAL OR same tenant) ─
CREATE OR REPLACE FUNCTION enforce_invoice_line_provenance_tenant()
RETURNS TRIGGER AS $$
DECLARE
  ref_tenant UUID;
  svc_tenant UUID;
BEGIN
  IF NEW."appointmentId" IS NOT NULL THEN
    SELECT "tenantId" INTO ref_tenant FROM "appointments" WHERE "id" = NEW."appointmentId";
    IF ref_tenant IS NULL OR ref_tenant IS DISTINCT FROM NEW."tenantId" THEN
      RAISE EXCEPTION 'invoice_line_items: appointmentId tenant mismatch' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW."clinicalServiceId" IS NOT NULL THEN
    SELECT "tenantId" INTO svc_tenant
    FROM "canonical_clinical_service_definitions"
    WHERE "id" = NEW."clinicalServiceId";
    IF NOT FOUND THEN
      RAISE EXCEPTION 'invoice_line_items: clinicalServiceId not found' USING ERRCODE = '23514';
    END IF;
    -- SYSTEM_CANONICAL: tenantId IS NULL; TENANT_CUSTOM: must equal line tenant
    IF svc_tenant IS NOT NULL AND svc_tenant IS DISTINCT FROM NEW."tenantId" THEN
      RAISE EXCEPTION 'invoice_line_items: clinicalServiceId TENANT_CUSTOM ownership mismatch'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW."snapshotRevisionId" IS NOT NULL THEN
    SELECT "tenantId" INTO ref_tenant FROM "appointment_service_snapshot_revisions" WHERE "id" = NEW."snapshotRevisionId";
    IF ref_tenant IS NULL OR ref_tenant IS DISTINCT FROM NEW."tenantId" THEN
      RAISE EXCEPTION 'invoice_line_items: snapshotRevisionId tenant mismatch' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW."courseSessionId" IS NOT NULL THEN
    SELECT tc."tenantId" INTO ref_tenant
    FROM "course_sessions" cs
    JOIN "treatment_courses" tc ON tc."id" = cs."courseId"
    WHERE cs."id" = NEW."courseSessionId";
    IF ref_tenant IS NULL OR ref_tenant IS DISTINCT FROM NEW."tenantId" THEN
      RAISE EXCEPTION 'invoice_line_items: courseSessionId tenant mismatch' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoice_line_items_provenance_tenant ON "invoice_line_items";
CREATE TRIGGER invoice_line_items_provenance_tenant
  BEFORE INSERT OR UPDATE ON "invoice_line_items"
  FOR EACH ROW EXECUTE FUNCTION enforce_invoice_line_provenance_tenant();
