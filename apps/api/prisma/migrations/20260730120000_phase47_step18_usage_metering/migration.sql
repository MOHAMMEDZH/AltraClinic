-- Phase 47 Supplemental Capability U01 — Usage Metering & Limit Enforcement (Historical filename retains step18 label; capability is Supplemental U01)
-- Additive only. Seeds meter definitions (zero usage). No nonzero counters / observations / billing.

CREATE TABLE "platform_usage_meter_definitions" (
  "id" UUID NOT NULL,
  "meterKey" VARCHAR(64) NOT NULL,
  "limitKey" VARCHAR(64) NOT NULL,
  "valueType" VARCHAR(16) NOT NULL,
  "aggregation" VARCHAR(32) NOT NULL,
  "periodType" VARCHAR(32) NOT NULL,
  "enforcementMode" VARCHAR(32) NOT NULL,
  "sourceOwner" VARCHAR(64) NOT NULL,
  "reconciliationMode" VARCHAR(32) NOT NULL,
  "retentionClass" VARCHAR(32) NOT NULL,
  "privacyClass" VARCHAR(64) NOT NULL,
  "schemaVersion" VARCHAR(64) NOT NULL DEFAULT 'usage-meter/v1',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "platform_usage_meter_definitions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_usage_meter_definitions_meterKey_key"
  ON "platform_usage_meter_definitions"("meterKey");
CREATE INDEX "platform_usage_meter_definitions_limitKey_idx"
  ON "platform_usage_meter_definitions"("limitKey");

CREATE TABLE "platform_usage_observations" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "meterKey" VARCHAR(64) NOT NULL,
  "operation" VARCHAR(32) NOT NULL,
  "value" VARCHAR(64) NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "source" VARCHAR(128) NOT NULL,
  "sourceEventId" VARCHAR(128) NOT NULL,
  "schemaVersion" VARCHAR(64) NOT NULL,
  "correlationId" VARCHAR(128),
  "requestFingerprint" VARCHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "platform_usage_observations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_usage_observations_tenantId_source_sourceEventId_key"
  ON "platform_usage_observations"("tenantId", "source", "sourceEventId");
CREATE INDEX "platform_usage_observations_tenantId_meterKey_occurredAt_idx"
  ON "platform_usage_observations"("tenantId", "meterKey", "occurredAt");

CREATE TABLE "platform_usage_counters" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "meterKey" VARCHAR(64) NOT NULL,
  "periodType" VARCHAR(32) NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "schemaVersion" VARCHAR(64) NOT NULL,
  "currentValue" VARCHAR(64) NOT NULL,
  "reservedValue" VARCHAR(64) NOT NULL DEFAULT '0',
  "lastObservationAt" TIMESTAMP(3),
  "lastReconciledAt" TIMESTAMP(3),
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  "staleClass" VARCHAR(32) NOT NULL DEFAULT 'FRESH',
  "sourceClass" VARCHAR(32) NOT NULL DEFAULT 'OBSERVATION',
  "valueDigest" VARCHAR(64),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "platform_usage_counters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_usage_counters_tenant_meter_period_schema_key"
  ON "platform_usage_counters"("tenantId", "meterKey", "periodType", "periodStart", "schemaVersion");
CREATE INDEX "platform_usage_counters_tenantId_meterKey_idx"
  ON "platform_usage_counters"("tenantId", "meterKey");

CREATE TABLE "platform_usage_reconciliation_checkpoints" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "meterKey" VARCHAR(64) NOT NULL,
  "periodType" VARCHAR(32) NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "expectedValue" VARCHAR(64) NOT NULL,
  "counterValue" VARCHAR(64) NOT NULL,
  "driftClass" VARCHAR(32) NOT NULL,
  "driftAbsolute" VARCHAR(64),
  "lastReconciledAt" TIMESTAMP(3) NOT NULL,
  "sourceOwner" VARCHAR(64) NOT NULL,
  "schemaVersion" VARCHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "platform_usage_reconciliation_checkpoints_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_usage_reconciliation_checkpoints_uniq"
  ON "platform_usage_reconciliation_checkpoints"("tenantId", "meterKey", "periodType", "periodStart", "schemaVersion");
CREATE INDEX "platform_usage_reconciliation_checkpoints_tenant_meter_idx"
  ON "platform_usage_reconciliation_checkpoints"("tenantId", "meterKey");

CREATE TABLE "platform_usage_idempotency" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "operation" VARCHAR(64) NOT NULL,
  "idempotencyKey" VARCHAR(128) NOT NULL,
  "requestHash" VARCHAR(64) NOT NULL,
  "resultResourceType" VARCHAR(32) NOT NULL,
  "resultResourceId" UUID NOT NULL,
  "status" VARCHAR(16) NOT NULL,
  "resultPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "platform_usage_idempotency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_usage_idempotency_tenant_op_key"
  ON "platform_usage_idempotency"("tenantId", "operation", "idempotencyKey");
CREATE INDEX "platform_usage_idempotency_expiresAt_idx"
  ON "platform_usage_idempotency"("expiresAt");

-- Seed 8 meter definitions (catalog only; zero usage).
INSERT INTO "platform_usage_meter_definitions" (
  "id", "meterKey", "limitKey", "valueType", "aggregation", "periodType",
  "enforcementMode", "sourceOwner", "reconciliationMode", "retentionClass",
  "privacyClass", "schemaVersion", "createdAt", "updatedAt"
) VALUES
  (gen_random_uuid(), 'meter.max_users', 'limit.max_users', 'integer', 'gauge', 'LIFETIME',
   'HARD', 'identity.users', 'LIVE_AGGREGATE', 'OPERATIONAL_90D', 'OPERATIONAL_AGGREGATE', 'usage-meter/v1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'meter.max_branches', 'limit.max_branches', 'integer', 'gauge', 'LIFETIME',
   'HARD', 'settings.branches', 'LIVE_AGGREGATE', 'OPERATIONAL_90D', 'OPERATIONAL_AGGREGATE', 'usage-meter/v1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'meter.max_patients', 'limit.max_patients', 'integer', 'gauge', 'LIFETIME',
   'HARD', 'patients', 'LIVE_AGGREGATE', 'OPERATIONAL_90D', 'OPERATIONAL_AGGREGATE', 'usage-meter/v1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'meter.max_storage_gb', 'limit.max_storage_gb', 'decimal', 'gauge', 'LIFETIME',
   'HARD', 'media.assets', 'LIVE_AGGREGATE', 'OPERATIONAL_90D', 'OPERATIONAL_AGGREGATE', 'usage-meter/v1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'meter.max_email_per_month', 'limit.max_email_per_month', 'integer', 'sum', 'CALENDAR_MONTH',
   'HARD', 'communication.ledger', 'LEDGER_PROJECTION', 'OPERATIONAL_90D', 'OPERATIONAL_AGGREGATE', 'usage-meter/v1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'meter.max_sms_per_month', 'limit.max_sms_per_month', 'integer', 'sum', 'CALENDAR_MONTH',
   'HARD', 'communication.ledger', 'LEDGER_PROJECTION', 'OPERATIONAL_90D', 'OPERATIONAL_AGGREGATE', 'usage-meter/v1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'meter.max_whatsapp_per_month', 'limit.max_whatsapp_per_month', 'integer', 'sum', 'CALENDAR_MONTH',
   'HARD', 'communication.ledger', 'LEDGER_PROJECTION', 'OPERATIONAL_90D', 'OPERATIONAL_AGGREGATE', 'usage-meter/v1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'meter.max_push_per_month', 'limit.max_push_per_month', 'integer', 'sum', 'CALENDAR_MONTH',
   'HARD', 'communication.ledger', 'LEDGER_PROJECTION', 'OPERATIONAL_90D', 'OPERATIONAL_AGGREGATE', 'usage-meter/v1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
