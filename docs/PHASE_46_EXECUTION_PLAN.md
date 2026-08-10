# Phase 46 — Execution Plan

**Document type:** Execution planning (implementation roadmap)  
**Date:** 2026-07-19  
**Capability:** Patient Portal (patient self-service experience)  
**Dynamic Platform phase:** **46**  
**Target release:** **Release 46.0** (master flag default OFF until Production Acceptance enablement)  
**Internal milestones:** **46a–46f** (execution subdivisions only — do not alter roadmap numbering)

| Authority | Status |
|-----------|--------|
| Discovery | [`PHASE_46_ARCHITECTURE_DISCOVERY_AND_READINESS.md`](./PHASE_46_ARCHITECTURE_DISCOVERY_AND_READINESS.md) — **PASS** |
| Architecture Review | [`PHASE_46_ARCHITECTURE_REVIEW_AND_APPROVAL.md`](./PHASE_46_ARCHITECTURE_REVIEW_AND_APPROVAL.md) — **PASS** |
| Architecture SSOT | [`PATIENT_PORTAL_ARCHITECTURE.md`](./PATIENT_PORTAL_ARCHITECTURE.md) — **APPROVED AND FROZEN** |
| This plan | Execution roadmap — **APPROVED** · does not modify architecture |
| Implementation | **46a COMPLETE (QG-A)** · **46b COMPLETE (QG-B)** · **46c COMPLETE (QG-C)** · **46d COMPLETE (QG-D)** · **46e COMPLETE (QG-E)** · **46f COMPLETE (QG-F)** · Release **46.0** packaged (flag default OFF) |

**Master feature flag:** `PATIENT_PORTAL_CENTER_ENABLED` — **default OFF** through all milestones and until controlled post-QG-F enablement.  
**RBAC resource:** `api.patient_portal` (additive permissions allowed only within OD-AUTH / OD-PORTAL-BOUNDARY)  
**License gates:** `patientPortal` · `caregiverAccess`  
**Frontend location (frozen intent):** `apps/patient-portal`  
**Backend BC:** `apps/api/src/modules/patient-portal` (extend foundation)

**Governance rules (frozen, non-negotiable):**

1. Do **not** reinterpret, weaken, extend, or replace Architecture Decisions (OD-*).  
2. Do **not** redesign Releases **41–45** or merge frozen queue engines.  
3. Do **not** duplicate Scheduling, EMR, Billing, Messaging, or Notification engines.  
4. Patient Portal remains a **consumer facade**, not a clinical System of Record.  
5. Patient session class **≠** staff session class.  
6. Enrollment must complete before PHI facades.  
7. Caregiver scope enforcement **before every** delegated PHI read.  
8. Flags default **OFF**; licensing fail-closed.  
9. Milestones are strictly sequential: **46a → 46b → 46c → 46d → 46e → 46f**.  
10. Scope changes require formal architecture change control.

---

# Executive Summary

This plan converts the frozen Patient Portal architecture (Option B) into six gated execution milestones that deliver Release **46.0** as an incremental, testable product behind `PATIENT_PORTAL_CENTER_ENABLED` default **OFF**.

**Release 46.0 MVP (execution scope):** dedicated patient web app · portal foundation · patient identity / enrollment / MFA / session security · appointment self-service via Scheduling SoR · caregiver grant lifecycle with mandatory scope enforcement · patient-safe profile facade · result-release **gate plumbing** · Notification / Audit / Activity / Observability / White Label consumption for in-MVP surfaces · staff portal-admin UX as required · production acceptance.

**Explicitly not in Release 46.0 milestones (remain deferred under same architecture):** messaging product slice · billing / payments product slice · documents product slice · clinical-results display product slice (beyond gate plumbing + optional later sub-flag) · native mobile · Marketplace packs · FHIR · telemedicine · PGHD · family accounts beyond grants · Option C big-bang.

Architecture Freeze alone does **not** authorize implementation. Approval of this plan authorizes **Phase 46a only**.

---

# Authoritative Inputs

| Document | Role |
|----------|------|
| [`PATIENT_PORTAL_ARCHITECTURE.md`](./PATIENT_PORTAL_ARCHITECTURE.md) | Architectural SSOT — immutable during execution |
| [`PHASE_46_ARCHITECTURE_REVIEW_AND_APPROVAL.md`](./PHASE_46_ARCHITECTURE_REVIEW_AND_APPROVAL.md) | Approved direction (Option B); MVP framing |
| [`PHASE_46_ARCHITECTURE_DISCOVERY_AND_READINESS.md`](./PHASE_46_ARCHITECTURE_DISCOVERY_AND_READINESS.md) | Discovery baseline / foundation inventory |
| Releases **41.0–45.0** Center SSOTs | Immutable integration constraints |
| Existing `patient-portal` module + Prisma `PortalAccount` / `CaregiverAccessGrant` | Foundation to extend, not replace |

**Frozen OD register (must be obeyed, not changed):**  
OD-PORTAL-BOUNDARY · OD-PORTAL-APP · OD-API · OD-AUTH · OD-ENROLLMENT · OD-MFA · OD-SESSION · OD-CAREGIVER · OD-PHI · OD-RESULTS · OD-MESSAGING · OD-BILLING · OD-PAYMENTS · OD-DOCUMENTS · OD-NOTIFY · OD-AUDIT · OD-ACTIVITY · OD-OBSERVABILITY · OD-WHITELABEL · OD-LICENSE · OD-FLAGS · OD-TENANCY · OD-BRANCH · OD-STORAGE · OD-PORTABILITY · OD-EXTENSIBILITY

---

# Frozen Architecture Constraints

| Constraint | Execution implication |
|------------|----------------------|
| Option B topology | Dedicated `apps/patient-portal` + extend API `patient-portal` BC |
| Consumer facade | Portal orchestrates; domains own SoRs |
| Portal-native storage only | Accounts, enrollment, grants, portal prefs/settings — no clinical/billing tables as SoR |
| API-first | Business rules in API; SPA is a client |
| Stateless backend | Standard Nest horizontal scaling |
| Public / application contracts only | No silent foreign-table SoR coupling |
| Session separation | Patient JWT/cookie/audience ≠ staff |
| Enrollment before PHI | Incomplete enrollment denies PHI facades |
| Caregiver before PHI | Grant + scope + expiry checked before delegated reads |
| Result-release | Gate enforced before any results response (when results slice exists) |
| Branch | Optional filter; never expands authorization |
| Flags | Master + sub-flags default OFF |
| License | `patientPortal` / `caregiverAccess` fail-closed |
| Releases 41–45 | Consume only — no redesign |

---

# Release Scope

## Release 46.0 — in scope (assigned to milestones)

| Theme | Milestone |
|-------|-----------|
| Dedicated patient web application shell | 46a |
| Workspace / build / deploy config | 46a |
| Master + approved sub-flag structure | 46a |
| Licensing + base RBAC + tenant/branch rules | 46a |
| White Label bootstrap + a11y/i18n/responsive baselines | 46a |
| Portal account lifecycle + enrollment | 46b |
| Patient session class + MFA + recovery | 46b |
| Appointment list / detail / book / reschedule / cancel | 46c |
| Scheduling facade (SoR unchanged) | 46c |
| Caregiver grants + per-request scope enforcement | 46d |
| Patient-safe profile facade (Patients SoR) | 46d |
| Result-release gate (enforce; display product deferred) | 46d |
| Portal home / settings / caregiver UI / staff admin UX | 46e |
| Notification / Audit / Activity / Observability integrations for MVP | 46e |
| Production acceptance / release packaging | 46f |

## Approved sub-flag structure (names may match repo convention at 46a; semantics frozen)

| Flag | Default | Unlocks |
|------|---------|---------|
| `PATIENT_PORTAL_CENTER_ENABLED` | **OFF** | Master product gate |
| `PATIENT_PORTAL_APPOINTMENTS_ENABLED` | **OFF** | Appointment self-service |
| `PATIENT_PORTAL_CAREGIVER_ENABLED` | **OFF** | Caregiver delegation surfaces |
| `PATIENT_PORTAL_PROFILE_ENABLED` | **OFF** | Patient-safe profile facade |
| `PATIENT_PORTAL_RECORDS_ENABLED` | **OFF** | Future clinical-results slice (not Release 46.0 product) |
| `PATIENT_PORTAL_MESSAGING_ENABLED` | **OFF** | Future messaging slice (deferred) |
| `PATIENT_PORTAL_BILLING_ENABLED` | **OFF** | Future billing slice (deferred) |
| `PATIENT_PORTAL_PAYMENTS_ENABLED` | **OFF** | Future payments slice (deferred) |
| `PATIENT_PORTAL_DOCUMENTS_ENABLED` | **OFF** | Future documents slice (deferred) |

Sub-flags for deferred domains may be **registered in 46a** as dark structure only; **no implementation** of those domains in 46a–46f.

---

# Deferred Scope

Do **not** assign to 46a–46f implementation:

- Native mobile applications  
- Marketplace portal packs  
- FHIR exposure  
- Advanced messaging / messaging product slice  
- Telemedicine  
- Billing / payments product slices (beyond architecture readiness)  
- Patient-generated health data  
- Family-account expansion beyond caregiver grants  
- Advanced documents / e-sign workflows / documents product slice  
- Clinical-results **display** product (gate plumbing only in 46d)  
- Full multi-domain big-bang  
- Any redesign of Releases 41–45  

Deferred items cannot enter implementation via “corrective work” in 46f.

---

# Execution Strategy

1. **Foundation first** — dedicated app + gates without PHI (46a).  
2. **Identity before data** — enrollment/session/MFA before any self-service PHI (46b).  
3. **First vertical slice** — appointments via Scheduling SoR (46c).  
4. **Delegation hardening** — caregiver enforcement + safe profile before broader data (46d).  
5. **Release experience** — UX polish + cross-cutting integrations for MVP only (46e).  
6. **Accept, do not build** — 46f evidence only.

**No parallelization across milestones** that would bypass security, enrollment, session, caregiver, contract, or tenant prerequisites. Limited parallelization **within** a milestone (docs, tests, UI/API after contracts exist) is allowed.

---

# Milestone Sequence

```
46a Portal Foundation & Dedicated Application
  → QG-A
46b Patient Identity, Enrollment & Session Security
  → QG-B
46c Appointments & Scheduling Self-Service
  → QG-C
46d Caregiver Delegation & Patient-Safe Data Access
  → QG-D
46e Portal Experience & Cross-Cutting Integrations
  → QG-E
46f Production Acceptance
  → QG-F → Release 46.0 packaging (flag still default OFF)
```

A later milestone **must not begin** until the preceding quality gate **passes**.

---

# Phase 46a — Portal Foundation & Dedicated Application

### Purpose
Establish the dedicated patient application and portal governance skeleton **without** PHI reads or clinical/financial workflows.

### Objectives
- Create `apps/patient-portal` integrated into monorepo build/deploy.  
- Harden `patient-portal` backend module registration, flags, license, RBAC, tenant/branch rules.  
- Define public API namespace / versioning / patient-safe errors.  
- Bootstrap White Label, a11y, i18n, responsive, security headers.  
- Prove null/disabled behavior when flag or license is OFF.

### Workstreams

| Workstream | Deliverables |
|------------|--------------|
| Frontend/application | App scaffold, routing shell, config, API client boundary, disabled-state UX |
| Backend/domain | Module hardening, flag/license/RBAC wiring, tenant resolution hooks |
| API/contracts | Public namespace convention, versioning policy, error contract shape |
| White Label | Branding token bootstrap (consumer only) |
| Accessibility | Baseline landmarks, focus, contrast targets for shell |
| Localization | Locale plumbing / readiness (strings may be English-first) |
| Observability | Foundation spans/metrics hooks for portal module (PHI-safe; dormant when OFF) |
| Testing | Harnesses, flag-OFF tests, license deny tests, tenant context tests |
| Documentation | Foundation doc / ADRs for app path only (not OD changes) |
| Deployment/operations | Env config, build pipeline, security headers, health dormant semantics |

### In scope
- Dedicated patient web application  
- Workspace and build integration  
- Frontend routing shell and configuration  
- API client boundary  
- Portal backend module hardening  
- Public API namespace and versioning  
- Patient-safe error contracts  
- Master feature flag + approved sub-flag **structure**  
- Licensing integration  
- Base RBAC and permission alignment  
- Tenant resolution  
- Branch context rules (non-expansion)  
- White Label bootstrap  
- Accessibility baseline  
- Localization readiness  
- Responsive layout baseline  
- Frontend security headers  
- Deployment and environment configuration  
- Foundation observability  
- Null and disabled-state behavior  
- Test harnesses  
- Foundation documentation  

### Explicitly out of scope
- PHI reads  
- Appointment workflows  
- Clinical records / results display  
- Messaging, billing, payments, documents  
- Enrollment completion product (may stub routes that 401/403)  
- Caregiver grant enforcement product  

### Schema
- **No required migrations** in 46a unless module registration demands config-only changes.  
- Do **not** authorize schema changes in planning; assess in Data Plan — execute only if 46a implementation proves necessity and change control allows additive non-PHI metadata.

### Exit intent
QG-A ready: dedicated app builds; flags OFF; license/RBAC fail-closed; no PHI surfaces live.

---

# Quality Gate QG-A

**Name:** Portal Foundation Ready  
**Authorizes:** Phase **46b** only

| Dimension | Requirement |
|-----------|-------------|
| **Entry criteria** | This execution plan approved; frozen SSOT unchanged; Releases 41–45 untouched |
| **Deliverables** | `apps/patient-portal` builds; portal module gated; flag registry; foundation docs |
| **Automated tests** | Unit/integration: flag OFF denies; license deny; RBAC deny; tenant context required |
| **Security tests** | No staff-session acceptance on patient app client paths; security headers present in app config |
| **Integration tests** | White Label bootstrap resolves or degrades safely; Observability dormant when flag OFF |
| **Documentation** | Foundation / topology / flag matrix documented |
| **Pass conditions** | All above green; **zero** PHI/appointment/clinical endpoints newly exposed as live product |
| **Blocking conditions** | Missing dedicated app; flag default ON; license bypass; architecture OD change; PHI introduced |
| **Next milestone** | **46b** authorized only on PASS |

---

# Phase 46b — Patient Identity, Enrollment & Session Security

### Purpose
Deliver patient portal identity, enrollment, MFA, and session lifecycle with strict separation from staff sessions.

### Objectives
- Complete portal account lifecycle to ACTIVE.  
- Patient-specific session class.  
- MFA per policy; password setup/reset; recovery.  
- Rate limit / brute-force / lockout.  
- Audit (+ Activity where permitted) for enrollment; PHI-safe auth observability.

### Workstreams

| Workstream | Deliverables |
|------------|--------------|
| Authentication/security | Session class, MFA, reset, rate limits, lockout, CSRF/cookie strategy |
| Backend/domain | Enrollment state machine; identity match boundaries; revoke paths |
| API/contracts | Auth/enrollment public APIs; idempotent verify where needed |
| Data/storage | Assess PortalAccount / enrollment fields (see Data Plan) |
| Frontend/application | Enroll / login / MFA / reset UX in patient app |
| Integration | Notification intents for invite/verify; Audit emitters |
| Observability | Auth metrics/traces without credentials or PHI |
| Testing | Enrollment, MFA, session separation, rate-limit, enumeration resistance |
| Documentation | Identity & enrollment security doc |

### In scope
- Portal account lifecycle  
- Enrollment initiation / verification / completion  
- Invitation or activation flows  
- Patient identity matching boundaries  
- Authentication integration  
- Patient-specific session class  
- Strict separation from staff sessions  
- MFA policy and flows  
- Password setup and reset  
- Account recovery  
- Session create / renew / expire / logout / revoke  
- Device/session metadata where Auth patterns already approve  
- Rate limiting, brute-force, lockout/challenge  
- Consent capture where frozen  
- Enrollment Audit (+ Activity if non-PHI permitted)  
- PHI-safe authentication observability  
- Licensing and feature-flag enforcement  
- Security tests + identity documentation  

### Explicitly out of scope
- Appointment functionality  
- Delegated caregiver PHI access  
- Clinical / messaging / billing / documents  

### Prerequisite rule
**No appointment or delegated PHI access may be implemented before QG-B passes.**

### Exit intent
Only ACTIVE enrolled patients with valid patient sessions can proceed to 46c facades.

---

# Quality Gate QG-B

**Name:** Identity & Enrollment Security Ready  
**Authorizes:** Phase **46c** only

| Dimension | Requirement |
|-----------|-------------|
| **Entry criteria** | QG-A PASS |
| **Deliverables** | Enrollment to ACTIVE; patient session class; MFA; revoke; staff admin invite path as required |
| **Automated tests** | Unit/API: invite→verify→activate; incomplete enrollment denies; logout/revoke |
| **Security tests** | Staff JWT rejected on patient APIs; patient JWT rejected on staff APIs; rate-limit; enumeration-safe errors; session fixation defenses; MFA policy paths |
| **Integration tests** | Notification invite intent; Audit enrollment events; license/flag fail-closed |
| **Documentation** | Enrollment/session/MFA runbook |
| **Pass conditions** | PHI facades remain closed to non-ACTIVE; session separation proven |
| **Blocking conditions** | Shared staff/patient session; enrollment bypass; MFA engine fork; secrets in logs |
| **Next milestone** | **46c** authorized only on PASS |

---

# Phase 46c — Appointments & Scheduling Self-Service

### Purpose
Deliver the approved MVP scheduling vertical slice as a **facade** over Scheduling SoR.

### Objectives
- Patient appointment list/detail/book/reschedule/cancel.  
- Availability via Scheduling contracts.  
- Branch filter without auth expansion.  
- Notification intents; Audit/Activity where required; Observability.  
- Sub-flag `PATIENT_PORTAL_APPOINTMENTS_ENABLED` (default OFF).

### Workstreams

| Workstream | Deliverables |
|------------|--------------|
| Backend/domain | Scheduling facade handlers; ownership validation; policy enforcement |
| API/contracts | Appointment public APIs; idempotency keys where booking requires |
| Frontend/application | Appointment UX in patient app |
| Integration | Notification intents; Activity/Audit cross-links |
| Observability | Booking latency/error metrics; traces |
| Accessibility / Localization | Date/time a11y + locale formatting |
| Testing | Workflow, concurrency/stale-slot, ownership, tenant, flag tests |
| Documentation | Appointment workflow doc |

### In scope
- Patient appointment list and detail  
- Booking availability  
- Branch filtering (non-expansion)  
- Book / reschedule / cancel  
- Scheduling policy + booking eligibility  
- Patient ownership validation  
- Scheduling facade contracts  
- Idempotency where required  
- Concurrency and stale-slot behavior  
- Timezone handling  
- Localization of appointment dates/times  
- Notification intents  
- Activity cross-links where approved  
- Audit for privileged/consent-sensitive actions  
- Metrics, logs, traces, health contributors  
- Feature flags + licensing  
- API/UI/a11y tests  
- Appointment workflow documentation  

### Explicitly out of scope
- Duplicating availability/booking/reschedule/cancel **engines**  
- Caregiver delegated booking (unless grant scope `appointments` already enforced — prefer self-only in 46c; caregiver acting context may land in 46d)  
- Clinical records, messaging, billing  

### SoR rule
**Scheduling remains the sole System of Record.**

### Exit intent
Self-service appointments work for ACTIVE self patients behind flags; no engine duplication.

---

# Quality Gate QG-C

**Name:** Scheduling Self-Service Ready  
**Authorizes:** Phase **46d** only  
**Result:** **PASS** (Phase 46c complete)

| Dimension | Requirement |
|-----------|-------------|
| **Entry criteria** | QG-B PASS |
| **Deliverables** | Facade APIs + UI for list/detail/book/reschedule/cancel; notifications wired |
| **Automated tests** | API/UI workflow tests; ownership; tenant isolation; flag OFF deny |
| **Security tests** | IDOR prevention (other patient appointments); branch non-expansion |
| **Integration tests** | Scheduling contract consumption; Notification intents; no duplicate engine |
| **Documentation** | Appointment workflow + facade boundary doc |
| **Pass conditions** | All workflows green; Scheduling SoR unchanged; concurrency/stale-slot handled |
| **Blocking conditions** | Portal-owned slot engine; cross-patient access; flag default ON |
| **Next milestone** | **46d** authorized only on PASS |

---

# Phase 46d — Caregiver Delegation & Patient-Safe Data Access

### Purpose
Deliver caregiver grant lifecycle with **mandatory per-request scope enforcement**, plus patient-safe profile facade and result-release **gate**.

### Objectives
- Distinguish self vs caregiver acting context vs staff vs platform admin.  
- Roles alone are **never** sufficient for caregiver PHI.  
- Profile via Patients SoR.  
- Result-release gate enforced (results **display product** remains deferred / sub-flag OFF).

### Access model (frozen distinctions)

| Actor | Authorization basis |
|-------|---------------------|
| **Self** | ACTIVE `PortalAccount` linked to patient + session class |
| **Caregiver** | ACTIVE account **plus** active `CaregiverAccessGrant` with required scope, non-expired, tenant match — evaluated **per request before PHI** |
| **Staff** | Clinic RBAC on **admin** APIs only (not patient app session) |
| **Platform admin** | Existing platform roles — not patient PHI via portal patient APIs |

### Workstreams

| Workstream | Deliverables |
|------------|--------------|
| Backend/domain | Grant lifecycle; scope evaluator; acting-context resolver |
| API/contracts | Caregiver APIs; profile facade; acting-patient headers/params convention |
| Authentication/security | Negative auth matrix; revoked/expired/scope tests |
| Frontend/application | Caregiver context switcher; grant management (patient/staff as required) |
| Data/storage | Assess CaregiverAccessGrant / consent fields |
| Integration | Audit grant CRUD; Notification invite/accept; Activity non-PHI |
| Observability | Authz deny metrics without PHI |
| Testing | Cross-tenant, IDOR, revoked, expired, scope-boundary suites |
| Documentation | Caregiver authorization model |

### In scope
- Caregiver identity linkage  
- Grant lifecycle: invite/accept/activate/expire/revoke  
- Consent representation  
- Explicit scope model  
- Per-request delegated-access evaluation  
- Patient vs caregiver acting context  
- Caregiver scope enforcement before every delegated PHI read  
- Tenant isolation  
- Branch non-expansion  
- Safe patient profile facade  
- Approved patient-safe data views (profile-level)  
- Result-release gate enforcement (plumbing)  
- Minimal clinical-result access **only if** later authorized — **not** Release 46.0 product default  
- Safe document metadata/retrieval **only if** permitted — **deferred for 46.0**  
- Audit / Activity / Notification as applicable  
- PHI-safe observability  
- Negative authorization, cross-tenant, revoked, expired, scope-boundary tests  
- Caregiver documentation  

### Explicitly out of scope for Release 46.0 product
- Messaging / billing / payments / documents product APIs  
- Clinical-results **display** UI/API (gate may exist; `PATIENT_PORTAL_RECORDS_ENABLED` stays OFF and unimplemented as product)  

### Exit intent
Delegated access is fail-closed and test-proven; profile safe; results gate ready without shipping results product.

---

# Quality Gate QG-D

**Name:** Caregiver & Patient-Safe Access Ready  
**Authorizes:** Phase **46e** only  
**Result:** **PASS** (Phase 46d complete)

| Dimension | Requirement |
|-----------|-------------|
| **Entry criteria** | QG-C PASS |
| **Deliverables** | Grant lifecycle; scope evaluator on all delegated paths; profile facade; release-gate module |
| **Automated tests** | Self vs caregiver matrix; scope allow/deny; profile tenant isolation |
| **Security tests** | Cross-tenant attacks; revoked/expired grants; IDOR; role-without-grant deny |
| **Integration tests** | Patients SoR facade; Audit grant events; Notification grant flows |
| **Documentation** | Caregiver model + acting-context contract |
| **Pass conditions** | **No** delegated PHI path without prior scope check; results product not shipped unless change control |
| **Blocking conditions** | Role-only caregiver access; missing per-request evaluation; PHI in logs/Activity |
| **Next milestone** | **46e** authorized only on PASS |

---

# Phase 46e — Portal Experience & Cross-Cutting Integrations

### Purpose
Complete the **approved Release 46.0 experience** and wire cross-cutting Centers for MVP surfaces only.

### Objectives
- Portal home, appointment-oriented dashboard, profile presentation, account/security settings, caregiver management UI.  
- Notification preferences where portal-owned.  
- White Label, i18n, responsive, a11y completion.  
- Notification / Audit / Activity / Observability completion for MVP.  
- Staff administration UX required by architecture.  
- E2E + regression (including 41–45 non-breakage).

### Workstreams

| Workstream | Deliverables |
|------------|--------------|
| Frontend/application | Home, dashboard, settings, caregiver UI, staff admin pages |
| White Label | Full branding application for patient shell |
| Accessibility | WCAG-oriented completion for MVP flows |
| Localization | String completion for MVP locales supported by platform |
| Integration | Notification / Audit / Activity final wiring |
| Observability | Health/metrics/logs/traces; alerting hooks if approved |
| API/contracts | OpenAPI / API docs for public portal namespace |
| Deployment/operations | Runbooks, enablement checklist draft, support diagnostics |
| Testing | E2E, regression 41–45, a11y, responsive, WL, flag matrix |
| Documentation | Ops runbooks, deployment guidance, user/support guidance |

### In scope
- Portal home experience  
- Appointment-oriented dashboard  
- Patient profile presentation  
- Account and security settings  
- Caregiver management UI  
- Notification preferences (portal-owned only)  
- White Label branding / theme / tenant assets  
- Localization + responsive + accessibility completion  
- Approved Notification / Audit / Activity / Observability integration  
- Operational health, metrics, structured logs, tracing  
- Alerting hooks where Observability patterns already approve  
- Privacy-safe telemetry  
- Support and recovery guidance  
- Staff administration UX where required  
- API documentation  
- Operational runbooks  
- Deployment guidance  
- End-to-end and regression tests  

### Explicitly out of scope
- Messaging, billing, payments, documents, clinical-records **product** slices  
- Native mobile  
- Any deferred capability “sneak-in”  

### Exit intent
Release experience complete for MVP; Centers consumed correctly; ready for acceptance.

---

# Quality Gate QG-E

**Name:** Portal Release Experience Ready
**Authorizes:** Phase **46f** only
**Result:** **PASS** (Phase 46e complete)

| Dimension | Requirement |
|-----------|-------------|
| **Entry criteria** | QG-D PASS |
| **Deliverables** | MVP UX complete; cross-cutting integrations; runbooks; API docs |
| **Automated tests** | E2E happy paths (enroll→login→appointments→caregiver); a11y checks; WL tests |
| **Security tests** | Full flag/license matrix on UX routes; session separation on UI |
| **Integration tests** | Notification/Audit/Activity/Observability for MVP events |
| **Documentation** | Runbooks + deployment + API docs reviewed |
| **Pass conditions** | No deferred product shipped; flags still default OFF; 41–45 regression green |
| **Blocking conditions** | Messaging/billing/docs/results product included; missing Observability hooks; broken WL |
| **Next milestone** | **46f** authorized only on PASS |

---

# Phase 46f — Production Acceptance

### Purpose
Validate Release 46.0 readiness. **No product features.**

### Allowed work
- Acceptance evidence and checklists  
- Documentation finalization / release packaging  
- Narrowly scoped corrective fixes for acceptance defects only  
- Regression protection confirmation for Releases 41–45  

### Forbidden
- New features  
- Pulling deferred capabilities into scope  
- Architecture OD changes  
- Flag default ON  

### Acceptance coverage (mandatory)
Architecture compliance · execution-plan compliance · feature completeness vs Release 46.0 MVP · dedicated app deployment · backend boundary · patient/staff session separation · enrollment · MFA · caregiver scope · tenant isolation · PHI protection · flags default OFF · licensing · API compatibility · White Label · branch handling · scheduling integration · Notification · Audit · Activity · Observability · accessibility · localization · responsive · security testing · performance validation process · failure injection · operational readiness · documentation review · rollback readiness · release enablement checklist · regression 41–45

### Exit intent
QG-F PASS → Release 46.0 package; enablement still controlled; flag default OFF.

---

# Quality Gate QG-F

**Name:** Production Acceptance Passed  
**Authorizes:** Release **46.0** packaging / controlled enablement process only (not automatic production ON)  
**Result:** **PASS** (Phase 46f complete — see [`PHASE_46_PRODUCTION_ACCEPTANCE.md`](./PHASE_46_PRODUCTION_ACCEPTANCE.md) · [`RELEASE_46_0.md`](./RELEASE_46_0.md))

| Dimension | Requirement |
|-----------|-------------|
| **Entry criteria** | QG-E PASS |
| **Deliverables** | Production Acceptance report; Release 46.0 notes; enablement checklist; rollback plan |
| **Automated tests** | Full acceptance suite green; 41–45 regression green |
| **Security tests** | Penetration-test readiness checklist complete; IDOR/tenant/caregiver suites green |
| **Integration tests** | End-to-end Centers consumption verified |
| **Documentation** | All MVP docs accepted |
| **Pass conditions** | All acceptance criteria objective PASS; no open blockers; flag default OFF |
| **Blocking conditions** | Any failed mandatory criterion; feature creep; OD drift; flag default ON |
| **Next** | Controlled tenant enablement **after** QG-F — outside this plan’s implementation authorization |

---

# Dependency Map

```
Frozen SSOT + this plan approved
        ↓
46a dedicated app + flags/license/RBAC/tenant/WL bootstrap
        ↓
46b patient session + enrollment + MFA
        ↓
46c scheduling facade (needs session + ACTIVE enrollment + scheduling contracts)
        ↓
46d caregiver grants (needs session) + profile (needs Patients contracts) + release gate
        ↓
46e UX + cross-cutting (needs 46a–46d surfaces)
        ↓
46f acceptance (needs Observability hooks + full MVP)
```

| Dependency | Rule |
|------------|------|
| Dedicated app before complete patient UX | 46a before 46e |
| Session class before PHI access | 46b before 46c/46d |
| Enrollment before PHI access | 46b before 46c/46d |
| Authentication before scheduling workflows | QG-B before 46c |
| Tenant context before data access | 46a wiring; enforced in all later |
| Licensing and flags before runtime activation | 46a; remain OFF |
| Scheduling contracts before appointment UI completion | 46c |
| Caregiver grants before delegated data reads | 46d |
| Result-release policy before clinical result display | Gate in 46d; display deferred |
| Notification intent contracts before patient notifications | 46b+ |
| Audit contracts before consent/privileged ops | 46b+ |
| Observability hooks before production acceptance | by 46e / QG-E |
| White Label contracts before branded release acceptance | 46a bootstrap; 46e completion |

### Repository prerequisites that could block implementation

| Prerequisite | Risk if missing |
|--------------|-----------------|
| Existing `patient-portal` module / Prisma models | Must extend; if corrupted, unblock via repair within BC |
| Auth MFA / password-reset primitives | 46b blocked — reuse required (OD-MFA) |
| Scheduling public/application appointment APIs | 46c blocked |
| Patients domain read contracts for demographics | 46d profile blocked |
| Notification intent registration path (41) | Invite/reminder blocked |
| Audit / Activity emitters | Compliance blocked |
| Observability instrumentation patterns (45) | QG-E/QG-F blocked |
| White Label token API | Branded acceptance blocked |
| Monorepo capacity for new `apps/patient-portal` | 46a blocked |
| License keys `patientPortal` / `caregiverAccess` already modeled | 46a gating blocked |

---

# Workstream Plan

Cross-milestone ownership (each milestone keeps workstreams inside its boundary):

| Workstream | 46a | 46b | 46c | 46d | 46e | 46f |
|------------|-----|-----|-----|-----|-----|-----|
| Backend/domain | ● | ● | ● | ● | ○ | ○ fix |
| API/contracts | ● | ● | ● | ● | ● docs | ○ |
| Authentication/security | ○ | ● | ○ | ● | ○ | ○ evidence |
| Frontend/application | ● | ● | ● | ● | ● | ○ |
| Data/storage | ○ assess | ● | ○ | ● | ○ | ○ |
| Integration | ○ | ● | ● | ● | ● | ○ |
| White Label | ● | ○ | ○ | ○ | ● | ○ |
| Accessibility | ● | ○ | ● | ○ | ● | ○ |
| Localization | ● | ○ | ● | ○ | ● | ○ |
| Observability | ● | ● | ● | ● | ● | ○ |
| Testing | ● | ● | ● | ● | ● | ● |
| Documentation | ● | ● | ● | ● | ● | ● |
| Deployment/operations | ● | ○ | ○ | ○ | ● | ● |

● = primary · ○ = secondary / evidence / assess only

---

# API Plan

### Namespace and versioning
- Public patient APIs under `/patient-portal/...` (existing foundation style preserved).  
- Versioning: prefer additive URL or header versioning consistent with platform norms; **no breaking changes** without deprecation policy.  
- Staff admin APIs remain under staff-authenticated routes (clinic-dashboard clients), never patient session.

### Contract requirements (all milestones)
- Request/response DTOs with allowlisted fields (PHI minimize)  
- Patient-safe error codes (no account enumeration)  
- Idempotency for booking and enrollment verify where retries expected  
- Pagination / filtering / sorting conventions aligned with platform  
- Rate limiting on auth and booking  
- Session required except explicit public enrollment bootstrap endpoints  
- `tenantId` from session — never trusted solely from body  
- Branch as filter query only  
- Self vs caregiver **acting context** explicitly represented (header or param — choose one convention in 46d and keep stable)  
- Correlation IDs compatible with Observability (45)  
- Backward compatibility for additive fields  
- Deprecation: announce → dual-run → remove only after acceptance policy  

### Endpoint invention rule
Do **not** freeze final path lists in this plan beyond categories already in SSOT. Implementation defines paths under the namespace without changing ownership.

---

# Data and Migration Plan

### Assessment (planning only — schema changes not authorized by this document)

| Area | Likely need | Owner BC | Notes |
|------|-------------|----------|-------|
| `PortalAccount` | Possible additive fields (enrollment tokens, MFA markers refs, prefs) | patient-portal | Prefer link to Auth SoR over duplicating secrets |
| `CaregiverAccessGrant` | Possible additive scope/consent/expiry indexes | patient-portal | Preserve existing entity semantics |
| Enrollment records | May be fields on PortalAccount or side table | patient-portal | Tenant key mandatory |
| Consent records/refs | Portal-owned consent capture refs if not elsewhere | patient-portal | Audit correlation IDs |
| Session metadata | Prefer Auth session store | Auth | Avoid portal-local session SoR |
| Portal preferences | Portal-owned | patient-portal | Locale/UX only |
| Indexes / uniqueness | `(tenantId, patientId)`, grant uniqueness | patient-portal | Required for isolation |
| Backfill | Existing invited accounts | patient-portal | Backward compatible |

### For every proposed schema change (at implementation time)
Must document: owning BC · migration order · backward compatibility · rollback · data safety · tenant isolation · required vs optional.

### Rollback strategy
- Additive migrations preferred.  
- Rollback = expand-contract; never drop PHI columns carelessly.  
- Feature flags hide new behavior without DB drop.

**This plan does not authorize executing migrations.**

---

# Security Plan

Fail-closed controls planned across milestones:

| Control | Milestone emphasis |
|---------|-------------------|
| Public attack-surface review | 46a, 46b, 46f |
| Threat modeling | 46b (auth), 46d (caregiver), 46f |
| Account enumeration prevention | 46b |
| Rate limiting / credential protection | 46b, 46c |
| MFA | 46b |
| Session fixation prevention | 46b |
| CSRF (cookie sessions) / XSS / CSP / headers | 46a–46b, 46e |
| Secure cookies or approved token storage | 46b |
| Token rotation / logout / revocation | 46b |
| Password reset safety | 46b |
| Patient identity verification | 46b |
| Caregiver authorization per request | 46d |
| Cross-tenant protection / IDOR | 46c–46d |
| PHI minimization | 46c–46e |
| Result-release enforcement | 46d (gate) |
| Auditability | 46b–46e |
| Privacy-safe observability | all |
| Penetration-test readiness | 46f |

---

# Testing Strategy

### Pyramid
Unit (domain/entities/policies) → contract → API/integration → frontend component → E2E → security/negatives → acceptance.

### Mandatory suites by milestone

| Suite | 46a | 46b | 46c | 46d | 46e | 46f |
|-------|-----|-----|-----|-----|-----|-----|
| Unit | ● | ● | ● | ● | ○ | ○ |
| Contract | ● | ● | ● | ● | ● | ○ |
| Integration / API | ● | ● | ● | ● | ● | ● |
| Frontend component | ● | ● | ● | ● | ● | ○ |
| E2E | ○ | ○ | ● | ● | ● | ● |
| Authorization | ● | ● | ● | ● | ● | ● |
| Tenant isolation | ● | ● | ● | ● | ● | ● |
| PHI-safety | ○ | ● | ● | ● | ● | ● |
| Caregiver-scope | — | — | ○ | ● | ● | ● |
| Session-separation | ○ | ● | ● | ● | ● | ● |
| Enrollment / MFA | — | ● | ○ | ○ | ● | ● |
| Scheduling workflow | — | — | ● | ○ | ● | ● |
| Concurrency / idempotency | — | ○ | ● | ○ | ○ | ● |
| Rate-limit | — | ● | ● | ○ | ○ | ● |
| Feature-flag / licensing | ● | ● | ● | ● | ● | ● |
| Accessibility | ● | ○ | ● | ○ | ● | ● |
| Responsive / localization | ● | ○ | ● | ○ | ● | ● |
| White Label | ● | ○ | ○ | ○ | ● | ● |
| Observability | ● | ● | ● | ● | ● | ● |
| Migration (if any) | ○ | ● | ○ | ● | ○ | ● |
| Regression Releases 41–45 | ○ | ○ | ○ | ○ | ● | ● |

All tests must be deterministic and CI-suitable.

---

# Performance Validation Plan

Do **not** invent numeric SLOs absent from SSOT or repository standards.

| Area | Plan |
|------|------|
| Portal page load | Measure in 46e/46f against existing frontend budgets if defined; else record baseline as **pre-implementation acceptance input** |
| API latency | Establish baselines for auth, appointment list/availability, booking during 46c–46f |
| Availability queries | Validate via Scheduling SoR performance — portal must not add N+1 fan-out |
| Booking workflows | Concurrency/stale-slot correctness over raw speed |
| Login / MFA | Auth path latency baselines; rate-limit behavior under load |
| Concurrent patient sessions | Soak test process at 46f |
| DB query efficiency | Explain/index review for portal queries in 46b–46d |
| Frontend asset size | Budget check vs clinic-dashboard norms if documented |
| CDN / memory / startup / observability overhead | Validate no material regression vs platform norms; unresolved targets = acceptance inputs |

Unresolved numeric targets are **pre-implementation acceptance inputs**, not blockers to starting 46a.

---

# Operational Plan

| Topic | Plan |
|-------|------|
| Environment variables | Portal app API base URL, flag providers, WL endpoints, auth cookie settings |
| Secret handling | No secrets in frontend; Auth/Notification secrets remain platform-managed |
| Deployment topology | Dedicated frontend deploy + existing API deploy compatibility |
| Health checks | Portal module dormant when flag OFF; ready checks don’t break clinical paths |
| Logging / metrics / tracing | Observability Center only; PHI scrubbed |
| Alerting | Use Observability alert hooks if approved; no parallel pager stack |
| Support diagnostics | Correlation IDs; privacy-safe support procedures |
| Feature enablement | Master OFF; staged tenant enablement post-QG-F |
| Rollback | Disable master flag; session revoke playbook |
| Incident response | Align with platform IR; portal-specific runbook in 46e/46f |

Release remains **disabled by default** until controlled enablement after QG-F.

---

# Documentation Plan

| Doc | Milestone |
|-----|-----------|
| Foundation / topology / flags | 46a |
| Identity, enrollment, session, MFA | 46b |
| Appointment workflow / facade | 46c |
| Caregiver authorization model | 46d |
| Ops runbooks, API docs, deployment, support | 46e |
| Production Acceptance + Release 46.0 | 46f |

Update discovery/review status pointers only as historical; **do not alter** frozen SSOT content or ODs.

---

# Risk Register

| ID | Risk | Mitigation |
|----|------|------------|
| R1 | Staff/patient session confusion | QG-B hard gate; separate claims/cookies |
| R2 | Caregiver role-only access bug | QG-D negative suites mandatory |
| R3 | Scheduling engine duplication | Facade-only reviews in 46c |
| R4 | PHI leakage in logs/Activity | Scrubber tests; OD-PHI |
| R5 | Scope creep (messaging/billing) | Deferred list; QG-E/QG-F blockers |
| R6 | Flag default ON accidentally | CI assert defaults; QG-A/F |
| R7 | Auth primitive gaps block 46b | Prerequisite check before 46b start |
| R8 | Scheduling contract gaps block 46c | Prerequisite inventory in 46a spike notes |
| R9 | White Label incomplete branding | Bootstrap 46a; complete 46e |
| R10 | Performance unknowns | Baseline process; no fake SLOs |
| R11 | Migration risk on PortalAccount | Additive only; expand-contract |
| R12 | Regression to Centers 41–45 | Explicit regression suite 46e/46f |

---

# Blocking Conditions

Execution Planning / milestone start is blocked if any of the following become true:

1. Attempt to change OD-* or frozen SSOT without change control  
2. Attempt to start 46b+ without prior QG PASS  
3. Missing Auth MFA/reset primitives with no reuse path  
4. Missing Scheduling facade-capable contracts for 46c  
5. Plan approval withheld  
6. Proposal to make portal a clinical SoR  
7. Proposal to merge Notification/Observability queues  
8. Flag default ON in mainline  
9. Deferred capabilities assigned into 46a–46f as product scope  

---

# Implementation Authorization Rules

1. **Architecture Freeze does not authorize implementation by itself.**  
2. **Approval of this execution plan authorizes only Phase 46a.**  
3. **Each later milestone requires the previous quality gate to pass.**  
4. **Scope changes require formal architecture change control.**  
5. **Deferred items cannot enter implementation through corrective work.**  
6. **Phase 46f cannot add features.**  
7. **Release 46.0 cannot proceed without QG-F.**  
8. Master and sub-flags remain **default OFF** until controlled post-acceptance enablement.  
9. Corrective fixes in 46f must be narrowly scoped to acceptance defects within Release 46.0 MVP.

---

# Final Readiness Assessment

| Criterion | Status |
|-----------|--------|
| Release scope explicit | **Met** |
| Milestone sequence explicit (46a→46f) | **Met** |
| Every milestone has bounded deliverables | **Met** |
| Every milestone has mandatory quality gate | **Met** |
| Dependencies documented | **Met** |
| Security gates documented | **Met** |
| Test requirements documented | **Met** |
| Integration ownership preserved | **Met** |
| Data changes assessed (not authorized) | **Met** |
| Operational readiness planned | **Met** |
| Deferred capabilities remain deferred | **Met** |
| Implementation authorization unambiguous | **Met** |
| Phase 46a can begin without unresolved architectural decisions | **Met** |

**Unresolved non-architecture inputs (do not block 46a):** numeric performance SLOs (establish during execution / acceptance); exact OpenAPI path list (implementation detail under frozen namespace).

---

**Document status:** Execution Plan — ready for approval  
**Next authorized activity after approval:** Phase **46a** implementation only
