# Wave E Round 3 Remediation Matrix

Status language: PASS = production fix + named test evidence recorded. Not ACCEPTED / FROZEN.

| Blocker | Root cause (Round 2 gap) | Production fix | Test proof | Primary files | Result |
|---------|--------------------------|----------------|------------|---------------|--------|
| R3-B1 PA-04 course/package pricing | Exact bind alone skipped PA-04 lock → reconcile → interval-valid ACTIVE; branch/successor/side-effect gaps | `resolveExactCoursePackagePrice` uses `resolveCurrentKeyOutcome` once; post-lock re-read; exact id must remain current; branch null/wrong fail-closed; no generic substitute | R3-B1-T1..T8 (+ T9 side-effects in T2); `wave-d-pricing-production-path` | `booking-commercial-resolver.service.ts` | PASS |
| R3-B2 Zero-day interval vs timestamp chronology | Calendar-day delta alone could treat same-day later timestamps as invalid when `intervalMinDays=0` | Separated **A)** strict timestamp chronology from **B)** signed UTC calendar-day interval bounds in `assertCourseSessionInterval` | R3-B2-T1..T10; `wave-e-round3`; production-path R3-B2 HTTP | `wave-e-reference.validation.ts` | PASS |
| R3-B3 PRE/POST platform pack visibility | Tenant-only visibility blocked platform pack (`tenantId == null`); precedence / mutation not proven | Visibility = tenant **OR** null; auto-resolve tenant PUBLISHED before platform; no template/version mutation | R3-B3-T1..T12 (+ extras); `wave-e-round3`; production-path T13/T14 | `pre-post-care.service.ts` | PASS |

## Validators / gates (Round 3 captures)

| Gate | Capture | Result |
|------|---------|--------|
| Unit (`wave-e-transitions` + `pricing-unit-applicability`) | `_wave_e_round3_unit.txt` | **2 / 22 PASS** |
| Postgres (`wave-e-*` + pricing production-path, includes round3) | `_wave_e_round3_jest.txt` | **8 / 153 PASS** |
| Permission routes | `_permissions_r3.txt` | PASS |
| Clean migration | `_clean_r3.txt` | PASS |
| Upgrade (Wave D → Wave E + Round 1; no R3 migration) | `_upgrade_r3.txt` | PASS |

## Evidence cross-refs

- `ROUND_3_PA04_COURSE_PRICING_MATRIX.md`
- `ROUND_3_ZERO_DAY_INTERVAL_MATRIX.md`
- `ROUND_3_PRE_POST_PLATFORM_PACK_MATRIX.md`

Conclusion language for this package: **READY FOR EXTERNAL REVIEW** only.
