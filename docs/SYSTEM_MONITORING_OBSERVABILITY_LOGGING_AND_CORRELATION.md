# System Monitoring & Observability — Logging & Correlation (Phase 45c)

**Phase:** 45c  
**Status:** Complete  
**Architecture SSOT:** [`SYSTEM_MONITORING_OBSERVABILITY_ARCHITECTURE.md`](./SYSTEM_MONITORING_OBSERVABILITY_ARCHITECTURE.md)  
**Execution plan:** [`PHASE_45_EXECUTION_PLAN.md`](./PHASE_45_EXECUTION_PLAN.md)  
**Foundation:** [`SYSTEM_MONITORING_OBSERVABILITY_FOUNDATION.md`](./SYSTEM_MONITORING_OBSERVABILITY_FOUNDATION.md)  
**Metrics:** [`SYSTEM_MONITORING_OBSERVABILITY_METRICS_AND_TELEMETRY.md`](./SYSTEM_MONITORING_OBSERVABILITY_METRICS_AND_TELEMETRY.md)

---

## Implemented scope

- Structured logging domain + stable schema (`schemaVersion: '45c'`)
- Severity and category models
- Correlation ID generation, validation, preservation, rejection of malformed inbound
- AsyncLocalStorage context propagation
- HTTP ingress middleware (`x-correlation-id`)
- Queue / background-job / payload propagation helpers
- Log enrichment (tenant, module, environment, host, process, feature flag)
- PHI/secret fail-closed redaction
- In-platform log store + NDJSON export
- Contributor helpers: API, queue, job, hub
- RBAC query/diagnostics under `/observability/logs/*`

**Not implemented:** distributed tracing, spans, live/ready aggregation, dashboards, alerting.

---

## Logging architecture

`StructuredLoggingPipelineService` writes `StructuredLogEvent` records through redaction into `InMemoryLogStore`, exportable via `InProcessLogsExport` (NDJSON).

Active only when:

- `SYSTEM_MONITORING_OBSERVABILITY_ENABLED=true`
- `OBSERVABILITY_LOGGING_ENABLED=true`

---

## Structured schema

Required fields: `timestamp`, `severity`, `category`, `event`, `correlationId`, `tenantId` (nullable), `module`, `operation`, `source`, `version`, `environment`, `host`, `processId`, `service`, `component`, `scope`, `dataClass`, `message`, `attributes`, `featureFlagEnabled`, `schemaVersion`.

Optional: `causationId`, `branchId`, `error{name,code,message,stackPreview}`.

### Severity

`debug` | `info` | `warn` | `error` | `fatal`

### Category

`api` | `queue` | `job` | `hub` | `security` | `ops` | `system` | `audit_bridge`

---

## Correlation lifecycle

1. At HTTP ingress (when active): read `x-correlation-id` (or `x-request-id`).  
2. If valid → preserve (`inherited=true`).  
3. If missing/malformed → generate UUID (`inherited=false`); malformed counts as rejected inbound.  
4. Set response header `x-correlation-id`.  
5. Enter ALS for the request.  
6. Queue/job helpers continue the same id via payload fields.

**IDs never grant authorization.**

Valid pattern: UUID v4 **or** `[A-Za-z0-9_-]{8,128}`.

---

## Propagation rules

| Boundary | Mechanism |
|----------|-----------|
| HTTP | `CorrelationMiddleware` + ALS |
| Async | `runWithContext` / `runWithContextAsync` |
| Queue | `contextFromPayload` + `withQueueContext` |
| Jobs | `withJobContext` |
| Outbound payload | `attachToPayload` |

---

## Enrichment rules

Automatic: timestamp, environment (`NODE_ENV`), host, pid, version `45c`, correlation from ALS, featureFlagEnabled.

Caller supplies: severity, category, event, message, module, operation, optional tenant/attributes/error.

---

## PHI restrictions / redaction

**Forbidden attribute keys:** patient identifiers, email, body, authorization, cookies, tokens, SQL, clinical fields, etc.

**Allowlisted attributes only:** method, status_class, status_code, queue, hub, outcome, error_class, job_name, duration_ms, attempt, path_template, dependency, flag_name, license_gate.

Fail-closed: unknown/forbidden/sensitive → entire write rejected (business caller gets `{ok:false}`, never throw).

Messages/errors scrub bearer tokens and `bk_`/`bki_` key material.

---

## Tenant attribution

- Platform/system scope forces `tenantId=null`
- Query defaults to caller tenant; cross-tenant requires RBAC `approve` + `crossTenant=true`

---

## Storage and export

| Port | Adapter |
|------|---------|
| `LOG_STORE` | `InMemoryLogStore` (bounded buffer, default 2000) |
| `LOGS_EXPORT` | `InProcessLogsExport` (NDJSON) |

No exclusive logging vendor. Export failures increment diagnostics and return empty string.

---

## Failure behavior

- Logging failures **fail-open** for business (no throw from `write`)
- PHI/access **fail-closed**
- Flag OFF → `pipeline_inactive`

---

## Feature flag / licensing / RBAC

| Gate | Rule |
|------|------|
| Master + `OBSERVABILITY_LOGGING_ENABLED` | Required for active pipeline/middleware ALS |
| `allowObservability` | Log query/diagnostics |
| `api.observability` `view` | Query/diagnostics |
| `api.observability` `approve` | Cross-tenant query |

---

## Endpoints

| Method | Path | Auth |
|--------|------|------|
| GET | `/observability/logs/query` | JWT + view + license |
| GET | `/observability/logs/diagnostics` | JWT + view + license |

---

## Extension points

- `ApiLoggingContributor`, `QueueLoggingContributor`, `JobLoggingContributor`, `HubLoggingContributor`
- Replaceable `LOG_STORE` / `LOGS_EXPORT`
- `CorrelationContextService` for custom boundaries

---

## Known limitations

- In-memory log buffer (process-local)
- Middleware dormant when flags OFF (no global correlation without enablement — per task)
- No automatic Nest Logger replacement for all modules yet
- No trace/span linkage (45d)

## Deferred

Tracing, health aggregation, dashboards, alerting, SIEM, commercial log platforms as SoR

---

## Tests

- `logging-and-correlation.spec.ts`
- Updated `observability-foundation.spec.ts`

---

## Operational notes

1. Keep flags **OFF** until acceptance.  
2. Prefer contributor helpers and allowlisted attributes.  
3. Never log request/response bodies or Authorization headers.
