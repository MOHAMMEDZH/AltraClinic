# ROUND_9_REFUND_CORRECTION_LIFECYCLE_PROOF

## Authoritative design

1. Repost replacement gross roots via canonical posting workers (full payment/invoice attribution).
2. Discover prior refund reversal rows on each old cohort root (`refundId IS NOT NULL`).
3. Append new `correction-refund-carry:` reversal rows on the uniquely matched replacement root (same `userId` + `paymentId` when present), preserving `refundId`, amounts, currency, package allocation, and audit.
4. Idempotency keys: `rev_corr_refund:{newRootId}:{refundId}:{correctionEventId}` (and recognize `rev:{newRootId}:{refundId}`).

Client-supplied remaining amounts are **not** accepted.

## Exact values (R9-A-T1)

| Step | Attributed net | Commission net (10%) |
|------|----------------|----------------------|
| Gross collected (800/5000×1000) | 160.00 | 16.00 |
| Prior refund 400/800 → −80 | 80.00 | 8.00 |
| After correction (carry −80 on +160) | **80.00** | **8.00** |

Broken pre-R9 outcome would have been 160.00 after correction.

## Multi-payment / participant

- R9-A-T2: two payments, prior refund on one root → net before = after (**280.00** attributed).
- R9-A-T3: 2×2 roots, one prior refund → aggregate attributed + commission unchanged; four open replacement roots.

## Replay / rollback

- R9-A-T5: same `correctionEventId` → `idempotent: true`, zero new rows.
- R9-A-T6: different replacement → fail closed.
- R9-A-T8: injected failure after repost before carry → full rollback (counts, net, ACTIVE binding unchanged).
- R9-A-T4: full prior refund → fail closed, no new positive open economics.
- R9-A-T7: later refund on replacement only; cumulative cap to zero; further refund fails.
