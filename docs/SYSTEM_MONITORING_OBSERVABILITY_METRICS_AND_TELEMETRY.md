# System Monitoring & Observability — Metrics & Telemetry (Phase 45b)

**Phase:** 45b  
**Status:** Complete  
**Architecture SSOT:** [`SYSTEM_MONITORING_OBSERVABILITY_ARCHITECTURE.md`](./SYSTEM_MONITORING_OBSERVABILITY_ARCHITECTURE.md)  
**Execution plan:** [`PHASE_45_EXECUTION_PLAN.md`](./PHASE_45_EXECUTION_PLAN.md)  
**Foundation:** [`SYSTEM_MONITORING_OBSERVABILITY_FOUNDATION.md`](./SYSTEM_MONITORING_OBSERVABILITY_FOUNDATION.md)

---

## Implemented scope

- Metric domain model (`counter` | `gauge` | `histogram`)
- Metric registry with validation and built-in descriptors
- In-process metrics pipeline (record / query / diagnostics)
- Label allowlists, normalization, PHI fail-closed rejection
- Cardinality limits per metric
- Observation sampling ratio on descriptors (optional)
- Retention metadata on descriptors
- In-platform metrics store + OpenMetrics-compatible export
- `GET /metrics` scrape surface (flag-gated content)
- RBAC catalog/query/diagnostics under `/observability/metrics/*`
- Contributor helpers: API, queue, hub, DB/cache
- Feature flag + licensing gates

**Not implemented (later phases):** correlation, structured logging pipeline, tracing, live/ready aggregation, dashboards, alerting, Notification intents.

---

## Metric model

| Type | Behavior |
|------|----------|
| `counter` | Monotonic sum of non-negative deltas |
| `gauge` | Last-write value |
| `histogram` | Fixed bucket counts + sum + count |

Each descriptor defines: `name`, `type`, `unit`, `description`, `allowedLabels`, `scope`, `dataClass`, `maxSeries`, `retentionDays`, optional `histogramBounds`, optional `sampleRatio`.

---

## Naming and units

- Names: `^[a-z][a-z0-9_.]{2,127}$` (e.g. `observability.api.requests`)
- Units: `1`, `ms`, `s`, `By`, `{request}`, `{error}`, `{job}`, `{alert}`
- Stable catalog seeded at process start; custom registration allowed if validation passes

---

## Label policy

**Global allowlist:** `tenant_id`, `service`, `component`, `queue`, `method`, `status_class`, `hub`, `outcome`, `error_class`, `dependency`

**Forbidden keys (examples):** `patient_id`, `user_id`, `email`, `url`, `path`, `sql`, `token`, `authorization`, clinical free-text keys

**Value rules:** max 64 chars; pattern `[a-zA-Z0-9_.:@-]`; reject spaces, `/`, `?`, secret-like patterns; `tenant_id` must be slug/UUID-like

Platform/system scope metrics **strip** `tenant_id`.

---

## Tenant attribution

| Scope | Behavior |
|-------|----------|
| `tenant` | May carry `tenant_id`; query defaults to caller tenant |
| `platform` / `system` | No tenant label |

Cross-tenant query requires RBAC `approve` (`cross_tenant`) plus explicit `crossTenant=true`.

---

## PHI restrictions

Fail-closed: invalid/forbidden/sensitive labels → observation rejected (never thrown to business caller). No PHI in names, labels, values, or export text.

---

## Cardinality controls

- Per-descriptor `maxSeries`
- Reject new series when exceeded (`cardinality_exceeded`)
- Internal diagnostic counter `observability.pipeline.rejected` (best-effort)
- No unbounded label keys

---

## Sampling

Descriptor `sampleRatio` (0–1). Default `1`. Sampled-out observations return `sampled_out` without affecting clinical path.

---

## Aggregation

- Counters accumulate
- Gauges overwrite
- Histograms update bucket counts / sum / count
- Query supports optional `sinceMs` window filter on `updatedAt`

---

## Retention metadata

`retentionDays` on descriptors (defaults 7–14). Enforcement of purge jobs is deferred; metadata is available for later ops.

---

## Storage and export

| Port | Adapter | Kind |
|------|---------|------|
| `METRICS_STORE` | `InMemoryMetricsStore` | `in_platform` |
| `METRICS_EXPORT` | `InProcessMetricsExport` | `in_platform` |

- Export path reserved: `/metrics`
- OpenMetrics/Prometheus-compatible text
- No exclusive commercial APM SoR
- Export failures increment diagnostics; never throw to `record()`

---

## Failure behavior

- Record path: catch-all → `MetricRecordResult` reject; **fail-open** for callers
- PHI/labels/cardinality: **fail-closed** (reject observation)
- Flag OFF: `pipeline_inactive` (no-op reject)

---

## Feature flag / licensing / RBAC

| Gate | Rule |
|------|------|
| `SYSTEM_MONITORING_OBSERVABILITY_ENABLED` | Master; default **OFF** |
| `OBSERVABILITY_METRICS_ENABLED` | Must be ON for `isActive()` |
| `allowObservability` | Required for catalog/query/diagnostics |
| `api.observability` `view` | Catalog/query/diagnostics |
| `api.observability` `approve` | Cross-tenant query |

When disabled: health remains ready/dormant; business ops unaffected; scrape returns disabled comment.

---

## Extension points

- `MetricRegistryService.register`
- `ApiMetricsContributor` / `QueueMetricsContributor` / `HubMetricsContributor` / `DatabaseMetricsContributor`
- Replaceable `METRICS_STORE` / `METRICS_EXPORT` ports

---

## Endpoints

| Method | Path | Auth |
|--------|------|------|
| GET | `/observability/health` | Public |
| GET | `/metrics` | Public (content flag-gated) |
| GET | `/observability/metrics/catalog` | JWT + view + license |
| GET | `/observability/metrics/query` | JWT + view + license |
| GET | `/observability/metrics/diagnostics` | JWT + view + license |

---

## Known limitations

- In-memory store only (process-local; multi-node aggregation later)
- No automatic instrumentation of all HTTP routes yet (contributors are opt-in hooks)
- No log/trace/alert pipelines
- Retention purge not scheduled
- Scrape endpoint relies on network policy for hardening

## Deferred

OD-SYNTHETIC, OD-SIEM, OD-APM-VENDOR, OD-BURN, correlation (45c), tracing/health aggregation (45d), dashboards/alerting (45e)

---

## Tests

- `observability-foundation.spec.ts` (updated for 45b health)
- `metrics-and-telemetry.spec.ts`

---

## Operational notes

1. Keep both flags **OFF** in production until acceptance.  
2. Restrict `/metrics` at the edge.  
3. Prefer contributor helpers over ad-hoc label sets.  
4. Do not record raw URLs, SQL, or user/patient identifiers.
