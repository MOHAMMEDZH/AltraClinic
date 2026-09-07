# Wave E Round 2 Remediation Matrix

Status language: PASS = production fix + named test evidence recorded. Not ACCEPTED / FROZEN.

| Blocker | Root cause (Round 1 gap) | Production fix | Test proof | Primary files | Result |
|---------|--------------------------|----------------|------------|---------------|--------|
| R2-B1 Course pricing patient + exact package binding | Patient equality missing; generic `lookupActivePrice` could diverge from `packagePriceVersionId` | `resolveExactCoursePackagePrice` — patient/service/status/lifecycle + exact PV bind; skips generic lookup for PER_COURSE/PER_PACKAGE | R2-B1-T1..T6 (+ T7 side-effects in T1); `wave-d-pricing-production-path` | `booking-commercial-resolver.service.ts` | PASS |
| R2-B2 Interval chronology + bidirectional neighbors | `Math.abs` distance hid reverse chronology; only prior-neighbor | `signedCalendarDaysBetween` + prior **and** next neighbor checks in `assertCourseSessionInterval` / reschedule | R2-B2-T1..T10; unit signed days; `wave-e-round2` | `wave-e-reference.validation.ts` | PASS |
| R2-B3 deviceId API contract | DTO/HTTP vs opaque VARCHAR(120) | DTO `@MaxLength(120)` + trim; `assertOpaqueExternalDeviceId`; no UUID requirement | R2-B3-T1..T4 `wave-e-http`; R2-B6-C production-path | `wave-e.dto.ts`; `device-treatment-record.service.ts` | PASS |
| R2-B4 PRE/POST write authority | Risk of creating templates/versions in patient path | `createInstance` binds existing PUBLISHED version only; zero template/version create | R2-B4-T1..T10 `wave-e-round2`; R2-B6-E production-path | `pre-post-care.service.ts` | PASS |
| R2-B5 DB mixed-parent / parent-switch proof | Overclaimed coverage without relation-by-relation tests | Explicit mixed-parent INSERT + parent-switch UPDATE cases in RLS suite | `wave-e-rls` relation tests; see `ROUND_2_DB_RELATION_TEST_MATRIX.md` | `wave-e-rls.postgres.integration.spec.ts`; triggers | PASS |
| R2-B6 Real API + PostgreSQL paths | Service-direct / mocked HTTP insufficient | Real Nest controller + real services + Postgres | R2-B6-A..E `wave-e-production-path` | `wave-e-production-path.postgres.integration.spec.ts` | PASS |
| Derm photo context | `attachDermatologyPhoto` accepted any same-tenant Encounter | Dermatology-valid encounter required via category marker + MediaAsset tenant | R2-DERM-T1..T4 `wave-e-round2`; R2-B6-D production-path | `dermatology-encounter.service.ts` | PASS |

## Validators / gates (Round 2 captures)

| Gate | Capture | Result |
|------|---------|--------|
| Unit (`wave-e-transitions` + `pricing-unit-applicability`) | `_wave_e_round2_unit.txt` | **2 / 22 PASS** |
| Postgres (`wave-e-*` + pricing production-path) | `_wave_e_round2_jest.txt` | **7 / 124 PASS** |
| Permission routes | `_permissions_r2.txt` | PASS |
| Clean migration | `_clean_r2.txt` | PASS |
| Upgrade (Wave D → Wave E + Round 1; no R2 migration) | `_upgrade_r2.txt` | PASS |

Conclusion language for this package: **READY FOR EXTERNAL REVIEW** only.
