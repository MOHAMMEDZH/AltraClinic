-- Flexible Step 20 — Feature Flags and Global Settings (additive).
-- Creates zero entitlement/commercial/lifecycle/provisioning/U01/secret rows.

CREATE TYPE "platform_feature_flag_effect" AS ENUM (
  'KILL_SWITCH_DENY',
  'ROLLOUT_ALLOW_FOR_ENTITLED',
  'INTERNAL_IMPLEMENTATION_SELECTION',
  'OPERATIONAL_ENABLEMENT'
);

CREATE TYPE "platform_feature_flag_status" AS ENUM (
  'DRAFT',
  'ACTIVE',
  'DEPRECATED',
  'RETIRED'
);

CREATE TYPE "platform_feature_flag_target_type" AS ENUM (
  'GLOBAL',
  'TENANT_ALLOWLIST',
  'TENANT_DENYLIST',
  'PERCENTAGE'
);

CREATE TYPE "platform_global_setting_value_kind" AS ENUM (
  'BOOLEAN',
  'STRING',
  'INTEGER',
  'REFERENCE',
  'JSON_BOUNDED'
);

CREATE TABLE "platform_feature_flags" (
  "id" UUID NOT NULL,
  "canonicalKey" VARCHAR(128) NOT NULL,
  "displayName" VARCHAR(255) NOT NULL,
  "description" VARCHAR(2000) NOT NULL,
  "ownerTeam" VARCHAR(128) NOT NULL,
  "category" VARCHAR(64) NOT NULL,
  "effect" "platform_feature_flag_effect" NOT NULL,
  "status" "platform_feature_flag_status" NOT NULL DEFAULT 'DRAFT',
  "killSwitchActive" BOOLEAN NOT NULL DEFAULT false,
  "targetType" "platform_feature_flag_target_type" NOT NULL DEFAULT 'GLOBAL',
  "rolloutPercentage" INTEGER NOT NULL DEFAULT 100,
  "defaultDenyWhenUnknown" BOOLEAN NOT NULL DEFAULT true,
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  "createdByPlatformUserId" UUID NOT NULL,
  "updatedByPlatformUserId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deprecatedAt" TIMESTAMP(3),
  CONSTRAINT "platform_feature_flags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_feature_flags_canonicalKey_key" ON "platform_feature_flags"("canonicalKey");
CREATE INDEX "platform_feature_flags_status_effect_idx" ON "platform_feature_flags"("status", "effect");
CREATE INDEX "platform_feature_flags_canonicalKey_idx" ON "platform_feature_flags"("canonicalKey");

CREATE TABLE "platform_feature_flag_targets" (
  "id" UUID NOT NULL,
  "flagId" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "mode" VARCHAR(16) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_feature_flag_targets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_feature_flag_targets_flagId_tenantId_mode_key"
  ON "platform_feature_flag_targets"("flagId", "tenantId", "mode");
CREATE INDEX "platform_feature_flag_targets_tenantId_idx" ON "platform_feature_flag_targets"("tenantId");

ALTER TABLE "platform_feature_flag_targets"
  ADD CONSTRAINT "platform_feature_flag_targets_flagId_fkey"
  FOREIGN KEY ("flagId") REFERENCES "platform_feature_flags"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "platform_feature_flag_history" (
  "id" UUID NOT NULL,
  "flagId" UUID NOT NULL,
  "actorPlatformUserId" UUID NOT NULL,
  "operation" VARCHAR(64) NOT NULL,
  "reason" VARCHAR(2000) NOT NULL,
  "beforeSummaryJson" JSONB,
  "afterSummaryJson" JSONB,
  "correlationId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_feature_flag_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "platform_feature_flag_history_flagId_createdAt_idx"
  ON "platform_feature_flag_history"("flagId", "createdAt");

ALTER TABLE "platform_feature_flag_history"
  ADD CONSTRAINT "platform_feature_flag_history_flagId_fkey"
  FOREIGN KEY ("flagId") REFERENCES "platform_feature_flags"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "platform_feature_flag_idempotency" (
  "id" UUID NOT NULL,
  "actorId" UUID NOT NULL,
  "operation" VARCHAR(64) NOT NULL,
  "idempotencyKey" VARCHAR(128) NOT NULL,
  "requestHash" VARCHAR(64) NOT NULL,
  "resultResourceType" VARCHAR(32) NOT NULL,
  "resultResourceId" UUID NOT NULL,
  "status" VARCHAR(16) NOT NULL,
  "resultPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "platform_feature_flag_idempotency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_feature_flag_idempotency_actorId_operation_idempotencyKey_key"
  ON "platform_feature_flag_idempotency"("actorId", "operation", "idempotencyKey");
CREATE INDEX "platform_feature_flag_idempotency_expiresAt_idx"
  ON "platform_feature_flag_idempotency"("expiresAt");

CREATE TABLE "platform_global_settings" (
  "id" UUID NOT NULL,
  "canonicalKey" VARCHAR(128) NOT NULL,
  "displayName" VARCHAR(255) NOT NULL,
  "description" VARCHAR(2000) NOT NULL,
  "ownerTeam" VARCHAR(128) NOT NULL,
  "valueKind" "platform_global_setting_value_kind" NOT NULL,
  "safeValueJson" JSONB,
  "referenceConfigured" BOOLEAN NOT NULL DEFAULT false,
  "referenceProviderType" VARCHAR(64),
  "referenceId" VARCHAR(128),
  "referenceHealthCategory" VARCHAR(32),
  "referenceRotationRequired" BOOLEAN NOT NULL DEFAULT false,
  "referenceLastVerifiedAt" TIMESTAMP(3),
  "highImpact" BOOLEAN NOT NULL DEFAULT false,
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  "createdByPlatformUserId" UUID NOT NULL,
  "updatedByPlatformUserId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "platform_global_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_global_settings_canonicalKey_key" ON "platform_global_settings"("canonicalKey");
CREATE INDEX "platform_global_settings_canonicalKey_idx" ON "platform_global_settings"("canonicalKey");

CREATE TABLE "platform_global_setting_history" (
  "id" UUID NOT NULL,
  "settingId" UUID NOT NULL,
  "actorPlatformUserId" UUID NOT NULL,
  "operation" VARCHAR(64) NOT NULL,
  "reason" VARCHAR(2000) NOT NULL,
  "beforeSummaryJson" JSONB,
  "afterSummaryJson" JSONB,
  "correlationId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_global_setting_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "platform_global_setting_history_settingId_createdAt_idx"
  ON "platform_global_setting_history"("settingId", "createdAt");

ALTER TABLE "platform_global_setting_history"
  ADD CONSTRAINT "platform_global_setting_history_settingId_fkey"
  FOREIGN KEY ("settingId") REFERENCES "platform_global_settings"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "platform_global_setting_idempotency" (
  "id" UUID NOT NULL,
  "actorId" UUID NOT NULL,
  "operation" VARCHAR(64) NOT NULL,
  "idempotencyKey" VARCHAR(128) NOT NULL,
  "requestHash" VARCHAR(64) NOT NULL,
  "resultResourceType" VARCHAR(32) NOT NULL,
  "resultResourceId" UUID NOT NULL,
  "status" VARCHAR(16) NOT NULL,
  "resultPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "platform_global_setting_idempotency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_global_setting_idempotency_actorId_operation_idempotencyKey_key"
  ON "platform_global_setting_idempotency"("actorId", "operation", "idempotencyKey");
CREATE INDEX "platform_global_setting_idempotency_expiresAt_idx"
  ON "platform_global_setting_idempotency"("expiresAt");
