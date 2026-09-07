-- Flexible Step 23 — Sales Representative Management (Platform identity extension).
-- Contract: docs/SALES_REPRESENTATIVE_MANAGEMENT.md
-- Additive only. No Step 24+ (Leads/Opportunities/Pipeline/Trials) tables.

CREATE TYPE "platform_sales_representative_status" AS ENUM (
  'PENDING_ACTIVATION',
  'ACTIVE',
  'SUSPENDED',
  'DISABLED'
);

CREATE TYPE "platform_sales_target_period" AS ENUM (
  'MONTH',
  'QUARTER',
  'YEAR'
);

CREATE TABLE IF NOT EXISTS "platform_sales_representatives" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "platformUserId" UUID NOT NULL UNIQUE,
  "status" "platform_sales_representative_status" NOT NULL DEFAULT 'PENDING_ACTIVATION',
  "managerRepresentativeId" UUID,
  "regionCode" VARCHAR(64),
  "territoryCode" VARCHAR(64),
  "targetAmount" DECIMAL(18, 4),
  "targetCurrency" VARCHAR(8),
  "targetPeriod" "platform_sales_target_period",
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "platform_sales_representatives_platformUserId_fkey"
    FOREIGN KEY ("platformUserId") REFERENCES "platform_users"("id") ON DELETE RESTRICT,
  CONSTRAINT "platform_sales_representatives_managerRepresentativeId_fkey"
    FOREIGN KEY ("managerRepresentativeId") REFERENCES "platform_sales_representatives"("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "platform_sales_representatives_status_idx"
  ON "platform_sales_representatives" ("status");
CREATE INDEX IF NOT EXISTS "platform_sales_representatives_managerRepresentativeId_idx"
  ON "platform_sales_representatives" ("managerRepresentativeId");
CREATE INDEX IF NOT EXISTS "platform_sales_representatives_regionCode_idx"
  ON "platform_sales_representatives" ("regionCode");
CREATE INDEX IF NOT EXISTS "platform_sales_representatives_territoryCode_idx"
  ON "platform_sales_representatives" ("territoryCode");

CREATE TABLE IF NOT EXISTS "platform_sales_customer_ownership" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "representativeId" UUID NOT NULL,
  "platformTenantId" UUID NOT NULL UNIQUE,
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  "assignedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "assignedById" UUID NOT NULL,
  "reason" VARCHAR(500),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "platform_sales_customer_ownership_representativeId_fkey"
    FOREIGN KEY ("representativeId") REFERENCES "platform_sales_representatives"("id") ON DELETE RESTRICT,
  CONSTRAINT "platform_sales_customer_ownership_platformTenantId_fkey"
    FOREIGN KEY ("platformTenantId") REFERENCES "platform_tenants"("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "platform_sales_customer_ownership_representativeId_idx"
  ON "platform_sales_customer_ownership" ("representativeId");

CREATE TABLE IF NOT EXISTS "platform_sales_customer_ownership_history" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ownershipId" UUID,
  "representativeId" UUID,
  "platformTenantId" UUID NOT NULL,
  "action" VARCHAR(32) NOT NULL,
  "actorPlatformUserId" UUID NOT NULL,
  "reason" VARCHAR(500),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "platform_sales_customer_ownership_history_ownershipId_fkey"
    FOREIGN KEY ("ownershipId") REFERENCES "platform_sales_customer_ownership"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "platform_sales_customer_ownership_history_tenant_created_idx"
  ON "platform_sales_customer_ownership_history" ("platformTenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "platform_sales_customer_ownership_history_rep_created_idx"
  ON "platform_sales_customer_ownership_history" ("representativeId", "createdAt");
CREATE INDEX IF NOT EXISTS "platform_sales_customer_ownership_history_ownershipId_idx"
  ON "platform_sales_customer_ownership_history" ("ownershipId");

CREATE TABLE IF NOT EXISTS "platform_sales_idempotency" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "actorId" UUID NOT NULL,
  "operation" VARCHAR(64) NOT NULL,
  "idempotencyKey" VARCHAR(128) NOT NULL,
  "requestHash" VARCHAR(64) NOT NULL,
  "resultResourceType" VARCHAR(32) NOT NULL,
  "resultResourceId" UUID NOT NULL,
  "status" VARCHAR(16) NOT NULL,
  "resultPayload" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "expiresAt" TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_sales_idempotency_actor_op_key_uidx"
  ON "platform_sales_idempotency" ("actorId", "operation", "idempotencyKey");

CREATE INDEX IF NOT EXISTS "platform_sales_idempotency_expires_idx"
  ON "platform_sales_idempotency" ("expiresAt");
