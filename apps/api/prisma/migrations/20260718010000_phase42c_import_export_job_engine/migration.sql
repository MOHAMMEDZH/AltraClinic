-- Phase 42c: Import/Export Job Engine persistence (orchestration metadata only).
-- No artifact/file/business payload columns.

CREATE TABLE "import_export_jobs" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID,
    "typeId" VARCHAR(120) NOT NULL,
    "direction" VARCHAR(20) NOT NULL,
    "status" VARCHAR(40) NOT NULL DEFAULT 'draft',
    "priority" VARCHAR(20) NOT NULL DEFAULT 'normal',
    "initiatedByUserId" UUID NOT NULL,
    "idempotencyKey" VARCHAR(200) NOT NULL,
    "correlationId" VARCHAR(100) NOT NULL,
    "causationId" VARCHAR(100),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "baseDelayMs" INTEGER NOT NULL DEFAULT 1000,
    "maxDelayMs" INTEGER NOT NULL DEFAULT 60000,
    "lastError" VARCHAR(1000),
    "failureReason" VARCHAR(80),
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "deadLetteredAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "leasedAt" TIMESTAMP(3),
    "leaseOwner" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_export_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "import_export_jobs_tenantId_idempotencyKey_key"
    ON "import_export_jobs"("tenantId", "idempotencyKey");
CREATE INDEX "import_export_jobs_tenantId_status_idx" ON "import_export_jobs"("tenantId", "status");
CREATE INDEX "import_export_jobs_tenantId_createdAt_idx" ON "import_export_jobs"("tenantId", "createdAt");
CREATE INDEX "import_export_jobs_tenantId_typeId_idx" ON "import_export_jobs"("tenantId", "typeId");
CREATE INDEX "import_export_jobs_tenantId_correlationId_idx" ON "import_export_jobs"("tenantId", "correlationId");
CREATE INDEX "import_export_jobs_status_expiresAt_idx" ON "import_export_jobs"("status", "expiresAt");

ALTER TABLE "import_export_jobs"
    ADD CONSTRAINT "import_export_jobs_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "import_export_dead_letters" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "attempts" INTEGER NOT NULL,
    "lastError" VARCHAR(1000),
    "correlationId" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_export_dead_letters_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "import_export_dead_letters_tenantId_createdAt_idx"
    ON "import_export_dead_letters"("tenantId", "createdAt");
CREATE INDEX "import_export_dead_letters_tenantId_jobId_idx"
    ON "import_export_dead_letters"("tenantId", "jobId");

ALTER TABLE "import_export_dead_letters"
    ADD CONSTRAINT "import_export_dead_letters_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "import_export_dead_letters"
    ADD CONSTRAINT "import_export_dead_letters_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "import_export_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "import_export_jobs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY import_export_jobs_tenant_isolation ON "import_export_jobs"
    USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE "import_export_dead_letters" ENABLE ROW LEVEL SECURITY;
CREATE POLICY import_export_dead_letters_tenant_isolation ON "import_export_dead_letters"
    USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
