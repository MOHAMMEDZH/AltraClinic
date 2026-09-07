-- Flexible Step 25 — Trial Creation and Customer Conversion.
-- Contract: docs/TRIAL_CREATION_AND_CUSTOMER_CONVERSION.md
-- Additive only. Trials are never auto-created by migration.
-- Entitlements stay Step 16 commercial snapshot + Step 18 EER (no parallel Trial engine).
-- No Step 26 commission/productivity tables. No billing invoice/charge/payment tables.

CREATE TYPE "platform_sales_trial_status" AS ENUM (
  'DRAFT',
  'PENDING_PROVISIONING',
  'ACTIVE',
  'EXPIRED',
  'CONVERTED',
  'CANCELLED'
);

CREATE TABLE IF NOT EXISTS "platform_sales_trials" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "platformTenantId" UUID,
  "originatingLeadId" UUID,
  "ownerRepresentativeId" UUID,
  "attributionSnapshotJson" JSONB NOT NULL DEFAULT '{}',
  "trialPlanVersionId" UUID NOT NULL,
  "status" "platform_sales_trial_status" NOT NULL DEFAULT 'DRAFT',
  "organizationName" VARCHAR(255) NOT NULL,
  "facilityTypeKey" VARCHAR(128) NOT NULL,
  "selectedSpecialtyKeys" JSONB NOT NULL DEFAULT '[]',
  "selectedModuleKeys" JSONB NOT NULL DEFAULT '[]',
  "startsAt" TIMESTAMPTZ,
  "expiresAt" TIMESTAMPTZ,
  "maxExtensions" INTEGER NOT NULL DEFAULT 2,
  "extensionCount" INTEGER NOT NULL DEFAULT 0,
  "commercialConfigId" UUID,
  "provisioningRequestId" UUID,
  "trialOnlyGrantsJson" JSONB NOT NULL DEFAULT '[]',
  "expiredAt" TIMESTAMPTZ,
  "cancelledAt" TIMESTAMPTZ,
  "cancellationReason" VARCHAR(1000),
  "createdByPlatformUserId" UUID NOT NULL,
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "platform_sales_trials_platformTenantId_fkey"
    FOREIGN KEY ("platformTenantId") REFERENCES "platform_tenants"("id") ON DELETE RESTRICT,
  CONSTRAINT "platform_sales_trials_originatingLeadId_fkey"
    FOREIGN KEY ("originatingLeadId") REFERENCES "platform_sales_leads"("id") ON DELETE RESTRICT,
  CONSTRAINT "platform_sales_trials_ownerRepresentativeId_fkey"
    FOREIGN KEY ("ownerRepresentativeId") REFERENCES "platform_sales_representatives"("id") ON DELETE RESTRICT,
  CONSTRAINT "platform_sales_trials_trialPlanVersionId_fkey"
    FOREIGN KEY ("trialPlanVersionId") REFERENCES "platform_plan_versions"("id") ON DELETE RESTRICT,
  -- Bounded extension policy: never 0 = unlimited, never negative counters.
  CONSTRAINT "platform_sales_trials_max_extensions_bounded"
    CHECK ("maxExtensions" >= 1 AND "maxExtensions" <= 12),
  CONSTRAINT "platform_sales_trials_extension_count_bounded"
    CHECK ("extensionCount" >= 0 AND "extensionCount" <= "maxExtensions"),
  CONSTRAINT "platform_sales_trials_window_order"
    CHECK ("startsAt" IS NULL OR "expiresAt" IS NULL OR "startsAt" < "expiresAt")
);

CREATE INDEX IF NOT EXISTS "platform_sales_trials_ownerRepresentativeId_idx"
  ON "platform_sales_trials" ("ownerRepresentativeId");
CREATE INDEX IF NOT EXISTS "platform_sales_trials_status_idx"
  ON "platform_sales_trials" ("status");
-- Expiry job claim: status = 'ACTIVE' AND "expiresAt" <= now() ORDER BY "expiresAt", "id"
CREATE INDEX IF NOT EXISTS "platform_sales_trials_status_expiresAt_id_idx"
  ON "platform_sales_trials" ("status", "expiresAt", "id");
CREATE INDEX IF NOT EXISTS "platform_sales_trials_expiresAt_id_idx"
  ON "platform_sales_trials" ("expiresAt", "id");
CREATE INDEX IF NOT EXISTS "platform_sales_trials_createdAt_id_idx"
  ON "platform_sales_trials" ("createdAt", "id");
CREATE INDEX IF NOT EXISTS "platform_sales_trials_platformTenantId_idx"
  ON "platform_sales_trials" ("platformTenantId");
CREATE INDEX IF NOT EXISTS "platform_sales_trials_originatingLeadId_idx"
  ON "platform_sales_trials" ("originatingLeadId");
CREATE INDEX IF NOT EXISTS "platform_sales_trials_trialPlanVersionId_idx"
  ON "platform_sales_trials" ("trialPlanVersionId");

CREATE TABLE IF NOT EXISTS "platform_sales_trial_extension_history" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "trialId" UUID NOT NULL,
  "previousExpiresAt" TIMESTAMPTZ NOT NULL,
  "newExpiresAt" TIMESTAMPTZ NOT NULL,
  "extensionDays" INTEGER NOT NULL,
  "reason" VARCHAR(1000) NOT NULL,
  "exceptional" BOOLEAN NOT NULL DEFAULT FALSE,
  "actorPlatformUserId" UUID NOT NULL,
  "correlationId" VARCHAR(100),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "platform_sales_trial_extension_history_trialId_fkey"
    FOREIGN KEY ("trialId") REFERENCES "platform_sales_trials"("id") ON DELETE RESTRICT,
  CONSTRAINT "platform_sales_trial_extension_days_bounded"
    CHECK ("extensionDays" >= 1 AND "extensionDays" <= 30),
  CONSTRAINT "platform_sales_trial_extension_forward_only"
    CHECK ("newExpiresAt" > "previousExpiresAt")
);

CREATE INDEX IF NOT EXISTS "platform_sales_trial_extension_history_trial_created_idx"
  ON "platform_sales_trial_extension_history" ("trialId", "createdAt");

CREATE TABLE IF NOT EXISTS "platform_sales_trial_conversions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "trialId" UUID NOT NULL,
  "targetPaidPlanVersionId" UUID NOT NULL,
  "dispositionsJson" JSONB NOT NULL DEFAULT '[]',
  "actorPlatformUserId" UUID NOT NULL,
  "convertedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "correlationId" VARCHAR(100),
  "outboxEventId" UUID,
  "commercialConfigId" UUID,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "platform_sales_trial_conversions_trialId_fkey"
    FOREIGN KEY ("trialId") REFERENCES "platform_sales_trials"("id") ON DELETE RESTRICT,
  CONSTRAINT "platform_sales_trial_conversions_targetPaidPlanVersionId_fkey"
    FOREIGN KEY ("targetPaidPlanVersionId") REFERENCES "platform_plan_versions"("id") ON DELETE RESTRICT
);

-- At most one durable conversion record per Trial (replay-safe conversion).
CREATE UNIQUE INDEX IF NOT EXISTS "platform_sales_trial_conversions_trialId_key"
  ON "platform_sales_trial_conversions" ("trialId");
CREATE INDEX IF NOT EXISTS "platform_sales_trial_conversions_targetPlanVersion_idx"
  ON "platform_sales_trial_conversions" ("targetPaidPlanVersionId");
CREATE INDEX IF NOT EXISTS "platform_sales_trial_conversions_convertedAt_id_idx"
  ON "platform_sales_trial_conversions" ("convertedAt", "id");
