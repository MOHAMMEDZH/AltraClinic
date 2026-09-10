# Wave H Regression Results

**Evidence SHA:** `c64a435`

## Run locally (this H5)

| Gate | Scope | Result |
|------|-------|--------|
| P1 Arabic search (H1) | unit + postgres | **PASS** (4+4) |
| Clinic-dashboard smoke | `tsc -b` + focused vitest | **PASS** (48 tests) |
| Playwright H2/H3/H4 | skip-if-API-down | **SKIPPED** (API unreachable) — not PASS |

## Not run locally (require PR CI — do not fake SUCCESS)

| Gate | Status |
|------|--------|
| Clinic Dashboard CD / e2e matrix (incl. H2–H4 Playwright) | **PENDING PR CI** |
| Platform DB security shell | **PENDING PR CI** |
| Super Admin gates | **PENDING PR CI** |
| Phase 28 / Release 47 onepass | **PENDING PR CI** |

Acceptance criteria hygiene: Wave H must not regress those gates on the accepting SHA; proof of green belongs to GitHub Actions after an authorized PR — **not** asserted here as PASS.

## Wave F / Wave G

Closed at merge base `3b79c0f` (Wave G). **Not reopened.**
