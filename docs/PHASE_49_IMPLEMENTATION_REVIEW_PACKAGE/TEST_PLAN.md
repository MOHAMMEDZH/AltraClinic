# Phase 49 — Test Plan

Working directory for npm scripts: `apps/api` unless noted.

| Gate | Command | Notes |
|------|---------|--------|
| K2 JWT unit | existing Jest for `jwt-secrets` / auth config | Local; see K2 evidence |
| K2 secrets scan (reuse) | `npm run test:step28-secrets-scan` (+ dep audit as needed) | Not a new required GH check |
| K3 restore drill | `apps/api/scripts/phase49-k3-restore-drill.ps1` (or container helper) | Ops `pg_dump` SoR; evidence uncommitted |
| K4 observability | `npm run test:phase49-observability-readiness` | Existing foundation/tracing/dashboards specs |
| K5 dry-run | Doc walkthrough only | **PARTIAL** without real prod cutover |
| K6 tenant isolation | `npm run test:phase49-tenant-isolation-check` | Requires test Postgres `:5433`; fail closed if missing |
| Platform DB (primary inside K6) | `npm run test:platform-db-security` | Path-filtered CI — force `workflow_dispatch` or local evidence |
| Step 28 / 29 baselines | `npm run test:step28-security-final-onepass` / `test:step29-release-final-onepass` | Heavy; regression stance — not re-run required for every K slice |
| Wave I onepass | `npm run test:phase48-onepass` | Optional/heavy; pointer only for Phase 49 |

## Evidence layout (uncommitted)

```text
apps/api/.ci-evidence/phase49-k2-<shortsha>/
apps/api/.ci-evidence/phase49-k3-<shortsha>/
apps/api/.ci-evidence/phase49-k4-220a931/
apps/api/.ci-evidence/phase49-k6-8bfa7c6/
```
