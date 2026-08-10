# Phase 45 — Architecture Review and Approval

**Document type:** Architecture governance — review, decision resolution, freeze readiness  
**Date:** 2026-07-18  
**Capability:** System Monitoring & Observability  
**Dynamic Platform phase:** **45**  
**Authoritative input:** [`PHASE_45_ARCHITECTURE_DISCOVERY_AND_READINESS.md`](./PHASE_45_ARCHITECTURE_DISCOVERY_AND_READINESS.md)  
**Companion strategy (non-binding until adopted by OD):** [`OBSERVABILITY.md`](./OBSERVABILITY.md)  
**Prior release baselines:** Release **43.0** (Backup & Restore) · Release **44.0** (API Keys & Integrations) — **PRODUCTION ACCEPTED**  
**Review posture:** Independent governance review against repository SSOT and frozen Phases 41–44  

| Constraint | Status |
|------------|--------|
| Production / application code changed during review | **No** |
| Migrations / APIs / UI / schemas introduced | **No** |
| Architecture SSOT freeze document | **Not yet** (authorized next step) |
| Implementation / execution planning | **NOT AUTHORIZED** |
| Phases 1–44 redesigned | **No** |

---

## 1. Executive Summary

Phase 45 must deliver a **platform Observability capability** that unifies operational signals (metrics, structured logs, traces, errors, health, alerts, operator dashboards) across the Healthcare ERP — while **preserving** Activity Center, Audit Center, Analytics, Workflow monitoring, and Releases 41–44 engines as separate systems of record.

Discovery established that the platform already has **fragmented foundations** (per-hub health, Redis/in-process metrics, PHI-safe structured logs with `correlationId`, Activity/Audit emitters, Settings Health pages) but lacks a **unified Observability Center**, global correlation at ingress, standardized export abstractions, SLO language, alerting product, and PHI-safe multi-tenant ops governance.

This review resolves the critical architectural questions: platform boundaries, build-versus-integrate, telemetry standards, correlation, health model, tenancy/PHI, cardinality/sampling/failure behavior, access control, and integration contracts with Notification / Activity / Audit. Vendor product freezes (specific APM SaaS, SIEM, managed TSDB) are **explicitly deferred** behind storage/export abstractions to limit lock-in.

**Overall verdict:**

# PASS — PHASE 45 ARCHITECTURE APPROVED

# READY FOR ARCHITECTURE FREEZE

Implementation remains **NOT AUTHORIZED** until the Architecture SSOT is written and frozen.

---

## 2. Review Scope

### 2.1 In review

- Discovery assessment and open-question resolution  
- Compatibility with Identity, RBAC, Licensing, Flags, Registry, Activity, Audit, Notification, IE, BR, Integrations, queues, configuration, multi-tenancy  
- Architecture Decisions (OD-*) for Phase 45  
- Security, multi-tenant, PHI, scalability, reliability, operational ownership  
- Scope control (in / deferred / rejected / conditional)  
- Risk register and freeze readiness  

### 2.2 Out of review (forbidden here)

- Code, APIs, migrations, UI modules  
- Execution / implementation phase plans and prompts  
- Final vendor commercial contracts  
- Full SIEM / SOC program design  
- Redesign of Phases 41–44  

---

## 3. Discovery Assessment

| Discovery claim | Review finding |
|-----------------|----------------|
| Phase 45 is free for Observability / APM | **Accepted** — Integrations SSOT defers APM to Phase 45; Phase 37 remains reserved |
| Foundations exist but fragmented | **Accepted** — hubs, QueueMetrics, structured logs, Settings Health |
| Activity ≠ Audit ≠ Observability | **Accepted and reinforced** |
| `OBSERVABILITY.md` is strategy input, not freeze | **Accepted** — adapted via OD-TELEMETRY / OD-STORAGE / OD-EXPORT |
| No blocking unknowns for Review | **Accepted** — critical ODs resolved below |
| Discovery did not design architecture | **Accepted** |

**Discovery quality:** Sufficient. No return-to-discovery required.

---

## 4. Existing Architecture Compatibility

| Platform | Compatibility rule (frozen for Phase 45) |
|----------|------------------------------------------|
| **Notification (41)** | Consume delivery health/metrics; may deliver alert **intents**; do not modify `notification-delivery` queue or engine |
| **Import/Export (42)** | Consume hub health/metrics/logs; do not redesign IE SoR |
| **Backup & Restore (43)** | Consume hub health/metrics; respect reserved BR queue isolation |
| **Integrations (44)** | Consume gateway/webhook/quota signals; do not redesign credential/webhook engines; flag stays default OFF |
| **Activity Center** | Cross-link by `correlationId` / activity ids; Observability is **not** an activity timeline |
| **Audit Center** | Cross-link for evidence; Observability is **not** legal/compliance SoR; Audit SSOT excludes APM |
| **Analytics / Reporting** | Business KPIs remain Analytics; Observability may show **operational** SLIs only |
| **Workflow monitoring UI** | Business workflow execution ≠ platform Observability |
| **Identity / RBAC / Licensing / Flags** | Extend with Observability resource, license gate, master flag; fail closed for access |
| **Redis / BullMQ / Background** | Preserve queue isolation; Observability **observes**, does not own job SoR |
| **Rate limiter reservations** | `/health` and `/metrics` paths remain reserved for platform probes/export |

---

## 5. Major Architecture Questions → Resolutions

| # | Question | Resolution |
|---|----------|------------|
| 1 | Bounded context / RBAC resource? | **Observability Center**; RBAC resource `api.observability` (see OD-ACCESS) |
| 2 | Liveness / readiness vs hub health? | Platform probes compose hub contributors; hubs remain authoritative for their engines (OD-HEALTH) |
| 3 | Global correlation middleware? | **Yes** — Observability owns ingress correlation/context propagation (OD-CORRELATION) |
| 4 | Minimum SLI/SLO for MVP? | Availability, latency, error rate, queue saturation, hub readiness (OD-SLO); burn-rate advanced rules deferred |
| 5 | Tenant vs platform dashboards? | Platform ops hub primary; tenant-safe status views limited and redacted (OD-DASHBOARD) |
| 6 | Relationship to `OBSERVABILITY.md`? | **Adopt principles**; **adapt** stack via abstractions; do not freeze Grafana/Sentry/Prometheus products (OD-TELEMETRY, OD-STORAGE) |
| 7 | Alert delivery? | Notification Center **intents** for in-product alerts; external on-call webhook optional later (OD-ALERTS, OD-NOTIFY) |
| 8 | Retention vs Audit? | Telemetry retention **shorter** and separately owned; never substitute Audit retention (OD-RETENTION) |
| 9 | Flag-dormant Centers in health? | Show as **`dormant`**, not `down` (OD-HEALTH) |
| 10 | Synthetic monitoring in MVP? | **Deferred** beyond Phase 45 core (OD-SYNTHETIC) |
| 11 | DB/cache depth? | Pool/saturation/error metrics only; **no** query text/bind params with PHI risk (OD-DB) |
| 12 | Sub-phase shape? | Deferred to SSOT freeze + execution planning (not this review) |
| 13 | Licensing? | License gate required when Center enabled (OD-LICENSE) |
| 14 | Root `/health` `/metrics`? | **Yes** — platform standards (OD-HEALTH, OD-EXPORT) |

---

## 6. Alternatives Considered

### 6.1 Platform boundary

| Alternative | Advantages | Disadvantages | Ops / Sec / Scale / Compat | Decision |
|-------------|------------|---------------|----------------------------|----------|
| **A. Unified Observability Center** (chosen) | One operator model; clear SoR for telemetry policy | Build cost | Aligns with IE/BR/Integrations hub pattern | **Preferred — Immediate** |
| B. Only external APM vendor UI | Faster vendor features | Lock-in; weak tenancy/PHI control; bypasses RBAC/licensing | Poor Healthcare ERP fit | **Rejected** as primary |
| C. Extend Audit Center into APM | Reuse evidence store | Violates Audit SSOT; retention/compliance collision | **Rejected** |
| D. Per-hub only (status quo+) | Minimal change | Continues fragmentation; no correlation product | **Rejected** as Phase 45 outcome |

### 6.2 Build vs integrate

| Alternative | Advantages | Disadvantages | Impact | Decision |
|-------------|------------|---------------|--------|----------|
| **A. Platform owns instrumentation + contracts + ops UX; backends via ports** (chosen) | Portability; PHI gates in-app; reuse hubs | More engineering | Compatible with open-standards strategy | **Preferred — Immediate** |
| B. Embed single commercial APM SDK as SoR | Rich features | Vendor lock; PHI/cardinality hard to enforce | **Rejected** as SoR |
| C. Build full TSDB + UI in-app | Max control | Cost/complexity explosion | **Rejected** for Phase 45 |

### 6.3 Telemetry standard

| Alternative | Advantages | Disadvantages | Decision |
|-------------|------------|---------------|----------|
| **A. OpenTelemetry-compatible semantic conventions + context propagation** (chosen) | Portability; aligns strategy doc; exporter flexibility | Discipline required | **Preferred — Immediate** (standard, not vendor) |
| B. Proprietary-only agent | Vendor polish | Lock-in | **Rejected** |
| C. Logs-only observability | Simple | Weak RCA across queues | **Rejected** |

### 6.4 Correlation ownership

| Alternative | Advantages | Disadvantages | Decision |
|-------------|------------|---------------|----------|
| **A. Global ingress middleware + propagation contract** (chosen) | End-to-end RCA; hubs already use correlationId | Must not trust unauthenticated client IDs blindly | **Preferred — Immediate** |
| B. Module-local IDs only | Less change | Continues RCA gaps | **Rejected** |

### 6.5 Failure mode for exporters

| Alternative | Advantages | Disadvantages | Decision |
|-------------|------------|---------------|----------|
| **A. Clinical path fail-open; telemetry droppable under backpressure** (chosen) | Patient journeys survive obs outages | Temporary blind spots | **Preferred — Immediate** |
| B. Fail closed (block requests if telemetry fails) | Strong signal integrity | Clinical availability risk — unacceptable | **Rejected** |
| C. Durable queue all telemetry before respond | No loss | Latency/cost; DoS risk | **Rejected** for hot path |

### 6.6 Alerting product depth

| Alternative | Advantages | Disadvantages | Decision |
|-------------|------------|---------------|----------|
| **A. Severity + rules + acknowledge/silence + Notification intents** (chosen) | Actionable ops without SIEM | Not full ITSM | **Preferred — Immediate** |
| B. Full SOC/SIEM + on-call platform | Enterprise security ops | Out of Phase 45 scope | **Rejected / Deferred** (security monitoring ≠ Observability SoR) |
| C. Metrics-only, no alerts | Less noise | Does not meet MTTD goals | **Rejected** |

---

## 7. Approved Decisions (Decision Register)

Status legend: **IMMEDIATE** = frozen for SSOT · **DEFERRED** = out of Phase 45 with boundary · **CONDITIONAL** = allowed only after stated validation.

### 7.1 Critical — RESOLVED (Immediate)

#### OD-BOUNDARY — Observability Center bounded context

| Field | Value |
|-------|-------|
| **Decision** | Introduce platform **Observability Center** as SoR for operational telemetry policy, health aggregation, metrics/log/trace contracts, alerting, and operator Observability UX. |
| **Not** | Activity timeline, Audit evidence, Analytics KPIs, SIEM/SOC, workforce productivity monitoring, Workflow business monitoring. |
| **Status** | Immediate |

#### OD-TELEMETRY — Telemetry standard

| Field | Value |
|-------|-------|
| **Decision** | Adopt **OpenTelemetry-compatible** instrumentation semantics (traces, metrics, baggage/context) as the platform standard. Exporters remain pluggable. |
| **Relation to `OBSERVABILITY.md`** | Principles adopted; concrete Prometheus/Grafana/Sentry **products not frozen**. |
| **Rejected** | Proprietary-only SoR; logs-only architecture. |
| **Status** | Immediate |

#### OD-METRICS — Metrics model

| Field | Value |
|-------|-------|
| **Decision** | Semantic metric catalogs (names, units, labels) owned by Observability contracts; hubs register contributors. Prefer counters/histograms/gauges with **allowlisted label keys**. |
| **Reuse** | Existing Redis `QueueMetricsService`, BR/Integrations in-process counters, hub catalogs become **inputs**. |
| **Status** | Immediate |

#### OD-LOGGING — Structured logging

| Field | Value |
|-------|-------|
| **Decision** | Structured JSON logs with standard fields: `timestamp`, `level`, `service`, `environment`, `tenantId?`, `branchId?`, `correlationId`, `causationId?`, `traceId?`, `spanId?`, `component`, `event`, `message`. |
| **Rule** | PHI/secrets **forbidden**; scrub before emit (OD-PHI). |
| **Status** | Immediate |

#### OD-TRACING — Distributed tracing

| Field | Value |
|-------|-------|
| **Decision** | Distributed tracing across HTTP → services → queues → workers → external calls, using W3C Trace Context–compatible propagation where applicable. |
| **Sampling** | Adaptive / head-based sampling with error and high-latency boost (OD-SAMPLING). |
| **Status** | Immediate |

#### OD-CORRELATION — Correlation and causation

| Field | Value |
|-------|-------|
| **Decision** | Observability owns **ingress correlation**: generate `correlationId` at edge if absent; accept inbound only when cryptographically/randomly well-formed and **not** trusted for authz. Propagate to logs, traces, jobs, Activity/Audit emitters (by reference). Support `causationId` for child work. |
| **Spoofing** | Client-supplied IDs are observational only; never elevate privilege. |
| **Status** | Immediate |

#### OD-TENANCY — Tenant attribution and isolation

| Field | Value |
|-------|-------|
| **Decision** | Every attributable signal carries `tenantId` when request/job is tenant-scoped. Platform/system signals may omit tenant or use explicit `tenantId=null` system scope. Storage and queries enforce tenant filters for tenant roles. |
| **Aggregation** | Cross-tenant aggregates allowed **only** for platform operators with `api.observability` elevated actions (OD-ACCESS). Aggregates must not expose another tenant’s identifiers in tenant-facing views. |
| **Status** | Immediate |

#### OD-PHI — PHI-safe observability

| Field | Value |
|-------|-------|
| **Decision** | Allowlist attribute model. Forbidden: clinical free text, diagnoses, notes, full names, national IDs, payment PANs, raw tokens, API key material, webhook signing secrets, request/response bodies with PHI. |
| **Fail behavior** | Scrubber **fail-closed** for unknown high-risk fields (drop/redact field, keep event shell). |
| **Status** | Immediate |

#### OD-CARDINALITY — Cardinality policy

| Field | Value |
|-------|-------|
| **Decision** | Forbid unbounded labels (`userId`, raw URLs, exception messages, patient ids) on metrics. Per-tenant metric series **tiered** (all tenants: coarse; selected tenants: fine) under budget. |
| **Status** | Immediate |

#### OD-SAMPLING — Sampling and volume

| Field | Value |
|-------|-------|
| **Decision** | Default trace sampling < 100% in production; always-sample errors and explicit debug traces (time-boxed). Log volume controlled by level + component rate limits. |
| **Status** | Immediate |

#### OD-RETENTION — Retention ownership

| Field | Value |
|-------|-------|
| **Decision** | Observability owns telemetry retention (metrics/logs/traces/alerts). Defaults **shorter** than Audit evidence retention. Telemetry must **never** be treated as legal evidence SoR. Exact day counts are SSOT parameters, not vendor defaults. |
| **Status** | Immediate |

#### OD-HEALTH — Health, readiness, liveness

| Field | Value |
|-------|-------|
| **Decision** | Platform exposes standard **`/health/live`** (process up) and **`/health/ready`** (critical deps + composed contributors). Hub endpoints (`/import-export/health`, `/backup-restore/health`, `/integrations/health`, …) remain and **register as contributors**. Flag-gated Centers report **`dormant`** when master flag OFF — **not** `down`. |
| **Also** | Root `/health` may alias ready semantics for orchestrators (document precisely in SSOT). |
| **Status** | Immediate |

#### OD-ALERTS — Alerting model

| Field | Value |
|-------|-------|
| **Decision** | Alert severities: `info` / `warning` / `critical`. Support threshold and absence-of-signal rules for MVP SLIs. Lifecycle: fire → notify → acknowledge → silence/resolve. Deduplicate and group to control fatigue. |
| **Not in Phase 45** | Full ITSM, paging vendor SoR, SOC playbook engine. |
| **Status** | Immediate |

#### OD-NOTIFY — Notification Center integration

| Field | Value |
|-------|-------|
| **Decision** | Alert fan-out uses Notification Center **intents** (email/in-app/webhook as configured). Observability does not own delivery SoR. Alert payloads must be PHI-safe summaries + deep links (correlation ids), not clinical content. |
| **Status** | Immediate |

#### OD-ACTIVITY — Activity Center integration

| Field | Value |
|-------|-------|
| **Decision** | Optional Activity emission for operator-visible Observability actions (e.g., alert acknowledged) and cross-link investigation via `correlationId`. No duplication of infra metrics into Activity timeline. |
| **Status** | Immediate |

#### OD-AUDIT — Audit Center integration

| Field | Value |
|-------|-------|
| **Decision** | Audit **required** for privileged Observability actions: cross-tenant view, export of telemetry, alert rule changes, retention/config changes, silence of critical alerts. Telemetry streams themselves are **not** Audit events. |
| **Status** | Immediate |

#### OD-STORAGE — Storage abstraction

| Field | Value |
|-------|-------|
| **Decision** | Define ports for metrics store, log store, trace store, alert state. Default **in-platform + exportable** adapters; external backends optional behind ports. |
| **Status** | Immediate |

#### OD-EXPORT — Export / scrape abstraction

| Field | Value |
|-------|-------|
| **Decision** | Platform **`/metrics`** (or versioned equivalent) for scrape/export; authenticated/network-restricted as ops policy. Rate-limiter skip for `/metrics` retained. No unbounded PHI in exported series. |
| **Status** | Immediate |

#### OD-FAILURE — Failure and backpressure

| Field | Value |
|-------|-------|
| **Decision** | **Clinical/business transactions continue** if Observability exporters, stores, or alert pipelines fail. Drop or shed load under backpressure (metrics/traces first; keep minimal local structured error logs). Health probes must still reflect dependency failure for **orchestration**, without blocking patient APIs. |
| **Durable** | Alert acknowledgements / silence state and Observability configuration are durable application data; raw high-volume telemetry is best-effort. |
| **Status** | Immediate |

#### OD-ACCESS — Access control and roles

| Field | Value |
|-------|-------|
| **Decision** | RBAC resource **`api.observability`** with actions at minimum: `read`, `manage` (rules/config), `export`, `acknowledge`, and platform-only `cross_tenant` (or equivalent elevated action). Least privilege. Tenant operators see own tenant only. |
| **Status** | Immediate |

#### OD-LICENSE — Licensing boundary

| Field | Value |
|-------|-------|
| **Decision** | Observability Center gated by Licensing (`allowObservability` or equivalent) **and** master feature flag. Missing license/flag → Center APIs/UI fail closed; platform `/health/live` remains available for orchestration. |
| **Status** | Immediate |

#### OD-FLAG — Feature flag behavior

| Field | Value |
|-------|-------|
| **Decision** | Master flag **`SYSTEM_MONITORING_OBSERVABILITY_ENABLED`** (name frozen for SSOT; alias documentation allowed). **Default OFF**. Sub-flags may gate tracing export, alerting, tenant dashboards. Enabling Observability must **not** flip IE/BR/Integrations flags. |
| **Status** | Immediate |

#### OD-OVERHEAD — Performance overhead limits

| Field | Value |
|-------|-------|
| **Decision** | Hot-path instrumentation must be asynchronous or O(1) local buffer; target negligible p99 impact under normal sampling. Hard rule: no synchronous remote export on request completion path. |
| **Status** | Immediate |

#### OD-QUEUE-OBS — Queue and job observability

| Field | Value |
|-------|-------|
| **Decision** | Standard signals per frozen queue: depth, age, throughput, fail/DLQ, worker liveness. Observe Notification, IE, Integrations, and reserved BR queues **without** merging queues. |
| **Status** | Immediate |

#### OD-API-OBS — API / authn / authz monitoring

| Field | Value |
|-------|-------|
| **Decision** | Monitor request rate, latency, error class, authn failures, authz denials, API-key rejects — with redaction (no raw keys, no tokens). |
| **Status** | Immediate |

#### OD-HUB-OBS — Hub domain monitoring

| Field | Value |
|-------|-------|
| **Decision** | First-class signal packs for: Integrations/webhooks/quotas, Backup & Restore, Import/Export, Notification delivery, Feature Flags/Licensing gate denials — **consume** existing hub contracts. |
| **Status** | Immediate |

#### OD-DB — Database and cache observability

| Field | Value |
|-------|-------|
| **Decision** | Connection pool saturation, query error rates, cache hit/miss and Redis health — **no** SQL text/bind parameters in telemetry by default. |
| **Status** | Immediate |

#### OD-DASHBOARD — Dashboard architecture

| Field | Value |
|-------|-------|
| **Decision** | Unified **Observability ops hub** in Settings (pattern parity with IE/BR/Integrations). Existing per-hub Health/Metrics pages **remain** and deep-link into platform views. Tenant-safe status page is optional, redacted, license/flag gated. |
| **Status** | Immediate |

#### OD-REPORT — Operational reporting

| Field | Value |
|-------|-------|
| **Decision** | Ops reports: availability, error budgets (MVP), top failing components, queue pressure, alert volume. Not Analytics SoR. |
| **Status** | Immediate |

#### OD-INCIDENT — Incident lifecycle boundary

| Field | Value |
|-------|-------|
| **Decision** | Phase 45 supports detect → triage → acknowledge → silence/resolve with correlation-assisted investigation. Full postmortem CMS, external ticketing SoR, and major-incident command are **out of scope**. |
| **Status** | Immediate |

#### OD-CONFIG — Configuration ownership

| Field | Value |
|-------|-------|
| **Decision** | Observability owns sampling rates, retention knobs, alert rules, dashboard definitions, contributor registration. Does not own clinical configuration or other Centers’ engine configs. |
| **Status** | Immediate |

#### OD-SECRETS — Secrets and credentials

| Field | Value |
|-------|-------|
| **Decision** | No secrets in telemetry. Exporter credentials via env refs (same pattern as Integrations secret refs). Scrubbers cover Authorization headers, `bk_`/`bki_` material, webhook signatures. |
| **Status** | Immediate |

#### OD-DEPLOY — Deployment topology

| Field | Value |
|-------|-------|
| **Decision** | Observability agents/exporters run sidecar-or-in-process with API workers; must scale horizontally with app instances. No single global mutable in-memory SoR for multi-node alert state without shared store (SSOT specifies store port). |
| **Status** | Immediate |

#### OD-DR — Disaster recovery

| Field | Value |
|-------|-------|
| **Decision** | Telemetry stores are **secondary**; clinical SoR and Audit/Activity restore paths remain authoritative. Observability config/alert state included in platform backup **only if** BR contracts allow without PHI risk — otherwise reconstructible. |
| **Status** | Immediate |

#### OD-PORTABILITY — Data portability / vendor lock-in

| Field | Value |
|-------|-------|
| **Decision** | Instrumentation and semantic conventions must remain exportable (OD-TELEMETRY + OD-EXPORT). Binding a single commercial APM as exclusive SoR is **forbidden** in Phase 45 architecture. |
| **Status** | Immediate |

#### OD-OWNERSHIP — Operational ownership

| Field | Value |
|-------|-------|
| **Decision** | Platform operators own platform-wide alerts; tenant admins may own tenant-scoped warnings where licensed. Security anomalies (credential stuffing, key abuse) are **signaled** to Observability and may escalate to Security/Audit processes — Observability is not SIEM SoR. |
| **Status** | Immediate |

#### OD-SLO — SLI / SLO MVP set

| Field | Value |
|-------|-------|
| **Decision** | MVP SLIs: API availability (success ratio), API latency (e.g. p95), dependency readiness, queue saturation, critical hub job failure rate. SLO targets parameterized per environment in SSOT. Advanced multi-window burn alerts **conditional** after MVP. |
| **Status** | Immediate |

#### OD-DATA-CLASS — Data classification

| Field | Value |
|-------|-------|
| **Decision** | Classes: `ops_public` (live/ready without tenant detail), `ops_tenant` (tenant-scoped telemetry), `ops_platform` (cross-tenant), `forbidden` (PHI/secrets). Access mapped to OD-ACCESS. |
| **Status** | Immediate |

#### OD-REDACTION — Redaction and masking

| Field | Value |
|-------|-------|
| **Decision** | Central redaction utility used by log/trace/error pipelines; reuse patterns from Integrations secret redaction where applicable. Mask to stable tokens for grouping without leaking content. |
| **Status** | Immediate |

### 7.2 Deferred — DEFERRED WITH EXPLICIT BOUNDARY

| ID | Boundary |
|----|----------|
| **OD-SYNTHETIC** | Synthetic journey monitoring **out of Phase 45 core**; may be Phase 45+ or later. Architecture must not block hooks. |
| **OD-SIEM** | Full SIEM/SOC, UEBA, threat intel — **out**. Auth anomaly **signals** only. |
| **OD-APM-VENDOR** | Commercial APM product rollout / exclusive vendor contract — **out** of architecture freeze; optional adapter later. |
| **OD-ONCALL** | External paging/on-call SoR — **out**; Notification intents cover in-product. |
| **OD-RUM** | Full frontend RUM/session replay — **out** of Phase 45 (privacy risk). |
| **OD-BURN** | Multi-window SLO burn-rate alerting — **deferred** after MVP SLIs. |
| **OD-BRANCH-OBS** | Fine-grained branch-level metric series — **deferred**; optional `branchId` on logs/traces OK with cardinality care. |
| **OD-TELEMETRY-BACKUP** | Dedicated backup of high-volume telemetry lakes — **deferred**; not clinical DR dependency. |

### 7.3 Conditional

| ID | Condition |
|----|-----------|
| **OD-EXT-BACKEND** | External metrics/log/trace backend adapters allowed **only** after PHI scrubber + tenancy filter + export auth review in sub-phase acceptance. |
| **OD-TENANT-STATUS** | Tenant-facing status page allowed **only** if redaction + license + flag sub-gate validated. |
| **OD-CROSS-EXPORT** | Cross-tenant telemetry export requires Audit event + `export` + `cross_tenant` (or equivalent) — enforced in acceptance tests. |

### 7.4 Rejected alternatives (summary)

| Rejected | Reason |
|----------|--------|
| Observability as Audit/Activity SoR | Violates frozen SSOTs |
| Fail-closed clinical APIs on telemetry failure | Patient availability risk |
| Unbounded per-user/per-URL metric labels | Cardinality / cost / DoS |
| Logging request/response bodies by default | PHI leakage |
| Full SIEM inside Phase 45 | Scope / security product boundary |
| Exclusive commercial APM as architecture SoR | Lock-in; weak governance |
| Workforce productivity surveillance dashboards | Explicitly out of healthcare ops ethics scope |
| Merging hub queues for “easier metrics” | Violates OD-QUEUE isolation from 41–44 |
| Enabling IE/BR/Integrations flags via Observability | Flag isolation |

---

## 8. Deferred Decisions

See §7.2. None of the deferred items block Architecture Freeze or later Phase 45a foundation — provided SSOT records the boundaries.

---

## 9. Rejected Alternatives

See §6 and §7.4. Critical rejections for freeze: Audit-as-APM, fail-closed clinical path, vendor-exclusive SoR, SIEM absorption, queue merging.

---

## 10. Security Review

| Threat | Safeguard | Fail behavior |
|--------|-----------|---------------|
| PHI leakage in logs/traces/errors | OD-PHI allowlist + scrubber | Drop/redact field |
| Secret leakage (keys, tokens, HMAC) | OD-SECRETS scrub patterns | Redact; never store raw |
| Sensitive metadata over-exposure | OD-DATA-CLASS + RBAC | Deny |
| Log injection | Structured fields; sanitize message; no raw user content concatenation into untyped blobs | Reject unsafe shapes |
| Cross-tenant leakage | OD-TENANCY query filters; Audit on cross-tenant | Fail closed on access |
| Unauthorized ops access | OD-ACCESS + OD-LICENSE + OD-FLAG | Fail closed |
| Excessive diagnostic detail | Sampling + redaction + admin debug time-box | Default deny verbose |
| Correlation-ID abuse | IDs non-authoritative for authz (OD-CORRELATION) | Ignore for privilege |
| Trace-context spoofing | Treat as observational; regenerate server-side when invalid | Safe default |
| Alert payload exposure | PHI-safe summaries only (OD-NOTIFY) | Strip |
| Retention risk | OD-RETENTION shorter than Audit; purge jobs | Enforce TTL |
| Export risk | OD-EXPORT auth + OD-AUDIT on export | Fail closed |
| Privilege escalation via ops roles | Least privilege actions; no `*` | Deny |
| Telemetry volume DoS | OD-SAMPLING, OD-CARDINALITY, backpressure shed (OD-FAILURE) | Drop telemetry, keep clinical |
| Cardinality attacks | Label allowlists; reject high-card labels | Drop series |

**Operational vs security monitoring:** Observability signals auth anomalies; **does not** replace Security/Audit investigation SoR (OD-SIEM deferred).

---

## 11. Multi-Tenant Review

| Topic | Decision |
|-------|----------|
| Default view | Tenant-scoped for tenant roles |
| Platform operators | Cross-tenant with elevated action + Audit |
| Aggregation | Coarse cross-tenant OK for platform; no peer leakage in tenant UI |
| Flag-dormant hubs | `dormant` status visible without implying outage |
| Branch | Optional context on events; fine metric series deferred (OD-BRANCH-OBS) |

---

## 12. PHI-Safety Review

| Rule | Status |
|------|--------|
| No PHI in metrics labels | **Required** |
| No PHI in log messages / attributes | **Required** |
| No PHI in span attributes | **Required** |
| No raw bodies on errors | **Required** |
| Investigation via Activity/Audit references | **Required** |
| Scrubber fail-closed on unknown sensitive keys | **Required** |

---

## 13. Scalability Review

| Concern | Architecture response |
|---------|----------------------|
| Tenant growth | Coarse metrics + tiered fine series (OD-CARDINALITY) |
| Horizontal API scale | Stateless instrumentation; shared alert/config store port (OD-DEPLOY) |
| Queue fan-out | Per-queue signals; no shared-queue redesign |
| Trace volume | Sampling (OD-SAMPLING) |
| Cost | Retention + sampling + cardinality budgets (OD-RETENTION, OD-CARDINALITY) |

---

## 14. Reliability Review

| Concern | Architecture response |
|---------|----------------------|
| Obs outage | Clinical continue (OD-FAILURE) |
| Partial telemetry loss | Accepted under shed; health still surfaces critical deps |
| Alert storms | Dedup/group/severity (OD-ALERTS) |
| Self-monitoring | Prefer minimal local logs + ready probe when exporters fail |
| DR | Telemetry secondary (OD-DR) |

---

## 15. Operational Review

| Question | Answer |
|----------|--------|
| Who owns alerts? | Platform ops for platform-wide; tenant admins for licensed tenant-scoped |
| Who acknowledges? | Roles with `acknowledge` on `api.observability` |
| Who views tenant telemetry? | Tenant-scoped `read` |
| Who views cross-tenant? | Elevated `cross_tenant` + Audit |
| False positives? | Silence + rule tune; documented runbooks in later ops docs |
| Alert fatigue? | Severity, dedup, grouping, SLO focus |
| If Observability fails? | Business continues; temporary blindness accepted |
| Droppable telemetry? | Metrics/traces under pressure; config/ack durable |
| Diagnostic vs auditable? | Telemetry diagnostic; privileged ops actions auditable |
| Phase 45 vs later? | See scope control §17 |

---

## 16. Integration Boundaries

| System | Phase 45 may | Phase 45 must not |
|--------|--------------|-------------------|
| Activity | Emit limited ops activities; deep-link | Become Activity SoR |
| Audit | Emit privileged action audits; deep-link | Store telemetry as audit evidence |
| Notification | Send alert intents; monitor delivery | Own Notification engine/queue |
| IE / BR / Integrations | Consume health/metrics | Redesign engines; flip their flags |
| Identity/RBAC/Licensing/Flags | Extend gates | Bypass deny-by-default |
| Analytics | Show operational SLIs only | Steal business KPI SoR |
| Workflow UI | Correlate by id | Replace workflow monitoring product |

---

## 17. Scope Control

### IN SCOPE for Phase 45

- Observability Center contracts, flags, license, RBAC  
- Correlation middleware and propagation  
- Metrics/log/trace semantic standards and scrubbing  
- Health aggregation (`live`/`ready` + hub contributors)  
- MVP SLIs/SLOs and alerting with acknowledge/silence  
- Notification intent integration for alerts  
- Activity/Audit integration boundaries  
- Queue/API/hub/auth signal packs  
- Unified Observability ops hub UI (parity with other Centers)  
- Export/scrape port (`/metrics`) and storage ports  
- PHI/tenancy/cardinality/sampling/failure policies  

### DEFERRED beyond Phase 45

- Synthetic monitoring (OD-SYNTHETIC)  
- Full SIEM/SOC (OD-SIEM)  
- Commercial APM vendor SoR (OD-APM-VENDOR)  
- External on-call SoR (OD-ONCALL)  
- Full RUM/session replay (OD-RUM)  
- Advanced burn-rate SLO alerting (OD-BURN)  
- Fine branch metric cardinality (OD-BRANCH-OBS)  
- Telemetry lake backup as DR pillar (OD-TELEMETRY-BACKUP)  
- Phase 46+ product functionality  

### REJECTED

- Audit/Activity absorption  
- Fail-closed clinical path on telemetry failure  
- Queue merging  
- Workforce surveillance dashboards  
- Exclusive vendor lock-in as architecture  

### CONDITIONAL

- External backends (OD-EXT-BACKEND)  
- Tenant status page (OD-TENANT-STATUS)  
- Cross-tenant export (OD-CROSS-EXPORT)  

---

## 18. Data Ownership

| Data | Owner |
|------|-------|
| Metric/log/trace streams | Observability (diagnostic) |
| Alert rules, silence, ack state | Observability |
| Hub engine health truth | Respective Centers (contributors) |
| Activity projections | Activity Center |
| Legal/compliance evidence | Audit Center |
| Notification delivery | Notification Center |
| Clinical SoR | Domain modules |

---

## 19. Access Model

- Resource: `api.observability`  
- Actions: `read`, `manage`, `export`, `acknowledge`, elevated cross-tenant  
- Gates: feature flag + license + RBAC  
- Tenant isolation default; platform elevation audited  

---

## 20. Failure Model

```
Request path ──► instrument (local, cheap) ──► async export
                      │
                      ├─ export fail / backpressure ──► DROP telemetry (continue business)
                      └─ scrub fail on sensitive ──► REDACT/DROP field (never emit PHI)

Orchestrator ──► /health/live|ready ──► may fail ready if critical deps down
                      (does not by itself take down already-accepted traffic logic)
```

---

## 21. Risk Register

| ID | Risk | Sev | Prob | Impact | Mitigation | Owner | Blocking? |
|----|------|-----|------|--------|------------|-------|-----------|
| R1 | PHI leak via errors | Critical | Med | Compliance breach | OD-PHI, OD-REDACTION | Observability | **No** (mitigated) |
| R2 | Cardinality explosion | High | Med | Cost/outage | OD-CARDINALITY | Observability | **No** |
| R3 | Hot-path latency | High | Med | Clinical UX | OD-OVERHEAD, OD-SAMPLING | Observability | **No** |
| R4 | Alert fatigue | Med | High | Missed real incidents | OD-ALERTS | Ops | **No** |
| R5 | Split-brain hub vs platform UI | Med | Med | Operator confusion | OD-DASHBOARD deep-links | Observability | **No** |
| R6 | Vendor lock-in pressure | Med | Med | Portability loss | OD-PORTABILITY, OD-STORAGE | Architecture | **No** |
| R7 | Mistaking telemetry for Audit | High | Med | Compliance error | OD-AUDIT boundary | Compliance | **No** |
| R8 | Obs outage blinds ops | Med | Med | MTTD↑ | OD-FAILURE + local logs + ready | Ops | **No** |
| R9 | Trace spoofing / ID abuse | Low | Low | Noise | OD-CORRELATION | Security | **No** |
| R10 | Scope creep into SIEM | High | Med | Delay Phase 45 | OD-SIEM deferred | Architecture | **No** |

**Blocking issues for approval:** **None.**

---

## 22. Blocking Issues

**None.** Architecture may proceed to freeze.

---

## 23. Required Follow-up

1. **Author and freeze** Architecture SSOT: `docs/SYSTEM_MONITORING_OBSERVABILITY_ARCHITECTURE.md` (or equivalent naming), incorporating this Decision Register.  
2. Record Decision Index from §25 in the SSOT.  
3. Define precise SLI formulas, retention day defaults, and flag/license key names in SSOT.  
4. Only then authorize Phase 45a foundation (contracts/flags/RBAC/health aggregation stubs) via execution planning — **not in this document**.  
5. Keep Releases 42–44 flags default OFF; do not enable as part of Observability work.  

---

## 24. Architecture Approval Checklist

| Gate | Result |
|------|--------|
| G1 Discovery complete and accepted | **PASS** |
| G2 Phase numbering = 45 Observability | **PASS** |
| G3 Phases 41–44 engines preserved | **PASS** |
| G4 Activity / Audit / Analytics boundaries explicit | **PASS** |
| G5 Critical ODs resolved | **PASS** |
| G6 Deferred ODs bounded | **PASS** |
| G7 PHI-safe + tenancy model defined | **PASS** |
| G8 Failure model protects clinical path | **PASS** |
| G9 Access / license / flag model defined | **PASS** |
| G10 Vendor lock-in controlled via ports | **PASS** |
| G11 SIEM/APM-vendor/synthetic scope controlled | **PASS** |
| G12 No implementation during review | **PASS** |
| G13 No blocking risks | **PASS** |

---

## 25. Proposed Decision Index (for future Architecture SSOT)

| ID | Title | Status |
|----|-------|--------|
| OD-BOUNDARY | Observability Center bounded context | APPROVED |
| OD-TELEMETRY | OpenTelemetry-compatible standard | APPROVED |
| OD-METRICS | Semantic metrics + allowlisted labels | APPROVED |
| OD-LOGGING | Structured JSON log contract | APPROVED |
| OD-TRACING | Distributed tracing + W3C-compatible propagation | APPROVED |
| OD-CORRELATION | Ingress correlation / causation | APPROVED |
| OD-TENANCY | Tenant attribution & isolation | APPROVED |
| OD-PHI | PHI-safe allowlist / fail-closed scrub | APPROVED |
| OD-CARDINALITY | Cardinality budgets / tiering | APPROVED |
| OD-SAMPLING | Trace/log sampling & volume | APPROVED |
| OD-RETENTION | Telemetry retention ownership | APPROVED |
| OD-HEALTH | live / ready / dormant hubs | APPROVED |
| OD-ALERTS | Severity + ack/silence | APPROVED |
| OD-NOTIFY | Notification intents for alerts | APPROVED |
| OD-ACTIVITY | Activity cross-link only | APPROVED |
| OD-AUDIT | Audit privileged ops only | APPROVED |
| OD-STORAGE | Metrics/log/trace/alert store ports | APPROVED |
| OD-EXPORT | `/metrics` export abstraction | APPROVED |
| OD-FAILURE | Fail-open clinical; shed telemetry | APPROVED |
| OD-ACCESS | `api.observability` RBAC | APPROVED |
| OD-LICENSE | License gate | APPROVED |
| OD-FLAG | `SYSTEM_MONITORING_OBSERVABILITY_ENABLED` default OFF | APPROVED |
| OD-OVERHEAD | Hot-path overhead limits | APPROVED |
| OD-QUEUE-OBS | Per-queue signals; no merge | APPROVED |
| OD-API-OBS | API/authn/authz signals | APPROVED |
| OD-HUB-OBS | IE/BR/Integrations/Notification packs | APPROVED |
| OD-DB | DB/cache without SQL PHI | APPROVED |
| OD-DASHBOARD | Unified ops hub + hub deep-links | APPROVED |
| OD-REPORT | Operational reporting (not Analytics) | APPROVED |
| OD-INCIDENT | Lightweight incident lifecycle | APPROVED |
| OD-CONFIG | Observability config ownership | APPROVED |
| OD-SECRETS | No secrets in telemetry | APPROVED |
| OD-DEPLOY | Horizontal scale; shared alert state port | APPROVED |
| OD-DR | Telemetry secondary to clinical/Audit | APPROVED |
| OD-PORTABILITY | No exclusive vendor SoR | APPROVED |
| OD-OWNERSHIP | Platform vs tenant alert ownership | APPROVED |
| OD-SLO | MVP SLI/SLO set | APPROVED |
| OD-DATA-CLASS | Ops data classification | APPROVED |
| OD-REDACTION | Central redaction utility | APPROVED |
| OD-SYNTHETIC | Synthetic monitoring | DEFERRED |
| OD-SIEM | Full SIEM/SOC | DEFERRED |
| OD-APM-VENDOR | Commercial APM SoR | DEFERRED |
| OD-ONCALL | External on-call SoR | DEFERRED |
| OD-RUM | Frontend RUM/replay | DEFERRED |
| OD-BURN | Burn-rate alerting | DEFERRED |
| OD-BRANCH-OBS | Fine branch metrics | DEFERRED |
| OD-TELEMETRY-BACKUP | Telemetry lake backup | DEFERRED |
| OD-EXT-BACKEND | External backends | CONDITIONAL |
| OD-TENANT-STATUS | Tenant status page | CONDITIONAL |
| OD-CROSS-EXPORT | Cross-tenant export | CONDITIONAL |

---

## 26. Final Verdict

| Confirmation | |
|--------------|--|
| Architecture status | **APPROVED** |
| Freeze status | **READY FOR ARCHITECTURE FREEZE** (SSOT not yet written) |
| Implementation | **NOT AUTHORIZED** |
| Approval date | **2026-07-18** |
| Feature flag (planned) | `SYSTEM_MONITORING_OBSERVABILITY_ENABLED` **default OFF** |
| Blocking issues | **None** |

**Authorized next step:** Produce and freeze the Phase 45 Architecture SSOT incorporating this Decision Register. Do **not** begin Phase 45a implementation or execution planning until that SSOT is **APPROVED AND FROZEN**.

---

# PASS — PHASE 45 ARCHITECTURE APPROVED

# READY FOR ARCHITECTURE FREEZE
