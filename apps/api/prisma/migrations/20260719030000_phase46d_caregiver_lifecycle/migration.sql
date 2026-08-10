-- Phase 46d: Caregiver grant lifecycle fields
ALTER TABLE "caregiver_access_grants"
  ADD COLUMN IF NOT EXISTS "status" VARCHAR(32) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "invitationTokenHash" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "invitationExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "declinedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "caregiverUserId" UUID;

CREATE INDEX IF NOT EXISTS "caregiver_access_grants_invitationTokenHash_idx"
  ON "caregiver_access_grants"("invitationTokenHash");

CREATE INDEX IF NOT EXISTS "caregiver_access_grants_caregiverUserId_idx"
  ON "caregiver_access_grants"("caregiverUserId");

-- Existing grants without revocation are active
UPDATE "caregiver_access_grants"
SET "status" = 'revoked'
WHERE "revokedAt" IS NOT NULL AND "status" = 'active';
