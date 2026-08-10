# System Monitoring & Observability Center — Developer Foundation Guide (Phase 45a)

**Phase:** 45a  
**Status:** Foundation complete  
**Architecture SSOT:** [`SYSTEM_MONITORING_OBSERVABILITY_ARCHITECTURE.md`](./SYSTEM_MONITORING_OBSERVABILITY_ARCHITECTURE.md)  
**Execution plan:** [`PHASE_45_EXECUTION_PLAN.md`](./PHASE_45_EXECUTION_PLAN.md)  
**Discovery:** [`PHASE_45_ARCHITECTURE_DISCOVERY_AND_READINESS.md`](./PHASE_45_ARCHITECTURE_DISCOVERY_AND_READINESS.md)  
**Review / freeze:** [`PHASE_45_ARCHITECTURE_REVIEW_AND_APPROVAL.md`](./PHASE_45_ARCHITECTURE_REVIEW_AND_APPROVAL.md)

This document describes the **developer-facing** Monitoring Foundation. Metrics (45b), logging/correlation (45c), tracing/health (45d), and dashboards/alerting (45e) are documented separately when implemented.

---

## Module structure

```
apps/api/src/modules/observability/
  observability.module.ts
  observability.constants.ts
  config/observability-config.ts
  controllers/observability-health.controller.ts
  catalog/static-observability.catalog.ts
  domain/observability-registration.contracts.ts
  application/
    *-contracts.ts
    observability-extension.registry.ts
    observability-health.contributors.ts
    effective-observability-view.service.ts
    observability-lifecycle.service.ts
    null-observability.services.ts
    ports/repositories.ts
    ports/services.ts
    ports/storage.port.ts
    ports/export.port.ts
  infrastructure/null/
  tests/observability-foundation.spec.ts
```

Registered in `AppModule` as `ObservabilityModule`.

---

## Configuration

| Env | Default | Role |
|-----|---------|------|
| `SYSTEM_MONITORING_OBSERVABILITY_ENABLED` | `false` | Master flag (OD-FLAG) |
| `OBSERVABILITY_METRICS_ENABLED` | `false` | Sub-flag (45b) |
| `OBSERVABILITY_TRACING_ENABLED` | `false` | Sub-flag (45d) |
| `OBSERVABILITY_ALERTING_ENABLED` | `false` | Sub-flag (45e) |
| `OBSERVABILITY_TENANT_DASHBOARD_ENABLED` | `false` | Sub-flag (conditional OD-TENANT-STATUS) |

Defaults (placeholders only): metrics/logs retention 14d, traces 7d, sample ratio 0.1, storage/export `unconfigured`.

---

## Permissions

Resource: `api.observability`

| Architecture action | Matrix action | Use |
|---------------------|---------------|-----|
| `read` | `view` | Health, catalogs, later dashboards |
| `acknowledge` | `update` | Ack/silence alerts (45e) |
| `export` | `export` | Telemetry export |
| `manage` | `manage` | Rules/config |
| `cross_tenant` | `approve` | Elevated cross-tenant ops |

---

## Licensing

Tenant gate: `allowObservability` (default **false** / false-closed).

Capabilities registered: `observabilityCenter`, `metricsPipeline`, `tracingPipeline`, `alerting`, `tenantStatus`, `crossTenantOps`.

---

## EffectiveObservabilityView

When the master flag is OFF: `visible=false`, empty `types`, `executableCount=0`.

Static signal-domain catalog is **never** runtime authority.

---

## Health

`GET /observability/health` (public readiness probe):

- `featureFlag`, sub-`flags`
- Pipelines all `wired: false` (metrics, correlation, tracing, healthAggregation, alerting, redaction)
- Storage/export ports `null` / reserved `/metrics` unwired
- Health contributor **definitions** (`dormant` when flag OFF)
- `phase: '45a'`

This is **not** the platform `/health/live` / `/health/ready` product (45d).

---

## Health contributor framework

`ObservabilityHealthContributors`:

- Lists OD-HEALTH contributor id definitions
- Accepts `registerContributor(source, id)` for later live probes
- Does **not** evaluate readiness/liveness in 45a

---

## Storage / export abstractions

Ports (null adapters in 45a):

- `METRICS_STORE`, `LOG_STORE`, `TRACE_STORE`, `ALERT_STATE_STORE`
- `METRICS_EXPORT` (`reservedPath: '/metrics'`)

Service markers (null): metrics pipeline, correlation, tracing, health aggregator, alert evaluator, redaction.

---

## Contracts only (no emit / send / collect / evaluate)

- Activity event names
- Audit action names
- Notification intent kinds
- Telemetry metric names + structured log fields + data classes + `correlationId` field
- Null service holders (`contractVersion: '45a'`)
- Null repositories (empty reads)

---

## Explicitly not in 45a

Metrics collection/aggregation/cardinality/sampling, structured logging pipeline, correlation middleware, distributed tracing, live/ready aggregation, dashboards, alert engine, Notification delivery, OpenTelemetry exporters, synthetic/SIEM/RUM, commercial APM.

---

## Next

**Phase 45c — Logging & Correlation** — see [`SYSTEM_MONITORING_OBSERVABILITY_LOGGING_AND_CORRELATION.md`](./SYSTEM_MONITORING_OBSERVABILITY_LOGGING_AND_CORRELATION.md).  
**Phase 45d — Tracing & Health** is next per execution plan.  
Master flag remains default **OFF**.
