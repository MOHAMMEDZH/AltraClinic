# Round 16 — Full Refund Saturation Matrix (R16-A)

## Reference case (invoice SERVICE_NET 10%, root 100.00 / 10.00)

Authoritative denominator = invoice.amountTotal = **100.00**

| Step | Refund basis | Isolated proposal (rev/comm) | Applied effect (rev/comm) | Cumulative basis | Remaining after |
|---|---|---|---|---|---|
| A | 33.34 | 33.34 / 3.33 | −33.34 / −3.33 | 33.34 | 66.66 / 6.67 |
| B | 33.33 | 33.33 / 3.33 | −33.33 / −3.33 | 66.67 | 33.33 / 3.34 |
| C (saturates) | 33.33 | 33.33 / 3.33 | −33.33 / −3.34 | 100.00 | 0.00 / 0.00 |

**Final net attributed revenue:** 0.00
**Final net commission:** 0.00
**Fourth refund:** not created/required; additional attempt fail-closed (R16-A-T4)

Note: which of A/B/C absorbs the 0.01 commission residual depends on application order; complete-set validation is order-independent for valid multisets.

## R16-A-T5 asymmetric retention (100.00 / 1.00)

Refunds 33.50 + 33.50 + 32.90 + 0.10 → final tail −0.10 / 0.00; nets 0.00 / 0.00 (commission exhausted before revenue).

## Package COLLECTED_REVENUE (R16-A-T7)

Denominator = sum(invoice payments). Exact split 33.34+33.33+33.33 → nets 0/0; paymentId, packageAllocationId, currency preserved on all reversal rows.

## Correction (R16-A-T9)

After saturation, correctAndRepost carries canonical refund identities exactly once; nets remain 0/0.
