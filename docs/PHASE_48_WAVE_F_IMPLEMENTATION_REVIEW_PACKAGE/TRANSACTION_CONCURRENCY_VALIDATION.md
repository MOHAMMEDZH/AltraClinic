# TRANSACTION_CONCURRENCY_VALIDATION (Round 6)

| Control | Result |
|---------|--------|
| Package allocation advisory lock per course | PASS (R5 regression) |
| Concurrent over-allocate prevented | PASS |
| Concurrent fit both succeed | PASS |
| Same-session duplicate → one | PASS |
| Unrelated packages non-blocking | PASS (PKG2-T5 fixture patient-aligned for R6 provenance) |
| Prior F7 settlement concurrency | CLOSED (Round 3 regression) |
| Correction binding validate-before-ACTIVE in same txn | PASS (R6-CORR-BINDING) |

See `ROUND_5_PACKAGE_ALLOCATION_CONCURRENCY_MATRIX.md` + `ROUND_6_CORRECTION_BINDING_INVARIANT_PARITY_MATRIX.md`.
