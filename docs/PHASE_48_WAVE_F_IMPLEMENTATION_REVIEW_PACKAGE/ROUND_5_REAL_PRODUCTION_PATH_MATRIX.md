# ROUND_5_REAL_PRODUCTION_PATH_MATRIX

| Path | Proven |
|------|--------|
| A. TreatmentCourse.packagePriceVersionId → authoritative basis/currency → registerSessionAllocation | YES (R5-PKG1) |
| B. Concurrent package allocation → serialized cap | YES (R5-PKG2) |
| C. commission_package_session_allocations → real app-role RLS | YES (R5-PKG3) |
| D. InvoiceLineItem provenance → strict two-way bind | YES (R5-BIND) |
| E. TENANT_CUSTOM ClinicalService → DB tenant integrity | YES (R5-CSVC) |
| F. Package allocation → accrual → correction → replacement → no double-count | YES (R5-PKGC) |

Core financial services exercised without mocks (real Prisma/Postgres).
