-- Phase 47 Step 06 — Platform authentication identity (additive only).
-- No default credentials. No tenantId on platform principals.

CREATE TABLE IF NOT EXISTS "platform_users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "displayName" VARCHAR(200),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lockedUntil" TIMESTAMP(3),
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "passwordChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" VARCHAR(45),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "platform_users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_users_email_key" ON "platform_users"("email");
CREATE INDEX IF NOT EXISTS "platform_users_isActive_idx" ON "platform_users"("isActive");
CREATE INDEX IF NOT EXISTS "platform_users_lockedUntil_idx" ON "platform_users"("lockedUntil");

CREATE TABLE IF NOT EXISTS "platform_refresh_tokens" (
    "id" UUID NOT NULL,
    "platformUserId" UUID NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "sessionId" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "platform_refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_refresh_tokens_sessionId_key" ON "platform_refresh_tokens"("sessionId");
CREATE INDEX IF NOT EXISTS "platform_refresh_tokens_platformUserId_idx" ON "platform_refresh_tokens"("platformUserId");
CREATE INDEX IF NOT EXISTS "platform_refresh_tokens_tokenHash_idx" ON "platform_refresh_tokens"("tokenHash");
CREATE INDEX IF NOT EXISTS "platform_refresh_tokens_familyId_idx" ON "platform_refresh_tokens"("familyId");
CREATE INDEX IF NOT EXISTS "platform_refresh_tokens_expiresAt_idx" ON "platform_refresh_tokens"("expiresAt");

ALTER TABLE "platform_refresh_tokens"
  ADD CONSTRAINT "platform_refresh_tokens_platformUserId_fkey"
  FOREIGN KEY ("platformUserId") REFERENCES "platform_users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
