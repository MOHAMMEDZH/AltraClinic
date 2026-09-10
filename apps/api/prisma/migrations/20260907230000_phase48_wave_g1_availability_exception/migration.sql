-- Phase 48 Wave G1 — AvailabilityException SoR (P1-11)
-- Additive: enum + tenant-scoped soft-delete table + RLS.

CREATE TYPE "availability_exception_type" AS ENUM (
  'PROVIDER_LEAVE',
  'BRANCH_HOLIDAY',
  'RESOURCE_MAINTENANCE',
  'EXTRA_AVAILABILITY'
);

CREATE TABLE IF NOT EXISTS "availability_exceptions" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "branchId" UUID,
  "type" "availability_exception_type" NOT NULL,
  "providerId" UUID,
  "resourceId" UUID,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "reason" VARCHAR(500),
  "createdBy" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "availability_exceptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "availability_exceptions_range_chk" CHECK ("endsAt" > "startsAt")
);

CREATE INDEX IF NOT EXISTS "availability_exceptions_tenantId_startsAt_endsAt_idx"
  ON "availability_exceptions" ("tenantId", "startsAt", "endsAt");
CREATE INDEX IF NOT EXISTS "availability_exceptions_tenantId_branchId_startsAt_idx"
  ON "availability_exceptions" ("tenantId", "branchId", "startsAt");
CREATE INDEX IF NOT EXISTS "availability_exceptions_tenantId_providerId_startsAt_idx"
  ON "availability_exceptions" ("tenantId", "providerId", "startsAt");
CREATE INDEX IF NOT EXISTS "availability_exceptions_tenantId_resourceId_startsAt_idx"
  ON "availability_exceptions" ("tenantId", "resourceId", "startsAt");

ALTER TABLE "availability_exceptions"
  DROP CONSTRAINT IF EXISTS "availability_exceptions_tenantId_fkey";
ALTER TABLE "availability_exceptions"
  ADD CONSTRAINT "availability_exceptions_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "availability_exceptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "availability_exceptions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON "availability_exceptions";
CREATE POLICY tenant_select ON "availability_exceptions" FOR SELECT
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON "availability_exceptions";
CREATE POLICY tenant_insert ON "availability_exceptions" FOR INSERT
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON "availability_exceptions";
CREATE POLICY tenant_update ON "availability_exceptions" FOR UPDATE
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.platform_rls_bypass', true) = 'true')
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON "availability_exceptions";
CREATE POLICY tenant_delete ON "availability_exceptions" FOR DELETE
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.platform_rls_bypass', true) = 'true');
