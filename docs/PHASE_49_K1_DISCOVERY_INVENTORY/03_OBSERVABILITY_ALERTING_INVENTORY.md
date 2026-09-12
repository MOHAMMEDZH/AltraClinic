# K1 — Observability / Alerting Inventory

**Lineage:** `9eac595+` · **Owner (on-call primary):** Platform Security on-call (`docs/RELEASE_47_STEP29_RELEASE_READINESS.md` §8.3)  
**Phase 49 claim:** none (inventory only)

---

## Surfaces found

| Item | Paths / evidence | Status |
|------|------------------|--------|
| Observability architecture SSOT | `docs/SYSTEM_MONITORING_OBSERVABILITY_ARCHITECTURE.md` (Phase 45; APPROVED/FROZEN) | **PASS-local** |
| Phase 45 execution plan | `docs/PHASE_45_EXECUTION_PLAN.md` | **PASS-local** |
| API module | `apps/api/src/modules/observability/` (health controller, dashboards, metrics, logging/correlation tests) | **PASS-local** |
| RBAC resource | `api.observability` (permission matrices; Wave I / Step 29 restored) | **PASS-local** |
| Health / ready surfaces | `/health`, `/health/live`, `/health/ready`, `/observability/health`; hub contributors (backup-restore, import-export, integrations, patient-portal, ops) | **PASS-local** |
| Alerting tests (in-module) | `apps/api/src/modules/observability/tests/dashboards-and-alerting.spec.ts` | **PARTIAL** (exists; **not** in Step 28/29 / regression-baselines onepass) |
| Foundation / tracing-health in Step 29 | `observability-foundation.spec.ts`, `tracing-and-health.spec.ts` (via Step 29 / regression-baselines) | **PASS-local** |
| In-process alert evaluator + static rules | `application/alerting/in-process-alert-evaluator.service.ts`, `catalog/static-alert-rules.catalog.ts` | **PASS-local** (product; not prod paging) |
| Health routes | `/health`, `/health/live`, `/health/ready` (`platform-health.controller.ts`); `/observability/health` (+ metrics/logs/traces/alerts/dashboards) | **PASS-local** |
| Phase 45 PA / docs set | `PHASE_45_PRODUCTION_ACCEPTANCE.md`, `SYSTEM_MONITORING_OBSERVABILITY_*.md` | **PASS-local** (Phase 45; flag default OFF) |
| Step 29 alerts / on-call | Readiness doc: alerts/on-call = **external/deployment-owned**; no Sentry/Prometheus/on-call wiring in repo | **PARTIAL** |
| Ops console health | Platform operations health aggregator reuse | **PARTIAL** |
| Phase 49 alerting readiness runbook / exit evidence | — | **MISSING** |
| Commercial APM / SIEM | Explicitly OUT of Phase 49 | N/A (OUT) |

---

## Evidence pointers

```text
docs/SYSTEM_MONITORING_OBSERVABILITY_ARCHITECTURE.md
docs/SYSTEM_MONITORING_OBSERVABILITY_DASHBOARDS_AND_ALERTING.md
docs/PHASE_45_EXECUTION_PLAN.md
docs/PHASE_45_PRODUCTION_ACCEPTANCE.md
docs/RELEASE_47_STEP29_RELEASE_READINESS.md (§8.3 Monitoring)
apps/api/src/modules/observability/
apps/api/src/modules/observability/controllers/platform-health.controller.ts
apps/api/src/modules/observability/controllers/observability-health.controller.ts
apps/api/src/modules/observability/tests/*.spec.ts
```

---

## Gaps (for K4)

1. In-repo observability ≠ production alert route to on-call (Step 29: external).
2. No Phase 49 “alerting readiness” checklist (which SLIs, who pages, silence policy) bound to accepting SHA.
3. `dashboards-and-alerting.spec.ts` not wired into regression onepass — decide include vs document deferral.
4. Risk of inventing parallel APM — must reuse Phase 45 + health contributors only.
5. Flag/default-off posture for Observability Center needs explicit production-enablement note (not product redesign).
