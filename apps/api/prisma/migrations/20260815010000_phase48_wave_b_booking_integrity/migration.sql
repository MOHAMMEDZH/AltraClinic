-- Phase 48 Wave B — Booking Integrity (additive)
-- P0-02/AR-05 snapshots, P0-04/AR-07 eligibility, AR-12 resource requirements
-- Does NOT drop Appointment.serviceType; does NOT add OPERATORY workflow.

ALTER TABLE "appointments"
  ADD COLUMN IF NOT EXISTS "clinicalServiceId" UUID,
  ADD COLUMN IF NOT EXISTS "effectiveSnapshotRevisionId" UUID;

CREATE TABLE IF NOT EXISTS "appointment_service_snapshot_revisions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "appointmentId" UUID NOT NULL,
  "revisionNumber" INTEGER NOT NULL,
  "previousRevisionId" UUID,
  "clinicalServiceId" UUID,
  "stableKey" VARCHAR(160) NOT NULL,
  "displayNameAr" VARCHAR(255) NOT NULL,
  "displayNameEn" VARCHAR(255) NOT NULL,
  "tenantServiceConfigurationId" UUID,
  "priceVersionId" UUID,
  "pricingUnit" "ClinicalPricingUnit" NOT NULL DEFAULT 'PER_VISIT',
  "quantity" DECIMAL(18,4) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "unitPrice" DECIMAL(18,4) NOT NULL,
  "taxPercent" DECIMAL(5,2),
  "lineBasisAmount" DECIMAL(18,4) NOT NULL,
  "commercialReason" VARCHAR(255),
  "changeReason" VARCHAR(500),
  "actorId" UUID NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "changeCommandContext" VARCHAR(120),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "appointment_service_snapshot_revisions_appointmentId_revisionNumber_key"
  ON "appointment_service_snapshot_revisions"("appointmentId", "revisionNumber");
CREATE INDEX IF NOT EXISTS "appointment_service_snapshot_revisions_tenantId_appointmentId_idx"
  ON "appointment_service_snapshot_revisions"("tenantId", "appointmentId");
CREATE INDEX IF NOT EXISTS "appointment_service_snapshot_revisions_tenantId_clinicalServiceId_idx"
  ON "appointment_service_snapshot_revisions"("tenantId", "clinicalServiceId");

CREATE TABLE IF NOT EXISTS "provider_service_eligibilities" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "providerUserId" UUID NOT NULL,
  "clinicalServiceId" UUID NOT NULL,
  "branchId" UUID,
  "specialtyRequirementRef" VARCHAR(120),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "inactivatedAt" TIMESTAMP(3)
);

CREATE INDEX IF NOT EXISTS "provider_service_eligibilities_tenantId_providerUserId_clinicalServiceId_active_idx"
  ON "provider_service_eligibilities"("tenantId", "providerUserId", "clinicalServiceId", "active");
CREATE INDEX IF NOT EXISTS "provider_service_eligibilities_tenantId_clinicalServiceId_active_idx"
  ON "provider_service_eligibilities"("tenantId", "clinicalServiceId", "active");
CREATE INDEX IF NOT EXISTS "provider_service_eligibilities_tenantId_branchId_idx"
  ON "provider_service_eligibilities"("tenantId", "branchId");

CREATE TABLE IF NOT EXISTS "service_resource_requirements" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "clinicalServiceId" UUID NOT NULL,
  "resourceType" "scheduling_resource_type" NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "constraints" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "service_resource_requirements_tenantId_clinicalServiceId_resourceType_key"
  ON "service_resource_requirements"("tenantId", "clinicalServiceId", "resourceType");
CREATE INDEX IF NOT EXISTS "service_resource_requirements_tenantId_clinicalServiceId_idx"
  ON "service_resource_requirements"("tenantId", "clinicalServiceId");

CREATE INDEX IF NOT EXISTS "appointments_tenantId_clinicalServiceId_idx"
  ON "appointments"("tenantId", "clinicalServiceId");
CREATE INDEX IF NOT EXISTS "appointments_tenantId_effectiveSnapshotRevisionId_idx"
  ON "appointments"("tenantId", "effectiveSnapshotRevisionId");

DO $$ BEGIN
  ALTER TABLE "appointment_service_snapshot_revisions"
    ADD CONSTRAINT "appointment_service_snapshot_revisions_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "appointment_service_snapshot_revisions"
    ADD CONSTRAINT "appointment_service_snapshot_revisions_appointmentId_fkey"
    FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "appointment_service_snapshot_revisions"
    ADD CONSTRAINT "appointment_service_snapshot_revisions_previousRevisionId_fkey"
    FOREIGN KEY ("previousRevisionId") REFERENCES "appointment_service_snapshot_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "appointment_service_snapshot_revisions"
    ADD CONSTRAINT "appointment_service_snapshot_revisions_clinicalServiceId_fkey"
    FOREIGN KEY ("clinicalServiceId") REFERENCES "canonical_clinical_service_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "appointment_service_snapshot_revisions"
    ADD CONSTRAINT "appointment_service_snapshot_revisions_tenantServiceConfigurationId_fkey"
    FOREIGN KEY ("tenantServiceConfigurationId") REFERENCES "tenant_service_configurations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "appointment_service_snapshot_revisions"
    ADD CONSTRAINT "appointment_service_snapshot_revisions_priceVersionId_fkey"
    FOREIGN KEY ("priceVersionId") REFERENCES "clinical_service_price_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "appointments"
    ADD CONSTRAINT "appointments_clinicalServiceId_fkey"
    FOREIGN KEY ("clinicalServiceId") REFERENCES "canonical_clinical_service_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "appointments"
    ADD CONSTRAINT "appointments_effectiveSnapshotRevisionId_fkey"
    FOREIGN KEY ("effectiveSnapshotRevisionId") REFERENCES "appointment_service_snapshot_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "provider_service_eligibilities"
    ADD CONSTRAINT "provider_service_eligibilities_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "provider_service_eligibilities"
    ADD CONSTRAINT "provider_service_eligibilities_clinicalServiceId_fkey"
    FOREIGN KEY ("clinicalServiceId") REFERENCES "canonical_clinical_service_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "provider_service_eligibilities"
    ADD CONSTRAINT "provider_service_eligibilities_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "service_resource_requirements"
    ADD CONSTRAINT "service_resource_requirements_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "service_resource_requirements"
    ADD CONSTRAINT "service_resource_requirements_clinicalServiceId_fkey"
    FOREIGN KEY ("clinicalServiceId") REFERENCES "canonical_clinical_service_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
