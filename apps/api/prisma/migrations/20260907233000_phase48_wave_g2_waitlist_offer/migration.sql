-- Phase 48 Wave G2 — WaitlistOffer SoR (P1-10)
-- Additive: offer status enum + tenant-scoped soft-delete table + RLS.
-- Default: no silent auto-book (application flag waitlist.auto_book).

CREATE TYPE "waitlist_offer_status" AS ENUM (
  'PENDING',
  'ACCEPTED',
  'EXPIRED',
  'REJECTED'
);

CREATE TABLE IF NOT EXISTS "waitlist_offers" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "branchId" UUID,
  "waitlistEntryId" UUID NOT NULL,
  "sourceAppointmentId" UUID,
  "providerId" UUID NOT NULL,
  "resourceId" UUID,
  "offeredStartsAt" TIMESTAMP(3) NOT NULL,
  "offeredEndsAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "status" "waitlist_offer_status" NOT NULL DEFAULT 'PENDING',
  "appointmentId" UUID,
  "createdBy" UUID,
  "acceptedAt" TIMESTAMP(3),
  "expiredAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "waitlist_offers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "waitlist_offers_range_chk" CHECK ("offeredEndsAt" > "offeredStartsAt")
);

CREATE INDEX IF NOT EXISTS "waitlist_offers_tenantId_status_expiresAt_idx"
  ON "waitlist_offers" ("tenantId", "status", "expiresAt");
CREATE INDEX IF NOT EXISTS "waitlist_offers_tenantId_waitlistEntryId_status_idx"
  ON "waitlist_offers" ("tenantId", "waitlistEntryId", "status");
CREATE INDEX IF NOT EXISTS "waitlist_offers_tenantId_offeredStartsAt_offeredEndsAt_idx"
  ON "waitlist_offers" ("tenantId", "offeredStartsAt", "offeredEndsAt");

ALTER TABLE "waitlist_offers"
  DROP CONSTRAINT IF EXISTS "waitlist_offers_tenantId_fkey";
ALTER TABLE "waitlist_offers"
  ADD CONSTRAINT "waitlist_offers_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "waitlist_offers"
  DROP CONSTRAINT IF EXISTS "waitlist_offers_waitlistEntryId_fkey";
ALTER TABLE "waitlist_offers"
  ADD CONSTRAINT "waitlist_offers_waitlistEntryId_fkey"
  FOREIGN KEY ("waitlistEntryId") REFERENCES "appointment_waitlist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "waitlist_offers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "waitlist_offers" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON "waitlist_offers";
CREATE POLICY tenant_select ON "waitlist_offers" FOR SELECT
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON "waitlist_offers";
CREATE POLICY tenant_insert ON "waitlist_offers" FOR INSERT
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON "waitlist_offers";
CREATE POLICY tenant_update ON "waitlist_offers" FOR UPDATE
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.platform_rls_bypass', true) = 'true')
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON "waitlist_offers";
CREATE POLICY tenant_delete ON "waitlist_offers" FOR DELETE
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.platform_rls_bypass', true) = 'true');
