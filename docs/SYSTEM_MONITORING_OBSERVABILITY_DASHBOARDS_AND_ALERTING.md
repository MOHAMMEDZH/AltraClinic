# System Monitoring & Observability — Dashboards & Alerting (Phase 45e)

**Phase:** 45e  
**Status:** Complete  
**Architecture SSOT:** [`SYSTEM_MONITORING_OBSERVABILITY_ARCHITECTURE.md`](./SYSTEM_MONITORING_OBSERVABILITY_ARCHITECTURE.md)  
**Execution plan:** [`PHASE_45_EXECUTION_PLAN.md`](./PHASE_45_EXECUTION_PLAN.md)  
**Prior phase guides:** Foundation · Metrics · Logging · Tracing & Health

---

## Implemented scope

- Read-only operational dashboard registry + descriptors + data providers
- Platform and tenant dashboard queries (tenant dashboard gated by sub-flag)
- Alert rule catalog + evaluation engine (threshold + absence)
- Alert lifecycle: fire → notify intent → acknowledge → silence / resolve
- Deduplication / suppression to reduce alert storms
- Notification intent registration (PHI-safe; no delivery SoR)
- Activity cross-link emission for operator-visible alert actions
- Audit references for privileged actions (ack, critical silence)
- Lightweight incident visibility model
- Operational reporting + JSON export contracts
- RBAC (`api.observability`), licensing (`allowObservability`), feature flags

**Not implemented:** commercial APM/SIEM, burn-rate alerts, synthetic/RUM, on-call escalation, Analytics/BI, production acceptance (45f).

---

## Dashboard model

`DashboardDescriptor` + `DashboardSnapshot` (`schemaVersion: '45e'`).

Dashboards are **read-only** aggregations over existing metrics/logs/traces/health/alerts. No custom viz engine; panels are `stat` | `list` | `status` | `series_summary`.

### Catalog

| Id | Scope |
|----|-------|
| `operational_summary` | shared |
| `platform_health` | platform |
| `metrics_overview` | shared |
| `logging_overview` | shared |
| `tracing_overview` | shared |
| `queue_overview` | shared |
| `background_jobs_overview` | shared |
| `database_health` | platform |
| `cache_health` | platform |
| `export_storage_health` | platform |
| `tenant_operational` | tenant (sub-flag) |
| `platform_operational` | platform |

Deep-links include Settings ops hub path `/settings/observability` and hub Health routes (IE/BR/Integrations).

### APIs

- `GET /observability/dashboards` — catalog  
- `GET /observability/dashboards/:id` — snapshot query  

---

## Alert model

Severities: `info` | `warning` | `critical`  
States: `ok` | `pending` | `firing` | `acknowledged` | `silenced` | `resolved`  
Conditions: `threshold` | `absence`

### Lifecycle

1. Evaluate rules against metrics pipeline signals.  
2. On fire: upsert alert, register Notification intent, emit Activity `alert_fired`.  
3. Duplicate open fingerprint → suppress (no re-notify).  
4. Active silence window → suppress.  
5. Ack / silence / resolve via RBAC `update`; privileged actions create Audit references.

### APIs

- `GET /observability/alerts/rules`  
- `POST /observability/alerts/evaluate`  
- `GET /observability/alerts`  
- `GET /observability/alerts/incidents`  
- `POST /observability/alerts/:id/acknowledge|silence|resolve`  

---

## Notification integration

Intent kinds (OD-NOTIFY):

- `observability_alert_info` / `_warning` / `_critical`
- `observability_health_degraded`
- `observability_exporter_failed`

Registrar stores PHI-safe payloads only (title/summary/deepLink/ids). Delivery remains Notification Center SoR.

---

## Activity / Audit integration

- Activity emitter: cross-link ids for `alert_fired`, `alert_acknowledged`, `alert_silenced`, `alert_resolved` (no metric dumps).
- Audit bridge: references for `observability.alert.acknowledged`, `observability.alert.silenced_critical`, etc.

---

## Reporting model

Kinds: `availability_summary`, `error_budget_mvp`, `failing_components`, `queue_pressure`, `alert_volume`.

- `GET /observability/reports`  
- `GET /observability/reports/:kind`  
- `GET /observability/reports/export/:kind` (export permission)

---

## Tenant isolation

Tenant operators see own tenant series/alerts only. Cross-tenant requires `api.observability` **approve**. Tenant dashboard additionally requires `OBSERVABILITY_TENANT_DASHBOARD_ENABLED`.

---

## PHI restrictions

Dashboards/alerts/reports/notifications use operational allowlists only. No patient identifiers, clinical values, secrets, tokens, or raw request bodies.

---

## Feature flag behavior

| Flag | Default | Effect |
|------|---------|--------|
| `SYSTEM_MONITORING_OBSERVABILITY_ENABLED` | OFF | Master gate |
| `OBSERVABILITY_ALERTING_ENABLED` | OFF | Alert evaluation / fan-out |
| `OBSERVABILITY_TENANT_DASHBOARD_ENABLED` | OFF | Tenant dashboard data |

When master OFF: dashboards return dormant snapshots; alerts inactive; business unchanged.

---

## Licensing / RBAC

- License: `allowObservability`
- Resource: `api.observability` — `view` (read), `update` (ack/silence), `manage` (evaluate), `export`, `approve` (cross-tenant)

---

## Extension points

- `DashboardRegistryService.registerDescriptor`
- `InProcessAlertEvaluatorService.registerRule`
- Replaceable `ALERT_STATE_STORE` port

---

## Known limitations

- In-process alert state (shared port ready for multi-node adapters)
- Notification intents registered; producer delivery optional/external
- Ops hub UI is API + deep-link contract (Settings parity path documented)
- No burn-rate / ML anomaly / on-call routing

---

## Deferred capabilities

- Production acceptance / Release 45.0 (45f)
- SIEM, synthetic, RUM, burn-rate (OD-BURN)
- Full Settings SPA polish beyond deep-link contracts

---

## Test coverage

`apps/api/src/modules/observability/tests/dashboards-and-alerting.spec.ts` plus regression suites 45a–45d.

---

## Architecture decisions complied with

OD-BOUNDARY, OD-ALERTS, OD-DASHBOARD, OD-REPORT, OD-INCIDENT, OD-NOTIFY, OD-ACTIVITY, OD-AUDIT, OD-TENANCY, OD-PHI, OD-ACCESS, OD-FLAG, OD-FAILURE, OD-LICENSE, OD-QUEUE-OBS, OD-API-OBS, OD-HUB-OBS, OD-DATA-CLASS, OD-REDACTION, OD-PORTABILITY.

**No Architecture Decision text was modified.**
