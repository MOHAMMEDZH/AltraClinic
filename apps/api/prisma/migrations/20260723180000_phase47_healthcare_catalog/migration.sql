-- Phase 47 Step 12 — Healthcare Catalog Source of Record
-- Metadata only: no Plan / Plan Version / Add-on / Override / tenant assignment.

CREATE TYPE "HealthcareCatalogKind" AS ENUM (
  'FACILITY_TYPE',
  'SPECIALTY',
  'MODULE',
  'FEATURE',
  'LIMIT'
);

CREATE TYPE "HealthcareCatalogLifecycle" AS ENUM (
  'DRAFT',
  'ACTIVE',
  'DEPRECATED',
  'RETIRED'
);

CREATE TYPE "HealthcareCatalogRuleType" AS ENUM (
  'REQUIRES',
  'REQUIRES_ANY_OF',
  'INCOMPATIBLE_WITH',
  'ALLOWED_FOR',
  'NOT_ALLOWED_FOR'
);

CREATE TYPE "HealthcareCatalogLimitValueType" AS ENUM (
  'INTEGER',
  'DECIMAL',
  'DURATION',
  'BYTES',
  'COUNT'
);

CREATE TABLE "healthcare_catalog_items" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "canonicalKey" VARCHAR(128) NOT NULL,
  "kind" "HealthcareCatalogKind" NOT NULL,
  "lifecycle" "HealthcareCatalogLifecycle" NOT NULL DEFAULT 'DRAFT',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "iconKey" VARCHAR(64),
  "parentItemId" UUID,
  "owningModuleItemId" UUID,
  "systemSeeded" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 1,
  "replacementCanonicalKey" VARCHAR(128),
  "limitValueType" "HealthcareCatalogLimitValueType",
  "limitUnit" VARCHAR(64),
  "limitMin" DECIMAL(18, 4),
  "limitMax" DECIMAL(18, 4),
  "limitZeroValid" BOOLEAN,
  "limitUnlimitedSupported" BOOLEAN,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "healthcare_catalog_items_canonicalKey_key" UNIQUE ("canonicalKey"),
  CONSTRAINT "healthcare_catalog_items_parentItemId_fkey"
    FOREIGN KEY ("parentItemId") REFERENCES "healthcare_catalog_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "healthcare_catalog_items_owningModuleItemId_fkey"
    FOREIGN KEY ("owningModuleItemId") REFERENCES "healthcare_catalog_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "healthcare_catalog_items_kind_lifecycle_idx"
  ON "healthcare_catalog_items"("kind", "lifecycle");
CREATE INDEX "healthcare_catalog_items_sortOrder_idx"
  ON "healthcare_catalog_items"("sortOrder");

CREATE TABLE "healthcare_catalog_translations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "itemId" UUID NOT NULL,
  "locale" VARCHAR(10) NOT NULL,
  "displayName" VARCHAR(200) NOT NULL,
  "shortDescription" VARCHAR(500) NOT NULL,
  "longDescription" TEXT,
  "helpText" VARCHAR(500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "healthcare_catalog_translations_itemId_locale_key" UNIQUE ("itemId", "locale"),
  CONSTRAINT "healthcare_catalog_translations_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "healthcare_catalog_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "healthcare_catalog_translations_locale_displayName_idx"
  ON "healthcare_catalog_translations"("locale", "displayName");

CREATE TABLE "healthcare_catalog_aliases" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "itemId" UUID NOT NULL,
  "aliasValue" VARCHAR(128) NOT NULL,
  "sourceNamespace" VARCHAR(64) NOT NULL,
  "lifecycle" "HealthcareCatalogLifecycle" NOT NULL DEFAULT 'ACTIVE',
  "reason" VARCHAR(500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "retiredAt" TIMESTAMP(3),
  CONSTRAINT "healthcare_catalog_aliases_sourceNamespace_aliasValue_key"
    UNIQUE ("sourceNamespace", "aliasValue"),
  CONSTRAINT "healthcare_catalog_aliases_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "healthcare_catalog_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "healthcare_catalog_aliases_itemId_idx"
  ON "healthcare_catalog_aliases"("itemId");

CREATE TABLE "healthcare_catalog_compatibility_rules" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ruleType" "HealthcareCatalogRuleType" NOT NULL,
  "subjectItemId" UUID NOT NULL,
  "targetItemId" UUID NOT NULL,
  "anyOfGroupKey" VARCHAR(64) NOT NULL DEFAULT '',
  "lifecycle" "HealthcareCatalogLifecycle" NOT NULL DEFAULT 'DRAFT',
  "explanationEn" VARCHAR(500) NOT NULL,
  "explanationAr" VARCHAR(500) NOT NULL,
  "systemSeeded" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "healthcare_catalog_compatibility_rules_unique"
    UNIQUE ("ruleType", "subjectItemId", "targetItemId", "anyOfGroupKey"),
  CONSTRAINT "healthcare_catalog_compatibility_rules_subjectItemId_fkey"
    FOREIGN KEY ("subjectItemId") REFERENCES "healthcare_catalog_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "healthcare_catalog_compatibility_rules_targetItemId_fkey"
    FOREIGN KEY ("targetItemId") REFERENCES "healthcare_catalog_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "healthcare_catalog_compatibility_rules_lifecycle_ruleType_idx"
  ON "healthcare_catalog_compatibility_rules"("lifecycle", "ruleType");
