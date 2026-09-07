# ROUND 11 — Migration Validation

## Migration decision

**No Round 11 migration was added.**

Round 10 partial unique index `commission_accruals_tenant_root_refund_uidx` remains the semantic uniqueness authority:

```sql
CREATE UNIQUE INDEX commission_accruals_tenant_root_refund_uidx
  ON public.commission_accruals ("tenantId", "reversalOfAccrualId", "refundId")
  WHERE (("reversalOfAccrualId" IS NOT NULL) AND ("refundId" IS NOT NULL));
```

Lineage for carry/replay is proven from existing durable columns (`refundId`, `correctionEventId`, `reversalOfAccrualId`, participant/payment/invoice fields) plus full economic recompute — no history rewrite.

## Validators (fresh)

| Validator | Exit | Status | Notes |
|-----------|------|--------|-------|
| `validate-phase48-wave-f-clean.mjs` | 0 | PASS | Round 10 index still asserted |
| `validate-phase48-wave-f-upgrade.mjs` | 0 | PASS | Through latest Wave F migration (Round 10) |

Raw: `ROUND_11_RAW_GATE_OUTPUTS/18_clean.txt`, `19_upgrade.txt`
