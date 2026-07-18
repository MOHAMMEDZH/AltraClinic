-- Phase 41d: Notification Delivery Engine persistence
-- Additive, backward-compatible. No destructive changes to existing notifications tables.
-- Rollback: DROP TABLE in reverse order (see docs/NOTIFICATION_CENTER_ARCHITECTURE.md §41d).

CREATE TABLE "notification_intents" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID,
    "recipientId" UUID NOT NULL,
    "recipientType" VARCHAR(20) NOT NULL DEFAULT 'user',
    "notificationTypeId" VARCHAR(100),
    "category" VARCHAR(50),
    "transactional" BOOLEAN NOT NULL DEFAULT true,
    "priority" VARCHAR(20) NOT NULL DEFAULT 'medium',
    "requestedChannels" JSONB NOT NULL,
    "idempotencyKey" VARCHAR(200) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "body" TEXT NOT NULL,
    "titleAr" VARCHAR(500),
    "bodyAr" TEXT,
    "locale" VARCHAR(10) NOT NULL DEFAULT 'en',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "scheduledAt" TIMESTAMP(3),
    "status" VARCHAR(40) NOT NULL DEFAULT 'created',
    "correlationId" VARCHAR(100),
    "causationId" VARCHAR(100),
    "journeyInstanceId" UUID,
    "workflowInstanceId" UUID,
    "activityId" UUID,
    "requestedByUserId" UUID,
    "producerModuleId" VARCHAR(100),
    "providerKey" VARCHAR(100),
    "schemaVersion" VARCHAR(10) NOT NULL DEFAULT '1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_intents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_intents_tenantId_idempotencyKey_key"
    ON "notification_intents"("tenantId", "idempotencyKey");
CREATE INDEX "notification_intents_tenantId_status_idx" ON "notification_intents"("tenantId", "status");
CREATE INDEX "notification_intents_tenantId_recipientId_idx" ON "notification_intents"("tenantId", "recipientId");
CREATE INDEX "notification_intents_tenantId_createdAt_idx" ON "notification_intents"("tenantId", "createdAt");
CREATE INDEX "notification_intents_tenantId_notificationTypeId_idx" ON "notification_intents"("tenantId", "notificationTypeId");
CREATE INDEX "notification_intents_tenantId_correlationId_idx" ON "notification_intents"("tenantId", "correlationId");
CREATE INDEX "notification_intents_tenantId_scheduledAt_idx" ON "notification_intents"("tenantId", "scheduledAt");

CREATE TABLE "notification_messages" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "intentId" UUID NOT NULL,
    "notificationId" UUID,
    "title" VARCHAR(500) NOT NULL,
    "body" TEXT NOT NULL,
    "html" TEXT,
    "locale" VARCHAR(10) NOT NULL,
    "variables" JSONB NOT NULL DEFAULT '{}',
    "contentHash" VARCHAR(64),
    "brandingRef" VARCHAR(100),
    "branchSenderRef" VARCHAR(100),
    "redactionClass" VARCHAR(50),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notification_messages_tenantId_intentId_idx" ON "notification_messages"("tenantId", "intentId");
CREATE INDEX "notification_messages_tenantId_notificationId_idx" ON "notification_messages"("tenantId", "notificationId");
CREATE INDEX "notification_messages_tenantId_createdAt_idx" ON "notification_messages"("tenantId", "createdAt");

CREATE TABLE "notification_delivery_jobs" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "intentId" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "channel" VARCHAR(20) NOT NULL,
    "providerKey" VARCHAR(100) NOT NULL,
    "status" VARCHAR(40) NOT NULL DEFAULT 'pending',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "scheduledAt" TIMESTAMP(3),
    "leasedAt" TIMESTAMP(3),
    "leaseExpiresAt" TIMESTAMP(3),
    "leaseOwner" VARCHAR(100),
    "completedAt" TIMESTAMP(3),
    "deadLetteredAt" TIMESTAMP(3),
    "failureReason" VARCHAR(500),
    "idempotencyKey" VARCHAR(200),
    "priority" VARCHAR(20) NOT NULL DEFAULT 'medium',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_delivery_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_delivery_jobs_tenantId_intentId_channel_providerKey_key"
    ON "notification_delivery_jobs"("tenantId", "intentId", "channel", "providerKey");
CREATE INDEX "notification_delivery_jobs_tenantId_status_scheduledAt_idx"
    ON "notification_delivery_jobs"("tenantId", "status", "scheduledAt");
CREATE INDEX "notification_delivery_jobs_tenantId_channel_status_idx"
    ON "notification_delivery_jobs"("tenantId", "channel", "status");
CREATE INDEX "notification_delivery_jobs_tenantId_createdAt_idx"
    ON "notification_delivery_jobs"("tenantId", "createdAt");
CREATE INDEX "notification_delivery_jobs_status_leaseExpiresAt_idx"
    ON "notification_delivery_jobs"("status", "leaseExpiresAt");

CREATE TABLE "notification_delivery_attempts" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "providerKey" VARCHAR(100) NOT NULL,
    "success" BOOLEAN NOT NULL,
    "error" VARCHAR(500),
    "externalId" VARCHAR(200),
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_delivery_attempts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notification_delivery_attempts_tenantId_jobId_idx"
    ON "notification_delivery_attempts"("tenantId", "jobId");
CREATE INDEX "notification_delivery_attempts_tenantId_attemptedAt_idx"
    ON "notification_delivery_attempts"("tenantId", "attemptedAt");

CREATE TABLE "notification_receipts" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "channel" VARCHAR(20) NOT NULL,
    "status" VARCHAR(40) NOT NULL,
    "externalId" VARCHAR(200),
    "raw" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_receipts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_receipts_jobId_key" ON "notification_receipts"("jobId");
CREATE INDEX "notification_receipts_tenantId_status_idx" ON "notification_receipts"("tenantId", "status");
CREATE INDEX "notification_receipts_tenantId_occurredAt_idx" ON "notification_receipts"("tenantId", "occurredAt");

CREATE TABLE "notification_dead_letters" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID,
    "jobId" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "finalFailureCode" VARCHAR(80) NOT NULL,
    "finalFailureReason" VARCHAR(500) NOT NULL,
    "attemptHistory" JSONB NOT NULL DEFAULT '[]',
    "providerReferences" JSONB NOT NULL DEFAULT '{}',
    "correlationId" VARCHAR(100),
    "eligibleForManualRetry" BOOLEAN NOT NULL DEFAULT true,
    "resolutionStatus" VARCHAR(40) NOT NULL DEFAULT 'open',
    "resolvedBy" UUID,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadLetteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_dead_letters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_dead_letters_jobId_key" ON "notification_dead_letters"("jobId");
CREATE INDEX "notification_dead_letters_tenantId_resolutionStatus_idx"
    ON "notification_dead_letters"("tenantId", "resolutionStatus");
CREATE INDEX "notification_dead_letters_tenantId_deadLetteredAt_idx"
    ON "notification_dead_letters"("tenantId", "deadLetteredAt");
CREATE INDEX "notification_dead_letters_tenantId_correlationId_idx"
    ON "notification_dead_letters"("tenantId", "correlationId");

CREATE TABLE "notification_consent_decisions" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID,
    "intentId" UUID NOT NULL,
    "policyId" VARCHAR(80) NOT NULL,
    "policyVersion" VARCHAR(20) NOT NULL DEFAULT '1',
    "decision" VARCHAR(20) NOT NULL,
    "reasonCode" VARCHAR(100) NOT NULL,
    "source" VARCHAR(50) NOT NULL DEFAULT 'delivery-engine',
    "recipientId" UUID NOT NULL,
    "notificationType" VARCHAR(100),
    "channel" VARCHAR(20),
    "evaluatorVersion" VARCHAR(20) NOT NULL DEFAULT '41d.1',
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_consent_decisions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notification_consent_decisions_tenantId_intentId_idx"
    ON "notification_consent_decisions"("tenantId", "intentId");
CREATE INDEX "notification_consent_decisions_tenantId_evaluatedAt_idx"
    ON "notification_consent_decisions"("tenantId", "evaluatedAt");

CREATE TABLE "notification_preference_snapshots" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "intentId" UUID NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_preference_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notification_preference_snapshots_tenantId_intentId_idx"
    ON "notification_preference_snapshots"("tenantId", "intentId");

-- Foreign keys
ALTER TABLE "notification_intents"
    ADD CONSTRAINT "notification_intents_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "notification_messages"
    ADD CONSTRAINT "notification_messages_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notification_messages"
    ADD CONSTRAINT "notification_messages_intentId_fkey"
    FOREIGN KEY ("intentId") REFERENCES "notification_intents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_delivery_jobs"
    ADD CONSTRAINT "notification_delivery_jobs_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notification_delivery_jobs"
    ADD CONSTRAINT "notification_delivery_jobs_intentId_fkey"
    FOREIGN KEY ("intentId") REFERENCES "notification_intents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_delivery_jobs"
    ADD CONSTRAINT "notification_delivery_jobs_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "notification_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_delivery_attempts"
    ADD CONSTRAINT "notification_delivery_attempts_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notification_delivery_attempts"
    ADD CONSTRAINT "notification_delivery_attempts_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "notification_delivery_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_receipts"
    ADD CONSTRAINT "notification_receipts_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notification_receipts"
    ADD CONSTRAINT "notification_receipts_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "notification_delivery_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_dead_letters"
    ADD CONSTRAINT "notification_dead_letters_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notification_dead_letters"
    ADD CONSTRAINT "notification_dead_letters_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "notification_delivery_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_consent_decisions"
    ADD CONSTRAINT "notification_consent_decisions_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notification_consent_decisions"
    ADD CONSTRAINT "notification_consent_decisions_intentId_fkey"
    FOREIGN KEY ("intentId") REFERENCES "notification_intents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_preference_snapshots"
    ADD CONSTRAINT "notification_preference_snapshots_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notification_preference_snapshots"
    ADD CONSTRAINT "notification_preference_snapshots_intentId_fkey"
    FOREIGN KEY ("intentId") REFERENCES "notification_intents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS tenant isolation
ALTER TABLE "notification_intents" ENABLE ROW LEVEL SECURITY;
CREATE POLICY notification_intents_tenant_isolation ON "notification_intents"
    USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE "notification_messages" ENABLE ROW LEVEL SECURITY;
CREATE POLICY notification_messages_tenant_isolation ON "notification_messages"
    USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE "notification_delivery_jobs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY notification_delivery_jobs_tenant_isolation ON "notification_delivery_jobs"
    USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE "notification_delivery_attempts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY notification_delivery_attempts_tenant_isolation ON "notification_delivery_attempts"
    USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE "notification_receipts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY notification_receipts_tenant_isolation ON "notification_receipts"
    USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE "notification_dead_letters" ENABLE ROW LEVEL SECURITY;
CREATE POLICY notification_dead_letters_tenant_isolation ON "notification_dead_letters"
    USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE "notification_consent_decisions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY notification_consent_decisions_tenant_isolation ON "notification_consent_decisions"
    USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE "notification_preference_snapshots" ENABLE ROW LEVEL SECURITY;
CREATE POLICY notification_preference_snapshots_tenant_isolation ON "notification_preference_snapshots"
    USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
