# Wave G Regression Results

**Evidence SHA:** `22b3b5d`

## Run locally (this G5)

| Gate | Scope | Result |
|------|-------|--------|
| P1 Availability Pack | unit + postgres | **PASS** (5+4) |
| P1 Waitlist Pack | unit + postgres | **PASS** (5+5) |
| P1 Recall Pack | unit + postgres | **PASS** (7+5) |
| Clinic-dashboard scheduling smoke | `tsc -b` + scheduling vitest | **PASS** (20 tests) |

## Not run locally (require PR CI — do not fake SUCCESS)

| Gate | Status |
|------|--------|
| Clinic Dashboard CD / e2e matrix | **PENDING PR CI** |
| Platform DB security shell | **PENDING PR CI** |
| Super Admin gates | **PENDING PR CI** |
| Phase 28 / Release 47 onepass | **PENDING PR CI** |

Acceptance criteria hygiene: Wave G must not regress those gates on the accepting SHA; proof of green belongs to GitHub Actions after an authorized PR — **not** asserted here as PASS.

## Wave F / 3F

Closed at `c202114`. **Not reopened.**
