-- Flexible Step 21 — Audit Center export metadata + history immutability triggers.
-- Additive only. Zero business mutations. Zero invented audit rows.

CREATE TABLE IF NOT EXISTS "platform_audit_export_records" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "actorPlatformUserId" UUID NOT NULL,
  "status" VARCHAR(32) NOT NULL,
  "filterJson" JSONB NOT NULL,
  "filterFingerprint" VARCHAR(64) NOT NULL,
  "rowCount" INTEGER NOT NULL DEFAULT 0,
  "reason" VARCHAR(2000) NOT NULL,
  "fileName" VARCHAR(255) NOT NULL,
  "contentSha256" VARCHAR(64),
  "downloadTokenHash" VARCHAR(64),
  "expiresAt" TIMESTAMPTZ,
  "correlationId" UUID NOT NULL,
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "completedAt" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS "platform_audit_export_records_actor_created_idx"
  ON "platform_audit_export_records" ("actorPlatformUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "platform_audit_export_records_expires_idx"
  ON "platform_audit_export_records" ("expiresAt");

CREATE TABLE IF NOT EXISTS "platform_audit_export_idempotency" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "actorId" UUID NOT NULL,
  "operation" VARCHAR(64) NOT NULL,
  "idempotencyKey" VARCHAR(128) NOT NULL,
  "requestHash" VARCHAR(64) NOT NULL,
  "resultResourceType" VARCHAR(32) NOT NULL,
  "resultResourceId" UUID NOT NULL,
  "status" VARCHAR(16) NOT NULL,
  "resultPayload" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "expiresAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "platform_audit_export_idempotency_actor_op_key_uq"
    UNIQUE ("actorId", "operation", "idempotencyKey")
);

CREATE INDEX IF NOT EXISTS "platform_audit_export_idempotency_expires_idx"
  ON "platform_audit_export_idempotency" ("expiresAt");

-- Append-only enforcement for Step 20 history tables (application SoR for flag/setting evidence).
CREATE OR REPLACE FUNCTION prevent_platform_history_modification()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'platform history tables are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS platform_feature_flag_history_immutable ON "platform_feature_flag_history";
CREATE TRIGGER platform_feature_flag_history_immutable
  BEFORE UPDATE OR DELETE ON "platform_feature_flag_history"
  FOR EACH ROW EXECUTE FUNCTION prevent_platform_history_modification();

DROP TRIGGER IF EXISTS platform_global_setting_history_immutable ON "platform_global_setting_history";
CREATE TRIGGER platform_global_setting_history_immutable
  BEFORE UPDATE OR DELETE ON "platform_global_setting_history"
  FOR EACH ROW EXECUTE FUNCTION prevent_platform_history_modification();

-- Supporting indexes for Audit Center common filters (additive, non-destructive).
CREATE INDEX IF NOT EXISTS "audit_entries_tenantId_action_createdAt_idx"
  ON "audit_entries" ("tenantId", "action", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "audit_entries_tenantId_category_createdAt_idx"
  ON "audit_entries" ("tenantId", "category", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "audit_entries_createdAt_id_idx"
  ON "audit_entries" ("createdAt" DESC, "id" DESC);
