-- Phase 47 Step 14 — Plan Version entitlements and typed Limits (additive only).
-- Commercial definition SoR only. No Add-ons, Overrides, subscription FKs, tenant assignment, or runtime tables.
-- Preserves Steps 06–13 Plans, Catalog, licensing runtime, and existing publication fingerprints.

CREATE TABLE "platform_plan_version_entitlements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "planVersionId" UUID NOT NULL,
    "catalogItemId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_plan_version_entitlements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_plan_version_entitlements_planVersionId_catalogItemId_key"
  ON "platform_plan_version_entitlements"("planVersionId", "catalogItemId");
CREATE INDEX "platform_plan_version_entitlements_planVersionId_idx"
  ON "platform_plan_version_entitlements"("planVersionId");
CREATE INDEX "platform_plan_version_entitlements_catalogItemId_idx"
  ON "platform_plan_version_entitlements"("catalogItemId");

CREATE TABLE "platform_plan_version_limits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "planVersionId" UUID NOT NULL,
    "catalogItemId" UUID NOT NULL,
    "unlimited" BOOLEAN NOT NULL DEFAULT false,
    "valueText" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_plan_version_limits_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "platform_plan_version_limits_value_xor_unlimited_chk" CHECK (
      ("unlimited" = true AND "valueText" IS NULL)
      OR ("unlimited" = false AND "valueText" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "platform_plan_version_limits_planVersionId_catalogItemId_key"
  ON "platform_plan_version_limits"("planVersionId", "catalogItemId");
CREATE INDEX "platform_plan_version_limits_planVersionId_idx"
  ON "platform_plan_version_limits"("planVersionId");
CREATE INDEX "platform_plan_version_limits_catalogItemId_idx"
  ON "platform_plan_version_limits"("catalogItemId");

ALTER TABLE "platform_plan_version_entitlements"
  ADD CONSTRAINT "platform_plan_version_entitlements_planVersionId_fkey"
  FOREIGN KEY ("planVersionId") REFERENCES "platform_plan_versions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "platform_plan_version_entitlements"
  ADD CONSTRAINT "platform_plan_version_entitlements_catalogItemId_fkey"
  FOREIGN KEY ("catalogItemId") REFERENCES "healthcare_catalog_items"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "platform_plan_version_limits"
  ADD CONSTRAINT "platform_plan_version_limits_planVersionId_fkey"
  FOREIGN KEY ("planVersionId") REFERENCES "platform_plan_versions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "platform_plan_version_limits"
  ADD CONSTRAINT "platform_plan_version_limits_catalogItemId_fkey"
  FOREIGN KEY ("catalogItemId") REFERENCES "healthcare_catalog_items"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
