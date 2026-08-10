# Phase 45 — Architecture Discovery and Readiness Report

**Document type:** Architecture discovery & readiness  
**Date:** 2026-07-18  
**Capability:** System Monitoring & Observability  
**Dynamic Platform phase:** **45**  
**Companion strategy document (non-binding for Phase 45 design):** [`OBSERVABILITY.md`](./OBSERVABILITY.md)  
**Prior release baselines:** Release **43.0** (Backup & Restore) · Release **44.0** (API Keys & Integrations) — **PRODUCTION ACCEPTED**

| Constraint | Status |
|------------|--------|
| Production / application code changed during discovery | **No** |
| Migrations / modules / APIs / UI / schemas introduced | **No** |
| Final architecture designed | **No** (deferred to Architecture Review) |
| Technology selections frozen | **No** (must remain open for Review) |
| Phases 1–44 modified | **No** |

---

## 1. Executive Summary

After Production Acceptance of **API Keys & Integrations** (Phase **44** / Release **44.0**), the next Dynamic Platform capability is **System Monitoring & Observability**, permanently numbered **Phase 45**.

The Healthcare ERP has accumulated **fragmented but valuable** operational telemetry across Releases 41–44: per-hub public health probes, structured PHI-safe logs with `correlationId`, in-process and Redis queue counters, Activity/Audit observational emitters, and Settings-level Health pages for Import/Export, Backup & Restore, and Integrations. A strategy document ([`OBSERVABILITY.md`](./OBSERVABILITY.md)) already articulates enterprise goals (tenant-aware, privacy-safe, correlated telemetry). Product inventory lists “System Monitoring & Alerts” as a P1 infrastructure need. Dynamic Platform SSOTs explicitly defer an **APM / distributed tracing product** to Phase 45.

**What is missing** is a **unified Observability Platform**: end-to-end correlation across the request path, consistent SLI/SLO language, centralized health aggregation, alerting/escalation, incident investigation workflows, capacity and dependency views, and PHI-safe multi-tenant telemetry governance—without redesigning Activity Center, Audit Center, Notification Delivery, Import/Export, Backup & Restore, or API Keys & Integrations engines.

**Discovery conclusion:** The problem space, requirements, gaps, risks, and review questions are sufficiently understood to authorize Architecture Review. No blocking unknowns remain that would force premature implementation choices.

**Final readiness verdict:**

# READY FOR ARCHITECTURE REVIEW

---

## 2. Problem Statement

Operators, platform engineers, security, and compliance stakeholders cannot answer—at platform scale—questions such as:

- Is the **tenant-facing API** healthy right now, by tenant and by dependency?
- Why did **this booking / billing / sync** fail, end-to-end across services, queues, and integrations?
- Are **queues** (notification-delivery, import-export, integrations-webhooks, reserved backup-restore) saturating?
- Are **API keys, webhooks, backups, imports, notifications** failing silently or only locally logged?
- Are we approaching **capacity** limits (DB pools, Redis, workers, storage) before patients feel it?
- Can we investigate incidents **without PHI leakage** and with **tenant isolation** of telemetry?
- Do we meet **availability / latency / correctness** objectives, or are we flying blind?

Today, answers require stitching **per-module health endpoints**, Nest structured logs, Redis counters, and hub-specific Settings UIs. There is **no** platform Observability Center, no global ingress correlation middleware, no unified alert/escalation product, and no production APM/tracing product in code—despite strategy guidance and roadmap intent.

---

## 3. Business Goals

1. **Operational confidence** — Detect, diagnose, and resolve production issues before clinical operations are disrupted.  
2. **Tenant trust** — Provide transparent (but safe) operational status for multi-clinic deployments.  
3. **Compliance support** — Enable investigation and evidence workflows without turning Observability into an Audit SoR or PHI store.  
4. **Cost of ownership** — Reduce mean-time-to-detect (MTTD) and mean-time-to-resolve (MTTR) through correlated signals.  
5. **Scalable SaaS operations** — Support growth in tenants, branches, and modules without linear growth in blind spots.  
6. **Release quality** — Make flag-gated Centers (IE, BR, Integrations) operable under the same visibility model when enabled.

---

## 4. Technical Goals

1. Establish a **platform Observability capability** that consumes and normalizes signals from existing modules.  
2. Preserve **Activity Center** and **Audit Center** as separate systems of record (observability ≠ audit ≠ activity timeline).  
3. Unify **health / readiness / liveness** concepts for orchestration and human operators.  
4. Define requirements for **metrics, logs, traces, errors, and synthetic checks** as observability domains (not implementations).  
5. Enforce **PHI-safe, secret-safe, tenant-aware** telemetry by design.  
6. Support **alerting, escalation, dashboards, and operational reporting** as operator outcomes.  
7. Remain **compatible** with Releases 42–44 frozen engines and queue isolation rules.  
8. Leave **vendor/stack choices** to Architecture Review (strategy docs are inputs, not Phase 45 freezes).

---

## 5. Numbering Affirmation

| Claim | Authority |
|-------|-----------|
| Phase 43 = Backup & Restore | Release 43.0 + BR SSOTs |
| Phase 44 = API Keys & Integrations | Release 44.0 + Integrations SSOTs |
| Phase 45 = System Monitoring & Observability | This discovery; `CURRENT_SYSTEM_AUDIT_AND_EXPLANATION.md` row 45; Integrations SSOT defers “APM / distributed tracing product” to Phase 45 |
| Phase 37 | Remains reserved (Department/Franchise) |
| `FEATURE_INVENTORY.md` “System Monitoring & Alerts” | Product taxonomy — **does not override** Dynamic Platform numbering |

**Phase 45 is free** under Dynamic Platform numbering. No competing Phase 45 assignment was found.

---

## 6. Existing Platform Analysis

### 6.1 What already exists (foundation — not Phase 45 completion)

| Layer | Current state |
|-------|----------------|
| **Strategy** | [`OBSERVABILITY.md`](./OBSERVABILITY.md) — principles, structured logging fields, SLI examples, privacy stance; recommends open standards (non-binding for Review) |
| **Health probes** | Public readiness endpoints for Import/Export, Backup & Restore, Integrations; AI provider health; module-registry health; adapter-level `.health()` in Notification delivery |
| **Health contributor registries** | BR / Integrations define contributor IDs (often dormant / not live probes) |
| **Metrics hooks** | Redis `QueueMetricsService` (depth / processed / failed windows); in-process counters in BR & Integrations; metric **name catalogs** in contracts |
| **Structured logs** | Nest Logger objects with `kind`, `component`, `event`, `tenantId`, `correlationId` in Notification, IE, BR, Integrations |
| **Correlation** | Job/engine-level `correlationId`; **no** global HTTP request correlation middleware / context propagation found |
| **Tracing namespaces** | String namespaces reserved (`import_export`, `backup_restore`, `integrations`); **no** distributed tracing product in dependencies |
| **Activity / Audit emitters** | Modules emit observational events; Audit SSOT explicitly excludes APM |
| **Ops UI** | Per-hub Settings Health / Metrics pages (IE, BR, Integrations); **no** unified Observability dashboard |
| **Rate-limit reservations** | Paths `/health` and `/metrics` skipped by API rate limiter — imply future root probes / scrape surfaces |

### 6.2 Explicit non-goals of adjacent platforms

| Platform | Boundary relevant to Phase 45 |
|----------|-------------------------------|
| **Audit Center** | Not logging, not APM, not analytics; evidence of who did what |
| **Activity Center** | User/system activity timeline; correlation for sagas—not infra monitoring |
| **Analytics** | Business KPIs / clinical-business metrics—not ops telemetry SoR |
| **Workflow “monitoring” UI** | Business workflow execution—not platform Observability |
| **Notification / IE / BR / Integrations** | Own operational health; remain SoR for their engines |

### 6.3 Dependent Centers to integrate with (consume, do not redesign)

Identity · RBAC · Licensing · Dynamic Modules · Registry · Activity · Audit · Notification Delivery · Import/Export · Backup & Restore · API Keys & Integrations · Workflow Engine · Background Jobs · Feature Flags · Configuration · existing Health/Metrics hooks · Redis/queue infrastructure · Tenant policy.

---

## 7. Requirements Discovery

### 7.1 Overall observability goals

- Single coherent **operational picture** of platform health.  
- Ability to **correlate** a patient-impacting or tenant-impacting failure across API → auth → domain → queue → integration.  
- Signals that support **alerts**, **capacity planning**, **incident response**, and **post-incident review**.  
- Strict **signal-to-noise** control (cardinality, sampling, severity).

### 7.2 Operational visibility requirements

Operators need:

- Live **status** of hubs and critical dependencies.  
- Historical **trends** (latency, errors, queue depth, auth failures).  
- Drill-down from symptom → tenant → correlation ID → related Activity/Audit (by reference, not duplication of SoR).  
- Clear **dormant vs enabled** state for flag-gated Centers.

### 7.3 Healthcare-specific requirements

- **PHI-safe telemetry** — no clinical content, free-text notes, identifiers beyond approved operational IDs.  
- Support for **multi-clinic / branch** operational views without leaking cross-tenant data.  
- Alignment with **auditability** expectations (who investigated / who acknowledged alerts)—without replacing Audit Center.  
- Awareness of **clinical availability** impact (scheduling, EMR access, billing) as first-class user journeys.

### 7.4 Multi-tenant monitoring considerations

- Tenant-scoped views and alerts where required.  
- Cardinality control for per-tenant metrics (tiers / sampling).  
- Isolation of telemetry storage and access (RBAC + licensing).  
- No silent cross-tenant aggregation that exposes tenant-sensitive operational detail to peers.

---

## 8. Functional Requirements (discovery-level)

The Observability capability must eventually address (subject to Architecture Review prioritization):

### 8.1 Domain coverage (minimum)

| Domain | Discovery need |
|--------|----------------|
| Infrastructure | Host/runtime resource visibility (CPU, memory, disk, network)—as requirements, not tool picks |
| Application | Service health, exception rates, release health |
| API | Request rate, latency distributions, error classes, authn/authz outcomes |
| Integration | Outbound/inbound webhooks, provider adapters, gateway quotas |
| Background jobs / queues | Depth, age, throughput, failure/DLQ, worker liveness; respect queue isolation |
| Database / cache | Saturation, connection pools, slow operations (no PHI in samples) |
| Authentication / authorization | Login failures, permission denials, API-key rejects (redacted) |
| Feature flags / licensing | Flag state drift, license gate denials, dormant hubs |
| Scheduler | Scheduled job success/miss (where schedulers exist) |
| Storage | Artifact/backup/media storage health signals |
| Backup / Import-Export / Notification | Consume existing hub signals; do not duplicate engines |
| Audit / Activity | Cross-link for investigation; do not become SoR |
| Errors / exceptions | Capture, group, release association, correlation |
| Performance / availability / capacity | SLIs, saturation, dependency health |
| Distributed tracing | End-to-end causality across HTTP, queues, workers |
| Metrics / logs | Collection, retention, searchability, PHI scrubbing |
| Correlation IDs | Platform-wide propagation requirements |
| Health / readiness / liveness | K8s/orchestrator and human operator semantics |
| Synthetic monitoring | Proactive checks of critical journeys |
| SLA/SLO/SLI | Define measurable objectives; alert on burn |
| Alerting / escalation | Thresholds, routing, noise control, on-call |
| Dashboards / ops reporting | Platform + optional tenant-safe views |
| Incident / RCA workflows | Timeline assembly, correlation, postmortems |

### 8.2 Operator outcomes

- Detect → triage → diagnose → mitigate → verify → document.  
- Distinguish **platform-wide** vs **single-tenant** incidents.  
- Support controlled enablement of flag-gated Centers with observability parity.

---

## 9. Non-Functional Requirements

| NFR | Discovery statement |
|-----|---------------------|
| **Performance** | Telemetry path must not materially degrade clinical API latency under normal load; sampling/aggregation required. |
| **Scalability** | Must support growing tenants/modules without unbounded metric cardinality. |
| **Reliability** | Observability outage must not take down clinical SoR; fail-open vs fail-closed policy for telemetry exporters is a Review topic. |
| **Extensibility** | New Centers must register health/metrics/log conventions without redesigning the platform. |
| **Tenant isolation** | Telemetry access and storage must respect tenancy boundaries. |
| **Security** | Secrets, API keys, tokens, PHI redacted; least-privilege access to ops views. |
| **Maintainability** | Prefer conventions and contracts over one-off probes. |
| **Availability** | Critical health signals available even when feature Centers are dormant. |
| **Disaster recovery** | Observability must not be the only copy of Audit/Activity evidence; backup of telemetry optional/secondary. |
| **Operational simplicity** | Reduce tool sprawl; one operator mental model for hubs already shipping Health pages. |

---

## 10. Operational Requirements

- Runbooks for common alerts (queue saturation, auth spike, webhook DLQ, backup failure, IE job failure).  
- On-call escalation paths (Notification Center as delivery channel candidate—not designed here).  
- Change/release correlation (deploy markers).  
- Quiet hours / maintenance mode awareness (tenant policy already has maintenance concepts).  
- Flag-aware interpretation (dormant ≠ down).  
- Capacity reviews (weekly/monthly) using historical metrics.

---

## 11. Compliance Requirements

- Observability must **not** become a competing Audit log of record.  
- Retention and access for telemetry must be **policy-defined** (open for Review) and distinct from clinical retention where needed.  
- PHI/PII scrubbing is mandatory for logs and error payloads.  
- Investigations may **reference** Audit/Activity IDs without copying PHI.  
- Security monitoring (auth anomalies, API-key abuse) must align with Security SSOT without reinventing SIEM unless Review chooses otherwise.

---

## 12. Healthcare Considerations

- Clinical uptime journeys: scheduling, EMR access, billing capture, patient portal.  
- Branch/clinic operational ownership vs platform ownership of alerts.  
- Staff vs patient impact classification.  
- Avoid “surveillance” perception of productivity monitoring (FEATURE_INVENTORY critique)—Phase 45 is **system** observability, not workforce performance management.  
- Multi-tenant SaaS isolation for regulated data adjacent signals.

---

## 13. Observability Domains (taxonomy for Review)

Discovery groups the problem into domains. **This is not an architecture.**

1. **Signals** — metrics, logs, traces, errors, synthetics, health probes  
2. **Context** — tenant, branch, correlation, causation, release, flag, license  
3. **Aggregation** — platform health model, dependency graph, SLO burn  
4. **Action** — alert, escalate, acknowledge, silence, ticket  
5. **Presentation** — operator dashboards, optional tenant-safe status  
6. **Governance** — retention, access RBAC, PHI policy, cardinality budgets  

---

## 14. Dependency Analysis

| Dependency | Relationship to Phase 45 |
|------------|--------------------------|
| Identity / Auth | Source of authn failure signals; subject of monitoring |
| RBAC | Controls who sees ops telemetry; permission denials are signals |
| Licensing | Gate visibility of Observability product; license denials are signals |
| Feature Flags | Master/sub-flag state for Centers; Observability itself will need a flag |
| Module Registry | Module health / dependency lock reasons |
| Activity Center | Correlation for user-visible events; not SoR for infra |
| Audit Center | Security/compliance evidence; cross-link only |
| Notification | Alert delivery channel candidate; delivery health is a monitored domain |
| Background / Redis / BullMQ | Queue metrics foundation; queue isolation must be preserved |
| IE / BR / Integrations | Existing health + counters to consume |
| Workflow | Execution monitoring complementary, not replacement |
| Configuration / Tenant policy | Maintenance mode, advanced policy gates |
| Frontend (clinic-dashboard) | Operator UX eventual consumer; current hub Health pages are precursors |

---

## 15. Gap Analysis

| Gap | Impact |
|-----|--------|
| No unified Observability Center / APM product | Blind production (audit gap #27) |
| No global request correlation / context propagation | Hard RCA across modules |
| No distributed tracing product in code | Cross-queue causality weak |
| No Prometheus-style scrape / standardized metrics export | Hub counters trapped in Redis/memory |
| No centralized alerting/escalation product | Manual log watching |
| No platform SLO catalog | No burn-rate operations |
| No synthetic journey checks | Silent customer-path failures |
| Health contributors often dormant | Definitions ≠ live probes |
| BR queue reserved but unwired | Incomplete job telemetry for BR async story |
| Per-hub UI only | No single ops landing experience |
| Strategy vs implementation drift | `OBSERVABILITY.md` aspirational; code partial |

---

## 16. Constraints

1. **Do not redesign** Phases 41–44 engines or frozen queue names.  
2. **Do not replace** Activity or Audit as SoRs.  
3. **Do not store PHI** in observability pipelines.  
4. **Do not enable** Release 44.0 / 43.0 / 42.0 flags by default as part of Observability work.  
5. Product roadmap taxonomies do **not** override Dynamic Platform Phase **45** numbering.  
6. Architecture Review must resolve open questions before implementation sub-phases.  
7. Discovery must remain **technology-neutral**; existing strategy recommendations are **inputs**, not freezes.

---

## 17. Assumptions

1. Phase 45 remains the Dynamic Platform slot for System Monitoring & Observability / APM.  
2. Multi-tenant SaaS deployment continues as the primary operating model.  
3. Operators will use clinic-dashboard and/or platform admin surfaces for ops UX (exact surface TBD in Review).  
4. Existing hub health endpoints remain valuable signals to aggregate.  
5. Notification Center can eventually deliver alerts (contractual integration, not ownership transfer).  
6. Cardinality and cost control will be first-class design drivers in Review.

---

## 18. Risk Analysis

| Category | Risk | Discovery note |
|----------|------|----------------|
| **Technical** | Telemetry overhead degrades clinical latency | Sampling / async export required |
| **Technical** | Cardinality explosion (per-tenant metrics) | Tiering / aggregation |
| **Operational** | Alert fatigue | Severity model + SLO burn focus |
| **Operational** | Split-brain tools (hub Health vs platform APM) | Clear ownership boundaries |
| **Security** | PHI/secret leakage via errors/logs | Scrubbing gates; redaction libraries already exist in Integrations |
| **Security** | Over-privileged ops dashboards | RBAC resource for Observability |
| **Scalability** | Hot-path instrumentation | Prefer edge + worker instrumentation conventions |
| **Performance** | Synchronous metric writes on request path | Review must constrain |
| **Compliance** | Observability mistaken for Audit | Explicit SSOT boundary |
| **Future expansion** | Vendor lock-in if stack chosen too early | Keep Review technology-open |
| **Future expansion** | Overlap with Analytics / Workflow monitoring | Naming and scope discipline |

---

## 19. Success Criteria (for later Architecture / Acceptance)

Discovery-level success for **Architecture Review readiness** (this document):

1. Problem and goals clear.  
2. Numbering affirmed.  
3. Existing foundation inventoried without claiming Phase 45 progress.  
4. Domains, NFRs, risks, and open questions listed.  
5. Boundaries with Activity/Audit/Analytics/hubs explicit.  
6. No implementation or premature tech freeze.

Future Architecture / Production success (out of scope here) will require: approved SSOT, PHI-safe telemetry, correlation, hub aggregation, alerting, operator UX, and acceptance gates—with flag default OFF.

---

## 20. Open Questions (for Architecture Review)

These are **questions**, not decisions:

1. What is the **bounded context** name and RBAC resource for Observability?  
2. How do **liveness / readiness / startup** probes map to existing hub health endpoints?  
3. Should Observability own a **global correlation middleware**, or compose module conventions only?  
4. What is the **minimum SLI/SLO set** for MVP vs later phases?  
5. How are **tenant-facing** vs **platform-only** dashboards separated?  
6. What is the relationship to [`OBSERVABILITY.md`](./OBSERVABILITY.md) recommendations (adopt / adapt / replace)?  
7. How are **alerts** delivered (Notification intents vs external on-call)?  
8. What is the **retention** model for metrics/logs/traces vs Audit retention?  
9. How to handle **flag-dormant** Centers in aggregated health (exclude vs show dormant)?  
10. Is **synthetic monitoring** in MVP or deferred?  
11. How deep is **DB/cache** instrumentation without PHI risk?  
12. What is the **sub-phase roadmap** (foundation → signals → aggregation → alerting → UI → acceptance)?  
13. How does Observability interact with **Licensing** (ops SKU / `allow*` gates)?  
14. Should `/metrics` and `/health` root paths become platform standards (already rate-limit reserved)?  

---

## 21. Future Architecture Topics (explicitly deferred)

- Component diagrams and data flows  
- Technology stack selection  
- API contracts and schemas  
- Database / TSDB / log store models  
- Service/entity catalogs  
- Alert rule engines  
- Implementation phase plans and prompts  

---

## 22. Review Readiness Assessment

| Gate | Result |
|------|--------|
| Numbering clear (Phase 45 free) | **PASS** |
| Prior releases (43/44) accepted and frozen | **PASS** |
| Problem / goals articulated | **PASS** |
| Existing foundation inventoried | **PASS** |
| Functional & NFR discovery complete | **PASS** |
| Healthcare / PHI / tenancy considered | **PASS** |
| Dependencies & gaps identified | **PASS** |
| Risks identified | **PASS** |
| Open questions listed for Review | **PASS** |
| No architecture/tech freeze attempted | **PASS** |
| No code / APIs / schemas produced | **PASS** |

**Blocking issues:** None for starting Architecture Review.

---

## 23. Authorized Next Step

Conduct **Phase 45 Architecture Review and Approval** against this discovery. Produce a frozen Architecture SSOT only after resolving critical open decisions. Do **not** begin Phase 45a implementation until the architecture is **APPROVED AND FROZEN**.

---

## Document Control

| Field | Value |
|-------|-------|
| Discovery | **COMPLETE** |
| Architecture | **NOT STARTED** (Review pending) |
| Implementation | **NOT AUTHORIZED** |
| Feature flag | N/A until architecture defines Observability flag |

---

# READY FOR ARCHITECTURE REVIEW
