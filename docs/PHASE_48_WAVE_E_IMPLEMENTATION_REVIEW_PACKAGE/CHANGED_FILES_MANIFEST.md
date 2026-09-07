# Wave E Changed Files Manifest (Round 3)

Wave E source / config / evidence files. Excludes generated `packages/module-registry` and `packages/dashboard-export` `.js`/`.d.ts` artifacts.

Base HEAD: `438b8b3859b3a78548cfde81c8fc14135a51a5ef`
Branch: `cursor/phase48-wave-e-aesthetic-dermatology`

## Round 3 key files (app / tests)

- `apps/api/src/modules/scheduling/application/services/booking-commercial-resolver.service.ts` — R3-B1 PA-04 `resolveCurrentKeyOutcome` on exact course package bind; branch null/wrong; no substitute
- `apps/api/src/modules/aesthetic/services/wave-e-reference.validation.ts` — R3-B2 timestamp chronology vs signed calendar-day interval; signed `daysBetweenAppointments` alias
- `apps/api/src/modules/aesthetic/services/treatment-course.service.ts` — interval enforcement on link (uses assertCourseSessionInterval)
- `apps/api/src/modules/aesthetic/services/pre-post-care.service.ts` — R3-B3 tenant OR null platform pack; tenant precedence; no mutation
- `apps/api/src/modules/aesthetic/tests/wave-e-round3.postgres.integration.spec.ts` — R3-B2 / R3-B3
- `apps/api/src/modules/aesthetic/tests/wave-e-production-path.postgres.integration.spec.ts` — R3-B2 HTTP; R3-B3-T13/T14 platform pack
- `apps/api/src/modules/clinical-catalog/tests/wave-d-pricing-production-path.postgres.integration.spec.ts` — R3-B1-T1..T8
- `apps/api/src/modules/clinical-catalog/domain/pricing-unit-applicability.ts` (+ unit spec) — course/package booking context (as touched)

## Wave E + Round 1 / Round 2 baseline (still in tree; not Round 3 migrations)

- Aesthetic module (controller, services, module, audit port/adapter)
- Migrations: `20260820120000_phase48_wave_e_aesthetic_dermatology`, `20260820140000_phase48_wave_e_round1_remediation`
- Round 2 app remediations (exact bind, bidirectional intervals, deviceId DTO, PRE/POST authority, RLS relation tests, production-path)
- Validators: `validate-phase48-wave-e-*.mjs`
- Permission matrices (3-way), `schema.prisma`, `rls-policies.sql`, `triggers.sql`

## Evidence package — Round 3 matrices / updates

**New**

- `ROUND_3_REMEDIATION_MATRIX.md`
- `ROUND_3_PA04_COURSE_PRICING_MATRIX.md`
- `ROUND_3_ZERO_DAY_INTERVAL_MATRIX.md`
- `ROUND_3_PRE_POST_PLATFORM_PACK_MATRIX.md`

**Updated**

- `IMPLEMENTATION_MATRIX.md`, `TEST_RESULTS.md`, `REGRESSION_RESULTS.md`, `BUILD_RESULTS.md`, `KNOWN_LIMITATIONS.md`, `TRANSACTION_CONCURRENCY_VALIDATION.md`, `MIGRATION_VALIDATION.md`, `CHANGED_FILES_MANIFEST.md`

**Captures**

- `_wave_e_round3_unit.txt`, `_wave_e_round3_jest.txt`, `_permissions_r3.txt`, `_clean_r3.txt`, `_upgrade_r3.txt`, `_api_build_r3.txt`, `_wave_a_r3.txt`, `_wave_b_r3.txt`
- Wave C / D Round 3 FULL captures: `_wave_c_r3.txt` / `_wave_d_r3.txt` when recorded

## Explicitly excluded from Wave E review scope

- `packages/module-registry/**` generated `.js` / `.d.ts`
- `packages/dashboard-export/**` generated `.js` / `.d.ts`
- Prisma client under `apps/api/node_modules/.prisma/**`
