-- Phase 48 Wave A — Canonical clinical service catalog, tenant/branch config, PriceVersion, legacy mappings.
-- Additive only: does NOT drop ServicePrice / Appointment.serviceType / historical prices.

CREATE TYPE "ClinicalServiceProvenance" AS ENUM ('SYSTEM_CANONICAL', 'TENANT_CUSTOM');
CREATE TYPE "ClinicalServiceLifecycle" AS ENUM ('DRAFT', 'PUBLISHED', 'DEPRECATED', 'INACTIVE');
CREATE TYPE "ClinicalServiceDomain" AS ENUM ('GENERAL', 'DENTAL', 'AESTHETIC', 'DIAGNOSTIC', 'OTHER');
CREATE TYPE "ClinicalPricingUnit" AS ENUM ('PER_VISIT', 'PER_PROCEDURE', 'PER_TOOTH', 'PER_SESSION', 'PER_UNIT', 'OTHER');
CREATE TYPE "ClinicalPriceVersionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'INACTIVE');
CREATE TYPE "LegacyClinicalMappingStatus" AS ENUM ('MAPPED', 'LEGACY_UNMAPPED', 'AMBIGUOUS');

CREATE TABLE "canonical_clinical_service_definitions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID,
  "provenance" "ClinicalServiceProvenance" NOT NULL,
  "stableKey" VARCHAR(200) NOT NULL,
  "domain" "ClinicalServiceDomain" NOT NULL DEFAULT 'GENERAL',
  "categoryKey" VARCHAR(100),
  "lifecycle" "ClinicalServiceLifecycle" NOT NULL DEFAULT 'DRAFT',
  "defaultDurationMin" INTEGER,
  "publishedAt" TIMESTAMP(3),
  "publishedBy" UUID,
  "deprecatedAt" TIMESTAMP(3),
  "deprecatedBy" UUID,
  "inactivatedAt" TIMESTAMP(3),
  "inactivatedBy" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "canonical_clinical_service_definitions_stableKey_key" UNIQUE ("stableKey"),
  CONSTRAINT "canonical_clinical_service_definitions_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "canonical_clinical_service_definitions_provenance_tenant_chk" CHECK (
    ("provenance" = 'SYSTEM_CANONICAL' AND "tenantId" IS NULL)
    OR ("provenance" = 'TENANT_CUSTOM' AND "tenantId" IS NOT NULL)
  ),
  CONSTRAINT "canonical_clinical_service_definitions_stable_key_prefix_chk" CHECK (
    ("provenance" = 'SYSTEM_CANONICAL' AND "stableKey" LIKE 'canonical.%')
    OR ("provenance" = 'TENANT_CUSTOM' AND "stableKey" LIKE 'tenant.%')
  )
);

CREATE INDEX "canonical_clinical_service_definitions_provenance_lifecycle_idx"
  ON "canonical_clinical_service_definitions"("provenance", "lifecycle");
CREATE INDEX "canonical_clinical_service_definitions_tenantId_lifecycle_idx"
  ON "canonical_clinical_service_definitions"("tenantId", "lifecycle");
CREATE INDEX "canonical_clinical_service_definitions_domain_lifecycle_idx"
  ON "canonical_clinical_service_definitions"("domain", "lifecycle");

CREATE TABLE "clinical_service_translations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "clinicalServiceId" UUID NOT NULL,
  "locale" VARCHAR(10) NOT NULL,
  "displayName" VARCHAR(255) NOT NULL,
  "shortDescription" VARCHAR(500),
  "longDescription" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clinical_service_translations_clinicalServiceId_locale_key" UNIQUE ("clinicalServiceId", "locale"),
  CONSTRAINT "clinical_service_translations_clinicalServiceId_fkey"
    FOREIGN KEY ("clinicalServiceId") REFERENCES "canonical_clinical_service_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "clinical_service_translations_locale_displayName_idx"
  ON "clinical_service_translations"("locale", "displayName");

CREATE TABLE "clinical_service_aliases" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "clinicalServiceId" UUID NOT NULL,
  "locale" VARCHAR(10) NOT NULL,
  "aliasText" VARCHAR(255) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clinical_service_aliases_clinicalServiceId_fkey"
    FOREIGN KEY ("clinicalServiceId") REFERENCES "canonical_clinical_service_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "clinical_service_aliases_clinicalServiceId_locale_idx"
  ON "clinical_service_aliases"("clinicalServiceId", "locale");
CREATE INDEX "clinical_service_aliases_locale_aliasText_idx"
  ON "clinical_service_aliases"("locale", "aliasText");

CREATE TABLE "tenant_service_presentation_overrides" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "clinicalServiceId" UUID NOT NULL,
  "locale" VARCHAR(10) NOT NULL,
  "displayNameOverride" VARCHAR(255),
  "shortDescriptionOverride" VARCHAR(500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_service_presentation_overrides_tenant_service_locale_key"
    UNIQUE ("tenantId", "clinicalServiceId", "locale"),
  CONSTRAINT "tenant_service_presentation_overrides_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "tenant_service_presentation_overrides_clinicalServiceId_fkey"
    FOREIGN KEY ("clinicalServiceId") REFERENCES "canonical_clinical_service_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "tenant_service_presentation_overrides_tenant_service_idx"
  ON "tenant_service_presentation_overrides"("tenantId", "clinicalServiceId");

CREATE TABLE "tenant_service_configurations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "clinicalServiceId" UUID NOT NULL,
  "branchId" UUID,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "defaultDurationOverride" INTEGER,
  "requiresResourceTypes" JSONB NOT NULL DEFAULT '[]',
  "bookingVisibleOnPortal" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_service_configurations_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "tenant_service_configurations_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "tenant_service_configurations_clinicalServiceId_fkey"
    FOREIGN KEY ("clinicalServiceId") REFERENCES "canonical_clinical_service_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- PostgreSQL NULL-safe uniqueness for tenant default vs branch override
CREATE UNIQUE INDEX "tenant_service_configurations_tenant_default_uidx"
  ON "tenant_service_configurations"("tenantId", "clinicalServiceId")
  WHERE "branchId" IS NULL;
CREATE UNIQUE INDEX "tenant_service_configurations_tenant_branch_uidx"
  ON "tenant_service_configurations"("tenantId", "clinicalServiceId", "branchId")
  WHERE "branchId" IS NOT NULL;

CREATE INDEX "tenant_service_configurations_tenantId_clinicalServiceId_idx"
  ON "tenant_service_configurations"("tenantId", "clinicalServiceId");
CREATE INDEX "tenant_service_configurations_tenantId_branchId_idx"
  ON "tenant_service_configurations"("tenantId", "branchId");
CREATE INDEX "tenant_service_configurations_clinicalServiceId_enabled_idx"
  ON "tenant_service_configurations"("clinicalServiceId", "enabled");

CREATE TABLE "clinical_service_price_versions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "branchId" UUID,
  "clinicalServiceId" UUID NOT NULL,
  "serviceVariantId" UUID,
  "pricingUnit" "ClinicalPricingUnit" NOT NULL DEFAULT 'PER_VISIT',
  "currency" VARCHAR(3) NOT NULL,
  "unitPrice" DECIMAL(18, 4) NOT NULL,
  "taxPercent" DECIMAL(5, 2) NOT NULL DEFAULT 0,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "status" "ClinicalPriceVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3),
  "publishedBy" UUID,
  "supersededAt" TIMESTAMP(3),
  "supersededByVersionId" UUID,
  "inactivatedAt" TIMESTAMP(3),
  "inactivatedBy" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clinical_service_price_versions_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "clinical_service_price_versions_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "clinical_service_price_versions_clinicalServiceId_fkey"
    FOREIGN KEY ("clinicalServiceId") REFERENCES "canonical_clinical_service_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "clinical_service_price_versions_range_chk" CHECK (
    "effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom"
  )
);

CREATE INDEX "clinical_service_price_versions_lookup_idx"
  ON "clinical_service_price_versions"("tenantId", "clinicalServiceId", "status", "effectiveFrom");
CREATE INDEX "clinical_service_price_versions_branch_lookup_idx"
  ON "clinical_service_price_versions"("tenantId", "branchId", "clinicalServiceId", "status");
CREATE INDEX "clinical_service_price_versions_clinicalServiceId_status_idx"
  ON "clinical_service_price_versions"("clinicalServiceId", "status");

-- At most one DRAFT per commercial key (tenant default)
CREATE UNIQUE INDEX "clinical_service_price_versions_draft_tenant_default_uidx"
  ON "clinical_service_price_versions"("tenantId", "clinicalServiceId", "pricingUnit", "currency", COALESCE("serviceVariantId"::text, ''))
  WHERE "status" = 'DRAFT' AND "branchId" IS NULL;
CREATE UNIQUE INDEX "clinical_service_price_versions_draft_branch_uidx"
  ON "clinical_service_price_versions"("tenantId", "branchId", "clinicalServiceId", "pricingUnit", "currency", COALESCE("serviceVariantId"::text, ''))
  WHERE "status" = 'DRAFT' AND "branchId" IS NOT NULL;

CREATE TABLE "legacy_clinical_service_mappings" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID,
  "sourceSystem" VARCHAR(64) NOT NULL,
  "sourceCode" VARCHAR(100) NOT NULL,
  "sourceLabelEn" VARCHAR(255),
  "sourceLabelAr" VARCHAR(255),
  "status" "LegacyClinicalMappingStatus" NOT NULL,
  "clinicalServiceId" UUID,
  "decisionNote" VARCHAR(500),
  "decidedBy" UUID,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "legacy_clinical_service_mappings_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "legacy_clinical_service_mappings_clinicalServiceId_fkey"
    FOREIGN KEY ("clinicalServiceId") REFERENCES "canonical_clinical_service_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "legacy_clinical_service_mappings_platform_uidx"
  ON "legacy_clinical_service_mappings"("sourceSystem", "sourceCode")
  WHERE "tenantId" IS NULL;
CREATE UNIQUE INDEX "legacy_clinical_service_mappings_tenant_uidx"
  ON "legacy_clinical_service_mappings"("tenantId", "sourceSystem", "sourceCode")
  WHERE "tenantId" IS NOT NULL;
CREATE INDEX "legacy_clinical_service_mappings_source_idx"
  ON "legacy_clinical_service_mappings"("sourceSystem", "sourceCode");
CREATE INDEX "legacy_clinical_service_mappings_status_idx"
  ON "legacy_clinical_service_mappings"("status");
CREATE INDEX "legacy_clinical_service_mappings_clinicalServiceId_idx"
  ON "legacy_clinical_service_mappings"("clinicalServiceId");

CREATE TABLE "legacy_clinical_price_mappings" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "servicePriceId" UUID NOT NULL,
  "status" "LegacyClinicalMappingStatus" NOT NULL,
  "clinicalServiceId" UUID,
  "priceVersionId" UUID,
  "decisionNote" VARCHAR(500),
  "decidedBy" UUID,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "legacy_clinical_price_mappings_servicePriceId_key" UNIQUE ("servicePriceId"),
  CONSTRAINT "legacy_clinical_price_mappings_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "legacy_clinical_price_mappings_servicePriceId_fkey"
    FOREIGN KEY ("servicePriceId") REFERENCES "service_prices"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "legacy_clinical_price_mappings_clinicalServiceId_fkey"
    FOREIGN KEY ("clinicalServiceId") REFERENCES "canonical_clinical_service_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "legacy_clinical_price_mappings_tenantId_status_idx"
  ON "legacy_clinical_price_mappings"("tenantId", "status");
CREATE INDEX "legacy_clinical_price_mappings_clinicalServiceId_idx"
  ON "legacy_clinical_price_mappings"("clinicalServiceId");
