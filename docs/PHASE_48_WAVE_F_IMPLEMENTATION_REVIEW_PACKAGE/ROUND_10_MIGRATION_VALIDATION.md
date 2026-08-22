# ROUND_10_MIGRATION_VALIDATION

- Migration: `20260821100000_phase48_wave_f_round10_remediation`
- Creates partial unique index `commission_accruals_tenant_root_refund_uidx`
- Pre-check fails closed if duplicate `(tenantId, reversalOfAccrualId, refundId)` groups exist
- Clean validator: EXIT 0 (asserts migration + index)
- Upgrade validator: EXIT 0 (asserts Round 10 applied + index present)
- No historical financial row rewrite/delete
