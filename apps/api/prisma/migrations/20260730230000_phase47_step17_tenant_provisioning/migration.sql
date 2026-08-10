-- Flexible Step 17 — Tenant Creation and Provisioning (additive only).
-- Creates zero tenants, requests, subscriptions, invitations, or U01 rows.

CREATE TYPE "platform_tenant_provisioning_status" AS ENUM (
  'REQUESTED',
  'VALIDATING',
  'READY',
  'PROVISIONING',
  'AWAITING_ACTIVATION',
  'COMPLETED',
  'FAILED_RETRYABLE',
  'FAILED_TERMINAL',
  'COMPENSATING',
  'COMPENSATED',
  'CANCELLED_BEFORE_ACTIVATION'
);

CREATE TABLE "platform_tenant_provisioning_requests" (
  "id" UUID NOT NULL,
  "status" "platform_tenant_provisioning_status" NOT NULL DEFAULT 'REQUESTED',
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  "organizationName" VARCHAR(255) NOT NULL,
  "requestedSlug" VARCHAR(100),
  "reservedSlug" VARCHAR(100),
  "region" VARCHAR(64),
  "timezone" VARCHAR(50),
  "facilityTypeKey" VARCHAR(128) NOT NULL,
  "specialtyKeys" JSONB NOT NULL,
  "publishedPlanVersionId" UUID NOT NULL,
  "addOnSelections" JSONB NOT NULL DEFAULT '[]',
  "adminEmail" VARCHAR(320) NOT NULL,
  "adminDisplayName" VARCHAR(255),
  "adminLocale" VARCHAR(16),
  "onboardingType" VARCHAR(32) NOT NULL,
  "requestedStartAt" TIMESTAMP(3),
  "salesAttributionId" VARCHAR(128),
  "externalRequestId" VARCHAR(128),
  "previewFingerprint" VARCHAR(64),
  "compatibilityFingerprint" VARCHAR(64),
  "tenantId" UUID,
  "platformTenantId" UUID,
  "commercialConfigId" UUID,
  "invitationId" UUID,
  "lastErrorCode" VARCHAR(64),
  "correlationId" UUID NOT NULL,
  "createdByPlatformUserId" UUID NOT NULL,
  "invitationPreparedAt" TIMESTAMP(3),
  "invitationDispatchedAt" TIMESTAMP(3),
  "activatedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_tenant_provisioning_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_tenant_provisioning_requests_externalRequestId_key"
  ON "platform_tenant_provisioning_requests"("externalRequestId");
CREATE INDEX "platform_tenant_provisioning_requests_status_idx"
  ON "platform_tenant_provisioning_requests"("status");
CREATE INDEX "platform_tenant_provisioning_requests_createdByPlatformUserId_idx"
  ON "platform_tenant_provisioning_requests"("createdByPlatformUserId");
CREATE INDEX "platform_tenant_provisioning_requests_reservedSlug_idx"
  ON "platform_tenant_provisioning_requests"("reservedSlug");
CREATE INDEX "platform_tenant_provisioning_requests_tenantId_idx"
  ON "platform_tenant_provisioning_requests"("tenantId");
CREATE INDEX "platform_tenant_provisioning_requests_platformTenantId_idx"
  ON "platform_tenant_provisioning_requests"("platformTenantId");
CREATE INDEX "platform_tenant_provisioning_requests_commercialConfigId_idx"
  ON "platform_tenant_provisioning_requests"("commercialConfigId");

CREATE TABLE "platform_tenant_provisioning_checkpoints" (
  "id" UUID NOT NULL,
  "requestId" UUID NOT NULL,
  "checkpointKey" VARCHAR(64) NOT NULL,
  "status" VARCHAR(16) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "evidenceJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_tenant_provisioning_checkpoints_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_tenant_provisioning_checkpoints_requestId_checkpointKey_key"
  ON "platform_tenant_provisioning_checkpoints"("requestId", "checkpointKey");
CREATE INDEX "platform_tenant_provisioning_checkpoints_requestId_status_idx"
  ON "platform_tenant_provisioning_checkpoints"("requestId", "status");

ALTER TABLE "platform_tenant_provisioning_checkpoints"
  ADD CONSTRAINT "platform_tenant_provisioning_checkpoints_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "platform_tenant_provisioning_requests"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "platform_tenant_provisioning_owned_resources" (
  "id" UUID NOT NULL,
  "requestId" UUID NOT NULL,
  "resourceType" VARCHAR(64) NOT NULL,
  "resourceId" UUID NOT NULL,
  "provenance" VARCHAR(32) NOT NULL,
  "safeToCompensate" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_tenant_provisioning_owned_resources_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_tenant_provisioning_owned_resources_requestId_resourceType_resourceId_key"
  ON "platform_tenant_provisioning_owned_resources"("requestId", "resourceType", "resourceId");
CREATE INDEX "platform_tenant_provisioning_owned_resources_requestId_idx"
  ON "platform_tenant_provisioning_owned_resources"("requestId");

ALTER TABLE "platform_tenant_provisioning_owned_resources"
  ADD CONSTRAINT "platform_tenant_provisioning_owned_resources_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "platform_tenant_provisioning_requests"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "platform_tenant_provisioning_idempotency" (
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
  CONSTRAINT "platform_tenant_provisioning_idempotency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_tenant_provisioning_idempotency_actorId_operation_idempotencyKey_key"
  ON "platform_tenant_provisioning_idempotency"("actorId", "operation", "idempotencyKey");
CREATE INDEX "platform_tenant_provisioning_idempotency_expiresAt_idx"
  ON "platform_tenant_provisioning_idempotency"("expiresAt");
