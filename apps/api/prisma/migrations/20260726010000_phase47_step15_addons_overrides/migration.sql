-- Phase 47 Step 15 — Platform Add-ons & Commercial Overrides (additive only).
-- Commercial definition SoR only. NO tenantId / subscriptionId assignment FKs.
-- Creating/publishing/approving MUST NOT alter LicensingEngineService runtime.
-- Empty Add-on catalog is OK (no invented addon.* seed products).
-- Preserves Steps 06–14 and Catalog inventory 68/136/68/13.

CREATE TYPE "PlatformAddOnLifecycle" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "PlatformAddOnVersionLifecycle" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');
CREATE TYPE "PlatformAddOnLimitEffectType" AS ENUM ('SET_ABSOLUTE', 'INCREASE_BY', 'SET_UNLIMITED');
CREATE TYPE "PlatformCommercialOverrideLifecycle" AS ENUM (
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'REVOKED',
  'EXPIRED'
);
CREATE TYPE "PlatformCommercialOverrideEffectKind" AS ENUM (
  'ENTITLEMENT_GRANT',
  'ENTITLEMENT_SUPPRESS',
  'LIMIT_SET_ABSOLUTE',
  'LIMIT_INCREASE_BY',
  'LIMIT_SET_UNLIMITED'
);
CREATE TYPE "PlatformCommercialOverrideReasonCode" AS ENUM (
  'SALES_CONCESSION',
  'CONTRACTUAL_EXCEPTION',
  'SUPPORT_WAIVER',
  'TRIAL_EXTENSION',
  'OTHER'
);

-- ─── Add-ons ────────────────────────────────────────────────────────────────

CREATE TABLE "platform_addons" (
    "id" UUID NOT NULL,
    "canonicalKey" VARCHAR(128) NOT NULL,
    "lifecycle" "PlatformAddOnLifecycle" NOT NULL DEFAULT 'DRAFT',
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    "systemSeeded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_addons_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_addons_canonicalKey_key" ON "platform_addons"("canonicalKey");
CREATE INDEX "platform_addons_lifecycle_idx" ON "platform_addons"("lifecycle");

CREATE TABLE "platform_addon_translations" (
    "id" UUID NOT NULL,
    "addOnId" UUID NOT NULL,
    "locale" VARCHAR(10) NOT NULL,
    "displayName" VARCHAR(200) NOT NULL,
    "shortDescription" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_addon_translations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_addon_translations_addOnId_locale_key" ON "platform_addon_translations"("addOnId", "locale");
CREATE INDEX "platform_addon_translations_locale_displayName_idx" ON "platform_addon_translations"("locale", "displayName");

CREATE TABLE "platform_addon_versions" (
    "id" UUID NOT NULL,
    "addOnId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "lifecycle" "PlatformAddOnVersionLifecycle" NOT NULL DEFAULT 'DRAFT',
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" TIMESTAMP(3),
    "publishedByPlatformUserId" UUID,
    "publicationFingerprint" VARCHAR(64),
    "publicationReason" VARCHAR(500),
    "sourceVersionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_addon_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_addon_versions_addOnId_versionNumber_key" ON "platform_addon_versions"("addOnId", "versionNumber");
CREATE INDEX "platform_addon_versions_addOnId_lifecycle_idx" ON "platform_addon_versions"("addOnId", "lifecycle");
CREATE INDEX "platform_addon_versions_lifecycle_publishedAt_idx" ON "platform_addon_versions"("lifecycle", "publishedAt");
-- Exactly one open Draft Add-on Version per Add-on (MVP policy).
CREATE UNIQUE INDEX "platform_addon_versions_one_draft_per_addon" ON "platform_addon_versions"("addOnId") WHERE "lifecycle" = 'DRAFT';

CREATE TABLE "platform_addon_version_translations" (
    "id" UUID NOT NULL,
    "addOnVersionId" UUID NOT NULL,
    "locale" VARCHAR(10) NOT NULL,
    "releaseLabel" VARCHAR(200) NOT NULL,
    "shortDescription" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_addon_version_translations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_addon_version_translations_addOnVersionId_locale_key" ON "platform_addon_version_translations"("addOnVersionId", "locale");
CREATE INDEX "platform_addon_version_translations_locale_releaseLabel_idx" ON "platform_addon_version_translations"("locale", "releaseLabel");

CREATE TABLE "platform_addon_version_entitlements" (
    "id" UUID NOT NULL,
    "addOnVersionId" UUID NOT NULL,
    "catalogItemId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_addon_version_entitlements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_addon_version_entitlements_addOnVersionId_catalogItemId_key" ON "platform_addon_version_entitlements"("addOnVersionId", "catalogItemId");
CREATE INDEX "platform_addon_version_entitlements_addOnVersionId_idx" ON "platform_addon_version_entitlements"("addOnVersionId");
CREATE INDEX "platform_addon_version_entitlements_catalogItemId_idx" ON "platform_addon_version_entitlements"("catalogItemId");

CREATE TABLE "platform_addon_version_limit_effects" (
    "id" UUID NOT NULL,
    "addOnVersionId" UUID NOT NULL,
    "catalogItemId" UUID NOT NULL,
    "effectType" "PlatformAddOnLimitEffectType" NOT NULL,
    "unlimited" BOOLEAN NOT NULL DEFAULT false,
    "valueText" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_addon_version_limit_effects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_addon_version_limit_effects_addOnVersionId_catalogItemId_key" ON "platform_addon_version_limit_effects"("addOnVersionId", "catalogItemId");
CREATE INDEX "platform_addon_version_limit_effects_addOnVersionId_idx" ON "platform_addon_version_limit_effects"("addOnVersionId");
CREATE INDEX "platform_addon_version_limit_effects_catalogItemId_idx" ON "platform_addon_version_limit_effects"("catalogItemId");

CREATE TABLE "platform_addon_version_applicability" (
    "id" UUID NOT NULL,
    "addOnVersionId" UUID NOT NULL,
    "planCanonicalKey" VARCHAR(128) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_addon_version_applicability_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_addon_version_applicability_addOnVersionId_planCanonicalKey_key" ON "platform_addon_version_applicability"("addOnVersionId", "planCanonicalKey");
CREATE INDEX "platform_addon_version_applicability_addOnVersionId_idx" ON "platform_addon_version_applicability"("addOnVersionId");
CREATE INDEX "platform_addon_version_applicability_planCanonicalKey_idx" ON "platform_addon_version_applicability"("planCanonicalKey");

-- ─── Commercial Overrides (definition only — no tenant assignment FK) ───────

CREATE TABLE "platform_commercial_overrides" (
    "id" UUID NOT NULL,
    "lifecycle" "PlatformCommercialOverrideLifecycle" NOT NULL DEFAULT 'DRAFT',
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    "reasonCode" "PlatformCommercialOverrideReasonCode" NOT NULL,
    "reasonNote" VARCHAR(500) NOT NULL,
    "effectiveFrom" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdByPlatformUserId" UUID NOT NULL,
    "submittedByPlatformUserId" UUID,
    "approvedByPlatformUserId" UUID,
    "rejectedByPlatformUserId" UUID,
    "revokedByPlatformUserId" UUID,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "rejectionReason" VARCHAR(500),
    "revocationReason" VARCHAR(500),
    "predecessorId" UUID,
    "compositionFingerprint" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_commercial_overrides_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "platform_commercial_overrides_lifecycle_idx" ON "platform_commercial_overrides"("lifecycle");
CREATE INDEX "platform_commercial_overrides_createdBy_idx" ON "platform_commercial_overrides"("createdByPlatformUserId");
CREATE INDEX "platform_commercial_overrides_predecessorId_idx" ON "platform_commercial_overrides"("predecessorId");

CREATE TABLE "platform_commercial_override_effects" (
    "id" UUID NOT NULL,
    "overrideId" UUID NOT NULL,
    "effectKind" "PlatformCommercialOverrideEffectKind" NOT NULL,
    "catalogItemId" UUID NOT NULL,
    "unlimited" BOOLEAN NOT NULL DEFAULT false,
    "valueText" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_commercial_override_effects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_commercial_override_effects_overrideId_catalogItemId_effectKind_key"
  ON "platform_commercial_override_effects"("overrideId", "catalogItemId", "effectKind");
CREATE INDEX "platform_commercial_override_effects_overrideId_idx" ON "platform_commercial_override_effects"("overrideId");
CREATE INDEX "platform_commercial_override_effects_catalogItemId_idx" ON "platform_commercial_override_effects"("catalogItemId");

-- ─── Idempotency (separate bounded context from Plans/Catalog) ──────────────

CREATE TABLE "platform_commercial_idempotency" (
    "id" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "operation" VARCHAR(64) NOT NULL,
    "idempotencyKey" VARCHAR(128) NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,
    "resultResourceType" VARCHAR(32) NOT NULL,
    "resultResourceId" UUID NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_commercial_idempotency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_commercial_idempotency_actorId_operation_idempotencyKey_key"
  ON "platform_commercial_idempotency"("actorId", "operation", "idempotencyKey");
CREATE INDEX "platform_commercial_idempotency_expiresAt_idx" ON "platform_commercial_idempotency"("expiresAt");

-- ─── Foreign keys (Restrict — no cascade delete of published history) ───────

ALTER TABLE "platform_addon_translations"
  ADD CONSTRAINT "platform_addon_translations_addOnId_fkey"
  FOREIGN KEY ("addOnId") REFERENCES "platform_addons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "platform_addon_versions"
  ADD CONSTRAINT "platform_addon_versions_addOnId_fkey"
  FOREIGN KEY ("addOnId") REFERENCES "platform_addons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "platform_addon_versions"
  ADD CONSTRAINT "platform_addon_versions_sourceVersionId_fkey"
  FOREIGN KEY ("sourceVersionId") REFERENCES "platform_addon_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "platform_addon_version_translations"
  ADD CONSTRAINT "platform_addon_version_translations_addOnVersionId_fkey"
  FOREIGN KEY ("addOnVersionId") REFERENCES "platform_addon_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "platform_addon_version_entitlements"
  ADD CONSTRAINT "platform_addon_version_entitlements_addOnVersionId_fkey"
  FOREIGN KEY ("addOnVersionId") REFERENCES "platform_addon_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "platform_addon_version_entitlements"
  ADD CONSTRAINT "platform_addon_version_entitlements_catalogItemId_fkey"
  FOREIGN KEY ("catalogItemId") REFERENCES "healthcare_catalog_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "platform_addon_version_limit_effects"
  ADD CONSTRAINT "platform_addon_version_limit_effects_addOnVersionId_fkey"
  FOREIGN KEY ("addOnVersionId") REFERENCES "platform_addon_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "platform_addon_version_limit_effects"
  ADD CONSTRAINT "platform_addon_version_limit_effects_catalogItemId_fkey"
  FOREIGN KEY ("catalogItemId") REFERENCES "healthcare_catalog_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "platform_addon_version_applicability"
  ADD CONSTRAINT "platform_addon_version_applicability_addOnVersionId_fkey"
  FOREIGN KEY ("addOnVersionId") REFERENCES "platform_addon_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "platform_commercial_overrides"
  ADD CONSTRAINT "platform_commercial_overrides_predecessorId_fkey"
  FOREIGN KEY ("predecessorId") REFERENCES "platform_commercial_overrides"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "platform_commercial_override_effects"
  ADD CONSTRAINT "platform_commercial_override_effects_overrideId_fkey"
  FOREIGN KEY ("overrideId") REFERENCES "platform_commercial_overrides"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "platform_commercial_override_effects"
  ADD CONSTRAINT "platform_commercial_override_effects_catalogItemId_fkey"
  FOREIGN KEY ("catalogItemId") REFERENCES "healthcare_catalog_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
