# ROUND_7_REMEDIATION_MATRIX

| ID | Blocker | Status | Evidence |
|----|---------|--------|----------|
| R7-A | Package COLLECTED proportional to payment/invoice × allocation | CLOSED | `postFromCollectedPayment` uses `allocatedRevenueAmount * (payment/invoiceTotal)` then remaining cap |
| R7-B | Cross-basis invoice vs collected race double-earn | CLOSED | Shared `lockCrossBasisEconomicScope` + package allocation FOR UPDATE before opposing checks |
| R7-C | Unconsumed allocation posts against different invoice line | CLOSED | `resolvePackageAllocationForPost` enforces pin whenever `invoiceLineId` set; correction lineage only when SUPERSEDED proven |
| R7-D | `correctAndRepost` cannot repost COLLECTED_REVENUE | CLOSED | Basis-aware repost: COLLECTED → `postFromCollectedPayment` in same txn; same-invoice payment required |
| R7-HYGIENE | git diff --check | CLOSED | Verified at gate |

Migration: **none** (application-level)

Tests: `wave-f-round7.postgres.integration.spec.ts` — **9 PASS**
