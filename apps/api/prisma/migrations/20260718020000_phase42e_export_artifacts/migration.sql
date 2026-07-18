-- Phase 42e: Export artifact metadata (opaque storage keys only).

CREATE TABLE "import_export_artifacts" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "format" VARCHAR(20) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" VARCHAR(128) NOT NULL,
    "contentType" VARCHAR(120) NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "status" VARCHAR(40) NOT NULL DEFAULT 'preparing',
    "storageKey" VARCHAR(500) NOT NULL,
    "downloadTokenHash" VARCHAR(128) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_export_artifacts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "import_export_artifacts_tenantId_jobId_key"
    ON "import_export_artifacts"("tenantId", "jobId");
CREATE INDEX "import_export_artifacts_tenantId_status_idx"
    ON "import_export_artifacts"("tenantId", "status");
CREATE INDEX "import_export_artifacts_status_expiresAt_idx"
    ON "import_export_artifacts"("status", "expiresAt");

ALTER TABLE "import_export_artifacts"
    ADD CONSTRAINT "import_export_artifacts_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "import_export_artifacts"
    ADD CONSTRAINT "import_export_artifacts_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "import_export_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "import_export_artifacts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY import_export_artifacts_tenant_isolation ON "import_export_artifacts"
    USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
