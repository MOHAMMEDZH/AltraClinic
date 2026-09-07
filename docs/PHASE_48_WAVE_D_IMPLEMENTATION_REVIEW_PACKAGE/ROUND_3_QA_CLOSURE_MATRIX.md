# Wave D Round 3 QA Closure Matrix

Date: 2026-08-20 (local)
Scope: B4 QA/evidence gaps only — no production source change.

## NOBYPASSRLS proof

| Field | Value | Test |
|-------|-------|------|
| current_user | `booking_app` (truthy) | `NOBYPASSRLS context is active` |
| rolbypassrls | `false` | same |
| active tenant | matches `app.current_tenant_id` per transaction | same |

File: `apps/api/src/modules/dental/tests/wave-d-rls.postgres.integration.spec.ts`

## Required B4 closure tests

| QA requirement | table | relation | test file | exact test name | NOBYPASSRLS | expected result | actual result | evidence status |
|----------------|-------|----------|-----------|-----------------|-------------|-----------------|---------------|-----------------|
| R3-T1 attachment FK mixed tenant | dental_lab_case_attachments | labCaseId | wave-d-rls.postgres.integration.spec.ts | R3-T1 attachment mixed-tenant labCaseId INSERT rejected under tenant B | yes | DB rejection; no row | reject + admin count 0; same-tenant control insert succeeds | CLOSED |
| R3-T2 participant FK mixed tenant | service_performance_participants | performanceId | wave-d-rls.postgres.integration.spec.ts | R3-T2 participant mixed-tenant performanceId INSERT rejected under tenant B | yes | DB rejection; no row | reject + admin count 0 | CLOSED |
| R3-T3 correction FK mixed tenant | service_performance_corrections | performanceId | wave-d-rls.postgres.integration.spec.ts | R3-T3 correction mixed-tenant performanceId INSERT rejected under tenant B | yes | DB rejection; no row | reject + admin count 0 | CLOSED |
| R3-T4 wrong child tenant INSERT | service_performance_participants | tenantId (RLS) | wave-d-rls.postgres.integration.spec.ts | R3-T4 participant wrong child tenantId INSERT rejected by RLS under tenant B | yes | RLS rejection; no row | reject + admin count 0 | CLOSED |
| R3-T5 wrong child tenant INSERT | service_performance_corrections | tenantId (RLS) | wave-d-rls.postgres.integration.spec.ts | R3-T5 correction wrong child tenantId INSERT rejected by RLS under tenant B | yes | RLS rejection; no row | reject + admin count 0 | CLOSED |
| Parent-switch UPDATE labCaseId | dental_lab_case_attachments | labCaseId | wave-d-rls.postgres.integration.spec.ts | R3 parent-switch UPDATE rejected for attachment labCaseId and participant performanceId | yes | trigger/FK reject; row unchanged | reject; labCaseId still caseA | CLOSED |
| Parent-switch UPDATE performanceId | service_performance_participants | performanceId | wave-d-rls.postgres.integration.spec.ts | R3 parent-switch UPDATE rejected for attachment labCaseId and participant performanceId | yes | trigger/FK reject; row unchanged | reject; performanceId still perfA | CLOSED |
| Parent-switch UPDATE appointmentId | treatment_plan_item_appointments | appointmentId | wave-d-rls.postgres.integration.spec.ts | R3 parent-switch UPDATE rejected for link appointmentId | yes | trigger/FK reject; row unchanged | reject; appointmentId still apptA | CLOSED |
| Parent-switch UPDATE planItemId | treatment_plan_item_appointments | planItemId | wave-d-rls.postgres.integration.spec.ts | parent-switch UPDATE is rejected for child Wave D relations | yes | trigger/FK reject | reject | CLOSED |
| Parent-switch UPDATE mediaAssetId | dental_lab_case_attachments | mediaAssetId | wave-d-rls.postgres.integration.spec.ts | parent-switch UPDATE is rejected for child Wave D relations | yes | trigger/FK reject | reject | CLOSED |
| Parent-switch UPDATE userId | service_performance_participants | userId | wave-d-rls.postgres.integration.spec.ts | parent-switch UPDATE is rejected for child Wave D relations | yes | trigger/FK reject | reject | CLOSED |
| Corrections append-only (no mutable UPDATE) | service_performance_corrections | performanceId, actorId | wave-d-rls.postgres.integration.spec.ts | R3 service_performance_corrections UPDATE is intentionally immutable via RLS (append-only) | yes | UPDATE denied by RLS `USING (false)` | update throws; updateMany count 0; reason unchanged | DOCUMENTED (not parent-switch via UPDATE) |
| Six-table lifecycle matrix | all six Wave D tables | SELECT/INSERT/UPDATE/DELETE | wave-d-rls.postgres.integration.spec.ts | R3 six-table RLS lifecycle matrix has explicit per-operation proof | yes | per-op assertions | all six tables covered with real assertions | CLOSED |

## Targeted Round 3 run

```
cwd: apps/api
env: RUN_PLATFORM_DB_SECURITY=true, ALLOW_TEST_DATABASE_RESET=true
command: npm run test:integration -- --testPathPattern=wave-d-rls
suites: 1
tests: 16
exit: 0
```

## Production code

Round 3 required tests passed against existing Round 2 DB triggers and RLS policies. **No production source change in Round 3.**
