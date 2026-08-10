-- Phase 47 Step 12 — durable Catalog mutation idempotency (additive).
-- Stores request hash + result identity only. No raw bodies, tokens, or translations.

CREATE TABLE "healthcare_catalog_idempotency" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "actorId" UUID NOT NULL,
  "operation" VARCHAR(64) NOT NULL,
  "idempotencyKey" VARCHAR(128) NOT NULL,
  "requestHash" VARCHAR(64) NOT NULL,
  "resultResourceType" VARCHAR(32) NOT NULL,
  "resultResourceId" UUID NOT NULL,
  "status" VARCHAR(16) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "healthcare_catalog_idempotency_actorId_operation_idempotencyKey_key"
  ON "healthcare_catalog_idempotency"("actorId", "operation", "idempotencyKey");

CREATE INDEX "healthcare_catalog_idempotency_expiresAt_idx"
  ON "healthcare_catalog_idempotency"("expiresAt");
