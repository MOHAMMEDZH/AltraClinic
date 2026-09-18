# Analytics demo seed — FORCE RLS soft-fail (pilot boot)

| Field | Value |
|-------|--------|
| **Result** | **PASS** (plain Nest boot) |
| **Base / tip verified** | `f373076` (PR #9 merge) + this branch hardening |
| **Evidence** | `apps/api/.ci-evidence/pilot-seed-softfail-f373076/` (**uncommitted**) |
| **DB role** | `pilot_neon_app` (`rolbypassrls = false`) via gitignored `PILOT_RUNTIME_DATABASE_URL` |
| **Out-of-repo seed no-op** | **NOT used** (`ts-node --transpile-only src/main.ts`) |

## Behavior

`AnalyticsDemoSeedService` catches RLS / permission failures (`42501`, row-level security, permission denied), logs **one** warn, and continues boot. Local/test paths where seed can write still seed normally.

## Health proof (this run)

| Endpoint | HTTP |
|----------|------|
| `GET /health/live` | **200** |
| `GET /health/ready` | **200** |

Log excerpt (redacted): `Skipping analytics demo seed (RLS/permission denied under current DB role). Boot continues.`

## Explicit

```text
Owner/superuser as API DATABASE_URL = NO
RLS / BYPASSRLS on runtime = unchanged
Product production cutover = NOT CLAIMED
Real tenant invite = wait for CTO
```
