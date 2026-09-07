# Round 15 — Implementation Summary

**Status:** READY FOR EXTERNAL REVIEW (not Production Acceptance)

## Mission

Close the three Round 14 external-review blockers only:

| ID | Blocker | Resolution |
|----|---------|------------|
| R15-A | Asymmetric residual refund continuation | Independent per-dimension caps; one-zero REVERSED tails; sequential complete-set search |
| R15-B | Lineage DB tenant/provenance + real RLS | `enforce_commission_correction_lineage_provenance` + CHECK; booking_app NOBYPASSRLS suite |
| R15-C | Pre-R14 historical upgrade | Zero-history fail-fast migration precondition + runtime fail-closed without lineage |

## Key production symbols

- `computeAuthoritativeRefundReversalAmounts` — caps revenue/commission independently; stops only when both remaining capacities are exhausted
- `assertReversalSignedEconomicShape` / `assertRealizableRefundEffectSet` — `refund-complete-set.ts`
- `acceptExistingRootRefundReversal` — uses reversal shape (allows one-zero)
- `correctAndRepost` — R15-C historical `correctionEventId` without lineage fails closed
- Migration `20260821200000_phase48_wave_f_round15_final_remediation`

## Mandatory 100.00 / 1.00 result (R15-A-T1)

| Step | Revenue effect | Commission effect | Remaining |
|------|----------------|-------------------|-----------|
| Root | 100.00 | 1.00 | — |
| A | −33.50 | −0.34 | 66.50 / 0.66 |
| B | −33.50 | −0.34 | 33.00 / 0.32 |
| C | −32.90 | −0.32 | 0.10 / 0.00 |
| D (tail) | −0.10 | 0.00 | **0.00 / 0.00** |

## Strategy R15-C

Zero-history fail-fast: migration aborts if any `commission_accruals.correctionEventId` lacks a matching `commission_correction_lineages` row. Clean + upgrade validators pass; seeded orphan negative fixture fails with `zero-history`. Runtime never treats orphan historical events as new corrections.
