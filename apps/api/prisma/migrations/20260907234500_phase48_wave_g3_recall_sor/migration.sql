-- Phase 48 Wave G3 — RecallRule + PatientRecallInstance SoR (P1-13 / AR-17)
-- Additive: enums + tenant-scoped soft-delete tables + RLS.
-- Reminders / journey registry remain delivery/orchestration only — not this SoR.

CREATE TYPE "patient_recall_status" AS ENUM (
  'DUE',
  'SNOOZED',
  'BOOKED',
  'COMPLETED',
  'OPTED_OUT'
);

CREATE TABLE IF NOT EXISTS "recall_rules" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "clinicalServiceId" UUID,
  "intervalDays" INTEGER NOT NULL,
  "eligibilityExpr" JSONB NOT NULL DEFAULT '{}',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "recall_rules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "recall_rules_interval_chk" CHECK ("intervalDays" > 0)
);

CREATE INDEX IF NOT EXISTS "recall_rules_tenantId_active_idx"
  ON "recall_rules" ("tenantId", "active");
CREATE INDEX IF NOT EXISTS "recall_rules_tenantId_clinicalServiceId_idx"
  ON "recall_rules" ("tenantId", "clinicalServiceId");

ALTER TABLE "recall_rules"
  DROP CONSTRAINT IF EXISTS "recall_rules_tenantId_fkey";
ALTER TABLE "recall_rules"
  ADD CONSTRAINT "recall_rules_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "recall_rules"
  DROP CONSTRAINT IF EXISTS "recall_rules_clinicalServiceId_fkey";
ALTER TABLE "recall_rules"
  ADD CONSTRAINT "recall_rules_clinicalServiceId_fkey"
  FOREIGN KEY ("clinicalServiceId") REFERENCES "canonical_clinical_service_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "recall_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "recall_rules" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON "recall_rules";
CREATE POLICY tenant_select ON "recall_rules" FOR SELECT
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON "recall_rules";
CREATE POLICY tenant_insert ON "recall_rules" FOR INSERT
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON "recall_rules";
CREATE POLICY tenant_update ON "recall_rules" FOR UPDATE
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.platform_rls_bypass', true) = 'true')
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON "recall_rules";
CREATE POLICY tenant_delete ON "recall_rules" FOR DELETE
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.platform_rls_bypass', true) = 'true');

CREATE TABLE IF NOT EXISTS "patient_recall_instances" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "patientId" UUID NOT NULL,
  "ruleId" UUID NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "status" "patient_recall_status" NOT NULL DEFAULT 'DUE',
  "lastQualifyingServiceAt" TIMESTAMP(3),
  "snoozedUntil" TIMESTAMP(3),
  "appointmentId" UUID,
  "completedAt" TIMESTAMP(3),
  "optedOutAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "patient_recall_instances_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "patient_recall_instances_tenantId_status_dueAt_idx"
  ON "patient_recall_instances" ("tenantId", "status", "dueAt");
CREATE INDEX IF NOT EXISTS "patient_recall_instances_tenantId_patientId_status_idx"
  ON "patient_recall_instances" ("tenantId", "patientId", "status");
CREATE INDEX IF NOT EXISTS "patient_recall_instances_tenantId_ruleId_status_idx"
  ON "patient_recall_instances" ("tenantId", "ruleId", "status");

ALTER TABLE "patient_recall_instances"
  DROP CONSTRAINT IF EXISTS "patient_recall_instances_tenantId_fkey";
ALTER TABLE "patient_recall_instances"
  ADD CONSTRAINT "patient_recall_instances_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "patient_recall_instances"
  DROP CONSTRAINT IF EXISTS "patient_recall_instances_patientId_fkey";
ALTER TABLE "patient_recall_instances"
  ADD CONSTRAINT "patient_recall_instances_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "patient_recall_instances"
  DROP CONSTRAINT IF EXISTS "patient_recall_instances_ruleId_fkey";
ALTER TABLE "patient_recall_instances"
  ADD CONSTRAINT "patient_recall_instances_ruleId_fkey"
  FOREIGN KEY ("ruleId") REFERENCES "recall_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "patient_recall_instances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "patient_recall_instances" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON "patient_recall_instances";
CREATE POLICY tenant_select ON "patient_recall_instances" FOR SELECT
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON "patient_recall_instances";
CREATE POLICY tenant_insert ON "patient_recall_instances" FOR INSERT
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON "patient_recall_instances";
CREATE POLICY tenant_update ON "patient_recall_instances" FOR UPDATE
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.platform_rls_bypass', true) = 'true')
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON "patient_recall_instances";
CREATE POLICY tenant_delete ON "patient_recall_instances" FOR DELETE
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.platform_rls_bypass', true) = 'true');
