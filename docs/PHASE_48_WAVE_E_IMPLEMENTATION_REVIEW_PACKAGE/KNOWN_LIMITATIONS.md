# Wave E Known Limitations (Round 3)

## Out of scope (unchanged)

- AR-22 / commission (Wave F) — **not authorized**
- Recall / waitlist (G), RTL (H), dual-read (I)
- Phase 49 / Step 30

## Residual / intentional (honest)

- **`daysBetweenAppointments`** is a deprecated **signed** alias of `signedCalendarDaysBetween` (no `Math.abs`). Chronology + interval enforcement uses signed calendar days plus strict timestamp ordering (R3-B2). Do not treat the alias as a separate production gate.
- **PER_PACKAGE** binds to `TreatmentCourse.packagePriceVersionId` — no separate Package SoR in frozen Wave E docs. Round 3 adds PA-04 lock/reconcile/interval authority on that exact id (`resolveCurrentKeyOutcome`).
- **`deviceId`** is opaque external VARCHAR(120), not an internal device FK / resource authority.
- **Deep medical JSON Schema** for `parameterPayload` is not required by frozen Wave E; type↔`parameterSchemaKey` registry binding is fail-closed.
- **Aesthetic inventory**: no dedicated Wave E consume endpoint; Wave C `InventoryUsageLedger` remains sole ledger (reuse-by-reference).
- **`wave-e-http`** may mock domain services for DTO/RBAC isolation; workflow acceptance proof is `wave-e-production-path` (real services).
- **No Round 2 or Round 3 migration** — schema/RLS/triggers unchanged from Wave E + Round 1; relation/interval/pricing/platform-pack proof is application + test coverage.
- **API build**: Round 3 capture `_api_build_r3.txt` — exit 2, **TS6059 baseline only** (see `BUILD_RESULTS.md`).

## Round closures (historical)

| Round | Closures | Status |
|-------|----------|--------|
| Round 1 | DB/RLS accountability, derm E2E, device context, course interval baseline, pricing context, validators | **CLOSED** (historical) |
| Round 2 | Exact package bind + patient equality; signed bidirectional intervals; deviceId API contract; PRE/POST write authority; DB relation proof; real API+Postgres; derm photo context | **CLOSED** (historical) |
| Round 3 | PA-04 course pricing (`resolveCurrentKeyOutcome`); 0-day interval vs timestamp chronology; PRE/POST platform pack visibility + tenant precedence | **CLOSED** (this package) |

## Process

- Expected HEAD remains frozen Wave D `438b8b3859b3a78548cfde81c8fc14135a51a5ef`
- Uncommitted / unpushed
- Generated `packages/module-registry` + `packages/dashboard-export` artifacts are not Wave E source

Max conclusion for this package: **READY FOR EXTERNAL REVIEW** only — not ACCEPTED / FROZEN / PRODUCTION ACCEPTED.
