# System Monitoring & Observability — Tracing & Health (Phase 45d)

**Phase:** 45d  
**Status:** Complete  
**Architecture SSOT:** [`SYSTEM_MONITORING_OBSERVABILITY_ARCHITECTURE.md`](./SYSTEM_MONITORING_OBSERVABILITY_ARCHITECTURE.md)  
**Execution plan:** [`PHASE_45_EXECUTION_PLAN.md`](./PHASE_45_EXECUTION_PLAN.md)  
**Foundation:** [`SYSTEM_MONITORING_OBSERVABILITY_FOUNDATION.md`](./SYSTEM_MONITORING_OBSERVABILITY_FOUNDATION.md)  
**Metrics:** [`SYSTEM_MONITORING_OBSERVABILITY_METRICS_AND_TELEMETRY.md`](./SYSTEM_MONITORING_OBSERVABILITY_METRICS_AND_TELEMETRY.md)  
**Logging:** [`SYSTEM_MONITORING_OBSERVABILITY_LOGGING_AND_CORRELATION.md`](./SYSTEM_MONITORING_OBSERVABILITY_LOGGING_AND_CORRELATION.md)

---

## Implemented scope

- OpenTelemetry-compatible trace context and span models (vendor-neutral)
- Span lifecycle: create, start, end, root/child, parent-child linkage
- Context propagation: ALS, HTTP (`traceparent`), queue, background jobs, async
- Trace validation (trace id / span id / W3C `traceparent`)
- Trace storage + JSON export contracts with in-process adapters
- Head sampling via `OBSERVABILITY_DEFAULT_TRACE_SAMPLE_RATIO`
- Health contributor registry + isolated probe execution
- Platform health aggregation with `healthy` | `degraded` | `dormant` | `unhealthy`
- Official endpoints: `/health/live`, `/health/ready`, `/health`
- PHI-safe attribute allowlist; forbidden clinical/secret keys rejected
- Feature flag, licensing (`allowObservability`), RBAC (`api.observability`)

**Not implemented:** dashboards, alert evaluation, notification intents, incident workflows, synthetic monitoring, RUM, exclusive APM vendor SoR (Phase 45e+).

---

## Trace model

`TraceContext`: `traceId` (32 hex), `spanId` (16 hex), optional `parentSpanId`, `traceFlags`, `correlationId`, `tenantId`, `sampled`.

`SpanRecord`: OTel-shaped record with `name`, `kind`, timings, `status`, allowlisted `attributes`, `schemaVersion: '45d'`.

Identifiers are deterministic hex strings generated via `crypto.randomBytes` and validated with fixed patterns.

---

## Span lifecycle

1. `createSpan` / `startSpan` — build context + record; sample decision; enter ALS when started.  
2. Child spans inherit `traceId` and set `parentSpanId` from active/parent context.  
3. `endSpan` — set end time/status; append to store if sampled.  
4. `runWithSpan` / `runWithSpanAsync` — scoped ALS + automatic end (ok/error).

Failures are **fail-open** for business callers (span may be dropped; work continues). PHI attribute rejection is **fail-closed** for the span (span not created).

---

## Propagation model

| Boundary | Mechanism |
|----------|-----------|
| HTTP | `TracingMiddleware` + W3C `traceparent` response header |
| Async | ALS via `runWithSpan` / `runWithSpanAsync` / `AsyncTracingContributor` |
| Queue | `QueueTracingContributor.withQueueSpan` + payload `traceparent`/`traceId`/`spanId` |
| Jobs | `JobTracingContributor.withJobSpan` |
| Hub | `HubTracingContributor.runHubSpan` |
| Correlation | Span records inherit `correlationId` from Phase 45c ALS when present |

---

## Health contributor model

`PlatformHealthAggregatorService` executes builtin + dynamically registered probes with:

- **Timeout isolation** (500ms) → contributor `unhealthy` with `contributor_timeout`
- **Exception isolation** → contributor `unhealthy`; other contributors still run
- **Dormant ≠ unhealthy** — flag-OFF hubs and pipelines report `dormant` and do not fail readiness unless a **critical** contributor is `unhealthy`

Builtin surfaces include: observability center, feature flags, configuration, licensing, metrics, logging, tracing, correlation, storage, export, hubs (IE/BR/Integrations/Notification), queue, background jobs, database, cache, health aggregation.

---

## Aggregation rules

1. Collect all contributor results.  
2. Summary counts by status.  
3. Overall status:  
   - `unhealthy` if any **critical** contributor is `unhealthy`  
   - else `degraded` if any contributor is `degraded`  
   - else `dormant` when master flag OFF and only dormant/healthy-none pattern applies  
   - else `healthy`  
4. `ready = !criticalUnhealthy`  
5. `live` always true for process liveness probe

---

## Endpoint definitions

| Endpoint | Semantics |
|----------|-----------|
| `GET /health/live` | Process up (liveness). Public. Minimal payload. |
| `GET /health/ready` | Composed readiness + contributors. Public. |
| `GET /health` | Alias of ready semantics (OD-HEALTH). Public. |
| `GET /observability/health` | Center diagnostics (phase 45d pipelines). Public. |
| `GET /observability/traces/query` | Span query (RBAC + license). |
| `GET /observability/traces/diagnostics` | Tracing diagnostics (RBAC + license). |

Operational health endpoints expose status only — no PHI.

---

## Health states

Exactly: `healthy` | `degraded` | `dormant` | `unhealthy`.

---

## Failure behavior

| Concern | Behavior |
|---------|----------|
| Tracing exporter/store errors | Fail-open; business continues |
| Contributor probe errors/timeouts | Isolated; marked unhealthy |
| PHI / forbidden attributes | Fail-closed for that span |
| Authorization / licensing | Fail-closed for diagnostic APIs |

---

## PHI restrictions

Allowlisted span attributes only: `method`, `status_class`, `queue`, `hub`, `outcome`, `error_class`, `job_name`, `dependency`, `http_route_template`, `operation`.

Forbidden keys include patient identifiers, clinical fields, tokens, cookies, passwords, secrets, SQL, raw bodies/headers/URLs.

---

## Feature flag behavior

Active tracing requires:

- `SYSTEM_MONITORING_OBSERVABILITY_ENABLED=true` (default **OFF**)
- `OBSERVABILITY_TRACING_ENABLED=true` (default **OFF**)

When disabled: tracing dormant; no spans stored; business unchanged. Platform `/health/live` remains available. Contributors report `dormant` where defined.

---

## Licensing / RBAC

- Tenant gate: `allowObservability`
- Permission resource: `api.observability` (`view` / `export` / `manage` / `approve` for cross-tenant)
- Trace query/diagnostics require flag + license + RBAC

---

## Extension points

- `PlatformHealthAggregatorService.registerProbe`
- `ObservabilityHealthContributors.registerContributor`
- Replaceable `TRACE_STORE` / `TRACES_EXPORT` ports
- Contributor helpers for API / queue / job / hub / async

---

## Known limitations

- In-process bounded buffer only (no durable remote APM backend)
- Head sampling only (no adaptive/error boost yet)
- Hub contributors reflect hub feature-flag presence, not deep hub redesign probes
- No SQL text or request body capture (by design)

---

## Deferred capabilities

- Dashboards & alert evaluation (45e)
- Notification intents / incident workflows (45e)
- Synthetic monitoring, RUM, burn-rate alerts
- Commercial exclusive APM / SIEM SoR

---

## Test coverage

`apps/api/src/modules/observability/tests/tracing-and-health.spec.ts` plus regression suites for 45a–45c covering:

- Span create/child/propagation (HTTP helpers, queue, job, async)
- Validation, export/store, PHI rejection
- Health states, dormant semantics, timeout/isolation
- Feature flag OFF, RBAC resource checks
- No dashboards/alerting regression

---

## Architecture decisions complied with

OD-BOUNDARY, OD-TRACING, OD-CORRELATION, OD-HEALTH, OD-TENANCY, OD-PHI, OD-REDACTION, OD-DATA-CLASS, OD-ACCESS, OD-FLAG, OD-FAILURE, OD-QUEUE-OBS, OD-API-OBS, OD-HUB-OBS, OD-STORAGE, OD-EXPORT, OD-CONFIG, OD-SECRETS, OD-LICENSE, OD-DEPLOY, OD-PORTABILITY.

**No Architecture Decision text was modified.** Frozen SSOT updated only with implementation-status notes.
