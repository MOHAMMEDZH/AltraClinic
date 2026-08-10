-- Flexible Step 22 — durable Operations Console idempotency claims (Model D-B).

CREATE TABLE IF NOT EXISTS "platform_operations_idempotency" (
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
  "expiresAt" TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_operations_idempotency_actor_op_key_uidx"
  ON "platform_operations_idempotency" ("actorId", "operation", "idempotencyKey");

CREATE INDEX IF NOT EXISTS "platform_operations_idempotency_expires_idx"
  ON "platform_operations_idempotency" ("expiresAt");
