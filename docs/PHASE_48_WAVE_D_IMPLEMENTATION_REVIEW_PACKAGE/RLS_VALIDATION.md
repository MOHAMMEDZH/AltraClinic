# RLS Validation (Wave D Round 3)

## Context proof (booking_app / NOBYPASSRLS)

Explicit assertion in `NOBYPASSRLS context is active`:

- `current_user` = truthy (`booking_app`)
- `rolbypassrls` = `false` (from `pg_roles`)
- `app.current_tenant_id` = session tenant UUID

Helper: `nobypassProof()` in `wave-d-rls.postgres.integration.spec.ts`

## Six Wave D tables — lifecycle matrix

Each PASS references an explicit test assertion (not by analogy).

| Table | Same-tenant SELECT | Cross-tenant SELECT | Same-tenant INSERT | Cross-tenant INSERT (wrong child tenantId) | Cross-tenant UPDATE | Cross-tenant DELETE | Mixed-tenant parent INSERT (session tenant B) |
|-------|-------------------|---------------------|-------------------|-------------------------------------------|---------------------|---------------------|-----------------------------------------------|
| treatment_plan_item_appointments | PASS — `same-tenant SELECT sees Wave D rows` | PASS — `cross-tenant SELECT is empty` | PASS — `same-tenant INSERT succeeds for all six Wave D tables under RLS` | PASS — `R3 six-table RLS lifecycle matrix...` | PASS — matrix `updateMany` count 0 | PASS — matrix `deleteMany` count 0 | PASS — `mixed-tenant parent INSERT...` |
| dental_lab_cases | PASS — same-tenant SELECT | PASS — cross-tenant SELECT | PASS — same-tenant INSERT | PASS — matrix | PASS — `cross-tenant INSERT/UPDATE/DELETE...` | PASS — cross-tenant deny test | N/A (parent table) |
| dental_lab_case_attachments | PASS — same-tenant SELECT | PASS — cross-tenant SELECT | PASS — same-tenant INSERT | PASS — matrix | PASS — matrix | PASS — matrix | PASS — `R3-T1...` (labCaseId Tenant-A under session B) |
| service_performances | PASS — same-tenant SELECT | PASS — cross-tenant SELECT | PASS — same-tenant INSERT | PASS — matrix | PASS — cross-tenant deny test | PASS — cross-tenant deny test | N/A (parent table) |
| service_performance_participants | PASS — same-tenant SELECT | PASS — cross-tenant SELECT | PASS — same-tenant INSERT | PASS — `R3-T4...` | PASS — matrix | PASS — matrix | PASS — `R3-T2...` (performanceId Tenant-A under session B) |
| service_performance_corrections | PASS — same-tenant SELECT | PASS — cross-tenant SELECT | PASS — same-tenant INSERT | PASS — `R3-T5...` | PASS — matrix + append-only test (RLS UPDATE false) | PASS — matrix (DELETE false) | PASS — `R3-T3...` (performanceId Tenant-A under session B) |

Proof file: `apps/api/src/modules/dental/tests/wave-d-rls.postgres.integration.spec.ts`

## Append-only correction rows

`service_performance_corrections` RLS policy: `tenant_update USING (false)`, `tenant_delete USING (false)`.

Documented in: `R3 service_performance_corrections UPDATE is intentionally immutable via RLS (append-only)`.

Parent-switch UPDATE on `performanceId` / `actorId` is not exercised via mutable UPDATE; INSERT-time trigger coverage is via R3-T2/T3/T5 and Round 2 migration triggers.

## DB child-parent triggers (Round 2 — unchanged Round 3)

Migration `20260819220000_phase48_wave_d_round2_child_tenant_integrity` + mirrored `triggers.sql` reject cross-tenant parent IDs on INSERT/UPDATE where UPDATE is permitted by RLS.

See `CHILD_PARENT_TENANT_INVARIANT_MATRIX.md` and `ROUND_3_QA_CLOSURE_MATRIX.md`.
