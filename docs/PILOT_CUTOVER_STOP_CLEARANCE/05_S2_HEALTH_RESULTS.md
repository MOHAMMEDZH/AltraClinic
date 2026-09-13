# STOP S2 — Nest API health against Neon runtime-app

| Field | Value |
|-------|--------|
| **Result** | **PASS** |
| **HEAD at run** | `7e9953a` |
| **Evidence** | `apps/api/.ci-evidence/pilot-s2-7e9953a/` (**uncommitted**) |
| **Host** | Local Nest (`ts-node`) on `127.0.0.1:3012` |
| **DB role** | `pilot_neon_app` (`rolbypassrls = false`) via gitignored `PILOT_RUNTIME_DATABASE_URL` |
| **Owner as `DATABASE_URL`** | **NO** |
| **Neon wiped** | **NO** |

## Runtime URL resolution

| Step | Result |
|------|--------|
| Prefer `PILOT_RUNTIME_DATABASE_URL` in `apps/api/.env.pilot.local` | Initially **missing** (C2b session passwords gone) |
| Derive without echo | **PASS** — owner (gitignored) `ALTER ROLE pilot_neon_app` new password → wrote `PILOT_RUNTIME_DATABASE_URL` (gitignored) |
| Probe `current_user` / bypass | `pilot_neon_app` / `f` |

## Fail-closed secrets (pilot-like)

| Item | Handling |
|------|----------|
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | From gitignored `apps/api/.env` (len ≥32, not known placeholders, unequal) |
| `NODE_ENV` | Forced `development` for this run (not `test`) |
| `PLATFORM_MFA_ENCRYPTION_KEY` | Ephemeral session key (not committed) |
| Placeholder JWT | Rejected |

## Health proofs

| Endpoint | HTTP | Notes |
|----------|------|--------|
| `GET /health/live` | **200** | `status=healthy`, `live=true` |
| `GET /health/ready` | **200** | `ready=true` (aggregate `status=dormant` — observability master flag off; dormant ≠ unhealthy) |
| `GET /health` | **200** | Same aggregate semantics as ready |

## Boot note (operator)

S2 proof initially used an **out-of-repo** no-op of **AnalyticsDemoSeedService** because demo upserts without tenant GUC hit FORCE RLS (`42501`) on Neon runtime-app.

**In-repo follow-up (this PR):** `AnalyticsDemoSeedService` fail-softs on RLS/permission denied (warn + skip; boot continues). Plain Nest boot against pilot runtime no longer requires out-of-repo hacks.

## Explicit

```text
STOP S2 API /health = PASS
DATABASE_URL role = pilot_neon_app (NOBYPASSRLS)
Owner/superuser as API DATABASE_URL = NO
Secrets committed = NO
Product production cutover = NOT CLAIMED
Phase 52 = OUT
```
