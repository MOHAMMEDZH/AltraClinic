# ROUND_5_PACKAGE_ALLOCATION_CONCURRENCY_MATRIX

| Test | Result | Notes |
|------|--------|-------|
| R5-PKG2-T1 | PASS | basis 5000, existing 3000, concurrent 1500+1500 → cumulative 4500 (≤5000) |
| R5-PKG2-T2 | PASS | one succeeds, one rejects |
| R5-PKG2-T3 | PASS | two small allocations both succeed |
| R5-PKG2-T4 | PASS | concurrent same-session → single row |
| R5-PKG2-T5 | PASS | different courses do not block each other |
| R5-PKG2-T6 | PASS | post-lock reread (lock before sum) |

**Lock:** `pg_advisory_xact_lock(hashtext(tenantId:pkg-alloc:treatmentCourseId))`
**Scope:** per treatment course commercial package
