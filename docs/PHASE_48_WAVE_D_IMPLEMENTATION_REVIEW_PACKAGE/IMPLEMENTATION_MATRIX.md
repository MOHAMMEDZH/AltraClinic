# Wave D Implementation Matrix

Status values: NOT STARTED | IN PROGRESS | EVIDENCE PENDING | PASS (evidence only).

| frozen requirement | source document/section | invariant | production entry point | current implementation state | change required | DB enforcement | tenant/RLS enforcement | RBAC enforcement | audit requirement | test required | status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P0-05 PlanItem↔Appointment M:N | Freeze AR-08; Target §8; QA Plan Link | Junction; links survive reschedule; no auto-cancel items | `/dental/treatment-plans/:planId/items/:itemId/appointments` | Implemented | table + service + HTTP | unique(planItemId, appointmentId) | RLS + tenant refs | api.treatment-plan-links | link/unlink | Plan Link pack | PASS |
| P0-05 explicit complete safety | QA Plan Link; Wave B lifecycle | **Only COMPLETED appointment can complete item** | `POST .../complete-from-appointment` | **Round 1 fixed** | status gate + fail-closed | tx item update only on pass | tenant+patient+link checks | api.treatment-plan-links update | success-only audit | state safety matrix | PASS |
| P0-05 nullable clinicalServiceId | Frozen plan migration | Historical rows can be null | plan item write/link | Implemented | nullable FK | FK RESTRICT | existing | existing | n/a | migration upgrade | PASS |
| P1-02 pricing units | Target §4 | Publish + booking enforce domain/unit; PER_COURSE/PER_PACKAGE fail-closed | catalog publish; booking commercial resolve | **Round 1 proof expanded** | production-path postgres tests | Prisma enum | existing tenant pricing | existing | existing | publish+booking integration | PASS |
| P1-03 OPERATORY | Freeze AR-12 | enum + lock reuse | resources + booking | Implemented | add enum/create API | enum | existing RLS | api.scheduling manage | create audit | conflict test | PASS |
| P1-07 DentalLabCase | Freeze AR-16 | transition + attachment + tenant refs | `/dental/lab-cases` | Implemented | model+service+HTTP | FK+status checks | RLS + tenant refs | api.dental-lab | create/transition/attach | transitions+HTTP+RLS | PASS |
| AR-21 ServicePerformance start | Freeze AR-21 | provider not auto performer; share<=100; correction path | `/service-performances` | **Round 1 fixed** | reference integrity + correction lock | new FK branch/encounter + FOR UPDATE lock | tenant checks + RLS | api.service-performance | create/complete/correct | ref matrix + concurrency | PASS |
| Dental usage via ledger | INV-B02 | no second ledger | existing dental consume path | Implemented | pass optional IDs to existing posting | existing usage constraints | existing validators | existing | existing | consume path tests | PASS |

Evidence: `ROUND_1_REMEDIATION_MATRIX.md`, `ROUND_3_QA_CLOSURE_MATRIX.md`, `TEST_RESULTS.md`, `TENANT_REFERENCE_VALIDATION.md`, `RLS_VALIDATION.md`, `CHILD_PARENT_TENANT_INVARIANT_MATRIX.md`, `AUDIT_VALIDATION.md`, `TRANSACTION_CONCURRENCY_VALIDATION.md`, `MIGRATION_VALIDATION.md`.
