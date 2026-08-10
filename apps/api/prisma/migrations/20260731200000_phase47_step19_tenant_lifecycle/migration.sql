-- Flexible Step 19 — Tenant Lifecycle Actions (additive)
-- Creates zero lifecycle requests, zero automatic status changes, zero session revocations.

ALTER TABLE "platform_tenants"
  ADD COLUMN IF NOT EXISTS "rowVersion" INTEGER NOT NULL DEFAULT 1;

DO $$ BEGIN
  CREATE TYPE "platform_tenant_lifecycle_request_type" AS ENUM ('ARCHIVE', 'DELETE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "platform_tenant_lifecycle_request_status" AS ENUM (
    'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'APPROVED_HANDOFF', 'EXECUTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "platform_tenant_lifecycle_requests" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "platformTenantId" UUID NOT NULL,
  "type" "platform_tenant_lifecycle_request_type" NOT NULL,
  "status" "platform_tenant_lifecycle_request_status" NOT NULL DEFAULT 'PENDING',
  "reason" VARCHAR(2000) NOT NULL,
  "impactFingerprint" VARCHAR(64) NOT NULL,
  "impactSummaryJson" JSONB,
  "expectedRowVersionAtCreate" INTEGER NOT NULL,
  "typedConfirmation" VARCHAR(255),
  "requesterPlatformUserId" UUID NOT NULL,
  "approverPlatformUserId" UUID,
  "decidedAt" TIMESTAMP(3),
  "decisionReason" VARCHAR(2000),
  "correlationId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_tenant_lifecycle_requests_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "platform_tenant_lifecycle_requests"
  DROP CONSTRAINT IF EXISTS "platform_tenant_lifecycle_requests_platformTenantId_fkey";
ALTER TABLE "platform_tenant_lifecycle_requests"
  ADD CONSTRAINT "platform_tenant_lifecycle_requests_platformTenantId_fkey"
  FOREIGN KEY ("platformTenantId") REFERENCES "platform_tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "platform_tenant_lifecycle_requests_tenantId_status_idx"
  ON "platform_tenant_lifecycle_requests"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "platform_tenant_lifecycle_requests_platformTenantId_status_idx"
  ON "platform_tenant_lifecycle_requests"("platformTenantId", "status");
CREATE INDEX IF NOT EXISTS "platform_tenant_lifecycle_requests_requesterPlatformUserId_idx"
  ON "platform_tenant_lifecycle_requests"("requesterPlatformUserId");
CREATE INDEX IF NOT EXISTS "platform_tenant_lifecycle_requests_type_status_idx"
  ON "platform_tenant_lifecycle_requests"("type", "status");

-- At most one PENDING request per (tenantId, type)
CREATE UNIQUE INDEX IF NOT EXISTS "platform_tenant_lifecycle_requests_pending_unique"
  ON "platform_tenant_lifecycle_requests"("tenantId", "type")
  WHERE "status" = 'PENDING';

CREATE TABLE IF NOT EXISTS "platform_tenant_lifecycle_idempotency" (
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
  CONSTRAINT "platform_tenant_lifecycle_idempotency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_tenant_lifecycle_idempotency_actor_op_key"
  ON "platform_tenant_lifecycle_idempotency"("actorId", "operation", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "platform_tenant_lifecycle_idempotency_expiresAt_idx"
  ON "platform_tenant_lifecycle_idempotency"("expiresAt");
