# Phase 40 — Patient Journey & Workflow Automation Architecture

**Phase:** 40 (Architecture APPROVED · **40a CLOSED** · **40b CLOSED** · **40c CLOSED** · **Phase 40 PERMANENTLY CLOSED**)  
**Status:** **ARCHITECTURE APPROVED** (2026-07-16) · Final Remediation **NOT REQUIRED** · Phase **40a CLOSED** (2026-07-16) · Phase **40b CLOSED** (2026-07-16) · Phase **40c CLOSED** (2026-07-16) · Phase **40d NOT STARTED** (optional advanced automation)  
**Prerequisite:** Phase 39 — Enterprise Audit Center (**permanently closed**, 2026-07-16); Dynamic Platform Phases **28–36** and **38–39** **frozen**; Phase **37** remains reserved (Department / franchise hardening — not started)  
**Authoring panel:** CTO · Principal Enterprise SaaS · Healthcare ERP · Clinical Ops · Platform · Backend · Frontend · Security · Compliance · DevOps  
**SSOT for:** All future Patient Journey & Workflow Automation implementation (40a/40b/40c closed / optional 40d), Marketplace journey packs, Plugin SDK pathway packs, care-pathway orchestration, clinic automation coordination

**Numbering note:** Earlier roadmap drafts labeled **Notification Center** or **Import/Export Center** as Phase 40. **This architecture permanently assigns Phase 40 to Patient Journey & Workflow Automation** — the first major **business feature** built on the completed Dynamic Platform. Notification Center and Import/Export remain roadmap candidates at later phase numbers. Phase **37** remains reserved for Department / franchise hardening — not started here.  
**Authority note:** This document is the permanent SSOT. Phase **40a Foundation CLOSED**. Phase **40b Runtime CLOSED**. Phase **40c Production CLOSED**. Phase **40 permanently closed**. Runtime authority = `EffectiveJourneyView`. `STATIC_JOURNEY_CATALOG_IS_RUNTIME_AUTHORITY = false`. Do **not** begin Phase 40d without explicit authorization. Do **not** redesign Phases 28–39.

---

## 1. Executive Summary

Phase 40 defines the **Patient Journey & Workflow Automation** layer — the **eleventh** registry consumer after navigation, routing, dashboard, search, reporting, analytics, white label, multi-branch, activity, and audit. It establishes a **patient-centric orchestration model** that spans the full clinic lifecycle — from lead through long-term care and re-activation — **without** replacing owning clinical, financial, or platform modules.

Patient Journey follows the proven catalog-as-baseline pattern from Phases 30–39:

```
Module Registry
  ↓
EffectiveModuleView (journey contributions)
  ↓
STATIC_JOURNEY_CATALOG (parity baseline; never runtime authority)
  ↓
EffectiveJourneyView (runtime configuration authority)
  ↓
JourneySnapshot
  ↓
DynamicJourneyProvider (40b — configuration & pathway discoverability)
  ↓
Existing domain runtimes + Workflow engine (execution remains owning modules)
```

### Purpose

Answer, for every authorized staff user and every patient:

> *Where is this patient in their clinic journey, what must happen next, what is blocked, and what may be automated — without widening permissions or inventing a second source of clinical truth?*

### Scope

| In scope (architecture) | Out of scope (this phase) |
|-------------------------|---------------------------|
| Patient lifecycle stages, transitions, guards | React / providers / hooks (40b) |
| Journey definitions, instances, milestones | Prisma / migrations (40b/40d) |
| Workflow engine contracts (definitions, states, timers, SLAs) | New REST APIs (40b) |
| Automation model & integration points | Playwright (40c) |
| Registry kind `journey` + static catalog design | AI model training / prompt redesign |
| Platform consumer integration (read-only contracts) | Lab / pharmacy / insurance product builds |
| Security, performance, marketplace, migration | Phase 37 department hierarchy |
| Technical debt inventory (honest) | Redesign of Phases 28–39 |

### Business value

- **Operational completeness:** One lifecycle spanning lead → care → billing → recall → re-activation.
- **Automation with safety:** Tasks, reminders, escalations, and SLAs coordinated through the existing Workflow module — fail-closed.
- **Platform coherence:** Consumes Licensing, Registry, Navigation, Routing, Dashboard, Search, Reporting, Analytics, White Label, Branch, Activity, and Audit — never replaces them.
- **Marketplace readiness:** Signed journey / pathway packs with namespaced `providerKey`.

### Explicit non-goals

| Patient Journey is **not** | Remains owned by |
|----------------------------|------------------|
| Patient demographics SoR | Patients module |
| Appointment / schedule SoR | Scheduling module |
| Queue ticket SoR | Queue module |
| Clinical chart / encounter SoR | EMR / Dental / Beauty modules |
| Invoice / payment SoR | Billing module |
| Inventory stock SoR | Inventory module |
| Notification delivery engine | Notifications module |
| Activity timeline | Activity Center (Phase 38) |
| Legal audit SoR | Audit Center (Phase 39) |
| Generic workflow executor replacement | Workflow module (`workflow` licensed module + existing `workflow` extension kind) |
| Licensing / RBAC engine | Phase 28 / identity |

### Relationship rule (Observe · Notify · Prove · Orchestrate · Execute)

| Layer | Verb | Phase / owner |
|-------|------|---------------|
| Activity Center | **Observes** | 38 |
| Notification Center | **Notifies** | Notifications module (roadmap) |
| Audit Center | **Proves** | 39 |
| Patient Journey | **Orchestrates** | 40 (this SSOT) |
| Workflow module | **Executes** automations / approvals / timers | Existing `workflow` module |

Journey **coordinates** domain mutations in owning modules and **may request** workflow instances.  
Activity **may reference** journey milestone IDs.  
Audit **must record** security-sensitive journey transitions.  
Notifications **may** be triggered by journey automation rules.  
**None replace each other.**

### Current state (evidence — 2026-07-16)

| Layer | State | Source |
|-------|-------|--------|
| Patients / Scheduling / Queue / EMR / Billing | Strong–partial modules | Prisma + Nest + clinic-dashboard features |
| Workflow center | Strong UI + partial automation | `modules/workflow`, FeatureGate, limited event triggers |
| Cross-module patient lifecycle orchestration | **Absent** | No journey instance / care-pathway SoR |
| Registry kind `journey` | **Not defined** | Extension catalog ends at `audit` (Phase 39) |
| Unified stage machine across lead→recall | **Absent** | Module handoffs are partial (see Current System Audit Part 8) |
| Lab / pharmacy / insurance | **Not started** | Blocks complete clinical loops |
| UX journey specs | Partial | `docs/USER_JOURNEYS.md` (UX only — not platform SSOT) |

---

## 2. Platform Position

### 2.1 First business feature on Dynamic Platform

Phases **28–36** and **38–39** delivered the **Dynamic Platform** (licensing, registry, and ten configuration consumers). Phase **40** is the first **vertical business orchestration** layer that:

1. Declares discoverable journey surfaces via the registry
2. Orchestrates existing clinical/financial modules
3. Reuses the Workflow module for execution mechanics
4. Projects to Activity / Audit / Notifications without owning them

### 2.2 Frozen platform — consumption only

| Platform capability | Journey consumption rule |
|---------------------|--------------------------|
| Licensing (28) | Journey surfaces gated by module + feature entitlements; never bypass |
| Registry (29) | `journey` contributions on EffectiveModuleView only |
| Navigation (30) | Journey nav items via `navigation` contributions owned by clinical modules |
| Routing (31) | Journey routes via `routing` contributions |
| Dashboard (32) | Journey widgets via `dashboard` contributions |
| Search (33) | Journey entities / deep links via `search` contributions |
| Reporting (33) | Journey operational reports via `reporting` contributions |
| Analytics (34) | Journey metrics via `analytics` contributions |
| White Label (35) | Chrome tokens only; clinical content brand-agnostic |
| Multi-Branch (36) | Active branch from DynamicBranchProvider; server enforces branch scope |
| Activity (38) | Optional activity cards for milestones; observe only |
| Audit (39) | Audit event types for journey mutations; prove only |

**Forbidden:** Redesigning any frozen consumer, widening EffectiveModuleView semantics, or embedding RBAC evaluation in the Journey UI.

### 2.3 Extension kind `journey` vs existing `workflow` kind

| Kind | Role | Runtime authority (future) |
|------|------|----------------------------|
| `workflow` (existing) | Trigger / action **registrations** for Workflow module automation catalog | Workflow module runtime |
| `journey` (**new**, Phase 40) | Pathway stages, transitions, milestone surfaces, journey hubs | `EffectiveJourneyView` |

**Do not collapse these kinds.** Journey packs may *reference* workflow template IDs; they do not replace `workflow` contributions.

---

## 3. Patient Lifecycle Model

### 3.1 Canonical stages (minimum set)

Frozen stage vocabulary for Phase 40a (IDs stable; labels i18n keys):

| # | `stageId` | Intent | Primary owning module(s) |
|---|-----------|--------|---------------------------|
| 1 | `lead` | Inbound interest; not yet a patient record | patients / CRM light |
| 2 | `prospect` | Qualified interest; outreach in progress | patients / notifications |
| 3 | `registration` | Demographics + consent captured | patients |
| 4 | `medical-history` | History / allergies / medications intake | emr / patients |
| 5 | `appointment` | Scheduled visit exists | scheduling |
| 6 | `check-in` | Arrived / checked in | scheduling / queue |
| 7 | `waiting-queue` | In waiting room | queue |
| 8 | `consultation` | Active clinical encounter | emr / dental / beauty |
| 9 | `diagnosis` | Assessment documented | emr / dental / beauty |
| 10 | `treatment-plan` | Plan authored / approved | dental / beauty / emr |
| 11 | `procedures` | Procedure execution | emr / dental / beauty |
| 12 | `laboratory` | Lab orders / results | future lab (gap) |
| 13 | `imaging` | Imaging orders / review | dental / media / future PACS |
| 14 | `prescription` | Rx issued | emr (pharmacy gap) |
| 15 | `billing` | Charges / invoice | billing |
| 16 | `payment` | Payment captured / partial | billing |
| 17 | `follow-up` | Planned follow-up visit | scheduling |
| 18 | `recall` | Preventive recall campaign | scheduling / notifications |
| 19 | `long-term-care` | Ongoing care program | emr / dental / beauty |
| 20 | `discharge` | Episode closed | emr / patients |
| 21 | `re-activation` | Returning patient episode | patients / scheduling |

**Cardinality:** A patient may have **multiple concurrent journey instances** (e.g., dental plan + beauty series + recall). Each instance has one **current stage** and a history of stage transitions.

### 3.2 Stage categories

| Category | Stages |
|----------|--------|
| Acquisition | lead, prospect, registration |
| Pre-visit | medical-history, appointment, check-in, waiting-queue |
| Clinical | consultation, diagnosis, treatment-plan, procedures, laboratory, imaging, prescription |
| Revenue | billing, payment |
| Continuity | follow-up, recall, long-term-care |
| Episode closure | discharge, re-activation |

### 3.3 Transition graph (canonical)

Transitions are **directed**. Guards (§5) may block. Compensating transitions exist for cancellations and no-shows.

```
lead → prospect → registration → medical-history → appointment
                                                      ↓
                              check-in ←──────────────┘
                                 ↓
                          waiting-queue
                                 ↓
                           consultation
                                 ↓
                             diagnosis
                                 ↓
                          treatment-plan ⇄ procedures
                                 ↓
                    laboratory / imaging / prescription  (parallel-capable)
                                 ↓
                              billing → payment
                                 ↓
                    follow-up / recall / long-term-care
                                 ↓
                             discharge
                                 ↓
                          re-activation → appointment (new episode)
```

### 3.4 Transition catalog (minimum)

| Transition ID | From | To | Trigger class | Typical actor |
|---------------|------|-----|---------------|---------------|
| `qualify-lead` | lead | prospect | manual / automation | Reception / marketing |
| `register-patient` | prospect | registration | domain event `patient.registered` | Reception / portal |
| `capture-history` | registration | medical-history | manual | Reception / nurse |
| `book-appointment` | medical-history \| re-activation \| follow-up | appointment | domain `appointment.created` | Reception / patient |
| `check-in-patient` | appointment | check-in | domain check-in | Reception / kiosk |
| `enqueue` | check-in | waiting-queue | domain queue enqueue | Reception / system |
| `start-consultation` | waiting-queue | consultation | domain encounter open | Doctor / dentist |
| `record-diagnosis` | consultation | diagnosis | clinical write | Clinician |
| `approve-plan` | diagnosis | treatment-plan | approval workflow | Clinician / patient consent |
| `execute-procedure` | treatment-plan | procedures | clinical write | Clinician |
| `order-lab` | diagnosis \| procedures | laboratory | clinical order | Clinician |
| `order-imaging` | diagnosis \| procedures | imaging | clinical order | Clinician |
| `issue-rx` | diagnosis \| procedures | prescription | clinical write | Clinician |
| `generate-invoice` | procedures \| consultation | billing | domain invoice | Billing / system |
| `collect-payment` | billing | payment | domain payment | Reception / accountant |
| `schedule-follow-up` | payment \| procedures | follow-up | scheduling | Reception / clinician |
| `enroll-recall` | discharge \| payment | recall | automation | System |
| `enter-ltc` | treatment-plan \| payment | long-term-care | manual | Clinician |
| `discharge-episode` | payment \| follow-up \| long-term-care | discharge | manual / automation | Clinician / GM |
| `reactivate` | discharge \| recall | re-activation | manual / automation | Reception |
| `cancel-appointment` | appointment \| check-in | (prior or discharge path) | cancel event | Reception |
| `mark-no-show` | appointment | (recall / re-activation policy) | automation / manual | System / Reception |

**Parallelism:** Laboratory, imaging, and prescription may be **active side-paths** while the primary stage remains `procedures` or `consultation`. Side-paths have their own milestone records; they do not invent a second primary stage without an explicit fork policy.

### 3.5 Journey instance identity

```typescript
interface JourneyInstanceIdentity {
  tenantId: string;
  branchId: string | null;      // active branch scope; null only if tenant-global grant
  patientId: string;
  journeyDefinitionId: string;  // e.g. dental-care-pathway@1.0.0
  journeyInstanceId: string;    // durable SoR id (40b+)
  episodeId?: string;           // optional link to encounter/plan episode
  providerKey: string;          // builtin | marketplace
}
```

---

## 4. Journey Configuration Model (Registry)

### 4.1 Contribution kinds inside `journey`

| `journeyKind` | Declares |
|---------------|----------|
| `stage` | Canonical or pack-specific stage metadata |
| `transition` | Allowed edge + default guards / required permissions |
| `definition` | Named pathway (e.g., general medical visit, dental plan, beauty series) |
| `milestone` | Checkpoint templates (forms, consents, tasks) |
| `surface` | UI hubs (journey board, patient strip, pathway builder) |
| `automationHook` | Links to workflow template / notification template IDs (references only) |
| `slaPolicy` | Named SLA budgets for stages/transitions |
| `pack` | Marketplace pack metadata |

### 4.2 Pipeline authority

| Layer | Authority |
|-------|-----------|
| Canonical vocabulary | Design-time SSOT (40a) |
| Manifest `journey` contributions | Module ownership |
| `STATIC_JOURNEY_CATALOG` | Parity / rollback baseline only |
| `STATIC_JOURNEY_CATALOG_IS_RUNTIME_AUTHORITY` | **false** (permanent) |
| `EffectiveJourneyView` | **Runtime configuration authority** (40b+) |
| Domain tables (Patient, Appointment, …) | **Business SoR** for clinical/financial facts |
| Journey instance store (40b+) | **Orchestration SoR** for stage + transition history |

### 4.3 EffectiveJourneyView (design)

```typescript
interface EffectiveJourneyView {
  identity: {
    tenantId: string;
    userId: string;
    branchId: string | null;
    rolesHash: string;
    entitlementVersion: string | null;
    catalogGeneration: number | null;
  };
  source: 'registry' | 'static-fallback' | 'static-only' | 'restricted';
  journeySnapshotVersion: string;
  providerKey: string;
  definitions: JourneyDefinitionView[];
  stages: JourneyStageView[];
  transitions: JourneyTransitionView[];
  surfaces: JourneySurfaceView[];
  automationHooks: JourneyAutomationHookView[];
  slaPolicies: JourneySlaPolicyView[];
  capabilities: JourneyCapabilities;
}
```

### 4.4 Aggregate capabilities (projected from snapshot only)

| Capability | Meaning |
|------------|---------|
| `canViewJourneyCenter` | See journey hub |
| `canViewPatientJourney` | See journey strip on patient |
| `canAdvanceJourney` | Trigger allowed transitions (still server-authorized) |
| `canOverrideJourney` | Break-glass / admin override (audited) |
| `canConfigurePathways` | Edit definitions (licensed + RBAC) |
| `canManageAutomations` | Bind automation hooks |
| `canViewCrossBranchJourney` | Cross-branch visibility when granted |
| `canExportJourneyTimeline` | Export configuration/timeline summaries |

**Rule:** Capabilities never widen beyond EffectiveModuleView ∩ server authorization. Restricted snapshot → all capabilities **false**.

---

## 5. Workflow Engine Architecture

Journey **orchestrates**; the Workflow module **executes**. Phase 40 specifies the **contract** Journey requires from Workflow — it does **not** redesign the Workflow module’s public API in this document beyond required capabilities.

### 5.1 Definitions

| Concept | Description |
|---------|-------------|
| Workflow definition | Versioned graph of steps owned by `workflow` module |
| Journey definition | Versioned patient pathway that **references** workflow definitions for approvals / tasks |
| Workflow instance | Running execution for a specific subject (patient, invoice, stock request, …) |
| Journey instance | Running patient pathway; may spawn zero or more workflow instances |

### 5.2 States (workflow instance)

Canonical operational states (align with existing Workflow center vocabulary where present):

| State | Meaning |
|-------|---------|
| `draft` | Definition not activated |
| `ready` | Waiting to start |
| `active` | In progress |
| `awaiting-approval` | Gate on human approval |
| `awaiting-timer` | Timer / SLA clock running |
| `awaiting-external` | External system / patient action |
| `escalated` | SLA breach or escalation rule fired |
| `completed` | Terminal success |
| `cancelled` | Terminal cancel |
| `failed` | Terminal failure after retries exhausted |
| `compensating` | Running compensating actions |

### 5.3 Transitions & guards

| Guard type | Examples |
|------------|----------|
| Permission guard | Actor has `resource` + `action` |
| License guard | Module / feature enabled |
| Branch guard | Subject branch ∈ actor accessible branches |
| Data guard | Required fields present (allergy list, consent, diagnosis code) |
| Clinical guard | Encounter open; plan approved |
| Financial guard | Invoice balance = 0 before discharge (policy) |
| Temporal guard | Not before appointment start − N minutes |
| Exclusive guard | No conflicting open journey stage |

**Fail closed:** Missing guard evaluation → transition denied.

### 5.4 Approvals

| Approval class | Use |
|----------------|-----|
| Clinical plan approval | Treatment plan consent |
| Financial write-off | Billing adjustments |
| Break-glass PHI | Temporary elevated access |
| Marketplace pack install | Platform / owner |
| Automation high-risk action | e.g., auto-cancel appointments |

Approvals reuse Workflow approval inbox; Journey records the **milestone** that required approval.

### 5.5 Escalations & SLAs

| Mechanism | Behavior |
|-----------|----------|
| Stage SLA | Max dwell time in stage (e.g., waiting-queue 30m) |
| Transition SLA | Max time to complete transition |
| Escalation chain | Role ladder (Reception → Nurse → Doctor → GM) |
| Breach action | Activity card + notification + optional workflow escalation (existing `WorkflowEscalationService`) |

### 5.6 Timers, reminders, retries

| Mechanism | Owner |
|-----------|-------|
| Appointment reminders | Scheduling + Notifications (existing debt) |
| Journey milestone timers | Workflow timers bound by journey hooks |
| Retry strategy | Exponential backoff; max attempts; dead-letter to monitoring |
| Failure handling | Mark workflow `failed`; journey stays fail-closed; compensating transition optional |

### 5.7 Automation rules

Automation rules bind:

```
trigger (domain event | journey transition | timer)
  → conditions (license, branch, stage, data)
  → actions (create task, notify, advance journey request, inventory reserve request, AI suggest)
```

**Critical rule:** Automation **requests** domain mutations through owning-module APIs / handlers. It never writes foreign SoR tables directly.

---

## 6. Automation Model

### 6.1 Automatic task creation

| Event | Task example | Assignee policy |
|-------|--------------|-----------------|
| `patient.registered` | Complete medical history | Reception / nurse pool |
| `appointment.created` | Confirm demographics | Reception |
| Check-in | Verify insurance / consent | Reception |
| Diagnosis recorded | Order labs if protocol | Clinician / nurse |
| Treatment plan approved | Schedule procedures | Reception |
| Invoice created | Collect payment | Reception / accountant |
| Payment received | Schedule follow-up | Reception |
| Discharge | Enroll recall | Automation |
| SLA breach waiting-queue | Escalate to GM | Escalation chain |

### 6.2 Reminders

| Reminder | Channel (existing / future) | Journey hook |
|----------|----------------------------|--------------|
| 24h / 1h appointment | SMS / WhatsApp / Email (notifications debt) | `appointment` stage |
| Incomplete history | In-app + push | `medical-history` |
| Outstanding balance | In-app + email | `billing` |
| Recall due | Campaign templates | `recall` |

### 6.3 Appointment automation

- Auto-suggest slots after plan approval
- Auto-cancel / waitlist promote on no-show (policy)
- Buffer enforcement remains Scheduling SoR

### 6.4 Billing automation

- Post-procedure charge suggestions (never silent finalize without policy)
- Partial payment → stay in `billing`/`payment` with milestone
- Write-offs require approval workflow

### 6.5 Inventory triggers

- Procedure start → material reservation request (Inventory owns stock)
- Insufficient stock → block procedure transition (guard) + task

### 6.6 Communication triggers

- Journey transitions emit **notification intents** (template keys) — Notifications module delivers
- Never store message bodies in Journey SoR

### 6.7 AI integration points (architecture only)

| Point | Allowed | Forbidden |
|-------|---------|-----------|
| Suggest next stage / checklist | Yes (advisory) | Auto-advance clinical stage without clinician confirm |
| Draft recall message | Yes | Send without template + channel policy |
| Risk score for no-show | Yes (analytics feature gated) | Bypass RBAC or branch |
| Chart summarization | EMR/AI module | Journey storing PHI summaries client-side |

### 6.8 External integrations

| Integration | Journey role |
|-------------|--------------|
| Lab LIS | Side-path `laboratory` milestones (future module) |
| Pharmacy | `prescription` fulfillment hooks (future) |
| Insurance | Eligibility guards at registration / billing (future) |
| Payment gateway | Billing module owns; journey observes payment events |
| WhatsApp / SMS providers | Notifications module owns |

---

## 7. Platform Integration Contracts

### 7.1 Activity Center (38)

| Journey emits | Activity consumes |
|---------------|-------------------|
| Milestone completed | Optional activity card (`canLinkToJourney`) |
| SLA breach | Operational activity in branch feed |
| Break-glass override | Security-visible activity if RBAC allows |

Journey **never** becomes the Activity timeline.

### 7.2 Audit Center (39)

| Journey mutation | Audit requirement |
|------------------|-------------------|
| Stage advance / override | Audit event (sensitive where PHI-adjacent) |
| Break-glass | Mandatory audit + reason |
| Pathway configuration change | Administration / configuration audit |
| Export journey timeline | Data-export audit class |

Journey **never** stores legal evidence; Audit SoR remains authoritative.

### 7.3 Dashboard (32)

Widgets (examples): patients in waiting-queue by stage, SLA breaches, journeys blocked on approval, today’s check-ins. Discovered via `dashboard` contributions; data from journey/read APIs (40b) + existing domain metrics.

### 7.4 Analytics (34)

Metrics (examples): stage dwell time, conversion lead→registration, no-show rate, pathway completion. Declared via `analytics` contributions; computation remains Analytics domain — Journey does not become a warehouse.

### 7.5 Reporting (33)

Operational reports: open journeys, SLA breaches, discharge summaries index. Via `reporting` contributions; queries authorized server-side.

### 7.6 Search (33)

Search entities: patient journey instance, pathway definition (config). Deep links to journey surfaces. No unrestricted PHI in search documents beyond existing patient search rules.

### 7.7 Navigation & Routing (30–31)

Surfaces: Journey Center, Patient Journey strip, Pathway settings. Owned primarily by `patients` / `settings` / specialty modules via navigation + routing contributions.

### 7.8 Branch (36)

- Journey instances are branch-scoped by default (`branchId`)
- Cross-branch visibility requires grant + capability
- Register consumer `'journey'` in branch refresh order **after** `'audit'` (40b)
- Unavailable branch → fail-closed restricted journey snapshot

### 7.9 White Label (35)

Apply shell chrome only. Clinical stage labels remain i18n keys; no brand-colored clinical severity encoding that implies medical meaning.

### 7.10 Licensing (28)

| Gate | Rule |
|------|------|
| Module | `patients` (+ specialty modules for specialty pathways) |
| Workflow execution | `workflow` module + `customWorkflows` / automation features as today |
| Journey center | Feature flag candidate `patientJourney` (named in 40a; enforced 40b) |
| Grace / suspended / expired | Shell fail-closed — no journey widen |

### 7.11 Mount order (40b design)

```
… → DynamicBranchProvider → DynamicWhiteLabelProvider
  → DynamicActivityProvider → DynamicAuditProvider
  → DynamicJourneyProvider → Registry routes
```

---

## 8. Security Model

### 8.1 RBAC

- Journey UI capabilities projected from snapshot only
- Every advance / override authorized on server with permission matrix resources (e.g., `api.patients`, `api.scheduling`, clinical resources)
- No client-side “if role === doctor” widen

### 8.2 Tenant isolation

- All journey identities include `tenantId`
- Resolver and future APIs fail closed on mismatch
- Marketplace packs cannot read cross-tenant instances

### 8.3 Branch isolation

- Default: actor sees journeys for accessible branches only
- Cross-branch: explicit grant + `canViewCrossBranchJourney`
- Phase 37 `departmentId`: nullable future-safe field on instance design — **not implemented** in Phase 40

### 8.4 PHI handling

| Rule | Detail |
|------|--------|
| Minimum necessary | Journey SoR stores stage, transition metadata, foreign keys — not full chart blobs |
| Redaction | Timeline exports follow Audit redaction policies when PHI included |
| Client cache | Configuration snapshots only — **no** unrestricted clinical payloads in `sessionStorage` |
| Portal | Patient-visible milestones only via patient-portal grants (future) |

### 8.5 Audit & Activity events

| Event class | Destination |
|-------------|-------------|
| Configuration change | Audit |
| Stage advance | Audit (+ optional Activity) |
| Automation fired | Workflow logs + optional Activity |
| Break-glass | Audit mandatory |

### 8.6 Approval flows

High-risk transitions (discharge with balance, break-glass, pathway publish) require Workflow approvals.

### 8.7 Break-glass access

| Property | Requirement |
|----------|-------------|
| Explicit reason | Required |
| Time-boxed | Required |
| Dual control | Policy-configurable |
| Audit | Mandatory |
| Activity | Security feed if permitted |
| Auto-revert | On expiry |

---

## 9. Performance Strategy

### 9.1 Caching

| Cache | Contents | Invalidation |
|-------|----------|--------------|
| Journey configuration cache | EffectiveJourneyView / Snapshot | Identity change, registry generation, branch switch, logout |
| Journey board projections | Paginated instance summaries | Soft TTL + event invalidation (40b) |
| Registry bootstrap | Existing module registry cache | Reuse — no bootstrap storms |

### 9.2 Pagination

- Journey boards: cursor pagination
- Transition history: bounded page size
- Never load full tenant journey set into browser

### 9.3 Search strategy

- Config search via registry contributions
- Instance search via server index / filters (patient, stage, branch, SLA state)
- Align with Phase 33 search RBAC

### 9.4 Offline considerations

| Surface | Offline stance |
|---------|----------------|
| Reception check-in | Optional local queue of intents; sync with conflict resolution (Scheduling/Queue own conflict) |
| Clinical charting | Existing EMR offline rules — Journey does not invent offline chart SoR |
| Pathway configuration | Online-only |

### 9.5 Enterprise & branch scaling

| Scale vector | Strategy |
|--------------|----------|
| Multi-branch | Partition by `branchId`; board queries always branch-scoped by default |
| High appointment volume | Async projection workers (40d if needed) |
| Automation spikes | Rate limits + Workflow executor backpressure |
| Marketplace packs | Lazy contribution load; signed bundles |

### 9.6 Performance budgets (targets for 40c)

| Budget | Target |
|--------|--------|
| Soft navigation registry bootstrap | Reuse cache; no storm |
| Journey provider rebuild on idle | Stable snapshot version |
| Board first paint (authorized) | Bounded query; skeleton OK |
| Rollback port | **5182** with `VITE_USE_STATIC_JOURNEY_ONLY=true` |

---

## 10. Marketplace Strategy

### 10.1 Journey packs

A journey pack ships:

- `providerKey` (namespaced)
- Stage / transition / definition / milestone / surface contributions (`kind: journey`)
- Optional references to workflow templates and notification templates
- Signed manifest integrity (registry §21)

### 10.2 Install without redesign

| Step | Platform mechanism |
|------|--------------------|
| Discover | Module catalog / marketplace ingress |
| Validate | Manifest completeness + journey integrity validators (40a) |
| Entitlement | Licensing feature gates |
| Activate | Tenant install lifecycle (existing) |
| Contribute | Appear on EffectiveModuleView |
| Rollback | Disable pack → contributions disappear; instances retain historical `providerKey` |

### 10.3 Uninstall policy

- Historical journey instances remain readable with provider metadata
- Active instances: block uninstall or force-migrate (policy)
- Never orphan PHI into pack storage

---

## 11. Migration Roadmap

### Phase 40a — Foundation (**CLOSED** — 2026-07-16)

**Scope completed:**

- Canonical journey categories (6), stages (21), transitions (22)
- Canonical guards (12), approvals (6), escalations (5), timers/SLAs (8) — vocabulary-only, fail-closed
- Canonical definitions (4), surfaces (4), automation hooks (10), packs (4) → **65** catalog entries
- Manifest builders + extension kind `journey` (`buildJourneyContributionsForModule`)
- `STATIC_JOURNEY_CATALOG` with `STATIC_JOURNEY_CATALOG_IS_RUNTIME_AUTHORITY = false`
- Fail-closed integrity + cross-package layer parity
- Zero runtime behavior change

**Evidence:** `@booking/module-registry` vitest **109/109**; clinic-dashboard `dynamic-journey` foundation vitest **16/16**

**Explicitly not included:** Provider, APIs, Prisma, storage, UI, Playwright, transition execution, automation execution

### Phase 40b — Runtime & Integration (**CLOSED** — 2026-07-16)

**Scope completed:**

- `DynamicJourneyProvider`, `useJourney()` / `useOptionalJourney()`
- `EffectiveJourneyView` / `JourneySnapshot` / identity-scoped configuration cache
- Branch refresh consumer `'journey'` (after `'audit'`)
- Mount after Audit in `RegistryRouteHost`
- `VITE_USE_STATIC_JOURNEY_ONLY` rollback flag (Playwright / port **5182** deferred to 40c)
- Configuration-source wiring for patient detail strip (`useOptionalJourney`) — no clinical redesign
- Zero business execution changes (no instances, transitions, guards, timers, automation jobs)

**Evidence:** clinic-dashboard `dynamic-journey` vitest **34/34** (foundation 16 + runtime 18); branch refresh contract includes `journey`

**Explicitly not included:** Playwright, port 5182 server, journey instance persistence, transition execution, automation execution, APIs, Prisma

### Phase 40c — Runtime Acceptance and Production Closure (**CLOSED** — 2026-07-16)

**Scope completed:**

- Playwright acceptance (`e2e/dynamic-journey.spec.ts` + `e2e/helpers/dynamic-journey.ts`)
- Rollback server on port **5182** (`VITE_USE_STATIC_JOURNEY_ONLY=true`)
- Role and licensing scenarios (Owner, GM, Doctor, Dentist, Receptionist, Accountant, Inventory Manager; Patient fail-closed bootstrap)
- Starter / Professional / Enterprise / Licensed; Grace / Suspended / Expired fail-closed shell
- Tenant and branch isolation; branch consumer `'journey'` synchronization
- Capabilities projected from JourneySnapshot only (no client RBAC widen)
- Cache and refresh (no patient journey records / PHI in browser storage)
- Security and performance verification (bounded bootstrap; no redirect loops; no rebuild storms)
- Existing UI continuity (Patient Detail, Scheduling, Queue, Dashboard, Reporting, Analytics) — configuration-source only
- Acceptance probes `__BOOKING_JOURNEY_RUNTIME__` / `__BOOKING_JOURNEY_ACTIONS__`
- SSOT production closure

**Evidence:** Playwright **37/37 passed**; clinic-dashboard `dynamic-journey` vitest **34/34**; `@booking/module-registry` vitest **109/109**

**Zero business execution changes.** Journey instances, transition execution, guards, automation, APIs, Prisma remain out of scope.

### Phase 40d — Advanced Automation (optional · **NOT STARTED**)

Authorize only if production requires:

- Projection workers for journey boards at massive scale
- Deep LIS / pharmacy / insurance adapters
- Advanced AI autonomous actions (still human-gated for clinical)
- Cross-enterprise franchise pathway packs (coordinates with Phase 37 when present)

Do **not** hide 40d work inside 40b/40c.

---

## 12. Architecture Risks

| Risk | Class | Mitigation |
|------|-------|------------|
| Dual SoR (journey vs clinical modules) | Critical | Journey stores orchestration metadata only; clinical facts stay in owning modules |
| Automation advances wrong clinical state | Critical | Guards + human confirm for clinical transitions; automation requests APIs |
| PHI leakage via journey cache/search | Critical | Config-only browser cache; server redaction; RBAC |
| Cross-tenant / cross-branch leakage | Critical | Identity on every view; fail-closed |
| Workflow engine overload | High | Backpressure, rate limits, LicensingExecutionGuard |
| Incomplete lab/pharmacy loops | High | Explicit side-path gaps; do not fake completion |
| Medical workflow risk (unsafe discharge) | High | Financial/clinical guards; approvals |
| AI hallucinated next steps | High | Advisory only; never silent clinical write |
| SLA alert fatigue | Medium | Tunable policies; severity tiers |
| Marketplace malicious pack | High | Signature, review workflow, sandbox entitlements |
| Phase numbering confusion (Notification as 40) | Medium | This SSOT’s numbering note is authoritative |
| Demo fallbacks masking journey failures | Critical (existing debt) | Must not rely on demo data in 40c acceptance |
| Partial event bus coverage | High | Expand triggers carefully; fail closed when missing |

---

## 13. Technical Debt Inventory (repository evidence — 2026-07-16)

### 13.1 What exists (verified)

| Artifact | Assessment |
|----------|------------|
| Patient / Appointment / QueueTicket / Encounter / TreatmentPlan / Invoice | Real domain SoRs |
| Workflow templates, tasks, approvals, automation rules, escalation | Real operational engine (partial triggers) |
| Domain events (patient.registered, appointment.*, invoice.*, payment.*) | Partial consumer coverage |
| Activity / Audit configuration platforms | Closed (38/39); execution/projectors partial |
| `docs/USER_JOURNEYS.md` | UX journeys — not orchestration SSOT |
| Registry `workflow` kind | Trigger/action registrations — not patient pathway |

### 13.2 What is missing (post-40c configuration closure)

| Gap | Notes |
|-----|-------|
| Journey instance persistence | No Prisma model — optional **40d** / future execution |
| Transition / guard / timer execution | Configuration only; no orchestration engine writes |
| Universal automation triggers | Listener covers limited events |
| Production SMS/WhatsApp/Email | Blocks reminder automation |
| Lab / pharmacy / insurance modules | Clinical loop incomplete |
| Demo data fallbacks in clinical UI | Critical residual debt (did not block 40c config acceptance) |
| Patient portal journey visibility | Portal partial |
| Department scope (Phase 37) | Reserved |

### 13.3 Must not be hidden

Future work for **40d** and adjacent roadmap (Notification Center, Import/Export, Lab) remains **explicitly deferred**. Configuration platform closure does **not** claim journey execution or those products are complete.

---

## 14. Cross-Consumer Coordination Summary

| Consumer | Coordination |
|----------|--------------|
| Licensing | Entitlements gate surfaces + workflow execution |
| Registry | `journey` contributions on EffectiveModuleView |
| Navigation / Routing | Discover hubs and deep links |
| Dashboard / Search / Reporting / Analytics | Projections only |
| White Label | Chrome only |
| Branch | Scope + refresh consumer |
| Activity | Optional observe cards |
| Audit | Mandatory prove for sensitive transitions |
| Workflow module | Execute tasks/approvals/timers |
| Notifications | Deliver intents |
| AI | Advisory integration points only |

---

## 15. Implementation Authority Boundaries

| Layer | Authority |
|-------|-----------|
| This SSOT | Architecture decisions for Phase 40 |
| Phase 40a | Vocabulary + catalog + validators only |
| Phase 40b | Provider + integration + minimal orchestration APIs/storage as required |
| Phase 40c | Runtime acceptance only |
| Phase 40d (optional) | Advanced automation / external clinical loops |
| Phases 28–39 | **Frozen** — consume only |
| Phase 37 | **Reserved** — design nullable-safe only |

---

## 16. Architecture Acceptance Gate

| Criterion | Status |
|-----------|--------|
| Patient lifecycle (21 stages) + transitions documented | **PASS** |
| Workflow engine contracts (states, guards, SLA, retry) | **PASS** |
| Automation model documented | **PASS** |
| Platform integration without redesign | **PASS** |
| Security (RBAC, branch, tenant, PHI, break-glass) | **PASS** |
| Performance / marketplace / roadmap 40a–40d | **PASS** |
| Risks + technical debt honest | **PASS** |
| Observe / Notify / Prove / Orchestrate / Execute separation | **PASS** |
| Static catalog non-authority explicit | **PASS** |
| Companions updated | **PASS** (Module Management, Current System Audit, Production Remediation) |
| Runtime code / APIs / Prisma / React / providers / tests in this phase | **NONE** (required) |
| Phase 40a foundation | **CLOSED** (2026-07-16) |
| Phase 40b runtime | **CLOSED** (2026-07-16) |
| Phase 40c production | **CLOSED** (2026-07-16) |
| Phase 40d | **NOT STARTED** (optional) |

**Architecture readiness:** **100%** (documentation gate)  
**Phase 40a foundation:** **100%**  
**Phase 40b runtime:** **100%**  
**Phase 40c production:** **100%**  
**Phase 40 configuration platform:** **100%** — **permanently closed**  
**Phase 40d:** **NOT STARTED** (optional)

---

## 17. Final Architecture Decision

**APPROVED** — Phase 40 Patient Journey & Workflow Automation Architecture is the permanent SSOT for the first major business feature on the Dynamic Platform.  
**Phase 40a Foundation CLOSED.**  
**Phase 40b Runtime CLOSED.**  
**Phase 40c Production CLOSED.**  
**Phase 40 permanently closed** (configuration platform).  
**Phase 40d remains optional and NOT STARTED.**

| Gate | Status |
|------|--------|
| Architecture | **APPROVED** |
| Remediation | **NOT REQUIRED** |
| Phase 40a | **CLOSED** |
| Phase 40b | **CLOSED** |
| Phase 40c | **CLOSED** |
| Phase 40 | **PERMANENTLY CLOSED** |
| Phase 40d | **NOT STARTED** (optional) |
| Phases 28–39 | **Frozen** |

Runtime authority: **EffectiveJourneyView**  
Static catalog authority: **STATIC_JOURNEY_CATALOG_IS_RUNTIME_AUTHORITY = false**  
Zero business execution changes.

Do **not** begin Phase 40d without explicit authorization.
