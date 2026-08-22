# ROUND_7_COLLECTED_CORRECTION_MATRIX

| ID | Scenario | Expected | Result |
|----|----------|----------|--------|
| R7-D-T1 | Non-package COLLECTED same-invoice correction | atomic reverse+repost | PASS |
| R7-D-T2 | Package + COLLECTED | same packageAllocationId | PASS |
| R7-D-T3 | Corrected attribution | proportional R7-A (160) | PASS |
| R7-D-T4 | Allocation row count unchanged | PASS | PASS |
| R7-D-T5 | Invalid provenance | full rollback | PASS |
| R7-D-T6 | Currency mismatch | fail-closed (parity) | covered |
| R7-D-T7 | Cross-invoice replacement | reject | PASS |
| R7-D-T8 | Replay same correctionEventId | idempotent | PASS |
| R7-D-T9 | Refund after correction | current replacement accrual | PASS |
| R7-D-T10 | Multi-participant | no duplicate share blow-up | PASS (R7-A-T6 + correction) |

`correctAndRepost` branches on `original.calculationBasis`: COLLECTED → `postFromCollectedPayment(..., tx)` with original `paymentId` and `correctionEventId`.
