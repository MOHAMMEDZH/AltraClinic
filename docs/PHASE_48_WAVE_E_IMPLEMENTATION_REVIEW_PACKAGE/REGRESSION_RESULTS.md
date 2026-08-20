# Wave E Round 3 — REGRESSION RESULTS

Date: 2026-08-20 (local)

## Prior-wave (exact captures)

| Scope | Suites | Tests | Evidence |
|-------|--------|-------|----------|
| Wave A (`clinical-price.unit`) | 1 | **11 PASS** | `_wave_a_r3.txt` |
| Wave B FULL | **12** | **268 PASS** | `_wave_b_r3.txt` |
| Wave C FULL | **13** | **206 PASS** | `_wave_c_r3.txt` |
| Wave D FULL (incl. pricing path) | **6** | **69 PASS** | `_wave_d_r3.txt` |
| Wave D unit | **2** | **14 PASS** | `_wave_d_unit_r3.txt` |
| Wave D RLS | **1** | **16 PASS** | `_wave_d_rls_r3.txt` |
| packages/permissions | 1 | **6 PASS** | `_permissions_pkg_r3.txt` |
| Wave E permission routes | — | PASS | `_permissions_r3.txt` |

### Wave D 62 → 69 delta

Round 2 Wave D FULL was **6 / 62**. Round 3 is **6 / 69** (+7).

Increase is from authorized R3-B1 PA-04 course-package pricing tests in
`wave-d-pricing-production-path.postgres.integration.spec.ts` (effective interval,
due successor, branch fail-closed, concurrent lock, no-side-effect). No prior Wave D
tests removed or weakened.

## Wave E (Round 3)

| Scope | Suites | Tests | Evidence |
|-------|--------|-------|----------|
| Targeted Round 3 (`wave-e-round3`) | 1 | **19 PASS** | `_wave_e_round3_targeted.txt` |
| Unit | 2 | **22 PASS** | `_wave_e_round3_unit.txt` |
| Postgres (`wave-e-*` + pricing path) | **8** | **153 PASS** | `_wave_e_round3_jest.txt` |
| Clean migration | — | PASS | `_clean_r3.txt` |
| Upgrade Wave D → Wave E | — | PASS | `_upgrade_r3.txt` |

Round 2 baseline was 7/124 postgres; Round 3 is 8/153 (new `wave-e-round3` suite + R3 pricing/HTTP cases).

No Wave F / Phase 49 / Step 30.
