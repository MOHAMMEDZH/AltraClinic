-- Phase 28: Durable license lifecycle state (replaces in-memory status cache)

CREATE TABLE "tenant_license_lifecycle_states" (
    "tenantId" UUID NOT NULL,
    "licenseStatus" VARCHAR(50) NOT NULL,
    "uiPlan" VARCHAR(50),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_license_lifecycle_states_pkey" PRIMARY KEY ("tenantId")
);

CREATE TABLE "license_lifecycle_transitions" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "previousStatus" VARCHAR(50) NOT NULL,
    "newStatus" VARCHAR(50) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "license_lifecycle_transitions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "license_lifecycle_transitions_tenantId_previousStatus_newStatus_key"
    ON "license_lifecycle_transitions"("tenantId", "previousStatus", "newStatus");

CREATE INDEX "license_lifecycle_transitions_tenantId_recordedAt_idx"
    ON "license_lifecycle_transitions"("tenantId", "recordedAt");

ALTER TABLE "tenant_license_lifecycle_states"
    ADD CONSTRAINT "tenant_license_lifecycle_states_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "license_lifecycle_transitions"
    ADD CONSTRAINT "license_lifecycle_transitions_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tenant_license_lifecycle_states" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_license_lifecycle_states_tenant_isolation ON "tenant_license_lifecycle_states"
    USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE "license_lifecycle_transitions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY license_lifecycle_transitions_tenant_isolation ON "license_lifecycle_transitions"
    USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
