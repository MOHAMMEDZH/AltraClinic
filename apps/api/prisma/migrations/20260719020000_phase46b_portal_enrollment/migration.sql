-- Phase 46b: Patient Portal enrollment token + consent fields
ALTER TABLE "portal_accounts"
  ADD COLUMN IF NOT EXISTS "enrollmentTokenHash" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "enrollmentTokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "enrollmentConsentAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "portal_accounts_enrollmentTokenHash_key"
  ON "portal_accounts"("enrollmentTokenHash");

CREATE INDEX IF NOT EXISTS "portal_accounts_tenantId_userId_idx"
  ON "portal_accounts"("tenantId", "userId");
