-- Phase 44c: Integrations & Webhooks Engine persistence
-- Secrets stored as AES-256-GCM envelopes only (never plaintext).

CREATE TABLE "integration_providers" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "providerKey" VARCHAR(120) NOT NULL,
    "displayName" VARCHAR(200) NOT NULL,
    "direction" VARCHAR(20) NOT NULL,
    "status" VARCHAR(40) NOT NULL DEFAULT 'active',
    "adapterKind" VARCHAR(40) NOT NULL,
    "version" VARCHAR(40) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "integration_providers_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "integration_providers_providerKey_idx" ON "integration_providers"("providerKey");

CREATE TABLE "integration_webhook_subscriptions" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "targetUrl" VARCHAR(2000) NOT NULL,
    "providerKey" VARCHAR(120) NOT NULL,
    "status" VARCHAR(40) NOT NULL DEFAULT 'active',
    "eventFilters" JSONB NOT NULL DEFAULT '[]',
    "secretId" UUID NOT NULL,
    "secretVersion" INTEGER NOT NULL DEFAULT 1,
    "maxAttempts" INTEGER NOT NULL DEFAULT 8,
    "timeoutMs" INTEGER NOT NULL DEFAULT 10000,
    "customHeaders" JSONB NOT NULL DEFAULT '{}',
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "disabledAt" TIMESTAMP(3),
    CONSTRAINT "integration_webhook_subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "integration_webhook_subscriptions_tenantId_status_idx"
    ON "integration_webhook_subscriptions"("tenantId", "status");
ALTER TABLE "integration_webhook_subscriptions"
    ADD CONSTRAINT "integration_webhook_subscriptions_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "integration_webhook_secrets" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "ciphertextEnvelope" TEXT NOT NULL,
    "status" VARCHAR(40) NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retiredAt" TIMESTAMP(3),
    CONSTRAINT "integration_webhook_secrets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "integration_webhook_secrets_tenantId_subscriptionId_idx"
    ON "integration_webhook_secrets"("tenantId", "subscriptionId");
ALTER TABLE "integration_webhook_secrets"
    ADD CONSTRAINT "integration_webhook_secrets_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "integration_webhook_deliveries" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "eventType" VARCHAR(120) NOT NULL,
    "eventId" UUID NOT NULL,
    "correlationId" VARCHAR(100) NOT NULL,
    "causationId" VARCHAR(100),
    "payloadJson" TEXT NOT NULL,
    "status" VARCHAR(40) NOT NULL DEFAULT 'pending',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 8,
    "nextAttemptAt" TIMESTAMP(3),
    "lastError" VARCHAR(1000),
    "responseCode" INTEGER,
    "deadLetteredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "integration_webhook_deliveries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "integration_webhook_deliveries_tenantId_status_idx"
    ON "integration_webhook_deliveries"("tenantId", "status");
CREATE INDEX "integration_webhook_deliveries_tenantId_subscriptionId_idx"
    ON "integration_webhook_deliveries"("tenantId", "subscriptionId");
ALTER TABLE "integration_webhook_deliveries"
    ADD CONSTRAINT "integration_webhook_deliveries_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "integration_webhook_attempts" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "deliveryId" UUID NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "outcome" VARCHAR(40) NOT NULL,
    "responseCode" INTEGER,
    "latencyMs" INTEGER,
    "errorMessage" VARCHAR(1000),
    "nonce" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "integration_webhook_attempts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "integration_webhook_attempts_tenantId_deliveryId_idx"
    ON "integration_webhook_attempts"("tenantId", "deliveryId");
ALTER TABLE "integration_webhook_attempts"
    ADD CONSTRAINT "integration_webhook_attempts_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "integration_webhook_attempts"
    ADD CONSTRAINT "integration_webhook_attempts_deliveryId_fkey"
    FOREIGN KEY ("deliveryId") REFERENCES "integration_webhook_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "integration_webhook_subscriptions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY integration_webhook_subscriptions_tenant_isolation ON "integration_webhook_subscriptions"
    USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE "integration_webhook_secrets" ENABLE ROW LEVEL SECURITY;
CREATE POLICY integration_webhook_secrets_tenant_isolation ON "integration_webhook_secrets"
    USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE "integration_webhook_deliveries" ENABLE ROW LEVEL SECURITY;
CREATE POLICY integration_webhook_deliveries_tenant_isolation ON "integration_webhook_deliveries"
    USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE "integration_webhook_attempts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY integration_webhook_attempts_tenant_isolation ON "integration_webhook_attempts"
    USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
