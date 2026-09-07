# Wave E RLS Validation (Round 2)

## Tables under Wave E RLS

| Table | ENABLE | FORCE | Policies |
|-------|--------|-------|----------|
| `treatment_courses` | yes | yes | tenant SELECT/INSERT/UPDATE/DELETE (`tenantId` = `app.current_tenant_id` OR platform bypass setting) |
| `course_sessions` | yes | yes | same |
| `device_treatment_records` | yes | yes | same |

Defined in migration `20260820120000_phase48_wave_e_aesthetic_dermatology` and synced in `apps/api/prisma/rls-policies.sql`. Round 1 accountability triggers do not change RLS policies.

## NOBYPASSRLS proof suite

File: `apps/api/src/modules/aesthetic/tests/wave-e-rls.postgres.integration.spec.ts`

Role context: `booking_app` with `app.platform_rls_bypass=false`.

| Assertion | Result |
|-----------|--------|
| `current_user` / `rolbypassrls=false` / tenant config proof | PASS |
| Same-tenant SELECT sees Wave E rows | PASS |
| Cross-tenant SELECT empty | PASS |
| Same-tenant INSERT succeeds under RLS | PASS |
| Cross-tenant INSERT rejected | PASS |
| Cross-tenant UPDATE/DELETE zero or rejected | PASS |
| Dangerous shape: `course_sessions.tenantId=A` + course from B rejected | PASS |
| Dangerous shape: device record foreign-tenant `patientId` rejected | PASS |
| Relation-by-relation mixed-parent INSERT / parent-switch UPDATE (R2-B5) | PASS — see `ROUND_2_DB_RELATION_TEST_MATRIX.md` |
| `dermatology_records` table does **not** exist | PASS |

Aggregate: included in Round 2 postgres run → **7 suites / 124 tests PASS** (`TEST_RESULTS.md`, `_wave_e_round2_jest.txt`).

Clean validator prints `OK RLS` for all three tables (`_clean_r2.txt`).
