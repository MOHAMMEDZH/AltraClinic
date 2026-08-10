-- Phase 47 Step 07 -- Platform MFA + session security (additive only).
-- Plaintext TOTP secrets are never persisted; only AES-256-GCM envelopes.

ALTER TABLE "platform_users"
  ADD COLUMN IF NOT EXISTS "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "mfaSecretEncrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "mfaKeyVersion" VARCHAR(16) DEFAULT '1',
  ADD COLUMN IF NOT EXISTS "mfaPendingSecretEncrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "mfaPendingExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "mfaConfirmedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastTotpStep" VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "failedMfaCount" INTEGER NOT NULL DEFAULT 0;

-- Session security columns. absoluteExpiresAt is required going forward; backfill
-- existing rows with createdAt + 12h before enforcing NOT NULL.
ALTER TABLE "platform_refresh_tokens"
  ADD COLUMN IF NOT EXISTS "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "absoluteExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "mfaCompletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "assuranceLevel" VARCHAR(32) NOT NULL DEFAULT 'mfa',
  ADD COLUMN IF NOT EXISTS "stepUpVerifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deviceLabel" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "authMethod" VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "revocationReason" VARCHAR(64);

UPDATE "platform_refresh_tokens"
  SET "absoluteExpiresAt" = "createdAt" + INTERVAL '12 hours'
  WHERE "absoluteExpiresAt" IS NULL;

ALTER TABLE "platform_refresh_tokens"
  ALTER COLUMN "absoluteExpiresAt" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "platform_refresh_tokens_absoluteExpiresAt_idx"
  ON "platform_refresh_tokens"("absoluteExpiresAt");

CREATE TABLE IF NOT EXISTS "platform_mfa_recovery_codes" (
    "id" UUID NOT NULL,
    "platformUserId" UUID NOT NULL,
    "codeHash" VARCHAR(64) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "platform_mfa_recovery_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_mfa_recovery_codes_platformUserId_codeHash_key"
  ON "platform_mfa_recovery_codes"("platformUserId", "codeHash");
CREATE INDEX IF NOT EXISTS "platform_mfa_recovery_codes_platformUserId_idx"
  ON "platform_mfa_recovery_codes"("platformUserId");
CREATE INDEX IF NOT EXISTS "platform_mfa_recovery_codes_usedAt_idx"
  ON "platform_mfa_recovery_codes"("usedAt");

ALTER TABLE "platform_mfa_recovery_codes"
  ADD CONSTRAINT "platform_mfa_recovery_codes_platformUserId_fkey"
  FOREIGN KEY ("platformUserId") REFERENCES "platform_users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
