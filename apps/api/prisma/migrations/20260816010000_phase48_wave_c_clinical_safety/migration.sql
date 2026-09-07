-- Phase 48 Wave C — Clinical Safety & Inventory Accountability (AR-09/10/11/18/20)
-- Non-destructive: evolve inventory_consumption_logs; create clinical forms; additive media/batch columns.

-- ---------------------------------------------------------------------------
-- A. Inventory batch recall flags
-- ---------------------------------------------------------------------------
ALTER TABLE "inventory_batches"
  ADD COLUMN IF NOT EXISTS "recalled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "recalledAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "inventory_batches_tenantId_recalled_idx"
  ON "inventory_batches" ("tenantId", "recalled");

-- ---------------------------------------------------------------------------
-- B. Evolve inventory_consumption_logs → InventoryUsageLedger columns
-- ---------------------------------------------------------------------------
ALTER TABLE "inventory_consumption_logs"
  ADD COLUMN IF NOT EXISTS "branchId" UUID,
  ADD COLUMN IF NOT EXISTS "warehouseId" UUID,
  ADD COLUMN IF NOT EXISTS "inventoryBatchId" UUID,
  ADD COLUMN IF NOT EXISTS "unit" VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "usageType" VARCHAR(40) NOT NULL DEFAULT 'CLINICAL_CONSUMPTION',
  ADD COLUMN IF NOT EXISTS "usedByUserId" UUID,
  ADD COLUMN IF NOT EXISTS "recordedByUserId" UUID,
  ADD COLUMN IF NOT EXISTS "appointmentId" UUID,
  ADD COLUMN IF NOT EXISTS "clinicalServiceId" UUID,
  ADD COLUMN IF NOT EXISTS "beautyAnnotationId" UUID,
  ADD COLUMN IF NOT EXISTS "reasonCode" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "occurredAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "recordedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "sourceStockMovementId" UUID,
  ADD COLUMN IF NOT EXISTS "reversalOfUsageId" UUID,
  ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) NOT NULL DEFAULT 'POSTED',
  ADD COLUMN IF NOT EXISTS "attributionStatus" VARCHAR(30) NOT NULL DEFAULT 'ATTRIBUTED';

-- Backfill recordedBy from legacy consumedBy (do not invent usedBy).
UPDATE "inventory_consumption_logs"
SET "recordedByUserId" = "consumedBy"
WHERE "recordedByUserId" IS NULL;

UPDATE "inventory_consumption_logs"
SET "occurredAt" = "consumedAt"
WHERE "occurredAt" IS NULL;

UPDATE "inventory_consumption_logs"
SET "recordedAt" = "consumedAt"
WHERE "recordedAt" IS NULL;

-- Historical rows without usedBy remain LEGACY_UNATTRIBUTED (AR-18 / AR-20).
UPDATE "inventory_consumption_logs"
SET "attributionStatus" = 'LEGACY_UNATTRIBUTED'
WHERE "usedByUserId" IS NULL;

ALTER TABLE "inventory_consumption_logs"
  DROP CONSTRAINT IF EXISTS "inventory_consumption_logs_inventoryBatchId_fkey";
ALTER TABLE "inventory_consumption_logs"
  ADD CONSTRAINT "inventory_consumption_logs_inventoryBatchId_fkey"
  FOREIGN KEY ("inventoryBatchId") REFERENCES "inventory_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory_consumption_logs"
  DROP CONSTRAINT IF EXISTS "inventory_consumption_logs_sourceStockMovementId_fkey";
ALTER TABLE "inventory_consumption_logs"
  ADD CONSTRAINT "inventory_consumption_logs_sourceStockMovementId_fkey"
  FOREIGN KEY ("sourceStockMovementId") REFERENCES "inventory_stock_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory_consumption_logs"
  DROP CONSTRAINT IF EXISTS "inventory_consumption_logs_reversalOfUsageId_fkey";
ALTER TABLE "inventory_consumption_logs"
  ADD CONSTRAINT "inventory_consumption_logs_reversalOfUsageId_fkey"
  FOREIGN KEY ("reversalOfUsageId") REFERENCES "inventory_consumption_logs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_consumption_logs_sourceStockMovementId_key"
  ON "inventory_consumption_logs" ("sourceStockMovementId");

CREATE INDEX IF NOT EXISTS "inventory_consumption_logs_tenantId_usageType_idx"
  ON "inventory_consumption_logs" ("tenantId", "usageType");
CREATE INDEX IF NOT EXISTS "inventory_consumption_logs_tenantId_usedByUserId_idx"
  ON "inventory_consumption_logs" ("tenantId", "usedByUserId");
CREATE INDEX IF NOT EXISTS "inventory_consumption_logs_tenantId_attributionStatus_idx"
  ON "inventory_consumption_logs" ("tenantId", "attributionStatus");
CREATE INDEX IF NOT EXISTS "inventory_consumption_logs_inventoryBatchId_idx"
  ON "inventory_consumption_logs" ("inventoryBatchId");
CREATE INDEX IF NOT EXISTS "inventory_consumption_logs_reversalOfUsageId_idx"
  ON "inventory_consumption_logs" ("reversalOfUsageId");

-- ---------------------------------------------------------------------------
-- C. Injectable specialization (AR-11)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "injectable_usage_details" (
  "usageLedgerId" UUID NOT NULL,
  "dose" DECIMAL(18,4),
  "anatomicalSite" VARCHAR(100),
  "beautyAnnotationId" UUID,
  "notes" TEXT,
  CONSTRAINT "injectable_usage_details_pkey" PRIMARY KEY ("usageLedgerId"),
  CONSTRAINT "injectable_usage_details_usageLedgerId_fkey"
    FOREIGN KEY ("usageLedgerId") REFERENCES "inventory_consumption_logs"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ---------------------------------------------------------------------------
-- D. Clinical forms (AR-09 / AR-10)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "clinical_form_templates" (
  "id" UUID NOT NULL,
  "tenantId" UUID,
  "kind" VARCHAR(40) NOT NULL,
  "stableKey" VARCHAR(100) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  "nameEn" VARCHAR(255) NOT NULL,
  "nameAr" VARCHAR(255),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdByUserId" UUID,
  CONSTRAINT "clinical_form_templates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "clinical_form_templates_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "clinical_form_templates_tenantId_kind_stableKey_key"
  ON "clinical_form_templates" ("tenantId", "kind", "stableKey");
CREATE INDEX IF NOT EXISTS "clinical_form_templates_tenantId_idx"
  ON "clinical_form_templates" ("tenantId");
CREATE INDEX IF NOT EXISTS "clinical_form_templates_tenantId_kind_status_idx"
  ON "clinical_form_templates" ("tenantId", "kind", "status");

CREATE TABLE IF NOT EXISTS "clinical_form_versions" (
  "id" UUID NOT NULL,
  "templateId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  "contentEn" TEXT NOT NULL,
  "contentAr" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "publishedByUserId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clinical_form_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "clinical_form_versions_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "clinical_form_templates"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "clinical_form_versions_templateId_version_key"
  ON "clinical_form_versions" ("templateId", "version");
CREATE INDEX IF NOT EXISTS "clinical_form_versions_templateId_status_idx"
  ON "clinical_form_versions" ("templateId", "status");

-- At most one PUBLISHED version per template (DB defense against concurrent publish races).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "clinical_form_versions"
    WHERE status = 'PUBLISHED'
    GROUP BY "templateId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'clinical_form_versions: duplicate PUBLISHED rows block one-published-per-template index';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "clinical_form_versions_one_published_per_template"
  ON "clinical_form_versions" ("templateId")
  WHERE status = 'PUBLISHED';

CREATE TABLE IF NOT EXISTS "patient_form_instances" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "patientId" UUID NOT NULL,
  "versionId" UUID NOT NULL,
  "appointmentId" UUID,
  "clinicalServiceId" UUID,
  "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  "signedAt" TIMESTAMP(3),
  "signerUserId" UUID,
  "signerPatientId" UUID,
  "method" VARCHAR(40),
  "signedContentEn" TEXT,
  "signedContentAr" TEXT,
  "voidedAt" TIMESTAMP(3),
  "voidedByUserId" UUID,
  "voidReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdByUserId" UUID,
  CONSTRAINT "patient_form_instances_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "patient_form_instances_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "patient_form_instances_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "patient_form_instances_versionId_fkey"
    FOREIGN KEY ("versionId") REFERENCES "clinical_form_versions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "patient_form_instances_tenantId_idx"
  ON "patient_form_instances" ("tenantId");
CREATE INDEX IF NOT EXISTS "patient_form_instances_tenantId_patientId_idx"
  ON "patient_form_instances" ("tenantId", "patientId");
CREATE INDEX IF NOT EXISTS "patient_form_instances_tenantId_patientId_status_idx"
  ON "patient_form_instances" ("tenantId", "patientId", "status");
CREATE INDEX IF NOT EXISTS "patient_form_instances_versionId_idx"
  ON "patient_form_instances" ("versionId");
CREATE INDEX IF NOT EXISTS "patient_form_instances_tenantId_clinicalServiceId_idx"
  ON "patient_form_instances" ("tenantId", "clinicalServiceId");

CREATE TABLE IF NOT EXISTS "clinical_service_form_requirements" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "clinicalServiceId" UUID NOT NULL,
  "formKind" VARCHAR(40) NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "clinical_service_form_requirements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "clinical_service_form_requirements_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "clinical_service_form_requirements_tenantId_clinicalServiceId_formKind_key"
  ON "clinical_service_form_requirements" ("tenantId", "clinicalServiceId", "formKind");
CREATE INDEX IF NOT EXISTS "clinical_service_form_requirements_tenantId_clinicalServiceId_active_idx"
  ON "clinical_service_form_requirements" ("tenantId", "clinicalServiceId", "active");

-- ---------------------------------------------------------------------------
-- E. Media photo consent flag (AR-10) — patientId already exists
-- ---------------------------------------------------------------------------
ALTER TABLE "media_assets"
  ADD COLUMN IF NOT EXISTS "requiresPhotoConsent" BOOLEAN NOT NULL DEFAULT false;

-- Fail-closed backfill: protected clinical/photo categories must require consent after upgrade.
UPDATE "media_assets"
SET "requiresPhotoConsent" = true
WHERE "category" IN ('DENTAL_IMAGE', 'BEAUTY_BEFORE_AFTER', 'PATIENT_ATTACHMENT')
  AND "requiresPhotoConsent" = false;

UPDATE "media_assets"
SET "requiresPhotoConsent" = false
WHERE "category" IN ('MEDICAL_DOCUMENT', 'INVOICE_ATTACHMENT')
  AND "requiresPhotoConsent" = true;

ALTER TABLE "patient_form_instances"
  ADD COLUMN IF NOT EXISTS "voidedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "voidedByUserId" UUID,
  ADD COLUMN IF NOT EXISTS "voidReason" TEXT;

-- ---------------------------------------------------------------------------
-- F. Immutability triggers (append-only usage; published version; signed instance)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_inventory_usage_ledger_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  invoice_link_changed boolean;
  clinical_changed boolean;
  allow_invoice_link boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'inventory_consumption_logs is append-only. DELETE is forbidden.'
      USING ERRCODE = 'restrict_violation';
  END IF;

  invoice_link_changed :=
    NEW."invoiceId" IS DISTINCT FROM OLD."invoiceId"
    OR NEW."invoiceLineItemId" IS DISTINCT FROM OLD."invoiceLineItemId";

  allow_invoice_link :=
    coalesce(current_setting('app.allow_inventory_usage_invoice_link', true), '') = 'true';

  -- Invoice linkage is post-posting billing metadata (not clinical truth).
  -- Mutations allowed ONLY when trusted billing path sets the session flag.
  IF invoice_link_changed AND NOT allow_invoice_link THEN
    RAISE EXCEPTION 'inventory_consumption_logs invoice linkage may only change via trusted billing path'
      USING ERRCODE = 'restrict_violation';
  END IF;

  clinical_changed :=
       NEW."tenantId" IS DISTINCT FROM OLD."tenantId"
    OR NEW."inventoryItemId" IS DISTINCT FROM OLD."inventoryItemId"
    OR NEW."inventoryBatchId" IS DISTINCT FROM OLD."inventoryBatchId"
    OR NEW."quantityUsed" IS DISTINCT FROM OLD."quantityUsed"
    OR NEW."usageType" IS DISTINCT FROM OLD."usageType"
    OR NEW."usedByUserId" IS DISTINCT FROM OLD."usedByUserId"
    OR NEW."recordedByUserId" IS DISTINCT FROM OLD."recordedByUserId"
    OR NEW."consumedBy" IS DISTINCT FROM OLD."consumedBy"
    OR NEW."sourceStockMovementId" IS DISTINCT FROM OLD."sourceStockMovementId"
    OR NEW."reversalOfUsageId" IS DISTINCT FROM OLD."reversalOfUsageId"
    OR NEW."patientId" IS DISTINCT FROM OLD."patientId"
    OR NEW."encounterId" IS DISTINCT FROM OLD."encounterId"
    OR NEW."appointmentId" IS DISTINCT FROM OLD."appointmentId"
    OR NEW."clinicalServiceId" IS DISTINCT FROM OLD."clinicalServiceId"
    OR NEW."warehouseId" IS DISTINCT FROM OLD."warehouseId"
    OR NEW."branchId" IS DISTINCT FROM OLD."branchId"
    OR NEW."unit" IS DISTINCT FROM OLD."unit"
    OR NEW."reasonCode" IS DISTINCT FROM OLD."reasonCode"
    OR NEW."occurredAt" IS DISTINCT FROM OLD."occurredAt"
    OR NEW."attributionStatus" IS DISTINCT FROM OLD."attributionStatus"
    OR NEW."procedureCode" IS DISTINCT FROM OLD."procedureCode"
    OR NEW."beautyAnnotationId" IS DISTINCT FROM OLD."beautyAnnotationId"
    OR NEW."notes" IS DISTINCT FROM OLD."notes"
    OR NEW."consumedAt" IS DISTINCT FROM OLD."consumedAt"
    OR NEW."recordedAt" IS DISTINCT FROM OLD."recordedAt";

  IF OLD."status" = 'REVERSED' THEN
    IF clinical_changed OR NEW."status" IS DISTINCT FROM OLD."status" THEN
      RAISE EXCEPTION 'inventory_consumption_logs reversed rows are immutable'
        USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD."status" = 'POSTED' THEN
    IF NEW."status" IS DISTINCT FROM OLD."status"
       AND NOT (OLD."status" = 'POSTED' AND NEW."status" = 'REVERSED') THEN
      RAISE EXCEPTION 'inventory_consumption_logs status transition % → % forbidden',
        OLD."status", NEW."status"
        USING ERRCODE = 'restrict_violation';
    END IF;

    IF clinical_changed THEN
      RAISE EXCEPTION 'inventory_consumption_logs posted critical fields are immutable'
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inventory_consumption_logs_append_only ON "inventory_consumption_logs";
CREATE TRIGGER inventory_consumption_logs_append_only
  BEFORE UPDATE OR DELETE ON "inventory_consumption_logs"
  FOR EACH ROW EXECUTE FUNCTION prevent_inventory_usage_ledger_mutation();

CREATE OR REPLACE FUNCTION prevent_injectable_usage_detail_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'injectable_usage_details is append-only. DELETE is forbidden.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RAISE EXCEPTION 'injectable_usage_details is append-only. UPDATE is forbidden.'
    USING ERRCODE = 'restrict_violation';
END;
$$;

DROP TRIGGER IF EXISTS injectable_usage_details_append_only ON "injectable_usage_details";
CREATE TRIGGER injectable_usage_details_append_only
  BEFORE UPDATE OR DELETE ON "injectable_usage_details"
  FOR EACH ROW EXECUTE FUNCTION prevent_injectable_usage_detail_mutation();


CREATE OR REPLACE FUNCTION prevent_clinical_form_version_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" = 'PUBLISHED' OR OLD."status" = 'SUPERSEDED' THEN
      RAISE EXCEPTION 'clinical_form_versions: DELETE forbidden after publish'
        USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD."status" = 'PUBLISHED' OR OLD."status" = 'SUPERSEDED' THEN
    -- Allow DRAFT→PUBLISHED handled at insert/update from DRAFT; once PUBLISHED only SUPERSEDED status flip.
    IF OLD."status" = 'PUBLISHED'
       AND NEW."status" = 'SUPERSEDED'
       AND NEW."contentEn" IS NOT DISTINCT FROM OLD."contentEn"
       AND NEW."contentAr" IS NOT DISTINCT FROM OLD."contentAr"
       AND NEW."version" IS NOT DISTINCT FROM OLD."version"
       AND NEW."templateId" IS NOT DISTINCT FROM OLD."templateId"
       AND NEW."publishedAt" IS NOT DISTINCT FROM OLD."publishedAt"
       AND NEW."publishedByUserId" IS NOT DISTINCT FROM OLD."publishedByUserId"
    THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'clinical_form_versions content is immutable after PUBLISHED'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clinical_form_versions_immutable ON "clinical_form_versions";
CREATE TRIGGER clinical_form_versions_immutable
  BEFORE UPDATE OR DELETE ON "clinical_form_versions"
  FOR EACH ROW EXECUTE FUNCTION prevent_clinical_form_version_mutation();

CREATE OR REPLACE FUNCTION prevent_patient_form_instance_signed_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" IN ('SIGNED', 'VOID') OR OLD."signedAt" IS NOT NULL THEN
      RAISE EXCEPTION 'patient_form_instances: DELETE forbidden after signed history'
        USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD."status" = 'VOID' OR (OLD."signedAt" IS NOT NULL AND OLD."status" <> 'SIGNED') THEN
    RAISE EXCEPTION 'patient_form_instances voided/signed history is immutable'
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF OLD."status" = 'SIGNED' OR OLD."signedAt" IS NOT NULL THEN
    IF NEW."status" = 'VOID'
       AND OLD."status" = 'SIGNED'
       AND NEW."signedContentEn" IS NOT DISTINCT FROM OLD."signedContentEn"
       AND NEW."signedContentAr" IS NOT DISTINCT FROM OLD."signedContentAr"
       AND NEW."versionId" IS NOT DISTINCT FROM OLD."versionId"
       AND NEW."patientId" IS NOT DISTINCT FROM OLD."patientId"
       AND NEW."signedAt" IS NOT DISTINCT FROM OLD."signedAt"
       AND NEW."signerUserId" IS NOT DISTINCT FROM OLD."signerUserId"
       AND NEW."signerPatientId" IS NOT DISTINCT FROM OLD."signerPatientId"
       AND NEW."method" IS NOT DISTINCT FROM OLD."method"
       AND NEW."tenantId" IS NOT DISTINCT FROM OLD."tenantId"
       AND NEW."appointmentId" IS NOT DISTINCT FROM OLD."appointmentId"
       AND NEW."clinicalServiceId" IS NOT DISTINCT FROM OLD."clinicalServiceId"
       AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt"
       AND NEW."createdByUserId" IS NOT DISTINCT FROM OLD."createdByUserId"
       AND NEW."voidReason" IS NOT NULL
       AND length(trim(NEW."voidReason")) > 0
       AND NEW."voidedAt" IS NOT NULL
       AND NEW."voidedByUserId" IS NOT NULL
    THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'patient_form_instances signed snapshot is immutable'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS patient_form_instances_signed_immutable ON "patient_form_instances";
CREATE TRIGGER patient_form_instances_signed_immutable
  BEFORE UPDATE OR DELETE ON "patient_form_instances"
  FOR EACH ROW EXECUTE FUNCTION prevent_patient_form_instance_signed_mutation();

-- ---------------------------------------------------------------------------
-- G. RLS policies (tenant isolation)
-- ---------------------------------------------------------------------------
ALTER TABLE injectable_usage_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE injectable_usage_details FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON injectable_usage_details;
CREATE POLICY tenant_select ON injectable_usage_details FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM inventory_consumption_logs u
    WHERE u.id = injectable_usage_details."usageLedgerId"
      AND (u."tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
           OR current_setting('app.platform_rls_bypass', true) = 'true')
  )
);
DROP POLICY IF EXISTS tenant_insert ON injectable_usage_details;
CREATE POLICY tenant_insert ON injectable_usage_details FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM inventory_consumption_logs u
    WHERE u.id = injectable_usage_details."usageLedgerId"
      AND (u."tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
           OR current_setting('app.platform_rls_bypass', true) = 'true')
  )
);
DROP POLICY IF EXISTS tenant_update ON injectable_usage_details;
CREATE POLICY tenant_update ON injectable_usage_details FOR UPDATE USING (false);
DROP POLICY IF EXISTS tenant_delete ON injectable_usage_details;
CREATE POLICY tenant_delete ON injectable_usage_details FOR DELETE USING (false);

ALTER TABLE clinical_form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_form_templates FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON clinical_form_templates;
CREATE POLICY tenant_select ON clinical_form_templates FOR SELECT USING (
  "tenantId" IS NULL
  OR "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  OR current_setting('app.platform_rls_bypass', true) = 'true'
);
DROP POLICY IF EXISTS tenant_insert ON clinical_form_templates;
CREATE POLICY tenant_insert ON clinical_form_templates FOR INSERT WITH CHECK (
  (
    "tenantId" IS NOT NULL
    AND "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  OR current_setting('app.platform_rls_bypass', true) = 'true'
);
DROP POLICY IF EXISTS tenant_update ON clinical_form_templates;
CREATE POLICY tenant_update ON clinical_form_templates FOR UPDATE USING (
  (
    "tenantId" IS NOT NULL
    AND "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  OR current_setting('app.platform_rls_bypass', true) = 'true'
) WITH CHECK (
  (
    "tenantId" IS NOT NULL
    AND "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  OR current_setting('app.platform_rls_bypass', true) = 'true'
);
DROP POLICY IF EXISTS tenant_delete ON clinical_form_templates;
CREATE POLICY tenant_delete ON clinical_form_templates FOR DELETE USING (
  (
    "tenantId" IS NOT NULL
    AND "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  OR current_setting('app.platform_rls_bypass', true) = 'true'
);

ALTER TABLE clinical_form_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_form_versions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON clinical_form_versions;
CREATE POLICY tenant_select ON clinical_form_versions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM clinical_form_templates t
    WHERE t.id = clinical_form_versions."templateId"
      AND (t."tenantId" IS NULL
           OR t."tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
           OR current_setting('app.platform_rls_bypass', true) = 'true')
  )
);
DROP POLICY IF EXISTS tenant_insert ON clinical_form_versions;
CREATE POLICY tenant_insert ON clinical_form_versions FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM clinical_form_templates t
    WHERE t.id = clinical_form_versions."templateId"
      AND (
        (
          t."tenantId" IS NOT NULL
          AND t."tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        )
        OR current_setting('app.platform_rls_bypass', true) = 'true'
      )
  )
);
DROP POLICY IF EXISTS tenant_update ON clinical_form_versions;
CREATE POLICY tenant_update ON clinical_form_versions FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM clinical_form_templates t
    WHERE t.id = clinical_form_versions."templateId"
      AND (
        (
          t."tenantId" IS NOT NULL
          AND t."tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        )
        OR current_setting('app.platform_rls_bypass', true) = 'true'
      )
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM clinical_form_templates t
    WHERE t.id = clinical_form_versions."templateId"
      AND (
        (
          t."tenantId" IS NOT NULL
          AND t."tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        )
        OR current_setting('app.platform_rls_bypass', true) = 'true'
      )
  )
);
DROP POLICY IF EXISTS tenant_delete ON clinical_form_versions;
CREATE POLICY tenant_delete ON clinical_form_versions FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM clinical_form_templates t
    WHERE t.id = clinical_form_versions."templateId"
      AND (
        (
          t."tenantId" IS NOT NULL
          AND t."tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        )
        OR current_setting('app.platform_rls_bypass', true) = 'true'
      )
  )
);

ALTER TABLE patient_form_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_form_instances FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON patient_form_instances;
CREATE POLICY tenant_select ON patient_form_instances FOR SELECT USING (
  "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  OR current_setting('app.platform_rls_bypass', true) = 'true'
);
DROP POLICY IF EXISTS tenant_insert ON patient_form_instances;
CREATE POLICY tenant_insert ON patient_form_instances FOR INSERT WITH CHECK (
  "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  OR current_setting('app.platform_rls_bypass', true) = 'true'
);
DROP POLICY IF EXISTS tenant_update ON patient_form_instances;
CREATE POLICY tenant_update ON patient_form_instances FOR UPDATE USING (
  "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  OR current_setting('app.platform_rls_bypass', true) = 'true'
) WITH CHECK (
  "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  OR current_setting('app.platform_rls_bypass', true) = 'true'
);
DROP POLICY IF EXISTS tenant_delete ON patient_form_instances;
CREATE POLICY tenant_delete ON patient_form_instances FOR DELETE USING (
  "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  OR current_setting('app.platform_rls_bypass', true) = 'true'
);

ALTER TABLE clinical_service_form_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_service_form_requirements FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON clinical_service_form_requirements;
CREATE POLICY tenant_select ON clinical_service_form_requirements FOR SELECT USING (
  "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  OR current_setting('app.platform_rls_bypass', true) = 'true'
);
DROP POLICY IF EXISTS tenant_insert ON clinical_service_form_requirements;
CREATE POLICY tenant_insert ON clinical_service_form_requirements FOR INSERT WITH CHECK (
  "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  OR current_setting('app.platform_rls_bypass', true) = 'true'
);
DROP POLICY IF EXISTS tenant_update ON clinical_service_form_requirements;
CREATE POLICY tenant_update ON clinical_service_form_requirements FOR UPDATE USING (
  "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  OR current_setting('app.platform_rls_bypass', true) = 'true'
) WITH CHECK (
  "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  OR current_setting('app.platform_rls_bypass', true) = 'true'
);
DROP POLICY IF EXISTS tenant_delete ON clinical_service_form_requirements;
CREATE POLICY tenant_delete ON clinical_service_form_requirements FOR DELETE USING (
  "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  OR current_setting('app.platform_rls_bypass', true) = 'true'
);
