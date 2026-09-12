# Phase 49 K5 — Deploy + Rollback SSOT

| Field | Value |
|-------|--------|
| **Slice** | K5 — Unified thin Deploy + Rollback runbooks |
| **Status** | Docs packaging on existing surfaces; **Phase 49 PA = PENDING** |
| **Branch** | `cursor/phase49-production-hardening-kickoff` |
| **Base lineage** | `9eac595` |
| **K4 tip** | `614b733` |
| **K5 tip** | _(set after substantive commit)_ |
| **Authority** | CTO authorize K5 only; K6–K7 **NOT** started |

## Files

| File | Purpose |
|------|---------|
| [01_DEPLOY_RUNBOOK.md](./01_DEPLOY_RUNBOOK.md) | Day-2 operator forward path |
| [02_ROLLBACK_RUNBOOK.md](./02_ROLLBACK_RUNBOOK.md) | Hybrid rollback + authorization |
| [03_SOURCE_INDEX.md](./03_SOURCE_INDEX.md) | Links to Step 29, migrations, runbooks, K3/K4, CI boundary |
| [04_EXPLICIT_OUT.md](./04_EXPLICIT_OUT.md) | Non-goals |
| [05_DRY_RUN_CHECKLIST.md](./05_DRY_RUN_CHECKLIST.md) | Optional doc-only dry-run (**PARTIAL** — no fake prod cutover) |

## Claims

```text
Phase 49 PA = PENDING
Topology (D-17) = EXTERNAL — no in-repo k8s/Docker prod platform
CI = regression / merge readiness — NOT CD
K6–K7 = NOT AUTHORIZED
```
