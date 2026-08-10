-- Phase 47 Step 08 — Platform RBAC + Platform User administration (additive)

-- PlatformUser lifecycle / authz fields
ALTER TABLE "platform_users" ADD COLUMN IF NOT EXISTS "status" VARCHAR(32) NOT NULL DEFAULT 'active';
ALTER TABLE "platform_users" ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMP(3);
ALTER TABLE "platform_users" ADD COLUMN IF NOT EXISTS "suspendedReason" VARCHAR(500);
ALTER TABLE "platform_users" ADD COLUMN IF NOT EXISTS "suspendedById" UUID;
ALTER TABLE "platform_users" ADD COLUMN IF NOT EXISTS "authzRevision" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "platform_users_status_idx" ON "platform_users"("status");

-- Existing Step 06/07 users remain active identities with no roles (deny-by-default).
UPDATE "platform_users" SET "status" = 'active' WHERE "status" IS NULL OR "status" = '';

CREATE TABLE IF NOT EXISTS "platform_user_roles" (
    "id" UUID NOT NULL,
    "platformUserId" UUID NOT NULL,
    "roleKey" VARCHAR(64) NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedById" UUID,
    "reason" VARCHAR(500),
    "revokedAt" TIMESTAMP(3),
    "revokedById" UUID,
    "revokeReason" VARCHAR(500),

    CONSTRAINT "platform_user_roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_user_roles_platformUserId_roleKey_key"
  ON "platform_user_roles"("platformUserId", "roleKey");
CREATE INDEX IF NOT EXISTS "platform_user_roles_platformUserId_idx" ON "platform_user_roles"("platformUserId");
CREATE INDEX IF NOT EXISTS "platform_user_roles_roleKey_idx" ON "platform_user_roles"("roleKey");
CREATE INDEX IF NOT EXISTS "platform_user_roles_revokedAt_idx" ON "platform_user_roles"("revokedAt");

ALTER TABLE "platform_user_roles"
  DROP CONSTRAINT IF EXISTS "platform_user_roles_platformUserId_fkey";
ALTER TABLE "platform_user_roles"
  ADD CONSTRAINT "platform_user_roles_platformUserId_fkey"
  FOREIGN KEY ("platformUserId") REFERENCES "platform_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "platform_user_invitations" (
    "id" UUID NOT NULL,
    "platformUserId" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "invitedById" UUID NOT NULL,
    "roleKeysJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_user_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_user_invitations_tokenHash_key" ON "platform_user_invitations"("tokenHash");
CREATE INDEX IF NOT EXISTS "platform_user_invitations_platformUserId_idx" ON "platform_user_invitations"("platformUserId");
CREATE INDEX IF NOT EXISTS "platform_user_invitations_email_idx" ON "platform_user_invitations"("email");
CREATE INDEX IF NOT EXISTS "platform_user_invitations_status_idx" ON "platform_user_invitations"("status");
CREATE INDEX IF NOT EXISTS "platform_user_invitations_expiresAt_idx" ON "platform_user_invitations"("expiresAt");

ALTER TABLE "platform_user_invitations"
  DROP CONSTRAINT IF EXISTS "platform_user_invitations_platformUserId_fkey";
ALTER TABLE "platform_user_invitations"
  ADD CONSTRAINT "platform_user_invitations_platformUserId_fkey"
  FOREIGN KEY ("platformUserId") REFERENCES "platform_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "platform_mfa_reset_requests" (
    "id" UUID NOT NULL,
    "targetUserId" UUID NOT NULL,
    "requesterId" UUID NOT NULL,
    "approverId" UUID,
    "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "reason" VARCHAR(1000) NOT NULL,
    "externalRef" VARCHAR(200),
    "riskClass" VARCHAR(32) NOT NULL DEFAULT 'high',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "decidedAt" TIMESTAMP(3),
    "decisionReason" VARCHAR(1000),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_mfa_reset_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "platform_mfa_reset_requests_targetUserId_status_idx"
  ON "platform_mfa_reset_requests"("targetUserId", "status");
CREATE INDEX IF NOT EXISTS "platform_mfa_reset_requests_requesterId_idx"
  ON "platform_mfa_reset_requests"("requesterId");
CREATE INDEX IF NOT EXISTS "platform_mfa_reset_requests_status_expiresAt_idx"
  ON "platform_mfa_reset_requests"("status", "expiresAt");

ALTER TABLE "platform_mfa_reset_requests"
  DROP CONSTRAINT IF EXISTS "platform_mfa_reset_requests_targetUserId_fkey";
ALTER TABLE "platform_mfa_reset_requests"
  ADD CONSTRAINT "platform_mfa_reset_requests_targetUserId_fkey"
  FOREIGN KEY ("targetUserId") REFERENCES "platform_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "platform_mfa_reset_requests"
  DROP CONSTRAINT IF EXISTS "platform_mfa_reset_requests_requesterId_fkey";
ALTER TABLE "platform_mfa_reset_requests"
  ADD CONSTRAINT "platform_mfa_reset_requests_requesterId_fkey"
  FOREIGN KEY ("requesterId") REFERENCES "platform_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "platform_mfa_reset_requests"
  DROP CONSTRAINT IF EXISTS "platform_mfa_reset_requests_approverId_fkey";
ALTER TABLE "platform_mfa_reset_requests"
  ADD CONSTRAINT "platform_mfa_reset_requests_approverId_fkey"
  FOREIGN KEY ("approverId") REFERENCES "platform_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
