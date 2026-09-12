# K4 — Surface Map (Phase 45 → Phase 49 readiness)

## Architecture / product precursors (reuse)

| Surface | Path / pointer | Phase 49 role |
|---------|----------------|---------------|
| Observability SSOT | `docs/SYSTEM_MONITORING_OBSERVABILITY_ARCHITECTURE.md` | Bound architecture |
| Dashboards & alerting doc | `docs/SYSTEM_MONITORING_OBSERVABILITY_DASHBOARDS_AND_ALERTING.md` | In-repo alert semantics |
| Phase 45 plan / PA | `docs/PHASE_45_EXECUTION_PLAN.md`, `PHASE_45_PRODUCTION_ACCEPTANCE.md` | Prior product PA; flag default OFF |
| Nest module | `apps/api/src/modules/observability/` | Implementation |
| RBAC | `api.observability` | Permission gate |

## HTTP readiness surfaces

| Route | Controller | Readiness meaning |
|-------|------------|-------------------|
| `GET /health/live` | `platform-health.controller.ts` | Process liveness |
| `GET /health/ready` | same | Dependency readiness aggregate |
| `GET /health` | same | Combined health report |
| `GET /observability/health` | `observability-health.controller.ts` | Observability center health + contributors |
| `GET /observability/metrics/*` | metrics controller | Metrics surfaces |
| `GET /observability/logs/*` | logs controller | Log query surfaces |
| `GET /observability/traces/*` | traces controller | Trace surfaces |
| `GET /observability/alerts/*` | alerts controller | In-process alert API |
| `GET /observability/dashboards/*` | dashboards controller | Static/dashboard catalog |

## Health contributors (hub reuse)

| Contributor area | Module pointer |
|------------------|----------------|
| Core observability | `application/observability-health.contributors.ts` |
| Platform aggregator | `application/health/platform-health-aggregator.service.ts` |
| Backup/restore | `backup-restore/.../backup-restore-health.contributors.ts` |
| Patient portal / integrations | respective `*-health.contributors.ts` |

## Step 29 baseline (already wired)

`run-step29-final-onepass.mjs` runs:

```text
tracing-and-health.spec|observability-foundation.spec
```

K4 **adds** a Phase 49 evidence wrapper that also includes `dashboards-and-alerting.spec` **without** amending Release 47 Step 28/29 onepass membership.
