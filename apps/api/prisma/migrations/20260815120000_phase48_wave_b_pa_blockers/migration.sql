-- Phase 48 Wave B PA blockers — append-only snapshot guard, multi-resource allocations,
-- portal idempotency ledger, Wave B RLS, optional providerUser FK.

-- ---------------------------------------------------------------------------
-- a) Append-only guard on appointment_service_snapshot_revisions
--    Escape hatch: SET LOCAL app.wave_b_snapshot_migration = 'true' (backfill/tests only)
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
  ON "appointment_service_snapshot_revisions";
CREATE TRIGGER appointment_service_snapshot_revisions_immutable
  BEFORE UPDATE OR DELETE ON "appointment_service_snapshot_revisions"
  FOR EACH ROW EXECUTE FUNCTION prevent_appointment_snapshot_revision_mutation();

-- ---------------------------------------------------------------------------
-- b) AppointmentResourceAllocation
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "appointment_resource_allocations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "appointmentId" UUID NOT NULL,
  "schedulingResourceId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "appointment_resource_allocations_appointmentId_schedulingResourceId_key"
  ON "appointment_resource_allocations"("appointmentId", "schedulingResourceId");
CREATE INDEX IF NOT EXISTS "appointment_resource_allocations_tenantId_schedulingResourceId_idx"
  ON "appointment_resource_allocations"("tenantId", "schedulingResourceId");

DO $$ BEGIN
  ALTER TABLE "appointment_resource_allocations"
    ADD CONSTRAINT "appointment_resource_allocations_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "appointment_resource_allocations"
    ADD CONSTRAINT "appointment_resource_allocations_appointmentId_fkey"
    FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "appointment_resource_allocations"
    ADD CONSTRAINT "appointment_resource_allocations_schedulingResourceId_fkey"
    FOREIGN KEY ("schedulingResourceId") REFERENCES "scheduling_resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- c) PortalSchedulingIdempotencyLedger
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "portal_scheduling_idempotency_ledger" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "patientId" UUID NOT NULL,
  "operation" VARCHAR(64) NOT NULL,
  "idempotencyKey" VARCHAR(255) NOT NULL,
  "fingerprint" VARCHAR(64) NOT NULL,
  "responseJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "portal_scheduling_idempotency_ledger_tenantId_patientId_operation_idempotencyKey_key"
  ON "portal_scheduling_idempotency_ledger"("tenantId", "patientId", "operation", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "portal_scheduling_idempotency_ledger_tenantId_patientId_idx"
  ON "portal_scheduling_idempotency_ledger"("tenantId", "patientId");

DO $$ BEGIN
  ALTER TABLE "portal_scheduling_idempotency_ledger"
    ADD CONSTRAINT "portal_scheduling_idempotency_ledger_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- e) Provider ownership is enforced in ProviderEligibilityService (tenant-scoped
--    user lookup). Hard FK to users is omitted: legacy/test rows may use
--    synthetic provider UUIDs that are not users rows; service validation is
--    authoritative for new writes.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- d) RLS ENABLE+FORCE+policies for Wave B tenant tables (appointments pattern)
-- ---------------------------------------------------------------------------
ALTER TABLE "appointment_service_snapshot_revisions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointment_service_snapshot_revisions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON "appointment_service_snapshot_revisions";
CREATE POLICY tenant_select ON "appointment_service_snapshot_revisions" FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON "appointment_service_snapshot_revisions";
CREATE POLICY tenant_insert ON "appointment_service_snapshot_revisions" FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON "appointment_service_snapshot_revisions";
CREATE POLICY tenant_update ON "appointment_service_snapshot_revisions" FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON "appointment_service_snapshot_revisions";
CREATE POLICY tenant_delete ON "appointment_service_snapshot_revisions" FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

ALTER TABLE "provider_service_eligibilities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "provider_service_eligibilities" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON "provider_service_eligibilities";
CREATE POLICY tenant_select ON "provider_service_eligibilities" FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON "provider_service_eligibilities";
CREATE POLICY tenant_insert ON "provider_service_eligibilities" FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON "provider_service_eligibilities";
CREATE POLICY tenant_update ON "provider_service_eligibilities" FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON "provider_service_eligibilities";
CREATE POLICY tenant_delete ON "provider_service_eligibilities" FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

ALTER TABLE "service_resource_requirements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "service_resource_requirements" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON "service_resource_requirements";
CREATE POLICY tenant_select ON "service_resource_requirements" FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON "service_resource_requirements";
CREATE POLICY tenant_insert ON "service_resource_requirements" FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON "service_resource_requirements";
CREATE POLICY tenant_update ON "service_resource_requirements" FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON "service_resource_requirements";
CREATE POLICY tenant_delete ON "service_resource_requirements" FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

ALTER TABLE "appointment_resource_allocations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointment_resource_allocations" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON "appointment_resource_allocations";
CREATE POLICY tenant_select ON "appointment_resource_allocations" FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON "appointment_resource_allocations";
CREATE POLICY tenant_insert ON "appointment_resource_allocations" FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON "appointment_resource_allocations";
CREATE POLICY tenant_update ON "appointment_resource_allocations" FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON "appointment_resource_allocations";
CREATE POLICY tenant_delete ON "appointment_resource_allocations" FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

ALTER TABLE "portal_scheduling_idempotency_ledger" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "portal_scheduling_idempotency_ledger" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON "portal_scheduling_idempotency_ledger";
CREATE POLICY tenant_select ON "portal_scheduling_idempotency_ledger" FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON "portal_scheduling_idempotency_ledger";
CREATE POLICY tenant_insert ON "portal_scheduling_idempotency_ledger" FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON "portal_scheduling_idempotency_ledger";
CREATE POLICY tenant_update ON "portal_scheduling_idempotency_ledger" FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON "portal_scheduling_idempotency_ledger";
CREATE POLICY tenant_delete ON "portal_scheduling_idempotency_ledger" FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
