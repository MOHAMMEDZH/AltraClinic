# CHANGE_SUMMARY (Round 7)

## Purpose
Close four Round 6 external-review Production Acceptance blockers for package COLLECTED proportionality, cross-basis concurrency, invoice-line pinning, and COLLECTED correction.

## Code
- `commission-accrual.service.ts`
  - R7-A proportional package collected attribution
  - R7-B shared performance + package allocation FOR UPDATE locks on both posting paths
  - R7-C pin enforcement whenever allocation.invoiceLineId set
  - R7-D basis-aware `correctAndRepost` → collected worker in same txn
  - multi-participant financiallyConsumedAt local mark after first write
- `wave-f-round7.postgres.integration.spec.ts` (9 tests)
- Round 6 PKGCOL expectations aligned to proportional economics

## Non-goals
No Wave G/H/I, Phase 49, Step 30. No commit/push. No Round 7 migration.
