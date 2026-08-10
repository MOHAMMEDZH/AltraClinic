-- Phase 47 Step 16 — Subscription Commercial Assignment
-- Commercial configuration SoR only. Does not mutate runtime PlatformSubscription plan/status.
-- LicensingEngineService must not read these tables in Step 16.

CREATE TYPE "platform_subscription_commercial_lifecycle" AS ENUM (
  'DRAFT',
  'SCHEDULED',
  'ACTIVE_COMMERCIAL',
  'SUSPENDED',
  'CANCELLED',
  'EXPIRED',
  'SUPERSEDED'
);

CREATE TABLE "platform_subscription_commercial_configs" (
  "id" UUID NOT NULL,
  "platformTenantId" UUID NOT NULL,
  "platformSubscriptionId" UUID,
  "lifecycle" "platform_subscription_commercial_lifecycle" NOT NULL DEFAULT 'DRAFT',
  "isCurrent" BOOLEAN NOT NULL DEFAULT true,
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  "planVersionId" UUID,
  "commercialStart" TIMESTAMP(3),
  "commercialEnd" TIMESTAMP(3),
  "scheduledActivationAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "cancellationEffectiveAt" TIMESTAMP(3),
  "reasonCode" VARCHAR(64),
  "reasonNote" VARCHAR(500),
  "commercialFingerprint" VARCHAR(64),
  "fingerprintSchemaVersion" VARCHAR(64),
  "predecessorId" UUID,
  "createdByPlatformUserId" UUID NOT NULL,
  "activatedByPlatformUserId" UUID,
  "activatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "platform_subscription_commercial_configs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "platform_subscription_commercial_dates_order"
    CHECK ("commercialStart" IS NULL OR "commercialEnd" IS NULL OR "commercialStart" < "commercialEnd"),
  CONSTRAINT "platform_subscription_commercial_no_self_supersede"
    CHECK ("predecessorId" IS NULL OR "predecessorId" <> "id")
);

CREATE TABLE "platform_subscription_addon_assignments" (
  "id" UUID NOT NULL,
  "configId" UUID NOT NULL,
  "addOnVersionId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "platform_subscription_addon_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platform_subscription_override_assignments" (
  "id" UUID NOT NULL,
  "configId" UUID NOT NULL,
  "overrideId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "platform_subscription_override_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platform_subscription_commercial_snapshots" (
  "id" UUID NOT NULL,
  "configId" UUID NOT NULL,
  "fingerprint" VARCHAR(64) NOT NULL,
  "fingerprintSchemaVersion" VARCHAR(64) NOT NULL,
  "snapshotPayload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "platform_subscription_commercial_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platform_subscription_commercial_changes" (
  "id" UUID NOT NULL,
  "configId" UUID NOT NULL,
  "action" VARCHAR(64) NOT NULL,
  "actorId" UUID NOT NULL,
  "beforeLifecycle" VARCHAR(32),
  "afterLifecycle" VARCHAR(32),
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "platform_subscription_commercial_changes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platform_subscription_commercial_idempotency" (
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

  CONSTRAINT "platform_subscription_commercial_idempotency_pkey" PRIMARY KEY ("id")
);

-- Cardinality: one current commercial configuration per PlatformTenant
CREATE UNIQUE INDEX "platform_subscription_commercial_one_current_per_tenant"
  ON "platform_subscription_commercial_configs" ("platformTenantId")
  WHERE "isCurrent" = true;

CREATE INDEX "platform_subscription_commercial_configs_platformTenantId_lifecycle_idx"
  ON "platform_subscription_commercial_configs"("platformTenantId", "lifecycle");

CREATE INDEX "platform_subscription_commercial_configs_platformTenantId_isCurrent_idx"
  ON "platform_subscription_commercial_configs"("platformTenantId", "isCurrent");

CREATE INDEX "platform_subscription_commercial_configs_lifecycle_idx"
  ON "platform_subscription_commercial_configs"("lifecycle");

CREATE INDEX "platform_subscription_commercial_configs_planVersionId_idx"
  ON "platform_subscription_commercial_configs"("planVersionId");

CREATE INDEX "platform_subscription_commercial_configs_predecessorId_idx"
  ON "platform_subscription_commercial_configs"("predecessorId");

CREATE INDEX "platform_subscription_commercial_configs_commercialStart_commercialEnd_idx"
  ON "platform_subscription_commercial_configs"("commercialStart", "commercialEnd");

CREATE UNIQUE INDEX "platform_subscription_addon_assignments_configId_addOnVersionId_key"
  ON "platform_subscription_addon_assignments"("configId", "addOnVersionId");

CREATE INDEX "platform_subscription_addon_assignments_configId_idx"
  ON "platform_subscription_addon_assignments"("configId");

CREATE INDEX "platform_subscription_addon_assignments_addOnVersionId_idx"
  ON "platform_subscription_addon_assignments"("addOnVersionId");

CREATE UNIQUE INDEX "platform_subscription_override_assignments_configId_overrideId_key"
  ON "platform_subscription_override_assignments"("configId", "overrideId");

CREATE INDEX "platform_subscription_override_assignments_configId_idx"
  ON "platform_subscription_override_assignments"("configId");

CREATE INDEX "platform_subscription_override_assignments_overrideId_idx"
  ON "platform_subscription_override_assignments"("overrideId");

CREATE UNIQUE INDEX "platform_subscription_commercial_snapshots_configId_key"
  ON "platform_subscription_commercial_snapshots"("configId");

CREATE INDEX "platform_subscription_commercial_snapshots_fingerprint_idx"
  ON "platform_subscription_commercial_snapshots"("fingerprint");

CREATE INDEX "platform_subscription_commercial_changes_configId_createdAt_idx"
  ON "platform_subscription_commercial_changes"("configId", "createdAt");

CREATE INDEX "platform_subscription_commercial_changes_action_idx"
  ON "platform_subscription_commercial_changes"("action");

CREATE UNIQUE INDEX "platform_subscription_commercial_idempotency_actorId_operation_idempotencyKe"
  ON "platform_subscription_commercial_idempotency"("actorId", "operation", "idempotencyKey");

CREATE INDEX "platform_subscription_commercial_idempotency_expiresAt_idx"
  ON "platform_subscription_commercial_idempotency"("expiresAt");

ALTER TABLE "platform_subscription_commercial_configs"
  ADD CONSTRAINT "platform_subscription_commercial_configs_platformTenantId_fkey"
  FOREIGN KEY ("platformTenantId") REFERENCES "platform_tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "platform_subscription_commercial_configs"
  ADD CONSTRAINT "platform_subscription_commercial_configs_platformSubscriptionId_fkey"
  FOREIGN KEY ("platformSubscriptionId") REFERENCES "platform_subscriptions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "platform_subscription_commercial_configs"
  ADD CONSTRAINT "platform_subscription_commercial_configs_planVersionId_fkey"
  FOREIGN KEY ("planVersionId") REFERENCES "platform_plan_versions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "platform_subscription_commercial_configs"
  ADD CONSTRAINT "platform_subscription_commercial_configs_predecessorId_fkey"
  FOREIGN KEY ("predecessorId") REFERENCES "platform_subscription_commercial_configs"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "platform_subscription_addon_assignments"
  ADD CONSTRAINT "platform_subscription_addon_assignments_configId_fkey"
  FOREIGN KEY ("configId") REFERENCES "platform_subscription_commercial_configs"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "platform_subscription_addon_assignments"
  ADD CONSTRAINT "platform_subscription_addon_assignments_addOnVersionId_fkey"
  FOREIGN KEY ("addOnVersionId") REFERENCES "platform_addon_versions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "platform_subscription_override_assignments"
  ADD CONSTRAINT "platform_subscription_override_assignments_configId_fkey"
  FOREIGN KEY ("configId") REFERENCES "platform_subscription_commercial_configs"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "platform_subscription_override_assignments"
  ADD CONSTRAINT "platform_subscription_override_assignments_overrideId_fkey"
  FOREIGN KEY ("overrideId") REFERENCES "platform_commercial_overrides"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "platform_subscription_commercial_snapshots"
  ADD CONSTRAINT "platform_subscription_commercial_snapshots_configId_fkey"
  FOREIGN KEY ("configId") REFERENCES "platform_subscription_commercial_configs"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "platform_subscription_commercial_changes"
  ADD CONSTRAINT "platform_subscription_commercial_changes_configId_fkey"
  FOREIGN KEY ("configId") REFERENCES "platform_subscription_commercial_configs"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
