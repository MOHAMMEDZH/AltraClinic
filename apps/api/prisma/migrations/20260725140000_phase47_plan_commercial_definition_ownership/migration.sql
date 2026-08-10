-- Phase 47 Step 14 final gate — commercial definition ownership for seed safety.
-- Distinguishes uninitialized seed-owned Drafts from administrator-owned empty/non-empty Drafts.
-- Additive only. Preserves existing Plans, versions, entitlements, Limits, fingerprints.

CREATE TYPE "PlatformPlanCommercialDefinitionOwnership" AS ENUM (
  'UNINITIALIZED',
  'SEED_INITIALIZED',
  'ADMINISTRATOR_OWNED'
);

ALTER TABLE "platform_plan_versions"
  ADD COLUMN "commercialDefinitionOwnership" "PlatformPlanCommercialDefinitionOwnership"
  NOT NULL DEFAULT 'UNINITIALIZED';

-- Existing Drafts that already have entitlement or Limit children were seed-initialized
-- or administrator-edited. Prefer SEED_INITIALIZED when systemSeeded and children exist;
-- ADMINISTRATOR_OWNED when children exist and version is not system-seeded.
UPDATE "platform_plan_versions" v
SET "commercialDefinitionOwnership" = 'SEED_INITIALIZED'
WHERE v."lifecycle" = 'DRAFT'
  AND v."systemSeeded" = true
  AND (
    EXISTS (SELECT 1 FROM "platform_plan_version_entitlements" e WHERE e."planVersionId" = v."id")
    OR EXISTS (SELECT 1 FROM "platform_plan_version_limits" l WHERE l."planVersionId" = v."id")
  );

UPDATE "platform_plan_versions" v
SET "commercialDefinitionOwnership" = 'ADMINISTRATOR_OWNED'
WHERE (
    EXISTS (SELECT 1 FROM "platform_plan_version_entitlements" e WHERE e."planVersionId" = v."id")
    OR EXISTS (SELECT 1 FROM "platform_plan_version_limits" l WHERE l."planVersionId" = v."id")
  )
  AND v."commercialDefinitionOwnership" = 'UNINITIALIZED';

-- Any Draft that was mutated after creation (rowVersion > 1) without children is administrator-owned empty.
UPDATE "platform_plan_versions" v
SET "commercialDefinitionOwnership" = 'ADMINISTRATOR_OWNED'
WHERE v."lifecycle" = 'DRAFT'
  AND v."rowVersion" > 1
  AND v."commercialDefinitionOwnership" = 'UNINITIALIZED'
  AND NOT EXISTS (SELECT 1 FROM "platform_plan_version_entitlements" e WHERE e."planVersionId" = v."id")
  AND NOT EXISTS (SELECT 1 FROM "platform_plan_version_limits" l WHERE l."planVersionId" = v."id");
