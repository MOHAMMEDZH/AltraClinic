# ROUND_6_REAL_PRODUCTION_PATH_MATRIX

| Path | Flow | Result |
|------|------|--------|
| A | Package/session allocation → partial payment → COLLECTED_REVENUE accrual bounded by allocation | PASS (R6-PKGCOL-T1/T2/T8) |
| B | Package allocation currency ↔ invoice/payment currency parity; mismatch fail-closed | PASS (R6-PKGCUR-*) |
| C | TreatmentCourse → CourseSession → ServicePerformance → InvoiceLine → allocation with patient/session provenance | PASS (R6-PKGPROV-*) |
| D | Correction replacement → canonical binding validator → commit or full rollback | PASS (R6-CORRBIND-*) |
| E | Course bound V1 → V1 SUPERSEDED → existing course session still allocates using V1 | PASS (R6-PKGHIST-*) |

No mocked core financial/business services for acceptance proof — Nest services + Prisma PostgreSQL integration.
