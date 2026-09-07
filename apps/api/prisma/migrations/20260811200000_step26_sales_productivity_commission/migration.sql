-- Flexible Step 26 — Sales Productivity and Commission Snapshot.
-- Contract: docs/SALES_PRODUCTIVITY_AND_COMMISSION_SNAPSHOT.md
-- Additive only. Snapshots are never auto-created by migration.
-- Review records only: not payroll, not money movement, not billing ledgers.
-- No Step 27 notification/template tables. calculationStatus defaults UNCONFIGURED.

CREATE TABLE IF NOT EXISTS "platform_sales_commission_snapshots" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "representativeId" UUID NOT NULL,
  "periodKey" VARCHAR(16) NOT NULL,
  "periodTimezone" VARCHAR(64) NOT NULL DEFAULT 'UTC',
  "periodStart" TIMESTAMPTZ NOT NULL,
  "periodEnd" TIMESTAMPTZ NOT NULL,
  "sourceCutoffAt" TIMESTAMPTZ NOT NULL,
  "formulaVersion" VARCHAR(64) NOT NULL,
  "calculationStatus" VARCHAR(32) NOT NULL DEFAULT 'UNCONFIGURED',
  "ruleReference" VARCHAR(128),
  "computedAmount" DECIMAL(18, 4),
  "metricsJson" JSONB NOT NULL,
  "planVersionAttributionJson" JSONB NOT NULL,
  "addOnAttributionJson" JSONB NOT NULL,
  "completenessJson" JSONB NOT NULL,
  "reconciliationJson" JSONB,
  "reviewStatus" VARCHAR(32) NOT NULL DEFAULT 'NONE',
  "paidStatus" VARCHAR(32) NOT NULL DEFAULT 'UNPAID',
  "paidReason" VARCHAR(500),
  "paidReference" VARCHAR(200),
  "paidAt" TIMESTAMPTZ,
  "paidByPlatformUserId" UUID,
  "status" VARCHAR(32) NOT NULL,
  "supersedesSnapshotId" UUID,
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "finalizedAt" TIMESTAMPTZ,
  CONSTRAINT "platform_sales_commission_snapshots_representativeId_fkey"
    FOREIGN KEY ("representativeId") REFERENCES "platform_sales_representatives"("id") ON DELETE RESTRICT,
  CONSTRAINT "platform_sales_commission_snapshots_supersedesSnapshotId_fkey"
    FOREIGN KEY ("supersedesSnapshotId") REFERENCES "platform_sales_commission_snapshots"("id") ON DELETE RESTRICT,
  CONSTRAINT "platform_sales_commission_snapshots_period_order"
    CHECK ("periodStart" < "periodEnd"),
  CONSTRAINT "platform_sales_commission_snapshots_status_check"
    CHECK ("status" IN ('DRAFT', 'FINALIZED', 'SUPERSEDED')),
  CONSTRAINT "platform_sales_commission_snapshots_review_check"
    CHECK ("reviewStatus" IN ('NONE', 'IN_REVIEW', 'REVIEWED', 'REJECTED')),
  CONSTRAINT "platform_sales_commission_snapshots_paid_check"
    CHECK ("paidStatus" IN ('UNPAID', 'PAID')),
  CONSTRAINT "platform_sales_commission_snapshots_calc_check"
    CHECK ("calculationStatus" IN ('UNCONFIGURED')),
  CONSTRAINT "platform_sales_commission_snapshots_no_self_supersede"
    CHECK ("supersedesSnapshotId" IS NULL OR "supersedesSnapshotId" <> "id"),
  CONSTRAINT "platform_sales_commission_snapshots_computed_null_when_unconfigured"
    CHECK ("calculationStatus" <> 'UNCONFIGURED' OR "computedAmount" IS NULL)
);

-- At most one non-SUPERSEDED snapshot per (rep, period, timezone, formulaVersion).
CREATE UNIQUE INDEX IF NOT EXISTS "platform_sales_commission_snapshots_active_unique"
  ON "platform_sales_commission_snapshots" ("representativeId", "periodKey", "periodTimezone", "formulaVersion")
  WHERE "status" <> 'SUPERSEDED';

CREATE INDEX IF NOT EXISTS "platform_sales_commission_snapshots_rep_period_idx"
  ON "platform_sales_commission_snapshots" ("representativeId", "periodKey");
CREATE INDEX IF NOT EXISTS "platform_sales_commission_snapshots_period_tz_idx"
  ON "platform_sales_commission_snapshots" ("periodKey", "periodTimezone");
CREATE INDEX IF NOT EXISTS "platform_sales_commission_snapshots_status_idx"
  ON "platform_sales_commission_snapshots" ("status");
CREATE INDEX IF NOT EXISTS "platform_sales_commission_snapshots_review_idx"
  ON "platform_sales_commission_snapshots" ("reviewStatus");
CREATE INDEX IF NOT EXISTS "platform_sales_commission_snapshots_paid_idx"
  ON "platform_sales_commission_snapshots" ("paidStatus");
CREATE INDEX IF NOT EXISTS "platform_sales_commission_snapshots_createdAt_id_idx"
  ON "platform_sales_commission_snapshots" ("createdAt", "id");

-- Idempotency resultResourceType must fit audit resource types used as claim targets
-- (e.g. platform_sales_commission_snapshot = 34, platform_sales_customer_ownership = 33).
ALTER TABLE "platform_sales_idempotency"
  ALTER COLUMN "resultResourceType" TYPE VARCHAR(64);
