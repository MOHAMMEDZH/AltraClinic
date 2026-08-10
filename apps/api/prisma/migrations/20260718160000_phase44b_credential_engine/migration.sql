-- Phase 44b: API Keys & Integrations Credential Engine
-- Hash-only storage; raw credentials never persisted.

CREATE TABLE "integration_service_accounts" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "displayName" VARCHAR(200) NOT NULL,
    "status" VARCHAR(40) NOT NULL DEFAULT 'active',
    "roleBindings" JSONB NOT NULL DEFAULT '[]',
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "disabledAt" TIMESTAMP(3),

    CONSTRAINT "integration_service_accounts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "integration_service_accounts_tenantId_status_idx"
    ON "integration_service_accounts"("tenantId", "status");
CREATE INDEX "integration_service_accounts_tenantId_createdAt_idx"
    ON "integration_service_accounts"("tenantId", "createdAt");

ALTER TABLE "integration_service_accounts"
    ADD CONSTRAINT "integration_service_accounts_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "integration_api_credentials" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID,
    "name" VARCHAR(200) NOT NULL,
    "prefix" VARCHAR(16) NOT NULL,
    "keyHash" VARCHAR(64) NOT NULL,
    "hashAlgorithm" VARCHAR(40) NOT NULL DEFAULT 'sha256_pepper_v1',
    "status" VARCHAR(40) NOT NULL DEFAULT 'active',
    "scopes" JSONB NOT NULL DEFAULT '[]',
    "ownerType" VARCHAR(40) NOT NULL,
    "ownerId" UUID NOT NULL,
    "serviceAccountId" UUID,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdBy" UUID NOT NULL,
    "rotatedFromId" UUID,
    "rotationGraceEndsAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_api_credentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "integration_api_credentials_tenantId_keyHash_key"
    ON "integration_api_credentials"("tenantId", "keyHash");
CREATE INDEX "integration_api_credentials_tenantId_status_idx"
    ON "integration_api_credentials"("tenantId", "status");
CREATE INDEX "integration_api_credentials_tenantId_prefix_idx"
    ON "integration_api_credentials"("tenantId", "prefix");
CREATE INDEX "integration_api_credentials_tenantId_ownerType_ownerId_idx"
    ON "integration_api_credentials"("tenantId", "ownerType", "ownerId");
CREATE INDEX "integration_api_credentials_tenantId_createdAt_idx"
    ON "integration_api_credentials"("tenantId", "createdAt");
CREATE INDEX "integration_api_credentials_status_rotationGraceEndsAt_idx"
    ON "integration_api_credentials"("status", "rotationGraceEndsAt");
CREATE INDEX "integration_api_credentials_status_expiresAt_idx"
    ON "integration_api_credentials"("status", "expiresAt");

ALTER TABLE "integration_api_credentials"
    ADD CONSTRAINT "integration_api_credentials_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "integration_api_credentials"
    ADD CONSTRAINT "integration_api_credentials_serviceAccountId_fkey"
    FOREIGN KEY ("serviceAccountId") REFERENCES "integration_service_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "integration_service_accounts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY integration_service_accounts_tenant_isolation ON "integration_service_accounts"
    USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE "integration_api_credentials" ENABLE ROW LEVEL SECURITY;
CREATE POLICY integration_api_credentials_tenant_isolation ON "integration_api_credentials"
    USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
