# ROUND_6_PACKAGE_PROVENANCE_CHAIN_MATRIX

| ID | Scenario | Expected | Result |
|----|----------|----------|--------|
| R6-PKGPROV-T1 | Course patient A + performance patient B | Reject | PASS |
| R6-PKGPROV-T2 | Session appointment exists + performance appointment null | Reject | PASS |
| R6-PKGPROV-T3 | Session appointment A + performance appointment B | Reject | PASS |
| R6-PKGPROV-T4 | Invoice patient mismatch | Reject | PASS |
| R6-PKGPROV-T5 | invoiceLineId unrelated to performance/session | Reject | PASS |
| R6-PKGPROV-T6 | Wrong clinical service | Reject | PASS |
| R6-PKGPROV-T7 | Fully matching chain | Success | PASS |
| R6-PKGPROV-T8 | Failed validation | Zero allocation/accrual side effects | PASS |
| R6-PKGPROV-T9 | Real PostgreSQL | Suite is postgres integration | PASS |

## Invariants enforced at `registerSessionAllocation`

- Tenant: course / session / performance / (optional) invoice line / invoice
- Patient: `TreatmentCourse.patientId` = `ServicePerformance.patientId` = invoice patient when line supplied
- Appointment: if `CourseSession.appointmentId` set → performance must match; appointment patient must match course patient
- Clinical service: performance matches course clinical service
- `invoiceLineId` when present must prove: same `servicePerformanceId`, same `courseSessionId`, patient, currency, compatible appointment/clinicalService — not a UUID hint
