-- Phase 44d — Gateway & Quotas: quota policies, usage counters, gateway stats

CREATE TABLE "integration_quota_policies" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "name" VARCHAR(200) NOT NULL,
    "scopeKind" VARCHAR(40) NOT NULL,
    "limitCount" INTEGER NOT NULL,
    "windowSeconds" INTEGER NOT NULL,
    "burstLimit" INTEGER NOT NULL DEFAULT 50,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_quota_policies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "integration_usage_counters" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "credentialId" UUID,
    "serviceAccountId" UUID,
    "endpoint" VARCHAR(200) NOT NULL,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "authFailureCount" INTEGER NOT NULL DEFAULT 0,
    "authzFailureCount" INTEGER NOT NULL DEFAULT 0,
    "quotaFailureCount" INTEGER NOT NULL DEFAULT 0,
    "deniedCount" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowSeconds" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_usage_counters_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "integration_gateway_stats" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "authSuccessCount" INTEGER NOT NULL DEFAULT 0,
    "authRejectedCount" INTEGER NOT NULL DEFAULT 0,
    "quotaExceededCount" INTEGER NOT NULL DEFAULT 0,
    "avgAuthLatencyMs" INTEGER,
    "avgQuotaLatencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_gateway_stats_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "integration_quota_policies_tenantId_scopeKind_idx" ON "integration_quota_policies"("tenantId", "scopeKind");
CREATE INDEX "integration_quota_policies_enabled_idx" ON "integration_quota_policies"("enabled");
CREATE INDEX "integration_usage_counters_tenantId_windowStart_idx" ON "integration_usage_counters"("tenantId", "windowStart");
CREATE INDEX "integration_usage_counters_tenantId_credentialId_idx" ON "integration_usage_counters"("tenantId", "credentialId");
CREATE UNIQUE INDEX "integration_usage_counters_tenantId_credentialId_endpoint_windowStart_key" ON "integration_usage_counters"("tenantId", "credentialId", "endpoint", "windowStart");
CREATE INDEX "integration_gateway_stats_tenantId_periodStart_idx" ON "integration_gateway_stats"("tenantId", "periodStart");

ALTER TABLE "integration_quota_policies" ADD CONSTRAINT "integration_quota_policies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "integration_usage_counters" ADD CONSTRAINT "integration_usage_counters_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "integration_gateway_stats" ADD CONSTRAINT "integration_gateway_stats_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Global uniqueness for auth hash lookup (Phase 44d OD-AUTHN)
CREATE UNIQUE INDEX IF NOT EXISTS "integration_api_credentials_keyHash_key" ON "integration_api_credentials"("keyHash");
