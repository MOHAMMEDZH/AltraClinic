-- Phase 48 Wave F Round 10 — semantic exactly-once refund reversal per accrual root.
-- Fail closed if incompatible historical duplicates already exist.

DO $$
DECLARE
  dup_count integer;
BEGIN
  SELECT COUNT(*)::int INTO dup_count
  FROM (
    SELECT "tenantId", "reversalOfAccrualId", "refundId"
    FROM "commission_accruals"
    WHERE "reversalOfAccrualId" IS NOT NULL
      AND "refundId" IS NOT NULL
    GROUP BY "tenantId", "reversalOfAccrualId", "refundId"
    HAVING COUNT(*) > 1
  ) d;
  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'Wave F Round 10: % duplicate tenantId+reversalOfAccrualId+refundId groups — fail closed',
      dup_count
      USING ERRCODE = '23505';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "commission_accruals_tenant_root_refund_uidx"
  ON "commission_accruals" ("tenantId", "reversalOfAccrualId", "refundId")
  WHERE "reversalOfAccrualId" IS NOT NULL AND "refundId" IS NOT NULL;
