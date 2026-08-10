-- Phase 47 Step 13 — Platform Plans & Plan Versions (additive only).
-- No entitlement/limit/addon/override tables.
-- No subscription Plan Version FK.
-- Preserves Steps 06–12 and current licensing runtime.

CREATE TYPE "PlatformPlanLifecycle" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "PlatformPlanVersionLifecycle" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');
CREATE TYPE "PlatformPlanAliasLifecycle" AS ENUM ('ACTIVE', 'RETIRED');

CREATE TABLE "platform_plans" (
    "id" UUID NOT NULL,
    "canonicalKey" VARCHAR(128) NOT NULL,
    "lifecycle" "PlatformPlanLifecycle" NOT NULL DEFAULT 'DRAFT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "systemSeeded" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_plans_canonicalKey_key" ON "platform_plans"("canonicalKey");
CREATE INDEX "platform_plans_lifecycle_sortOrder_idx" ON "platform_plans"("lifecycle", "sortOrder");

CREATE TABLE "platform_plan_translations" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "locale" VARCHAR(10) NOT NULL,
    "displayName" VARCHAR(200) NOT NULL,
    "shortDescription" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_plan_translations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_plan_translations_planId_locale_key" ON "platform_plan_translations"("planId", "locale");
CREATE INDEX "platform_plan_translations_locale_displayName_idx" ON "platform_plan_translations"("locale", "displayName");

CREATE TABLE "platform_plan_aliases" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "sourceNamespace" VARCHAR(64) NOT NULL,
    "aliasValue" VARCHAR(128) NOT NULL,
    "normalizedValue" VARCHAR(128) NOT NULL,
    "lifecycle" "PlatformPlanAliasLifecycle" NOT NULL DEFAULT 'ACTIVE',
    "migrationNote" VARCHAR(500),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retiredAt" TIMESTAMP(3),

    CONSTRAINT "platform_plan_aliases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_plan_aliases_sourceNamespace_aliasValue_key" ON "platform_plan_aliases"("sourceNamespace", "aliasValue");
CREATE INDEX "platform_plan_aliases_planId_lifecycle_idx" ON "platform_plan_aliases"("planId", "lifecycle");
CREATE INDEX "platform_plan_aliases_sourceNamespace_normalizedValue_idx" ON "platform_plan_aliases"("sourceNamespace", "normalizedValue");

CREATE TABLE "platform_plan_versions" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "lifecycle" "PlatformPlanVersionLifecycle" NOT NULL DEFAULT 'DRAFT',
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    "effectiveFrom" TIMESTAMP(3),
    "retireAt" TIMESTAMP(3),
    "trialDefaultEnabled" BOOLEAN,
    "trialDefaultDays" INTEGER,
    "priceAmountMinor" INTEGER,
    "priceCurrency" VARCHAR(3),
    "billingInterval" VARCHAR(16),
    "billingIntervalCount" INTEGER,
    "internalReleaseNotes" VARCHAR(2000),
    "publishedAt" TIMESTAMP(3),
    "publishedByPlatformUserId" UUID,
    "publicationFingerprint" VARCHAR(64),
    "publicationReason" VARCHAR(500),
    "sourceVersionId" UUID,
    "systemSeeded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_plan_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_plan_versions_planId_versionNumber_key" ON "platform_plan_versions"("planId", "versionNumber");
CREATE INDEX "platform_plan_versions_planId_lifecycle_idx" ON "platform_plan_versions"("planId", "lifecycle");
CREATE INDEX "platform_plan_versions_lifecycle_publishedAt_idx" ON "platform_plan_versions"("lifecycle", "publishedAt");
-- Exactly one open Draft Plan Version per Plan (MVP policy).
CREATE UNIQUE INDEX "platform_plan_versions_one_draft_per_plan" ON "platform_plan_versions"("planId") WHERE "lifecycle" = 'DRAFT';

CREATE TABLE "platform_plan_version_translations" (
    "id" UUID NOT NULL,
    "planVersionId" UUID NOT NULL,
    "locale" VARCHAR(10) NOT NULL,
    "releaseLabel" VARCHAR(200) NOT NULL,
    "shortDescription" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_plan_version_translations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_plan_version_translations_planVersionId_locale_key" ON "platform_plan_version_translations"("planVersionId", "locale");
CREATE INDEX "platform_plan_version_translations_locale_releaseLabel_idx" ON "platform_plan_version_translations"("locale", "releaseLabel");

CREATE TABLE "platform_plan_idempotency" (
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

    CONSTRAINT "platform_plan_idempotency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_plan_idempotency_actorId_operation_idempotencyKey_key" ON "platform_plan_idempotency"("actorId", "operation", "idempotencyKey");
CREATE INDEX "platform_plan_idempotency_expiresAt_idx" ON "platform_plan_idempotency"("expiresAt");

ALTER TABLE "platform_plan_translations" ADD CONSTRAINT "platform_plan_translations_planId_fkey" FOREIGN KEY ("planId") REFERENCES "platform_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "platform_plan_aliases" ADD CONSTRAINT "platform_plan_aliases_planId_fkey" FOREIGN KEY ("planId") REFERENCES "platform_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "platform_plan_versions" ADD CONSTRAINT "platform_plan_versions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "platform_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "platform_plan_versions" ADD CONSTRAINT "platform_plan_versions_sourceVersionId_fkey" FOREIGN KEY ("sourceVersionId") REFERENCES "platform_plan_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "platform_plan_version_translations" ADD CONSTRAINT "platform_plan_version_translations_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "platform_plan_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
