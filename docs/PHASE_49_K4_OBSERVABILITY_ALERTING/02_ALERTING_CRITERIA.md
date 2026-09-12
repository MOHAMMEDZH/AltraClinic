# K4 — Alerting Readiness Criteria

## In-repo (Phase 49 can evidence)

| Capability | Evidence | Status |
|------------|----------|--------|
| Static alert rules catalog | `catalog/static-alert-rules.catalog.ts` | **PASS-local** |
| In-process alert evaluator | `application/alerting/in-process-alert-evaluator.service.ts` | **PASS-local** |
| Dashboards catalog | `catalog/static-dashboard.catalog.ts` | **PASS-local** |
| Unit/integration coverage | `tests/dashboards-and-alerting.spec.ts` | **PASS-local** (via K4 script; not in R47 onepass) |
| Foundation + tracing/health | `observability-foundation.spec.ts`, `tracing-and-health.spec.ts` | **PASS-local** (also Step 29) |
| Feature flags | `SYSTEM_MONITORING_OBSERVABILITY_ENABLED`, `OBSERVABILITY_ALERTING_ENABLED` (default OFF posture) | **PASS-local** / documented |

### Phase 49 readiness bar (in-repo)

```text
Health live/ready/observability health contracts remain covered by existing specs
Alert evaluator + static rules remain covered by dashboards-and-alerting.spec
Named npm script test:phase49-observability-readiness exits 0 on accepting SHA
```

## EXTERNAL / deployment-owned (Step 29 §8.3)

| Capability | Stance |
|------------|--------|
| PagerDuty / Opsgenie / phone on-call routing | **EXTERNAL** — not required in-repo |
| Sentry / Prometheus / Grafana scrape wiring | **EXTERNAL** — not invented in K4 |
| Alert silence / escalation policy tool | **EXTERNAL** (ops); in-repo runbooks may point only |
| Production enablement of Observability Center flag | Cutover/ops decision — document; do not force-enable in K4 |

```text
Phase 49 K4 readiness ≠ “pages a human on-call from this repo.”
Phase 49 K4 readiness = “existing surfaces + specs prove in-process alerting/health contracts.”
```

## Explicit gap (documented, not forced)

| Gap | Decision |
|-----|----------|
| `dashboards-and-alerting.spec` not in Step 28/29 onepass | **Keep out of R47 onepass** in K4; evidence via `test:phase49-observability-readiness` only |
| No prod pager integration | **OUT** — external |
