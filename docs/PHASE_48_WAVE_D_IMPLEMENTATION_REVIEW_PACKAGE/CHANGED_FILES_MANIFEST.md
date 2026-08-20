# Wave D Changed Files Manifest

## Round 3 (QA-only)

- `apps/api/src/modules/dental/tests/wave-d-rls.postgres.integration.spec.ts` — R3-T1..T5, parent-switch UPDATE, six-table matrix, NOBYPASSRLS proof helpers
- `docs/PHASE_48_WAVE_D_IMPLEMENTATION_REVIEW_PACKAGE/ROUND_3_QA_CLOSURE_MATRIX.md` (new)
- `docs/PHASE_48_WAVE_D_IMPLEMENTATION_REVIEW_PACKAGE/RLS_VALIDATION.md`
- `docs/PHASE_48_WAVE_D_IMPLEMENTATION_REVIEW_PACKAGE/CHILD_PARENT_TENANT_INVARIANT_MATRIX.md`
- `docs/PHASE_48_WAVE_D_IMPLEMENTATION_REVIEW_PACKAGE/TEST_RESULTS.md`
- `docs/PHASE_48_WAVE_D_IMPLEMENTATION_REVIEW_PACKAGE/REGRESSION_RESULTS.md`
- `docs/PHASE_48_WAVE_D_IMPLEMENTATION_REVIEW_PACKAGE/IMPLEMENTATION_MATRIX.md`
- `docs/PHASE_48_WAVE_D_IMPLEMENTATION_REVIEW_PACKAGE/CHANGED_FILES_MANIFEST.md`

No Round 3 production source changes.

## Round 1 additions focused on B1-B6 only

## New/updated Round 1 core files

- `apps/api/src/modules/dental/services/treatment-plan-appointment-link.service.ts`
- `apps/api/src/modules/dental/services/wave-d-reference.validation.ts`
- `apps/api/src/modules/service-performance/services/service-performance.service.ts`
- `apps/api/src/modules/dental/tests/wave-d-dental.postgres.integration.spec.ts`
- `apps/api/src/modules/dental/tests/wave-d-rls.postgres.integration.spec.ts`
- `apps/api/src/modules/clinical-catalog/tests/wave-d-pricing-production-path.postgres.integration.spec.ts`
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/20260819163000_phase48_wave_d_round1_reference_integrity/migration.sql`
- `apps/api/scripts/validate-phase48-wave-d-upgrade.mjs`

## Existing Wave D files preserved

- Wave D migration `20260819010000_phase48_wave_d_dental_integration`
- Wave D HTTP/operatory/lab/pricing unit tests
- Wave D modules/controllers/DTOs/permissions previously added

## Evidence package updates

- `CHANGE_SUMMARY.md`
- `IMPLEMENTATION_MATRIX.md`
- `TEST_RESULTS.md`
- `HTTP_VALIDATION.md`
- `TENANT_REFERENCE_VALIDATION.md`
- `RLS_VALIDATION.md`
- `AUDIT_VALIDATION.md`
- `TRANSACTION_CONCURRENCY_VALIDATION.md`
- `MIGRATION_VALIDATION.md`
- `REGRESSION_RESULTS.md`
- `BUILD_RESULTS.md`
- `KNOWN_LIMITATIONS.md`
- `CHANGED_FILES_MANIFEST.md`
- `ROUND_1_REMEDIATION_MATRIX.md`
