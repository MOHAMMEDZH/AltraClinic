# Release 45.0 — System Monitoring & Observability Center

**Version:** `v45.0.0` (candidate)  
**Codename:** System Monitoring & Observability Center  
**Acceptance date:** 2026-07-18  
**Status:** **READY FOR RELEASE 45.0** (feature flag **disabled by default**)

Evidence: [`PHASE_45_PRODUCTION_ACCEPTANCE.md`](./PHASE_45_PRODUCTION_ACCEPTANCE.md)  
Architecture SSOT: [`SYSTEM_MONITORING_OBSERVABILITY_ARCHITECTURE.md`](./SYSTEM_MONITORING_OBSERVABILITY_ARCHITECTURE.md) (**APPROVED AND FROZEN**)

---

## Freeze baselines

| Scope | Status |
|-------|--------|
| Release 41.0 Notification Center | **FROZEN** |
| Release 42.0 Import/Export | **FROZEN** |
| Release 43.0 Backup & Restore | **FROZEN** |
| Release 44.0 API Keys & Integrations | **FROZEN** |
| Phase 45 Architecture SSOT | **APPROVED AND FROZEN** |
| Phase 45a–45e implementation | **COMPLETE** |
| Phase 45f | Production Acceptance **PASS** |

Master flag: `SYSTEM_MONITORING_OBSERVABILITY_ENABLED=false` by default.

Sub-flags (all default **false**):

- `OBSERVABILITY_METRICS_ENABLED`
- `OBSERVABILITY_LOGGING_ENABLED`
- `OBSERVABILITY_TRACING_ENABLED`
- `OBSERVABILITY_ALERTING_ENABLED`
- `OBSERVABILITY_TENANT_DASHBOARD_ENABLED`

---

## What shipped (45a–45e)

| Phase | Capability |
|-------|------------|
| 45a | Foundation — module, flags, RBAC `api.observability`, licensing, ports, contributor definitions |
| 45b | Metrics & Telemetry — registry, cardinality, OpenMetrics `/metrics`, contributors |
| 45c | Logging & Correlation — structured logs, ALS, redaction, HTTP/queue propagation |
| 45d | Tracing & Health — OTel-compatible spans, W3C propagation, `/health/live|ready` |
| 45e | Dashboards & Alerting — ops hub APIs, alert engine, Notification intents, Activity/Audit, reports |
| 45f | Production Acceptance |

---

## Breaking changes

None expected for default deployments:

- Master flag **OFF** → Observability pipelines dormant; business behavior unchanged  
- Existing hub Health endpoints remain; platform health deep-links compose contributors  
- No queue name merges; no exclusive APM/SIEM SoR  

---

## Enablement checklist (post-release)

1. Confirm license `allowObservability` for target tenant(s).  
2. Confirm RBAC roles mapping to `api.observability` (view/update/manage/export/approve).  
3. Set `SYSTEM_MONITORING_OBSERVABILITY_ENABLED=true` in a non-prod environment first.  
4. Enable sub-flags incrementally (metrics → logging → tracing → alerting).  
5. Validate `/health/ready`, `/metrics`, `/observability/health`, dashboards, and alert evaluate.  
6. Confirm Notification intent registration and operator deep-links.  
7. Monitor cardinality, sampling, and alert noise before production fan-out.

---

## Rollback

1. Set `SYSTEM_MONITORING_OBSERVABILITY_ENABLED=false` (and/or sub-flags).  
2. Pipelines become dormant; platform `/health/live` remains.  
3. No clinical SoR rollback required — telemetry is secondary (OD-DR).  

---

## Known limitations

- In-process stores/adapters (ports ready for external backends)  
- Notification intents registered; delivery remains Notification Center SoR  
- Settings SPA polish for Observability hub may trail API deep-link contracts  
- Deferred: burn-rate alerts, SIEM, synthetic, RUM, on-call SoR  

---

## Operator references

- [`SYSTEM_MONITORING_OBSERVABILITY_FOUNDATION.md`](./SYSTEM_MONITORING_OBSERVABILITY_FOUNDATION.md)  
- [`SYSTEM_MONITORING_OBSERVABILITY_METRICS_AND_TELEMETRY.md`](./SYSTEM_MONITORING_OBSERVABILITY_METRICS_AND_TELEMETRY.md)  
- [`SYSTEM_MONITORING_OBSERVABILITY_LOGGING_AND_CORRELATION.md`](./SYSTEM_MONITORING_OBSERVABILITY_LOGGING_AND_CORRELATION.md)  
- [`SYSTEM_MONITORING_OBSERVABILITY_TRACING_AND_HEALTH.md`](./SYSTEM_MONITORING_OBSERVABILITY_TRACING_AND_HEALTH.md)  
- [`SYSTEM_MONITORING_OBSERVABILITY_DASHBOARDS_AND_ALERTING.md`](./SYSTEM_MONITORING_OBSERVABILITY_DASHBOARDS_AND_ALERTING.md)  
- [`PHASE_45_PRODUCTION_ACCEPTANCE.md`](./PHASE_45_PRODUCTION_ACCEPTANCE.md)  

---

## Quality gate

**QG-F PASS** — Production Acceptance complete; Release 45.0 package ready with flag default **OFF**.
