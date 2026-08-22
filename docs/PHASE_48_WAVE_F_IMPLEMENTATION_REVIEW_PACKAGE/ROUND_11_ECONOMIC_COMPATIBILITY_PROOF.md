# ROUND 11 — Economic Compatibility Proof

## Implemented production invariant

An existing root/refund accrual row may be returned as idempotent **only** after:

1. `status === REVERSED`
2. `attributedRevenueAmount < 0` and `commissionAmount < 0` (not zero)
3. Full root provenance parity (tenant, user, SP, appointment, service, snapshot, invoice, line, payment, package, plan version, basis, percent, currency, branch, reversalOf, refundId)
4. Idempotency key is `rev:{rootId}:{refundId}` or permitted legacy `rev_corr_refund:{rootId}:{refundId}:{correctionEventId}`
5. Amounts equal `computeAuthoritativeRefundReversalAmounts(..., { excludeAccrualId: existing.id })`

## Observed raw results (fresh R11 suite)

| Test | Observation |
|------|-------------|
| R11-A-T1 | Planted `-1.00` / `-8.00` → reject; counts/nets unchanged |
| R11-A-T2 | Planted `-80.00` / `-0.10` → reject |
| R11-A-T3 | Positive `+80` / `+8` → reject (sign) |
| R11-A-T6 | Valid replay returns same id; attributed `-80`, commission `-8`; net `80.00` |
| R11-A-T8 | Refund A `-80`, B `-40`; reverse-order replay; net `40.00`; no duplicates |

## Distinction

- **Invariant:** server code in `acceptExistingRootRefundReversal` / `computeAuthoritativeRefundReversalAmounts`
- **Executable:** R11-A-T1..T8, T12
- **Inherited:** Round 10 unique index `commission_accruals_tenant_root_refund_uidx` unchanged
