# ROUND_10_CHANGE_MATRIX

| ID | Defect | Fix | Source |
|----|--------|-----|--------|
| R10-A | Carry used `rev_corr_refund:…`; reverse used `rev:…` → double refund | Canonical `rev:{rootId}:{refundId}` + semantic lookup + partial unique index | `carryForwardPriorRefundReversals`, `findExistingRootRefundReversal`, `assertCompatibleRootRefundReversal`, migration Round 10 |
| R10-B | Production `__testFailAfterRepostBeforeRefundCarry` | Removed; fault via test-owned audit adapter | `correctAndRepost`; R9-A-T8 / R10-B-T2 |
| R10-C | R9-C-T3 was sequential | Real two-client refund↔correction with `pg_blocking_pids` | Round 10 R10-C-*; R9-C-T3 renamed honest |
| R10-D | Tests wrote `ROUND_9_RAW_PG_BLOCKING_EVIDENCE.md` | stdout diagnostics only | Round 9 `afterAll`; R10-D-T1 |

Migration: `20260821100000_phase48_wave_f_round10_remediation`
