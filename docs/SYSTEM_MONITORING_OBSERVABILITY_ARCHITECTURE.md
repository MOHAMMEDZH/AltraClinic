# Phase 45 — System Monitoring & Observability Architecture

**Phase:** 45 (Architecture — **APPROVED AND FROZEN**)  
**Status:** **APPROVED AND FROZEN** · **2026-07-18**  
**Capability:** System Monitoring & Observability (Observability Center)  
**Master feature flag:** `SYSTEM_MONITORING_OBSERVABILITY_ENABLED` — **default OFF**  
**License gate:** `allowObservability` (or equivalent Licensing key frozen at implementation mapping time without changing semantics)  
**RBAC resource:** `api.observability`  
**Prerequisite:** Release **43.0** Backup & Restore **PRODUCTION ACCEPTED**; Release **44.0** API Keys & Integrations **PRODUCTION ACCEPTED**; Dynamic Platform Phases **28–36**, **38–44** frozen as applicable; Phase **37** remains reserved  
**Authoring panel:** CTO · Principal Enterprise SaaS · Healthcare ERP · Platform · Backend · Frontend · Security · Compliance · DevOps · SRE  
**SSOT for:** Observability Center — operational telemetry policy, metrics/logs/traces contracts, correlation, health aggregation, alerting, operator Observability UX, PHI-safe multi-tenant ops governance  
**Discovery:** [`PHASE_45_ARCHITECTURE_DISCOVERY_AND_READINESS.md`](./PHASE_45_ARCHITECTURE_DISCOVERY_AND_READINESS.md)  
**Approval record:** [`PHASE_45_ARCHITECTURE_REVIEW_AND_APPROVAL.md`](./PHASE_45_ARCHITECTURE_REVIEW_AND_APPROVAL.md)  
**Strategy companion (non-SSOT):** [`OBSERVABILITY.md`](./OBSERVABILITY.md) — principles only; stack products not frozen here  

**Numbering note:** Dynamic Platform Phase **45** is permanently assigned to System Monitoring & Observability. Product taxonomy entries such as “System Monitoring & Alerts” in `FEATURE_INVENTORY.md` do **not** override this numbering. Phase **37** remains reserved.

**Authority note:** This document is the **frozen** architectural Single Source of Truth (SSOT) for Phase 45. After publication, all implementation **must** follow this document. Future architectural changes require **new Architecture Decisions** (revision + re-approval), not silent edits to frozen critical decisions. Do **not** redesign Phases 1–44. Do **not** modify Notification Delivery, Import/Export, Backup & Restore, or API Keys & Integrations engines or their frozen queues.

**Companion frozen SSOTs (consume, do not redesign):**  
[`NOTIFICATION_CENTER_ARCHITECTURE.md`](./NOTIFICATION_CENTER_ARCHITECTURE.md) · [`IMPORT_EXPORT_CENTER_ARCHITECTURE.md`](./IMPORT_EXPORT_CENTER_ARCHITECTURE.md) · [`BACKUP_RESTORE_CENTER_ARCHITECTURE.md`](./BACKUP_RESTORE_CENTER_ARCHITECTURE.md) · [`API_KEYS_INTEGRATIONS_ARCHITECTURE.md`](./API_KEYS_INTEGRATIONS_ARCHITECTURE.md) · [`DYNAMIC_ACTIVITY_CENTER_ARCHITECTURE.md`](./DYNAMIC_ACTIVITY_CENTER_ARCHITECTURE.md) · [`DYNAMIC_AUDIT_CENTER_ARCHITECTURE.md`](./DYNAMIC_AUDIT_CENTER_ARCHITECTURE.md) · [`LICENSING_ARCHITECTURE.md`](./LICENSING_ARCHITECTURE.md) · [`DYNAMIC_MODULE_MANAGEMENT_ARCHITECTURE.md`](./DYNAMIC_MODULE_MANAGEMENT_ARCHITECTURE.md) · [`BACKGROUND-ARCHITECTURE.md`](./BACKGROUND-ARCHITECTURE.md) · [`REDIS-ARCHITECTURE.md`](./REDIS-ARCHITECTURE.md)

**Implementation status:** Phases **45a–45f** complete. Production Acceptance **PASS** ([`PHASE_45_PRODUCTION_ACCEPTANCE.md`](./PHASE_45_PRODUCTION_ACCEPTANCE.md)). Release **45.0** ready with master flag default **OFF** ([`RELEASE_45_0.md`](./RELEASE_45_0.md)). Controlled enablement only after acceptance.

---

## 1. Executive Summary

The **Observability Center** is the Healthcare ERP’s **operational telemetry System of Record**: the licensed, RBAC-gated, tenant-aware platform capability that defines how the system is **measured, correlated, health-checked, alerted, and investigated** in production.

It unifies fragmented foundations already present across Releases 41–44 (per-hub health probes, Redis/in-process queue metrics, PHI-safe structured logs with `correlationId`, Activity/Audit observational emitters, Settings Health pages) into a coherent Observability platform — **without** becoming Activity Center, Audit Center, Analytics, SIEM, or a commercial APM product.

**Core guarantees (frozen):**

1. Telemetry is **OpenTelemetry-compatible** and **vendor-neutral** (ports for storage/export).  
2. **Clinical/business transactions fail-open** if telemetry exporters or stores fail.  
3. **PHI protection fails closed** (allowlist + scrub; never emit forbidden fields).  
4. **Tenant isolation** is mandatory for attributable signals and operator access.  
5. **Correlation IDs** are mandatory at ingress and propagated across HTTP, queues, and workers.  
6. **Structured logging** is mandatory for Observability-instrumented components.  
7. Health contributors report **`healthy` | `degraded` | `dormant` | `unhealthy`** as defined herein.  
8. Master flag defaults **OFF**; enabling Observability does **not** enable IE/BR/Integrations flags.

---

## 2. Scope

### 2.1 In scope (architecture + future authorized implementation)

1. Observability Center bounded context, contracts, and operator UX hub.  
2. Telemetry standard (metrics, logs, traces) — OpenTelemetry-compatible.  
3. Ingress correlation and causation model; context propagation.  
4. PHI-safe scrubbing / redaction / data classification.  
5. Cardinality, sampling, retention, and volume controls.  
6. Platform health model (`live` / `ready`) composing hub contributors.  
7. MVP SLI/SLO set and alerting (severity, fire, acknowledge, silence/resolve).  
8. Notification Center **intent** integration for alert delivery.  
9. Activity Center cross-link; Audit Center for privileged Observability actions.  
10. Feature flag + Licensing + RBAC gates.  
11. Queue, API, authn/authz, hub (IE/BR/Integrations/Notification), DB/cache signal packs (consume, do not redesign hubs).  
12. Storage and export abstractions (`/metrics` scrape/export port).  
13. Unified Observability ops hub (Settings pattern parity); deep-links from existing hub Health pages.  
14. Operational reporting of availability / error budgets (MVP) — not Analytics SoR.  
15. Lightweight incident lifecycle (detect → triage → ack → silence/resolve).  
16. Configuration ownership for sampling, retention knobs, alert rules, dashboards, contributor registration.  
17. Failure, backpressure, scalability, and deployment constraints as defined herein.

### 2.2 Explicitly included signal domains

Infrastructure (resource visibility requirements), application, API, integrations/webhooks, background jobs/queues, database/cache (saturation only), authentication/authorization, feature flags/licensing denials, scheduler success/miss where schedulers exist, storage health signals, backup/IE/notification hub signals, errors/exceptions, performance/availability/capacity, dependencies, correlation, health/readiness/liveness, MVP SLIs, alerting, dashboards, ops reporting, investigation aids via correlation.

---

## 3. Out of Scope

- Redesign of Phases 1–44 engines, queues, or frozen SSOTs.  
- Becoming Activity Center, Audit Center, Analytics, Reporting, or Workflow monitoring SoR.  
- Full SIEM / SOC / UEBA / threat-intel platform.  
- Exclusive commercial APM product as System of Record.  
- External paging/on-call platform as SoR (Notification intents cover in-product).  
- Synthetic journey monitoring (deferred).  
- Full frontend RUM / session replay (deferred).  
- Multi-window SLO burn-rate alerting (deferred).  
- Fine-grained branch-level metric series cardinality (deferred).  
- Dedicated telemetry-lake disaster-recovery pillar (deferred).  
- Workforce productivity / staff surveillance dashboards.  
- Automatic enablement of `SYSTEM_MONITORING_OBSERVABILITY_ENABLED` (or IE/BR/Integrations flags) in production.  
- Merging Notification / IE / BR / Integrations queues for “easier metrics.”  
- Storing PHI, secrets, raw API keys, or clinical request/response bodies in telemetry.  
- Implementation code, concrete HTTP API catalogs, database schemas, migrations, UI modules, tests, execution phase plans, or implementation prompts **in this document**.

---

## 4. Goals

### 4.1 Business goals

- Detect and resolve production issues before clinical operations are disrupted.  
- Provide safe operational transparency for multi-clinic SaaS.  
- Reduce MTTD/MTTR via correlated signals.  
- Support governed enablement of flag-gated Centers with observability parity.

### 4.2 Technical goals

- Single coherent operational picture of platform health.  
- End-to-end correlation across API → domain → queue → integration.  
- Extensible contributor model for new Centers without redesigning Observability.  
- Portable instrumentation (OpenTelemetry-compatible) with pluggable backends.

### 4.3 Healthcare / compliance goals

- PHI-safe telemetry by design.  
- Clear separation of diagnostic telemetry vs legal Audit evidence.  
- Tenant isolation of telemetry access and attributable signals.  
- Privileged Observability actions are auditable.

### 4.4 Operational goals

- Actionable alerts with fatigue controls.  
- Unified ops hub with deep-links to existing hub Health pages.  
- Flag-aware health (`dormant` ≠ `down`).  
- Clinical availability preserved during Observability outages.

---

## 5. Non-Goals

| Non-goal | Owner / note |
|----------|----------------|
| Legal/compliance evidence SoR | Audit Center |
| User/system activity timeline SoR | Activity Center |
| Business KPI / clinical analytics SoR | Analytics / Reporting |
| Business workflow execution monitoring product | Workflow UI / engine |
| Notification delivery engine / queue ownership | Phase 41 |
| Import/Export / Backup / Integrations engine ownership | Phases 42–44 |
| Full SIEM/SOC | Deferred (OD-SIEM) |
| Exclusive commercial APM SoR | Deferred / rejected as SoR (OD-APM-VENDOR) |
| Synthetic monitoring product | Deferred (OD-SYNTHETIC) |
| Staff productivity surveillance | Rejected |

---

## 6. Existing Platform Context

| Layer | Current foundation (consume) |
|-------|------------------------------|
| Hub health | Public readiness for IE, BR, Integrations; AI/module registry health; Notification adapter `.health()` |
| Metrics | Redis `QueueMetricsService`; in-process BR/Integrations counters; metric name catalogs |
| Logs | Nest structured objects with `kind`, `component`, `event`, `tenantId`, `correlationId` |
| Correlation | Job/engine-level `correlationId`; **no** global ingress middleware yet — Phase 45 owns this gap |
| Tracing namespaces | Reserved strings in hubs; no distributed tracing product in deps |
| Activity / Audit | Observational emitters; Audit excludes APM |
| Ops UI | Per-hub Settings Health/Metrics; no unified Observability hub yet |
| Rate limiter | `/health` and `/metrics` paths skipped — reserved for platform probes/export |
| Strategy | `OBSERVABILITY.md` aspirational; **this SSOT supersedes** it for Phase 45 decisions |

---

## 7. System Context

```
                    ┌─────────────────────────────────────┐
                    │     Operators / Platform SRE         │
                    │  (RBAC api.observability + license)  │
                    └─────────────────┬───────────────────┘
                                      │
                    ┌─────────────────▼───────────────────┐
                    │       Observability Center           │
                    │  contracts · aggregation · alerts    │
                    │  dashboards · scrub · correlation    │
                    └───┬─────────┬──────────┬────────────┘
                        │         │          │
           ┌────────────▼──┐  ┌───▼────┐  ┌─▼──────────────┐
           │ Signal sources │  │ Ports │  │ Integrations   │
           │ API / queues / │  │Store  │  │ Notification   │
           │ hubs / auth /  │  │Export │  │ Activity refs  │
           │ DB pools / …   │  │       │  │ Audit events   │
           └────────────────┘  └───────┘  └────────────────┘

Clinical SoR ──(fail-open)──► continue even if Observability ports fail
```

Observability **observes** domain and hub engines; it does **not** own their SoR data or queues.

---

## 8. Architecture Principles

1. **Observability Center is the operational telemetry System of Record.**  
2. Observability is **NOT** Activity Center, Audit Center, Analytics, SIEM, or commercial APM.  
3. Telemetry must be **vendor-neutral** and **OpenTelemetry-compatible**.  
4. Clinical workflows **fail-open** if telemetry is unavailable.  
5. PHI protection **fails closed**.  
6. Telemetry must **never** be a hard dependency for business transactions.  
7. **Tenant isolation** is mandatory.  
8. **Correlation IDs** are mandatory at ingress.  
9. **Structured logging** is mandatory for instrumented components.  
10. Health contributors report **`healthy` | `degraded` | `dormant` | `unhealthy`**.  
11. Flag-gated Centers that are OFF report **`dormant`**, not **`unhealthy`**.  
12. Prefer **contracts and contributors** over one-off probes.  
13. **Cardinality and cost control** are first-class design drivers.  
14. Do not redesign frozen Phases 41–44.  
15. Changes to frozen ODs require architecture revision + re-approval.

---

## 9. Component Boundaries

| Component | Responsibility | Boundary |
|-----------|----------------|----------|
| **Observability Center** | Policy, contracts, aggregation, alerts, ops UX, scrub, correlation ownership | SoR for operational telemetry policy |
| **Ingress correlation** | Generate/validate/propagate correlation & trace context | Owned by Observability |
| **Hub engines (41–44)** | Authoritative engine health & domain metrics | Contributors only |
| **Activity Center** | User/system activity timeline | Cross-link; not infra SoR |
| **Audit Center** | Legal/compliance evidence | Privileged ops audits only |
| **Notification Center** | Alert delivery | Intents in; delivery SoR remains Notification |
| **Analytics** | Business KPIs | No ownership transfer |
| **Storage/Export ports** | Pluggable backends | No exclusive vendor SoR |

---

## 10. Responsibility Matrix

| Concern | Observability | Hub Centers | Activity | Audit | Notification |
|---------|---------------|-------------|----------|-------|--------------|
| Metric name catalogs | Own platform + registry | Contribute hub catalogs | — | — | Contribute delivery |
| Engine correctness | Observe | **Own** | — | — | — |
| Correlation at ingress | **Own** | Propagate | Consume id | Consume id | Propagate |
| Alert rules | **Own** | — | — | Audit changes | Deliver |
| Legal evidence | — | — | — | **Own** | — |
| Activity timeline | Optional emit | Emit domain | **Own** | — | — |
| PHI in payloads | Forbid/scrub | Forbid | Policy | Policy | Forbid in alerts |

---

## 11. Data Ownership

| Data class | Owner | Notes |
|------------|-------|-------|
| Metrics / logs / traces streams | Observability | Diagnostic; best-effort durability |
| Alert rules, silence, acknowledgements | Observability | Durable application config/state |
| Health aggregation view | Observability | Composed from contributors |
| Hub engine state / jobs | Respective Centers | Observability does not become SoR |
| Activity projections | Activity Center | |
| Audit evidence | Audit Center | |
| Notification deliveries | Notification Center | |
| Clinical records | Domain modules | Never copied into telemetry |

---

## 12. Telemetry Model

Telemetry consists of **signals** with **context**:

| Signal kind | Purpose |
|-------------|---------|
| Metrics | Quantitative SLIs, saturation, rates |
| Logs | Structured discrete events |
| Traces | Causal distributed latency / dependency |
| Errors | Exception grouping (PHI-safe) |
| Health | live/ready + contributor status |
| Alerts | Derived actionable conditions |

**Context fields (when applicable):** `tenantId`, `branchId?`, `correlationId`, `causationId?`, `traceId?`, `spanId?`, `service`, `environment`, `release?`, `component`, `flagState?`.

**Standard:** OpenTelemetry-compatible semantics and context propagation (**OD-TELEMETRY**).

---

## 13. Metrics Model

- Semantic catalogs: name, type (counter/gauge/histogram), unit, description, **allowlisted label keys**.  
- Hubs register contributors; Observability owns platform catalog + aggregation.  
- **Forbidden labels:** unbounded `userId`, raw URLs, exception messages, patient identifiers, free text.  
- Per-tenant series are **tiered** (coarse for all; fine for selected tenants under budget) — **OD-CARDINALITY**.  
- Reuse existing Redis queue metrics and hub counters as inputs — do not discard without migration plan in execution (out of this SSOT).

**MVP SLIs (OD-SLO):**

1. API availability (success ratio)  
2. API latency (e.g. p95)  
3. Dependency / platform readiness  
4. Queue saturation (per frozen queue)  
5. Critical hub job failure rate  

Environment-specific numeric targets are parameters set at implementation mapping time without changing SLI definitions.

---

## 14. Logging Model

Mandatory structured JSON fields for Observability-instrumented components:

`timestamp`, `level`, `service`, `environment`, `tenantId?`, `branchId?`, `correlationId`, `causationId?`, `traceId?`, `spanId?`, `component`, `event`, `message`

Rules:

- No PHI/PII beyond approved operational IDs.  
- No secrets, tokens, API keys, webhook signing material.  
- No raw request/response bodies by default.  
- Scrub before emit (**OD-PHI**, **OD-REDACTION**).

---

## 15. Tracing Model

- Distributed traces across HTTP → services → queues → workers → external calls.  
- W3C Trace Context–compatible propagation where applicable.  
- Span attributes allowlisted; same PHI/secrets bans as logs.  
- Adaptive / head-based sampling; boost errors and high-latency (**OD-SAMPLING**, **OD-TRACING**).

---

## 16. Correlation Model

| Field | Rule |
|-------|------|
| `correlationId` | Generated at ingress if absent; well-formed inbound may be accepted **observationally** |
| `causationId` | Child work references parent |
| Authz | Correlation/trace IDs **never** grant privilege |
| Spoofing | Invalid inbound IDs discarded; server generates |

Propagation required across HTTP, message/job payloads, structured logs, traces, and Activity/Audit emitters by reference (**OD-CORRELATION**).

---

## 17. Health Model

### 17.1 Platform probes

| Probe | Semantics |
|-------|-----------|
| **`/health/live`** | Process up (liveness) |
| **`/health/ready`** | Critical dependencies + composed contributors allow traffic (readiness) |
| Root `/health` | May alias ready semantics; exact alias documented at implementation mapping without changing live/ready meanings |

### 17.2 Contributor statuses (frozen)

| Status | Meaning |
|--------|---------|
| `healthy` | Contributor operating within expected bounds |
| `degraded` | Partial impairment; not fully down |
| `dormant` | Flag/license gated Center intentionally inactive — **not an outage** |
| `unhealthy` | Contributor failing; impacts readiness per composition rules |

Hub endpoints (`/import-export/health`, `/backup-restore/health`, `/integrations/health`, Notification adapter health, etc.) **remain** and register as contributors (**OD-HEALTH**, **OD-HUB-OBS**).

---

## 18. Alerting Model

| Element | Rule |
|---------|------|
| Severities | `info` · `warning` · `critical` |
| Triggers | Threshold and absence-of-signal on MVP SLIs |
| Lifecycle | fire → notify → acknowledge → silence/resolve |
| Fatigue | Deduplicate, group, severity gating |
| Not included | Full ITSM, SOC playbooks, external on-call SoR |

(**OD-ALERTS**, **OD-INCIDENT**)

---

## 19. Dashboard Model

- Unified **Observability ops hub** in Settings (parity with IE/BR/Integrations hubs).  
- Existing per-hub Health/Metrics pages **remain** and deep-link into platform views.  
- Tenant-safe status views are **conditional** (redaction + license + sub-flag) — **OD-TENANT-STATUS**.  
- No workforce surveillance layouts.

(**OD-DASHBOARD**, **OD-REPORT**)

---

## 20. Notification Integration

- Alert fan-out via Notification Center **intents**.  
- Observability does **not** own delivery queues or adapters.  
- Alert payloads: PHI-safe summaries + deep links (correlation ids); no clinical content.  

(**OD-NOTIFY**)

---

## 21. Activity Integration

- Optional Activity emission for operator-visible Observability actions (e.g. alert acknowledged).  
- Investigation deep-links via `correlationId` / activity ids.  
- Must **not** dump infra metrics into Activity timeline.  

(**OD-ACTIVITY**)

---

## 22. Audit Integration

Audit **required** for:

- Cross-tenant telemetry view  
- Telemetry export  
- Alert rule / retention / config changes  
- Silence of critical alerts  

Telemetry streams themselves are **not** Audit events. Observability must **never** replace Audit retention or evidence SoR.

(**OD-AUDIT**)

---

## 23. Feature Flag Integration

| Flag | Default | Rule |
|------|---------|------|
| `SYSTEM_MONITORING_OBSERVABILITY_ENABLED` | **OFF** | Master gate for Center APIs/UI/alert fan-out |
| Optional sub-flags | OFF | May gate tracing export, alerting, tenant dashboards |

Enabling Observability **must not** flip IE/BR/Integrations master flags.

(**OD-FLAG**)

---

## 24. Licensing Integration

- Center gated by Licensing `allowObservability` (or equivalent) **and** master flag.  
- Missing license/flag → Observability product APIs/UI **fail closed**.  
- Platform `/health/live` remains available for orchestration.  
- License denials are themselves observable signals (coarse, PHI-safe).  

(**OD-LICENSE**)

---

## 25. Tenant Isolation

- Attributable signals carry `tenantId` when request/job is tenant-scoped.  
- System signals may use explicit system scope (`tenantId` null/system).  
- Tenant roles: own-tenant only.  
- Cross-tenant aggregates/views: platform operators with elevated action + Audit.  
- Tenant-facing views must not expose peer tenant identifiers.  

(**OD-TENANCY**, **OD-ACCESS**)

---

## 26. PHI Protection

| Rule | Behavior |
|------|----------|
| Allowlist attributes | Only approved operational fields |
| Forbidden | Clinical free text, diagnoses, notes, full names, national IDs, PANs, raw tokens, API keys, webhook secrets, PHI bodies |
| Scrubber | Fail-**closed** on unknown high-risk fields (drop/redact field, keep event shell) |
| Metrics labels | No PHI |
| Investigation | Reference Activity/Audit ids; do not copy PHI into telemetry |

(**OD-PHI**, **OD-REDACTION**, **OD-DATA-CLASS**)

**Data classes:** `ops_public` · `ops_tenant` · `ops_platform` · `forbidden`

---

## 27. Security Model

| Control | Frozen rule |
|---------|-------------|
| Tenant isolation | Mandatory (OD-TENANCY) |
| RBAC | `api.observability` actions: `read`, `manage`, `export`, `acknowledge`, elevated cross-tenant (OD-ACCESS) |
| Licensing | Required when Center enabled (OD-LICENSE) |
| Feature flags | Default OFF; fail closed for product surface (OD-FLAG) |
| Correlation | Non-authoritative for authz (OD-CORRELATION) |
| PHI allowlist | Fail-closed scrub (OD-PHI) |
| Redaction | Central utility (OD-REDACTION) |
| Secrets | Never in telemetry; exporter creds via env refs (OD-SECRETS) |
| Telemetry integrity | Best-effort diagnostic; not legal evidence |
| Diagnostic access | Least privilege; time-boxed verbose debug if any |
| Operational privilege separation | Platform vs tenant roles (OD-OWNERSHIP) |
| Export | Authenticated/network-restricted; Audit on privileged export (OD-EXPORT, OD-CROSS-EXPORT) |
| Volume DoS | Sampling + cardinality + shed (OD-SAMPLING, OD-CARDINALITY, OD-FAILURE) |

---

## 28. Operational Model

| Topic | Rule |
|-------|------|
| Platform-wide alerts | Owned by platform operators |
| Tenant-scoped alerts | Tenant admins where licensed |
| Acknowledge | `acknowledge` action |
| Cross-tenant view | Elevated action + Audit |
| False positives | Silence + rule tune; runbooks in later ops docs |
| Fatigue | Severity, dedup, group, SLO focus |
| Observability outage | Business continues; temporary blindness accepted |
| Droppable | High-volume metrics/traces under pressure |
| Durable | Alert ack/silence state + Observability configuration |
| Diagnostic vs auditable | Streams diagnostic; privileged actions auditable |

(**OD-OWNERSHIP**, **OD-FAILURE**)

---

## 29. Failure Model

1. Hot-path instrumentation is local/cheap; **no synchronous remote export** on request completion (**OD-OVERHEAD**).  
2. Export/store/alert pipeline failure → **continue clinical/business transactions** (**OD-FAILURE**).  
3. Under backpressure → shed metrics/traces first; keep minimal local structured error logs.  
4. Scrubber failure on sensitive field → **redact/drop field**, never emit PHI.  
5. Ready probe may fail when critical deps down (orchestration signal) without making telemetry a hard request-path dependency.

---

## 30. Availability Model

- Observability improves detection of availability issues; it is **not** the clinical availability SoR.  
- Hub `dormant` does not reduce platform availability scoring as an outage.  
- MVP SLIs track availability/latency/error/queue pressure.  
- Self-monitoring: when exporters fail, local logs + ready semantics still convey impairment.

---

## 31. Scalability Model

- Horizontal scale of API/workers: instrumentation must be safe multi-instance.  
- Alert/config state requires a **shared store port** (no single-node in-memory SoR for multi-node ack/silence).  
- Cardinality budgets prevent series explosion with tenant growth.  
- Sampling controls trace volume.  
- Queue observation respects per-queue isolation (no merge).

(**OD-DEPLOY**, **OD-CARDINALITY**, **OD-SAMPLING**, **OD-QUEUE-OBS**)

---

## 32. Deployment Constraints

- Exporters/agents in-process or sidecar alongside API/workers.  
- Must not require exclusive commercial agent as architecture SoR.  
- Network policy should restrict `/metrics` scrape endpoints.  
- Enabling Observability in an environment is controlled ops action (flag + license), not default.

---

## 33. Extension Points

1. **Health contributors** — hubs/modules register status providers.  
2. **Metric catalog contributors** — register names/labels under allowlist rules.  
3. **Storage adapters** — metrics/log/trace/alert ports.  
4. **Export adapters** — scrape/push exporters.  
5. **Alert notifiers** — via Notification intents (primary).  
6. **Dashboard definitions** — platform + optional tenant-safe (conditional).  

New Centers must extend via contributors/contracts — not fork Observability.

---

## 34. Dependency Rules

| Dependency | Rule |
|------------|------|
| Phases 41–44 | Consume only; do not redesign; do not flip their flags |
| Activity / Audit | Cross-link / privileged audit only |
| Notification | Alert intents only |
| Identity / RBAC / Licensing / Flags | Extend; fail closed for product access |
| Redis / BullMQ / Background | Observe; preserve queue isolation |
| Analytics / Workflow UI | No SoR takeover |
| Rate limiter | Keep `/health` `/metrics` skip reservations |

---

## 35. Storage Abstraction

Ports (logical):

- Metrics store  
- Log store  
- Trace store  
- Alert state / config store  

Default: in-platform + exportable adapters. External backends optional behind ports and **conditional** acceptance (**OD-STORAGE**, **OD-EXT-BACKEND**).

Telemetry lakes are **secondary** to clinical SoR and Audit/Activity for DR (**OD-DR**).

---

## 36. Export Abstraction

- Platform metrics export surface (e.g. `/metrics` or versioned equivalent).  
- Authenticated and/or network-restricted per ops policy.  
- Rate-limiter skip retained for scrape paths.  
- No PHI in exported series.  
- Cross-tenant export requires elevated permissions + Audit (**OD-EXPORT**, **OD-CROSS-EXPORT**).  

---

## 37. Configuration Model

Observability owns:

- Sampling rates  
- Retention knobs (day counts are implementation parameters under OD-RETENTION)  
- Alert rules  
- Dashboard definitions  
- Contributor registration  

Does **not** own clinical configuration or other Centers’ engine configs (**OD-CONFIG**).

---

## 38. Health Contributors

| Contributor source | Expected role |
|--------------------|---------------|
| Platform process / critical deps | live/ready core |
| Import/Export health | Hub contributor |
| Backup & Restore health | Hub contributor |
| Integrations health | Hub contributor |
| Notification delivery adapters | Hub contributor |
| Module registry / AI provider health (existing) | Optional contributors |
| Queue workers (per frozen queue) | Saturation/liveness signals |

Composition rules for when `degraded`/`unhealthy` fails **ready** are defined at implementation mapping without inventing new status enums.

---

## 39. Deferred Capabilities

| ID | Capability | Boundary |
|----|------------|----------|
| OD-SYNTHETIC | Synthetic journey monitoring | Out of Phase 45 core; hooks must not be blocked |
| OD-SIEM | Full SIEM/SOC/UEBA | Out; auth anomaly **signals** only |
| OD-APM-VENDOR | Commercial APM exclusive SoR / vendor rollout | Out of freeze; optional adapter later |
| OD-ONCALL | External paging/on-call SoR | Out; Notification intents for in-product |
| OD-RUM | Frontend RUM / session replay | Out (privacy) |
| OD-BURN | Multi-window SLO burn-rate alerts | After MVP SLIs |
| OD-BRANCH-OBS | Fine branch metric series | Deferred; optional `branchId` on logs/traces OK with care |
| OD-TELEMETRY-BACKUP | Dedicated telemetry lake backup as DR pillar | Deferred |

**Conditional (not deferred-forever):** OD-EXT-BACKEND, OD-TENANT-STATUS, OD-CROSS-EXPORT — allowed only after stated validation.

---

## 40. Future Evolution

- External observability backend adapters under ports.  
- Synthetic monitoring hooks.  
- Advanced SLO burn alerts after MVP.  
- Optional tenant status page under redaction gates.  
- Deeper dependency graphs and capacity planning views.  

Evolution **must not** violate Principles §8 or frozen ODs without revision.

---

## 41. Architecture Constraints

### 41.1 Hard prohibitions (implementation-time)

1. Implementation-time redesign of this architecture.  
2. Changing approved Architecture Decisions without revision + re-approval.  
3. Introducing exclusive vendor lock-in as Observability SoR.  
4. Mixing telemetry streams with Audit evidence records.  
5. Mixing telemetry with Activity Center as SoR.  
6. Adding PHI to telemetry.  
7. Weakening tenant isolation.  
8. Changing health status semantics (`healthy|degraded|dormant|unhealthy`).  
9. Changing correlation semantics (ingress ownership; non-authoritative for authz).  
10. Making telemetry a hard dependency of clinical/business transactions.  
11. Merging frozen hub queues.  
12. Enabling IE/BR/Integrations flags as a side effect of Observability work.  
13. Defaulting `SYSTEM_MONITORING_OBSERVABILITY_ENABLED` to ON.  
14. Logging raw secrets, API keys, or webhook signing material.  
15. Unbounded high-cardinality metric labels.

### 41.2 Compatibility constraints

- Preserve Phases 41–44 frozen engines and queue names.  
- Preserve Audit SSOT “not APM” and Activity correlation contracts.  
- Preserve rate-limiter reservations for `/health` and `/metrics`.

---

## 42. Approved Decision Register

Each decision below is **FROZEN**. Amendments require architecture revision.

---

### OD-BOUNDARY — Observability Center bounded context

| Field | Content |
|-------|---------|
| **Purpose** | Define SoR and non-goals for Phase 45 |
| **Decision** | Observability Center is SoR for operational telemetry policy, health aggregation, metrics/log/trace contracts, alerting, and operator Observability UX |
| **Rationale** | Fragmented hub telemetry cannot meet MTTD/MTTR or PHI/tenancy governance alone |
| **Consequences** | New ops hub and contracts; hubs remain engine SoRs |
| **Scope** | Phase 45 |
| **Dependencies** | Activity, Audit, Notification, Hubs 41–44 |
| **Deferred** | SIEM, exclusive APM vendor SoR |

---

### OD-TELEMETRY — Telemetry standard

| Field | Content |
|-------|---------|
| **Purpose** | Vendor-neutral instrumentation standard |
| **Decision** | OpenTelemetry-compatible semantics for traces/metrics/context; pluggable exporters |
| **Rationale** | Portability; aligns strategy principles without freezing products |
| **Consequences** | Instrumentation conventions mandatory; Prometheus/Grafana/Sentry products not frozen |
| **Scope** | All Phase 45 instrumentation |
| **Dependencies** | OD-STORAGE, OD-EXPORT, OD-PHI |
| **Deferred** | Specific commercial backends |

---

### OD-METRICS — Metrics model

| Field | Content |
|-------|---------|
| **Purpose** | Consistent quantitative signals |
| **Decision** | Semantic catalogs; allowlisted labels; hub contributors; reuse existing counters as inputs |
| **Rationale** | Prevent metric sprawl and cardinality explosion |
| **Consequences** | Unknown high-card labels rejected |
| **Scope** | Platform + hub metrics |
| **Dependencies** | OD-CARDINALITY, OD-HUB-OBS, OD-QUEUE-OBS |
| **Deferred** | Fine branch series (OD-BRANCH-OBS) |

---

### OD-LOGGING — Structured logging

| Field | Content |
|-------|---------|
| **Purpose** | Searchable, correlatable, PHI-safe logs |
| **Decision** | Mandatory structured JSON with standard fields listed in §14 |
| **Rationale** | Existing hubs already partial; needs platform contract |
| **Consequences** | Free-text PHI logging forbidden |
| **Scope** | Instrumented components |
| **Dependencies** | OD-PHI, OD-CORRELATION, OD-REDACTION |
| **Deferred** | None critical |

---

### OD-TRACING — Distributed tracing

| Field | Content |
|-------|---------|
| **Purpose** | Cross-service/queue causality |
| **Decision** | Distributed tracing with W3C-compatible propagation; sampled |
| **Rationale** | RCA across API and workers |
| **Consequences** | Sampling required in production |
| **Scope** | HTTP, queues, workers, outbound calls |
| **Dependencies** | OD-SAMPLING, OD-CORRELATION, OD-PHI |
| **Deferred** | Full RUM (OD-RUM) |

---

### OD-CORRELATION — Correlation and causation

| Field | Content |
|-------|---------|
| **Purpose** | End-to-end investigation key |
| **Decision** | Observability owns ingress correlation; propagate; IDs non-authoritative for authz |
| **Rationale** | Discovery gap: no global middleware |
| **Consequences** | All hubs must propagate; spoofed IDs ignored for privilege |
| **Scope** | Platform ingress + workers |
| **Dependencies** | Activity/Audit emitters by reference |
| **Deferred** | None |

---

### OD-TENANCY — Tenant attribution and isolation

| Field | Content |
|-------|---------|
| **Purpose** | Multi-tenant safety |
| **Decision** | TenantId on attributable signals; tenant-scoped access default; cross-tenant elevated + Audit |
| **Rationale** | Healthcare SaaS isolation |
| **Consequences** | Query filters mandatory; peer leakage forbidden |
| **Scope** | All tenant-scoped telemetry and UX |
| **Dependencies** | OD-ACCESS, OD-AUDIT |
| **Deferred** | OD-BRANCH-OBS fine metrics |

---

### OD-PHI — PHI-safe observability

| Field | Content |
|-------|---------|
| **Purpose** | Compliance and patient safety of data |
| **Decision** | Allowlist model; scrubber fail-closed on high-risk unknowns |
| **Rationale** | Observability must not become PHI store |
| **Consequences** | Some debug detail unavailable by design |
| **Scope** | All signal kinds |
| **Dependencies** | OD-REDACTION, OD-DATA-CLASS, OD-SECRETS |
| **Deferred** | None |

---

### OD-CARDINALITY — Cardinality policy

| Field | Content |
|-------|---------|
| **Purpose** | Cost and reliability of metrics |
| **Decision** | Forbid unbounded labels; tier per-tenant series under budget |
| **Rationale** | Cardinality attacks and cost blowups |
| **Consequences** | Less per-entity detail in metrics |
| **Scope** | Metrics primarily |
| **Dependencies** | OD-METRICS, OD-SAMPLING |
| **Deferred** | OD-BRANCH-OBS |

---

### OD-SAMPLING — Sampling and volume

| Field | Content |
|-------|---------|
| **Purpose** | Control trace/log volume |
| **Decision** | Default sampling &lt; 100%; always-sample errors/high latency; log rate limits by component |
| **Rationale** | Performance and cost |
| **Consequences** | Not every request fully traced |
| **Scope** | Traces/logs |
| **Dependencies** | OD-TRACING, OD-OVERHEAD |
| **Deferred** | None |

---

### OD-RETENTION — Retention ownership

| Field | Content |
|-------|---------|
| **Purpose** | Separate diagnostic retention from Audit |
| **Decision** | Observability owns telemetry retention; shorter than Audit; never legal SoR |
| **Rationale** | Compliance boundary clarity |
| **Consequences** | Telemetry purge independent of Audit |
| **Scope** | Metrics/logs/traces/alerts history |
| **Dependencies** | OD-AUDIT, OD-DR |
| **Deferred** | Exact day counts as env parameters |

---

### OD-HEALTH — Health, readiness, liveness

| Field | Content |
|-------|---------|
| **Purpose** | Orchestration + human ops semantics |
| **Decision** | `/health/live`, `/health/ready`; hubs contribute; statuses healthy/degraded/dormant/unhealthy |
| **Rationale** | Unify without erasing hub probes |
| **Consequences** | Dormant Centers must not page as down |
| **Scope** | Platform + contributors |
| **Dependencies** | Hub health endpoints |
| **Deferred** | None |

---

### OD-ALERTS — Alerting model

| Field | Content |
|-------|---------|
| **Purpose** | Actionable detection |
| **Decision** | Severities info/warning/critical; threshold + absence; ack/silence; dedup/group |
| **Rationale** | MTTD without SIEM scope |
| **Consequences** | Ops must tune rules |
| **Scope** | Phase 45 alerting |
| **Dependencies** | OD-NOTIFY, OD-SLO, OD-ACCESS |
| **Deferred** | OD-BURN, OD-ONCALL, OD-SIEM |

---

### OD-NOTIFY — Notification Center integration

| Field | Content |
|-------|---------|
| **Purpose** | Deliver alerts in-product |
| **Decision** | Notification intents; PHI-safe payloads |
| **Rationale** | Reuse Phase 41 delivery SoR |
| **Consequences** | No Observability-owned delivery queue |
| **Scope** | Alert fan-out |
| **Dependencies** | Phase 41 frozen |
| **Deferred** | OD-ONCALL |

---

### OD-ACTIVITY — Activity Center integration

| Field | Content |
|-------|---------|
| **Purpose** | Operator-visible breadcrumbs without SoR collision |
| **Decision** | Optional Activity for ops actions; cross-link only |
| **Rationale** | Activity SSOT is timeline, not APM |
| **Consequences** | No metric dumps into Activity |
| **Scope** | Integration boundary |
| **Dependencies** | Activity SSOT |
| **Deferred** | None |

---

### OD-AUDIT — Audit Center integration

| Field | Content |
|-------|---------|
| **Purpose** | Evidence for privileged ops |
| **Decision** | Audit cross-tenant view, export, rule/config changes, critical silences; not telemetry streams |
| **Rationale** | Audit excludes APM but must cover privilege |
| **Consequences** | Dual systems remain |
| **Scope** | Privileged Observability actions |
| **Dependencies** | Audit SSOT |
| **Deferred** | None |

---

### OD-STORAGE — Storage abstraction

| Field | Content |
|-------|---------|
| **Purpose** | Avoid vendor lock-in |
| **Decision** | Ports for metrics/log/trace/alert stores; in-platform + exportable defaults |
| **Rationale** | Portability (OD-PORTABILITY) |
| **Consequences** | Adapters required for external backends |
| **Scope** | All telemetry persistence |
| **Dependencies** | OD-EXPORT, OD-EXT-BACKEND |
| **Deferred** | Specific vendors |

---

### OD-EXPORT — Export / scrape abstraction

| Field | Content |
|-------|---------|
| **Purpose** | Interoperable metrics egress |
| **Decision** | Platform `/metrics` (or versioned) export; auth/network restricted; no PHI series |
| **Rationale** | Rate-limiter already reserves path |
| **Consequences** | Ops must secure scrape endpoints |
| **Scope** | Metrics export |
| **Dependencies** | OD-METRICS, OD-PHI, OD-CROSS-EXPORT |
| **Deferred** | Push exporters specifics |

---

### OD-FAILURE — Failure and backpressure

| Field | Content |
|-------|---------|
| **Purpose** | Protect clinical availability |
| **Decision** | Fail-open clinical path; shed telemetry under pressure; durable ack/config only |
| **Rationale** | Patient care &gt; perfect telemetry |
| **Consequences** | Temporary blind spots accepted |
| **Scope** | All exporters/pipelines |
| **Dependencies** | OD-OVERHEAD, OD-HEALTH |
| **Deferred** | None |

---

### OD-ACCESS — Access control

| Field | Content |
|-------|---------|
| **Purpose** | Least-privilege ops access |
| **Decision** | RBAC `api.observability` with `read`, `manage`, `export`, `acknowledge`, elevated cross-tenant |
| **Rationale** | Over-privileged dashboards are a security risk |
| **Consequences** | Role mapping required at implementation |
| **Scope** | All Observability product surfaces |
| **Dependencies** | RBAC, OD-LICENSE, OD-FLAG, OD-AUDIT |
| **Deferred** | None |

---

### OD-LICENSE — Licensing boundary

| Field | Content |
|-------|---------|
| **Purpose** | Commercial/ops SKU control |
| **Decision** | `allowObservability` (or equivalent) required with flag for Center product |
| **Rationale** | Consistency with other Centers |
| **Consequences** | Fail closed product APIs without license |
| **Scope** | Center enablement |
| **Dependencies** | Licensing architecture |
| **Deferred** | SKU packaging details |

---

### OD-FLAG — Feature flag behavior

| Field | Content |
|-------|---------|
| **Purpose** | Safe rollout |
| **Decision** | `SYSTEM_MONITORING_OBSERVABILITY_ENABLED` default OFF; sub-flags optional; no side-enable of other Centers |
| **Rationale** | Matches IE/BR/Integrations governance |
| **Consequences** | Controlled enablement post-acceptance |
| **Scope** | Phase 45 |
| **Dependencies** | Feature Flags platform |
| **Deferred** | Exact sub-flag names as parameters |

---

### OD-OVERHEAD — Performance overhead limits

| Field | Content |
|-------|---------|
| **Purpose** | Protect p99 clinical latency |
| **Decision** | Async/O(1) local buffer; no sync remote export on request completion |
| **Rationale** | Discovery NFR |
| **Consequences** | Export lag possible |
| **Scope** | Hot path |
| **Dependencies** | OD-FAILURE, OD-SAMPLING |
| **Deferred** | Numeric budgets as env parameters |

---

### OD-QUEUE-OBS — Queue and job observability

| Field | Content |
|-------|---------|
| **Purpose** | Saturation visibility without queue merge |
| **Decision** | Per frozen queue: depth, age, throughput, fail/DLQ, worker liveness |
| **Rationale** | OD-QUEUE isolation from 41–44 |
| **Consequences** | Multiple series by queue name |
| **Scope** | notification-delivery, import-export, integrations-webhooks, reserved backup-restore, etc. |
| **Dependencies** | Redis/BullMQ foundations |
| **Deferred** | None |

---

### OD-API-OBS — API / authn / authz monitoring

| Field | Content |
|-------|---------|
| **Purpose** | Request and security-signal visibility |
| **Decision** | Rate, latency, error class, authn failures, authz denials, API-key rejects — redacted |
| **Rationale** | Core MTTD for API plane |
| **Consequences** | No raw credentials in signals |
| **Scope** | API edge |
| **Dependencies** | OD-PHI, OD-SECRETS |
| **Deferred** | OD-SIEM enrichment |

---

### OD-HUB-OBS — Hub domain monitoring

| Field | Content |
|-------|---------|
| **Purpose** | First-class packs for Centers |
| **Decision** | Consume IE/BR/Integrations/Notification/Flags/Licensing denial signals |
| **Rationale** | Reuse without redesign |
| **Consequences** | Contributor contracts required |
| **Scope** | Hub integrations |
| **Dependencies** | Frozen hub SSOTs |
| **Deferred** | None |

---

### OD-DB — Database and cache observability

| Field | Content |
|-------|---------|
| **Purpose** | Saturation without PHI |
| **Decision** | Pool/saturation/error/cache hit-miss/Redis health; no SQL text/bind params by default |
| **Rationale** | Query text often contains PHI |
| **Consequences** | Limited query-level APM |
| **Scope** | DB/cache |
| **Dependencies** | OD-PHI |
| **Deferred** | Deeper DB APM under strict scrub (future revision) |

---

### OD-DASHBOARD — Dashboard architecture

| Field | Content |
|-------|---------|
| **Purpose** | Single operator mental model |
| **Decision** | Unified Observability ops hub; keep hub Health pages with deep-links |
| **Rationale** | Avoid split-brain; preserve existing UX investment |
| **Consequences** | Two layers (hub + platform) intentionally linked |
| **Scope** | Operator UX |
| **Dependencies** | OD-ACCESS, OD-TENANT-STATUS |
| **Deferred** | Advanced viz |

---

### OD-REPORT — Operational reporting

| Field | Content |
|-------|---------|
| **Purpose** | Ops summaries without Analytics takeover |
| **Decision** | Availability, MVP error budgets, failing components, queue pressure, alert volume |
| **Rationale** | Capacity and post-incident needs |
| **Consequences** | Not clinical business KPIs |
| **Scope** | Ops reports |
| **Dependencies** | OD-SLO, OD-METRICS |
| **Deferred** | None |

---

### OD-INCIDENT — Incident lifecycle boundary

| Field | Content |
|-------|---------|
| **Purpose** | Lightweight response loop |
| **Decision** | Detect → triage → ack → silence/resolve with correlation aids; no full ITSM/postmortem CMS |
| **Rationale** | Scope control |
| **Consequences** | External ticketing remains outside |
| **Scope** | Phase 45 |
| **Dependencies** | OD-ALERTS, OD-CORRELATION |
| **Deferred** | Major-incident command tooling |

---

### OD-CONFIG — Configuration ownership

| Field | Content |
|-------|---------|
| **Purpose** | Clear config SoR |
| **Decision** | Observability owns sampling, retention knobs, alert rules, dashboards, contributor registration |
| **Rationale** | Prevent config sprawl across hubs |
| **Consequences** | Hub engine configs remain hub-owned |
| **Scope** | Observability config |
| **Dependencies** | OD-ACCESS, OD-AUDIT |
| **Deferred** | None |

---

### OD-SECRETS — Secrets and credentials

| Field | Content |
|-------|---------|
| **Purpose** | Prevent secret leakage via telemetry |
| **Decision** | No secrets in telemetry; exporter creds via env refs; scrub Authorization and key material patterns |
| **Rationale** | Integrations already demonstrated secret risk |
| **Consequences** | Debug harder without secrets — intentional |
| **Scope** | All pipelines |
| **Dependencies** | OD-PHI, OD-REDACTION |
| **Deferred** | None |

---

### OD-DEPLOY — Deployment topology

| Field | Content |
|-------|---------|
| **Purpose** | Horizontal scale safety |
| **Decision** | In-process/sidecar with workers; shared store port for multi-node alert/config state |
| **Rationale** | Multi-instance API deployments |
| **Consequences** | No single-node memory SoR for acks in multi-node |
| **Scope** | Runtime topology |
| **Dependencies** | OD-STORAGE |
| **Deferred** | Exact orchestrator manifests |

---

### OD-DR — Disaster recovery

| Field | Content |
|-------|---------|
| **Purpose** | Clarify restore priorities |
| **Decision** | Telemetry secondary; clinical + Audit/Activity authoritative; Observability config/alert state reconstructible or optionally included only if PHI-safe |
| **Rationale** | Avoid making obs lake a DR dependency |
| **Consequences** | Telemetry loss acceptable in DR |
| **Scope** | DR planning |
| **Dependencies** | BR Center boundaries |
| **Deferred** | OD-TELEMETRY-BACKUP |

---

### OD-PORTABILITY — Data portability / vendor lock-in

| Field | Content |
|-------|---------|
| **Purpose** | Long-term flexibility |
| **Decision** | Instrumentation/export remain portable; exclusive commercial APM SoR forbidden in Phase 45 |
| **Rationale** | Review rejected vendor-as-SoR |
| **Consequences** | Adapters over hard embeds |
| **Scope** | Architecture |
| **Dependencies** | OD-TELEMETRY, OD-STORAGE, OD-EXPORT |
| **Deferred** | OD-APM-VENDOR optional adapters |

---

### OD-OWNERSHIP — Operational ownership

| Field | Content |
|-------|---------|
| **Purpose** | Who responds |
| **Decision** | Platform ops own platform-wide alerts; tenant admins own licensed tenant-scoped; security anomalies signaled but SIEM not Observability SoR |
| **Rationale** | Clear on-call boundaries |
| **Consequences** | Role playbooks needed later |
| **Scope** | Operations |
| **Dependencies** | OD-ACCESS, OD-ALERTS, OD-SIEM deferred |
| **Deferred** | OD-ONCALL |

---

### OD-SLO — SLI / SLO MVP set

| Field | Content |
|-------|---------|
| **Purpose** | Measurable objectives |
| **Decision** | MVP SLIs: API availability, API latency, readiness, queue saturation, critical hub job failure rate |
| **Rationale** | Focused signal set |
| **Consequences** | Numeric targets parameterized per environment |
| **Scope** | MVP |
| **Dependencies** | OD-METRICS, OD-ALERTS |
| **Deferred** | OD-BURN |

---

### OD-DATA-CLASS — Data classification

| Field | Content |
|-------|---------|
| **Purpose** | Access mapping |
| **Decision** | Classes ops_public / ops_tenant / ops_platform / forbidden |
| **Rationale** | Align access with sensitivity |
| **Consequences** | UI/API must enforce class |
| **Scope** | All Observability data |
| **Dependencies** | OD-ACCESS, OD-PHI |
| **Deferred** | None |

---

### OD-REDACTION — Redaction and masking

| Field | Content |
|-------|---------|
| **Purpose** | Central scrubbing |
| **Decision** | Central redaction utility for log/trace/error pipelines; mask to stable tokens for grouping |
| **Rationale** | Consistent PHI/secret handling; reuse Integrations patterns where applicable |
| **Consequences** | All emitters must use utility |
| **Scope** | Emit path |
| **Dependencies** | OD-PHI, OD-SECRETS |
| **Deferred** | None |

---

### Deferred decisions (boundaries frozen)

| ID | Status | Boundary |
|----|--------|----------|
| **OD-SYNTHETIC** | DEFERRED | No synthetic product in Phase 45 core |
| **OD-SIEM** | DEFERRED | No SIEM/SOC SoR |
| **OD-APM-VENDOR** | DEFERRED | No exclusive commercial APM SoR |
| **OD-ONCALL** | DEFERRED | No external on-call SoR |
| **OD-RUM** | DEFERRED | No RUM/session replay |
| **OD-BURN** | DEFERRED | No multi-window burn alerts in MVP |
| **OD-BRANCH-OBS** | DEFERRED | No fine branch metric cardinality requirement |
| **OD-TELEMETRY-BACKUP** | DEFERRED | No telemetry lake as DR pillar |

### Conditional decisions (boundaries frozen)

| ID | Status | Condition |
|----|--------|-----------|
| **OD-EXT-BACKEND** | CONDITIONAL | External backends only after PHI scrub + tenancy filter + export auth acceptance |
| **OD-TENANT-STATUS** | CONDITIONAL | Tenant status page only if redaction + license + sub-flag validated |
| **OD-CROSS-EXPORT** | CONDITIONAL | Cross-tenant export requires Audit + `export` + elevated cross-tenant |

---

## 43. Terminology

| Term | Definition |
|------|------------|
| **Observability Center** | Phase 45 bounded context; operational telemetry SoR |
| **Telemetry** | Metrics, logs, traces, errors, health signals used for ops |
| **Contributor** | Module/hub that registers health or metrics with Observability |
| **Correlation ID** | Ingress-scoped identifier linking related work |
| **Causation ID** | Parent reference for child work |
| **Dormant** | Intentionally inactive due to flag/license — not an outage |
| **Fail-open (clinical)** | Business transactions continue if telemetry fails |
| **Fail-closed (PHI/access)** | Deny emit or deny access when safety/auth uncertain |
| **SLI / SLO** | Service level indicator / objective |
| **Port** | Storage or export abstraction boundary |
| **Hub** | Settings-centered operational product (IE, BR, Integrations, Observability) |

---

## 44. Architecture Compliance Rules

Implementations **comply** only if they:

1. Honor every **APPROVED** OD in §42.  
2. Respect deferred/conditional boundaries.  
3. Do not redesign Phases 1–44.  
4. Keep Activity, Audit, Analytics, SIEM, and commercial APM boundaries intact.  
5. Enforce PHI allowlist + fail-closed scrub.  
6. Enforce tenant isolation and RBAC/license/flag gates.  
7. Fail-open clinical paths on telemetry failure.  
8. Use OpenTelemetry-compatible, vendor-neutral instrumentation.  
9. Preserve health status enum semantics.  
10. Preserve correlation non-authority for authz.  
11. Do not default the master flag ON.  
12. Do not merge frozen queues.  
13. Route alerts via Notification intents (not a new delivery SoR).  
14. Audit privileged Observability actions.  
15. Treat this document as SSOT over `OBSERVABILITY.md` for Phase 45 decisions.

**Non-compliance** requires stopping implementation and requesting architecture revision.

---

## 45. Implementation Entry Criteria

Implementation (including Phase 45a) may begin **only when all** are true:

1. This Architecture SSOT status is **APPROVED AND FROZEN**.  
2. Architecture Review verdict is **PASS** ([`PHASE_45_ARCHITECTURE_REVIEW_AND_APPROVAL.md`](./PHASE_45_ARCHITECTURE_REVIEW_AND_APPROVAL.md)).  
3. Discovery is complete ([`PHASE_45_ARCHITECTURE_DISCOVERY_AND_READINESS.md`](./PHASE_45_ARCHITECTURE_DISCOVERY_AND_READINESS.md)).  
4. Decision Register §42 is frozen (no unresolved critical ODs).  
5. Component boundaries §9 and scope §2–3 are frozen.  
6. Constraints §41 and deferred §39 are documented.  
7. **Execution Planning** for Phase 45 has been completed and authorized separately (not this document).  
8. No contradiction remains between this SSOT and frozen Phases 41–44 dependency rules.

**Until entry criteria are met: implementation must not start.**

---

## 46. Implementation Exit Criteria (Phase 45 completion)

Phase 45 is complete only when:

1. Observability Center ships behind `SYSTEM_MONITORING_OBSERVABILITY_ENABLED` **default OFF**.  
2. License + RBAC gates enforce access.  
3. Ingress correlation and structured logging contracts are live for instrumented paths.  
4. Platform live/ready health composes hub contributors with correct `dormant` semantics.  
5. MVP SLIs and alerting (ack/silence) function with Notification intents.  
6. PHI scrubbing and tenant isolation verified by acceptance tests.  
7. Storage/export ports exist; no exclusive vendor SoR.  
8. Activity/Audit boundaries respected (privileged actions audited; no telemetry-as-Audit).  
9. Failure model verified: clinical path continues when exporters fail.  
10. Unified Observability ops hub available; hub Health pages deep-linked.  
11. Production Acceptance document issued; flag remains default OFF pending controlled enablement.  
12. No Phase 41–44 engine/queue regressions.

*(Sub-phase exit criteria are defined during Execution Planning, subordinate to this SSOT.)*

---

## 47. Document Freeze Record

| Artifact | Action |
|----------|--------|
| `docs/SYSTEM_MONITORING_OBSERVABILITY_ARCHITECTURE.md` | **This SSOT — APPROVED AND FROZEN** |
| `docs/PHASE_45_ARCHITECTURE_REVIEW_AND_APPROVAL.md` | Approval authority |
| `docs/PHASE_45_ARCHITECTURE_DISCOVERY_AND_READINESS.md` | Discovery input |
| `docs/OBSERVABILITY.md` | Strategy companion only; subordinate to this SSOT for Phase 45 |

**Change control:** Critical OD amendments require new Architecture Decision, revision of this SSOT, and re-approval. Deferred OD promotion into scope requires explicit architecture revision.

| Field | Value |
|-------|-------|
| Architecture status | **APPROVED AND FROZEN** |
| Freeze date | **2026-07-18** |
| Implementation | **NOT AUTHORIZED** (pending Execution Planning) |
| Feature flag default | **OFF** |

---

# PASS — PHASE 45 ARCHITECTURE FROZEN

# READY FOR EXECUTION PLANNING
