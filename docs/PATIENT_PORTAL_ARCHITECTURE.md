# Patient Portal Architecture

**Phase:** 46 (Architecture — **APPROVED AND FROZEN**)  
**Status:** **APPROVED AND FROZEN** · **2026-07-18**  
**Implementation status:** **46a COMPLETE** · **46b COMPLETE** · **46c COMPLETE** · **46d COMPLETE** · **46e COMPLETE** · **46f COMPLETE (QG-F PASS)** — see [`PATIENT_PORTAL_FOUNDATION.md`](./PATIENT_PORTAL_FOUNDATION.md) · [`PATIENT_PORTAL_IDENTITY_AND_ENROLLMENT.md`](./PATIENT_PORTAL_IDENTITY_AND_ENROLLMENT.md) · [`PATIENT_PORTAL_APPOINTMENTS_AND_SCHEDULING.md`](./PATIENT_PORTAL_APPOINTMENTS_AND_SCHEDULING.md) · [`PATIENT_PORTAL_CAREGIVER_AND_SAFE_ACCESS.md`](./PATIENT_PORTAL_CAREGIVER_AND_SAFE_ACCESS.md) · [`PATIENT_PORTAL_EXPERIENCE_AND_INTEGRATIONS.md`](./PATIENT_PORTAL_EXPERIENCE_AND_INTEGRATIONS.md) · [`PHASE_46_PRODUCTION_ACCEPTANCE.md`](./PHASE_46_PRODUCTION_ACCEPTANCE.md) · [`RELEASE_46_0.md`](./RELEASE_46_0.md)  
**Dynamic Platform phase:** **46** = Patient Portal (patient self-service experience)  
**Master feature flag (planned):** `PATIENT_PORTAL_CENTER_ENABLED` — **default OFF**  
**Prerequisite:** Releases **41.0–45.0** PRODUCTION ACCEPTED / FROZEN; Discovery + Review **PASS**  
**Authoring panel:** CTO · Principal Enterprise SaaS · Healthcare ERP · Platform · Backend · Frontend · Security · Compliance · Product  
**SSOT for:** Patient Portal (dedicated patient web application, portal backend bounded context, auth/enrollment/session, caregiver delegation, patient-safe integrations)  
**Approval record:** [`PHASE_46_ARCHITECTURE_REVIEW_AND_APPROVAL.md`](./PHASE_46_ARCHITECTURE_REVIEW_AND_APPROVAL.md)  
**Discovery companion:** [`PHASE_46_ARCHITECTURE_DISCOVERY_AND_READINESS.md`](./PHASE_46_ARCHITECTURE_DISCOVERY_AND_READINESS.md)  
**Execution plan:** [`PHASE_46_EXECUTION_PLAN.md`](./PHASE_46_EXECUTION_PLAN.md)  
**Foundation doc:** [`PATIENT_PORTAL_FOUNDATION.md`](./PATIENT_PORTAL_FOUNDATION.md)

**Numbering note:** Phase **46** = Patient Portal (authoritative). Phase **37** remains reserved (Department/Franchise). Phase **47** = Super Admin Console. Product taxonomy labels do not override Dynamic Platform numbering.

**Authority note:** This document is the **sole architectural authority (SSOT)** for every remaining Phase 46 activity: Execution Planning, Implementation, Production Acceptance, and Release. After freeze, architectural changes require a **formal change process**. Do **not** redesign Releases **41–45**. Do **not** make Patient Portal a clinical System of Record.

**Companion frozen SSOTs (consume, do not redesign):**  
[`NOTIFICATION_CENTER_ARCHITECTURE.md`](./NOTIFICATION_CENTER_ARCHITECTURE.md) · [`IMPORT_EXPORT_CENTER_ARCHITECTURE.md`](./IMPORT_EXPORT_CENTER_ARCHITECTURE.md) · [`BACKUP_RESTORE_CENTER_ARCHITECTURE.md`](./BACKUP_RESTORE_CENTER_ARCHITECTURE.md) · [`API_KEYS_INTEGRATIONS_ARCHITECTURE.md`](./API_KEYS_INTEGRATIONS_ARCHITECTURE.md) · [`SYSTEM_MONITORING_OBSERVABILITY_ARCHITECTURE.md`](./SYSTEM_MONITORING_OBSERVABILITY_ARCHITECTURE.md) · [`DYNAMIC_ACTIVITY_CENTER_ARCHITECTURE.md`](./DYNAMIC_ACTIVITY_CENTER_ARCHITECTURE.md) · [`DYNAMIC_AUDIT_CENTER_ARCHITECTURE.md`](./DYNAMIC_AUDIT_CENTER_ARCHITECTURE.md) · [`LICENSING_ARCHITECTURE.md`](./LICENSING_ARCHITECTURE.md) · [`DYNAMIC_MODULE_MANAGEMENT_ARCHITECTURE.md`](./DYNAMIC_MODULE_MANAGEMENT_ARCHITECTURE.md) · [`DYNAMIC_WHITE_LABEL_ARCHITECTURE.md`](./DYNAMIC_WHITE_LABEL_ARCHITECTURE.md) · [`BACKGROUND-ARCHITECTURE.md`](./BACKGROUND-ARCHITECTURE.md)

**Existing foundation (extend, do not replace):** `apps/api/src/modules/patient-portal` · Prisma `PortalAccount` / `CaregiverAccessGrant` · RBAC `api.patient_portal` · license `patientPortal` / `caregiverAccess`

---

# Executive Summary

The **Patient Portal** is the clinic’s **patient-facing self-service product**: a **dedicated patient web application** backed by an extended **`patient-portal` bounded context** that authenticates patients (and caregivers), manages portal accounts and enrollment, and **orchestrates read/write facades** over existing Systems of Record.

Phase 46 freezes **Option B** (approved in Architecture Review):

| Layer | Decision |
|-------|----------|
| Frontend | New dedicated app under `apps/patient-portal` (name may be refined at Execution Planning; location is frozen) |
| Backend | Extend `apps/api/src/modules/patient-portal` — **not** a parallel clinical engine |
| Role | **Consumer facade** of Scheduling, EMR/clinical, Billing, Messaging, Notification, Documents |
| SoR ownership | Portal owns **only** portal-native aggregates (accounts, enrollment state, caregiver grants, portal sessions/preferences as defined below) |

**Non-goals of this architecture:** Native mobile apps; FHIR public exposure; telemedicine; marketplace pack runtime; becoming EMR/billing/notification SoR; redesigning Releases 41–45; collapsing patient UX into clinic-dashboard.

**Posture:** API-first · fail-closed · tenant-isolated · license-gated · feature-flag default OFF · caregiver scope enforced **before** any PHI read · no duplicated business engines.

---

# Scope

Frozen in-scope product surface for Phase 46 (MVP and near-MVP increments under this architecture):

1. Dedicated Patient Web Application  
2. Patient Portal Backend Module (extended BC)  
3. Patient Authentication (distinct session class from staff)  
4. Enrollment (invite / verify / activate / complete)  
5. MFA (policy-driven; reuse platform MFA primitives where safe)  
6. Session lifecycle (issue, refresh, revoke, timeout)  
7. Caregiver delegation (grants + **enforcement**)  
8. Patient authorization (portal roles + grant scope)  
9. Portal profile (portal-owned prefs + patient demographics via Patients SoR)  
10. Appointment management (self-service via Scheduling SoR)  
11. Clinical record access (patient-safe **read projections** only)  
12. Result-release policy (clinic-controlled; portal respects before display)  
13. Messaging integration (consume Messaging SoR / public contracts)  
14. Billing integration (patient-safe statements / balances)  
15. Payment integration (initiate only via existing payment adapters; ledger unchanged)  
16. Documents (patient-safe document access via Documents SoR)  
17. Notifications (intents → Notification Center)  
18. Activity integration (non-PHI operational events)  
19. Audit integration (consent, enrollment, privileged portal ops, PHI access where required)  
20. Observability integration (consume Phase 45; no parallel telemetry stack)  
21. White Label integration (branding tokens / theme)  
22. Licensing (`patientPortal`, `caregiverAccess`)  
23. Feature flags (master OFF by default; incremental sub-flags)  
24. Configuration (tenant portal settings)  
25. Public APIs (patient-facing HTTP contracts)  
26. Internal APIs (staff admin of portal accounts; in-process domain facades)  
27. Storage ownership (portal-native tables only)  
28. Security model (fail-closed, least privilege)  
29. PHI protection (minimize, redact, no PHI in logs/Activity)  
30. Tenant isolation (mandatory `tenantId` on all portal paths)  
31. Branch handling (optional filter; never broaden PHI scope)  
32. Portal branding (White Label consumer)  
33. Extension points (adapters; no core forks)  
34. Future mobile compatibility (API-first contracts; no native apps in MVP)  
35. Upgrade strategy (additive; foundation preserved; flags OFF)

---

# Out of Scope

| Item | Status |
|------|--------|
| Native iOS / Android apps | Deferred (API compatibility only) |
| Marketplace pack runtime as portal delivery | Deferred (Phase 44 pack engine not ready) |
| FHIR R4 public patient API as portal surface | Deferred |
| Advanced messaging (groups, attachments beyond MVP policy) | Deferred |
| Telemedicine / video visits | Deferred |
| Online payments beyond approved MVP adapter path | Deferred / constrained |
| Patient-generated health data (PGHD) / wearables | Deferred |
| Family account expansion beyond caregiver grants | Deferred |
| Advanced document workflows (e-sign orchestration as SoR) | Deferred |
| Redesign of Releases 41–45 Centers | Forbidden |
| Duplicating Scheduling / EMR / Billing / Notification engines | Forbidden |
| Clinic-dashboard as primary patient product (Option A) | Rejected |
| Big-bang full clinical self-service in one release (Option C) | Rejected |
| Phase 37 Department / Franchise | Reserved elsewhere |
| Phase 47 Super Admin Console | Separate phase |
| Implementation / execution planning / estimates in this document | Forbidden here |

---

# Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  apps/patient-portal  (dedicated SPA — patient UX only)     │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTPS / JWT (patient session class)
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  API Gateway / NestJS                                       │
│  · License: patientPortal · Flag: PATIENT_PORTAL_*          │
│  · Auth: patient session ≠ staff session                    │
│  · RBAC: api.patient_portal (+ portal role claims)          │
└────────────────────────────┬────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  patient-portal BC (orchestration facade)                   │
│  · PortalAccount · Enrollment · Session prefs               │
│  · CaregiverAccessGrant + scope enforcement                 │
│  · Result-release gate · Branch filter (optional)           │
└───┬──────┬──────┬──────┬──────┬──────┬──────┬───────────────┘
    │      │      │      │      │      │      │
    ▼      ▼      ▼      ▼      ▼      ▼      ▼
 Sched.  EMR/   Msg   Billing Docs  Patients  (public/in-process
         Clin.              Pay               contracts only)
    │      │      │      │      │      │
    └──────┴──────┴──────┴──────┴──────┘
              Systems of Record (unchanged)

Cross-cutting consumers (not owned by portal):
  Notification (41) · Audit · Activity · Observability (45) · White Label · Licensing · Feature Flags
```

**Principle:** Portal **orchestrates**; domains **own**.

---

# Bounded Contexts

| Context | Portal relationship | Mutable in Phase 46? |
|---------|--------------------|----------------------|
| **patient-portal** | **Owns** portal accounts, enrollment, caregiver grants, portal session class, portal prefs, release-gate application | **Yes** (extend) |
| **auth / identity** | Reuse JWT, MFA, password reset primitives; portal defines **patient session class** and enrollment flows | Extend contracts only |
| **patients** | Demographics / clinical patient identity SoR | No redesign; link only |
| **scheduling** | Appointments / availability SoR | Consume public handlers |
| **EMR / clinical / results** | Clinical documentation & results SoR | Consume patient-safe projections |
| **messaging** | Secure messaging SoR | Consume |
| **billing / payments** | Ledger & payment adapter SoR | Consume |
| **documents** | Document store SoR | Consume |
| **notification** (41) | Delivery SoR | Emit intents only |
| **audit** | Compliance event SoR | Emit events only |
| **activity** | Operational feed SoR | Emit non-PHI events only |
| **observability** (45) | Telemetry SoR | Instrument / consume |
| **white-label** | Branding SoR | Consume tokens |
| **licensing / module mgmt** | Entitlement SoR | Gate enablement |
| **api-keys** (44) | Machine credentials — **not** patient login | No coupling for human portal auth |
| **import-export** (42) | Export/import runtime | Policy consumer only if needed |
| **backup-restore** (43) | DR SoR | Portal data secondary |

---

# System of Record Matrix

Each capability has **exactly one** authoritative owner. Portal is SoR only for portal-native rows.

| Capability | System of Record | Portal role |
|------------|------------------|-------------|
| Authentication (credential verification, MFA factors platform) | **Auth / Identity** | Orchestrates patient login/enrollment; issues **patient session class** |
| Portal Accounts | **patient-portal** (`PortalAccount`) | **Owner** |
| Enrollment state / invites | **patient-portal** | **Owner** |
| Patient Profile (demographics, MRN link) | **Patients** domain | Consumer (read/update via Patients contracts where allowed) |
| Portal preferences (locale, UX prefs) | **patient-portal** | **Owner** |
| Appointments | **Scheduling** | Facade / consumer |
| Scheduling / availability engine | **Scheduling** | Consumer only — **no duplicate engine** |
| Medical Records (clinical documentation) | **EMR / Clinical** | Patient-safe **read projection** consumer |
| Clinical Results | **EMR / Results** (+ clinic release policy) | Consumer after **release gate** |
| Result-release policy definition | **Clinical / clinic policy** (config owned with clinical ops) | **Enforcer** at portal read edge |
| Messaging threads / content | **Messaging** | Consumer |
| Notifications / delivery | **Notification Center (41)** | Intent emitter |
| Billing statements / balances | **Billing** | Consumer |
| Payments / ledger / adapters | **Billing / Payments** | Initiator via approved adapters only |
| Documents | **Documents** | Consumer |
| Activity feed | **Activity Center** | Event emitter (non-PHI) |
| Audit trail | **Audit Center** | Event emitter |
| Observability telemetry | **Observability (45)** | Instrumentation consumer |
| Licensing | **Licensing** | Gate consumer |
| Configuration (tenant portal settings) | **patient-portal** (+ platform config patterns) | **Owner** of portal settings keys |
| Feature Flags | **Feature flag / module management platform** | Consumer; portal defines flag names |
| Caregiver grants | **patient-portal** (`CaregiverAccessGrant`) | **Owner** |
| White Label / branding tokens | **White Label** | Consumer |
| API Keys (machine) | **API Keys Center (44)** | Unrelated to patient human auth |

---

# Application Topology

| Component | Location (frozen intent) | Notes |
|-----------|--------------------------|-------|
| Patient web app | `apps/patient-portal` (or equivalent monorepo app path fixed at Execution Planning **without** changing dedicated-app decision) | Patient UX only; not clinic-dashboard |
| Staff portal admin UX | Existing `apps/clinic-dashboard` Settings / admin surfaces | Manage invites, revoke, grants — **staff** chrome |
| Portal API module | `apps/api/src/modules/patient-portal` | Extend foundation |
| Shared packages | Existing monorepo packages (`@healthcare-erp/*` patterns) | Maximize reuse |
| Persistence | Existing Prisma / DB — portal-native models | No separate patient DB |

**Topology rules:**

- Dedicated frontend is **mandatory** (OD-PORTAL-APP).  
- Backend remains **stateless** NestJS processes (session state in tokens / server-side store already used by Auth — not ad-hoc portal memory).  
- Clinic-dashboard patient stub pages may redirect or be retired later; they are **not** the product.

---

# Authentication

| Topic | Frozen rule |
|-------|-------------|
| Session class | **Patient portal session** is distinct from **staff clinic session** (claims / audience / cookie name or equivalent separation) |
| Identity link | `PortalAccount` ↔ `Patient` (and User where model requires) |
| Credentials | Reuse Auth password / reset / MFA primitives; do not invent a second password store |
| Machine auth | API Keys Center **must not** be used as patient login |
| Fail closed | Missing license, flag, or valid patient session → deny |

---

# Enrollment

| Stage | Owner | Rule |
|-------|-------|------|
| Invite (staff or automated) | patient-portal | Creates enrollment token / pending account; Audit |
| Verify identity / contact | patient-portal + Auth | Email/phone verify via platform patterns |
| Activate credentials | Auth + patient-portal | Password set; MFA enroll per policy |
| Complete / ACTIVE | patient-portal | Only ACTIVE accounts access PHI facades |
| Disable / revoke | patient-portal | Immediate session invalidation |

Incomplete enrollment **never** grants clinical or billing PHI reads.

---

# Authorization

| Layer | Rule |
|-------|------|
| License | `patientPortal` required for portal enablement |
| Feature flag | Master OFF by default; deny when OFF |
| RBAC permission | `api.patient_portal` (and finer permissions as Execution Planning adds — architecture allows additive permissions) |
| Portal role | Self vs Caregiver (and future roles only via formal change) |
| Caregiver grant | Active grant + scope + expiry checked **before** PHI read |
| Tenant | `tenantId` from session must match resource tenant |
| Branch | Optional filter; never expands access beyond patient/grant |

**Coarse portal roles (frozen vocabulary):**

| Role | Meaning |
|------|---------|
| `PATIENT_SELF` | Account linked to self patient |
| `CAREGIVER` | Acting under grant for another patient |
| Staff admin roles | Existing clinic RBAC for portal administration — **not** patient app roles |

---

# Caregiver Model

| Topic | Frozen rule |
|-------|-------------|
| Aggregate | `CaregiverAccessGrant` remains portal-owned SoR |
| Scope | Explicit scopes (e.g. appointments, records, messaging, billing) — deny scopes not granted |
| Enforcement | **Mandatory before any PHI-bearing read/write facade** (OD-CAREGIVER, OD-PHI) |
| License limit | `caregiverAccess` entitlements respected |
| Audit | Grant create / revoke / privileged use audited |
| Expansion | Multi-family / household accounts beyond grants = **deferred** |

---

# Session Model

| Topic | Frozen rule |
|-------|-------------|
| Lifecycle | Issue → refresh → idle/absolute timeout → logout / revoke |
| Revocation | On account disable, password change, grant revoke (caregiver), admin force-logout |
| Storage | Align with Auth module patterns (no portal-local ad-hoc session DB unless Auth already uses one) |
| Concurrent sessions | Policy configurable; default platform-safe |
| Staff crossover | Patient session **must not** authorize clinic-dashboard staff APIs |

---

# PHI Protection

| Rule | Requirement |
|------|-------------|
| Minimize | Portal APIs return only fields needed for patient-safe UX |
| Release gate | Results/clinical artifacts subject to clinic release policy before response |
| Logs | No PHI / secrets in application logs, Activity payloads, or Observability attributes beyond approved redaction |
| Caregiver | Scope check **before** load |
| Export | Patient data export follows IE/Audit policy; portal does not invent a second export engine |
| Fail closed | Ambiguous authorization → deny |

---

# Tenant Isolation

| Rule | Requirement |
|------|-------------|
| Every portal query | Constrained by `tenantId` |
| Cross-tenant | Impossible via portal APIs |
| White Label | Branding resolution tenant-scoped |
| Shared infra | Multi-tenant DB patterns unchanged — portal adds no shared-global patient table without tenant key |

---

# Scheduling Integration

| Topic | Frozen rule |
|-------|-------------|
| SoR | Scheduling / appointments module |
| Portal | Facade over existing create / reschedule / cancel / list / availability contracts |
| Forbidden | Reimplementing slot engine, provider calendar, or conflict logic in portal |
| Foundation | Extend `/patient-portal/me/appointments*` style public routes |

---

# Clinical Data Integration

| Topic | Frozen rule |
|-------|-------------|
| SoR | EMR / clinical / results modules |
| Portal access | **Read projections** composed for patients |
| Writes | Clinical documentation writes remain clinical SoR — portal does not become charting UI SoR |
| Results | Subject to **result-release policy** (OD-RESULTS) |
| Forbidden | Duplicating EMR storage or clinical decision engines |

---

# Messaging Integration

| Topic | Frozen rule |
|-------|-------------|
| SoR | Messaging module |
| Portal | Patient-safe thread list / send / read via Messaging public contracts |
| Notifications | New message alerts via Notification intents |
| Deferred | Group chat, rich attachments beyond policy, marketplace messaging packs |

---

# Billing Integration

| Topic | Frozen rule |
|-------|-------------|
| SoR | Billing module |
| Portal | View statements / balances / invoices patient is entitled to see |
| Forbidden | Portal ledger, invoice generation engine, or posting rules |

---

# Notification Integration

| Topic | Frozen rule |
|-------|-------------|
| SoR | Notification Center (Release 41) |
| Portal | Emit intents (invite, enrollment, appointment reminder hooks, message notify, payment receipt notify) |
| Forbidden | Portal-owned delivery queues, provider adapters, or quiet-hours engine |

---

# Audit Integration

| Topic | Frozen rule |
|-------|-------------|
| SoR | Audit Center |
| Must audit | Enrollment, consent, grant CRUD, login anomalies (as Auth policy), PHI access classes required by compliance, admin revoke |
| Portal | Emitter only |

---

# Activity Integration

| Topic | Frozen rule |
|-------|-------------|
| SoR | Activity Center |
| Portal | Non-PHI operational events (e.g. “appointment booked via portal”) |
| Forbidden | PHI bodies in Activity |

---

# Observability Integration

| Topic | Frozen rule |
|-------|-------------|
| SoR | Observability Center (Release 45) |
| Portal | Traces / metrics / logs with redaction; health contribution if module exposes readiness |
| Forbidden | Parallel APM, metrics DB, or alert engine |

---

# White Label

| Topic | Frozen rule |
|-------|-------------|
| SoR | White Label Center |
| Portal app | Consumes branding tokens (logo, colors, clinic name) for patient shell |
| Forbidden | Hardcoded clinic-specific forks per tenant |

---

# Licensing

| Entitlement | Rule |
|-------------|------|
| `patientPortal` | Required to enable portal product |
| `caregiverAccess` | Limits caregiver grant capacity / feature |
| Fail closed | Unlicensed → APIs and UI deny |
| Interaction | Does not auto-enable Notification / Observability / other Center flags |

---

# Feature Flags

| Flag (names frozen as architecture intent; exact string may match repo convention at implementation) | Default | Purpose |
|------------------------------------------------------------------------------------------------------|---------|---------|
| `PATIENT_PORTAL_CENTER_ENABLED` (master) | **OFF** | Entire patient portal product |
| Incremental sub-flags (appointments, records, messaging, billing, payments, documents) | **OFF** | Slice enablement |

Rules: flags default OFF; license still required when ON; no silent enablement in production.

---

# Public APIs

Frozen **contract categories** (paths may be refined without changing ownership):

| Category | Audience | Examples (illustrative) |
|----------|----------|-------------------------|
| Auth / enrollment | Patient | login, logout, enroll, verify, MFA challenge |
| Me / profile | Patient | `/patient-portal/me`, preferences |
| Appointments | Patient | list / book / reschedule / cancel |
| Clinical reads | Patient | records / results (post release-gate) |
| Messaging | Patient | threads / messages |
| Billing / pay | Patient | statements / pay initiate |
| Documents | Patient | list / download entitled docs |
| Caregiver context | Patient | switch/active patient under grant |

All public portal APIs: license + flag + patient session + tenant + (caregiver scope if applicable).

---

# Internal APIs

| Category | Audience | Purpose |
|----------|----------|---------|
| Portal admin | Staff (clinic-dashboard) | Invite, disable, reset enrollment, manage grants |
| In-process facades | Nest modules | Call Scheduling/EMR/Billing **domain services** — prefer existing public application services; avoid deep private table coupling |
| Jobs | Background | Reminder intents, enrollment expiry — via existing job infrastructure |

Portal must not expose staff-only internals on patient session.

---

# Configuration

| Config class | Owner | Examples |
|--------------|-------|----------|
| Portal tenant settings | patient-portal | Enrollment required fields, session timeouts (if portal-specific), allowed self-service actions |
| Result-release policy | Clinical / clinic policy config | Auto-release delay, physician release required |
| MFA policy | Auth + tenant security policy | Required for portal yes/no |
| Branding | White Label | Logos, theme |
| Notification templates | Notification Center | Invite / reminder template keys |

---

# Extension Points

Frozen extension model:

| Extension | Mechanism |
|-----------|-----------|
| Payment initiation | Existing payment adapter interface |
| Notification channels | Notification Center adapters |
| Additional patient-safe projections | Versioned portal DTO mappers — not new SoRs |
| Future mobile clients | Same public API contracts |
| Marketplace | Deferred — no pack runtime dependency for MVP |

**Forbidden:** Per-tenant code forks; copying domain engines into portal.

---

# Deferred Capabilities

| Capability | Reason |
|------------|--------|
| Native mobile apps | Out of MVP; API-first readiness only |
| Marketplace integration for portal features | Pack runtime incomplete |
| FHIR exposure as portal | Separate interoperability program |
| Advanced messaging | Scope control |
| Telemedicine | Separate product |
| Online payments beyond approved MVP adapter path | Risk / PCI surface |
| Patient-generated health data | Not SoR-ready |
| Family account expansion beyond caregiver grants | Model complexity |
| Advanced document e-sign workflows | Documents/e-sign SoR elsewhere |
| Full messaging + billing + records in single first production cut | Rejected Option C — incremental slices under same architecture |

---

# Architecture Decisions

## OD-PORTAL-BOUNDARY

| Field | Content |
|-------|---------|
| **Context** | Need clear ownership so portal does not become a second ERP. |
| **Decision** | Patient Portal is a **bounded context + dedicated app** that **owns only portal-native aggregates** and otherwise **consumes** SoRs. |
| **Rationale** | Preserves Releases 41–45 and clinical integrity; matches discovery/review. |
| **Consequences** | All clinical/billing/scheduling logic stays in domain modules; portal adds facades and gates. |
| **Deferred alternatives** | Portal as clinical SoR (rejected). |

## OD-PORTAL-APP

| Field | Content |
|-------|---------|
| **Context** | Patients need a dedicated UX separate from staff chrome. |
| **Decision** | Ship a **dedicated patient web application** (`apps/patient-portal` intent). Clinic-dashboard is for staff admin of portal, not patient primary UX. |
| **Rationale** | Security session separation; branding; Option B approved. |
| **Consequences** | New frontend app in monorepo; shared design tokens via White Label where applicable. |
| **Deferred alternatives** | Option A clinic-dashboard-only (rejected); native apps (deferred). |

## OD-API

| Field | Content |
|-------|---------|
| **Context** | Multiple clients (web now, mobile later) need stable contracts. |
| **Decision** | **API-first**: all portal capabilities exposed via versioned HTTP public APIs under patient-portal module; UI is a client. |
| **Rationale** | Portability (OD-PORTABILITY); testability; no UI-only business rules. |
| **Consequences** | Business rules live in API module; SPA remains thin. |
| **Deferred alternatives** | BFF-per-channel with divergent rules (rejected). |

## OD-AUTH

| Field | Content |
|-------|---------|
| **Context** | Patients must authenticate without using staff sessions. |
| **Decision** | Reuse Auth primitives; introduce/maintain a **distinct patient session class** bound to `PortalAccount`. |
| **Rationale** | Prevent privilege confusion; maximize reuse. |
| **Consequences** | Cookies/claims/audience separated; staff JWT cannot call patient PHI facades and vice versa. |
| **Deferred alternatives** | Shared undifferentiated session (rejected). |

## OD-ENROLLMENT

| Field | Content |
|-------|---------|
| **Context** | Accounts must be provably linked before PHI access. |
| **Decision** | Portal-owned enrollment lifecycle to **ACTIVE**; incomplete states deny PHI facades. |
| **Rationale** | Healthcare identity assurance; Audit trail. |
| **Consequences** | Invite/verify/activate flows mandatory before records/billing reads. |
| **Deferred alternatives** | Open registration without clinic linkage (rejected for MVP). |

## OD-MFA

| Field | Content |
|-------|---------|
| **Context** | Portal access is privileged relative to public internet. |
| **Decision** | MFA is **policy-driven** using platform MFA; tenant/security policy may require MFA for portal; portal does not invent a second MFA engine. |
| **Rationale** | Reuse; compliance. |
| **Consequences** | Enrollment includes MFA when policy on; Auth remains factor SoR. |
| **Deferred alternatives** | Portal-specific MFA stack (rejected). |

## OD-SESSION

| Field | Content |
|-------|---------|
| **Context** | Need predictable logout, timeout, revoke. |
| **Decision** | Session lifecycle aligns with Auth patterns; portal enforces revoke on disable/grant loss; idle/absolute timeouts configurable. |
| **Rationale** | Security consistency. |
| **Consequences** | Central revoke paths; caregiver grant revoke kills acting session context. |
| **Deferred alternatives** | Infinite sessions (rejected). |

## OD-CAREGIVER

| Field | Content |
|-------|---------|
| **Context** | Parents/caregivers need scoped access. |
| **Decision** | `CaregiverAccessGrant` is portal SoR; **scope enforcement is mandatory before any PHI read/write**. |
| **Rationale** | Review hard requirement; license `caregiverAccess`. |
| **Consequences** | Every facade accepts acting-patient + grant check; deny by default. |
| **Deferred alternatives** | Implicit family access without grants (rejected). |

## OD-PHI

| Field | Content |
|-------|---------|
| **Context** | Portal surfaces PHI. |
| **Decision** | Fail-closed PHI policy: minimize fields; no PHI in logs/Activity; caregiver check first; tenant match mandatory. |
| **Rationale** | Compliance; Align with platform PHI rules. |
| **Consequences** | DTO allowlists; redaction in Observability. |
| **Deferred alternatives** | Log-full clinical payloads for debug (rejected). |

## OD-RESULTS

| Field | Content |
|-------|---------|
| **Context** | Labs/results may need clinician release. |
| **Decision** | Portal applies **clinic result-release policy** before returning results; unreleased → not visible (or explicit “pending release” non-PHI status only). |
| **Rationale** | Clinical safety. |
| **Consequences** | Policy config outside portal engine; portal is enforcer. |
| **Deferred alternatives** | Always show raw LIS feed (rejected). |

## OD-MESSAGING

| Field | Content |
|-------|---------|
| **Context** | Patients expect secure messaging. |
| **Decision** | Portal consumes Messaging SoR via public contracts; Notification for alerts. |
| **Rationale** | No duplicate messaging engine. |
| **Consequences** | MVP messaging is integration slice, not new SoR. |
| **Deferred alternatives** | Portal-embedded chat product (rejected). |

## OD-BILLING

| Field | Content |
|-------|---------|
| **Context** | Patients need financial transparency. |
| **Decision** | Portal is billing **consumer** for patient-safe statements/balances. |
| **Rationale** | Ledger integrity. |
| **Consequences** | No portal posting/ledger. |
| **Deferred alternatives** | Portal invoices as SoR (rejected). |

## OD-PAYMENTS

| Field | Content |
|-------|---------|
| **Context** | Optional online pay. |
| **Decision** | Payment **initiation** only through existing payment adapters; ledger remains Billing/Payments SoR; MVP may limit methods. |
| **Rationale** | PCI/reuse. |
| **Consequences** | Portal never stores PAN/CHD. |
| **Deferred alternatives** | Portal payment gateway (rejected). |

## OD-DOCUMENTS

| Field | Content |
|-------|---------|
| **Context** | Forms, after-visit summaries, etc. |
| **Decision** | Documents SoR owns storage; portal lists/downloads entitled artifacts only. |
| **Rationale** | Single document store. |
| **Consequences** | Entitlement checks mirror clinical/billing release rules as applicable. |
| **Deferred alternatives** | Portal file bucket SoR (rejected). |

## OD-NOTIFY

| Field | Content |
|-------|---------|
| **Context** | Portal events need patient outreach. |
| **Decision** | Emit Notification Center intents only (Release 41 unchanged). |
| **Rationale** | Frozen Notification architecture. |
| **Consequences** | Template keys registered with Notification; no portal SMTP. |
| **Deferred alternatives** | Portal email sender (rejected). |

## OD-AUDIT

| Field | Content |
|-------|---------|
| **Context** | Compliance for portal privileged ops. |
| **Decision** | Audit Center remains SoR; portal emits required audit events. |
| **Rationale** | Frozen Audit architecture. |
| **Consequences** | Enrollment, grants, consent, privileged PHI access classes audited. |
| **Deferred alternatives** | Portal-only audit table as compliance SoR (rejected). |

## OD-ACTIVITY

| Field | Content |
|-------|---------|
| **Context** | Ops visibility for portal actions. |
| **Decision** | Activity Center for non-PHI operational events. |
| **Rationale** | Frozen Activity architecture. |
| **Consequences** | Event catalog without PHI bodies. |
| **Deferred alternatives** | None material. |

## OD-OBSERVABILITY

| Field | Content |
|-------|---------|
| **Context** | Portal must be operable. |
| **Decision** | Consume Observability Center (45) for traces/metrics/logs/health; no parallel stack. |
| **Rationale** | Release 45 frozen. |
| **Consequences** | Portal routes contribute spans/metrics with redaction. |
| **Deferred alternatives** | Sidecar-only APM product (rejected). |

## OD-WHITELABEL

| Field | Content |
|-------|---------|
| **Context** | Multi-tenant branding for patient app. |
| **Decision** | Patient app consumes White Label tokens; no per-tenant code forks. |
| **Rationale** | Existing White Label SSOT. |
| **Consequences** | Theme bootstrap from tenant branding API. |
| **Deferred alternatives** | Hardcoded CSS per clinic (rejected). |

## OD-LICENSE

| Field | Content |
|-------|---------|
| **Context** | Portal is a licensed module. |
| **Decision** | Enforce `patientPortal` + `caregiverAccess`; fail closed. |
| **Rationale** | Licensing architecture. |
| **Consequences** | Enablement path: license → flag → use. |
| **Deferred alternatives** | Free unmanaged portal (rejected). |

## OD-FLAGS

| Field | Content |
|-------|---------|
| **Context** | Safe rollout. |
| **Decision** | Master flag default **OFF**; incremental sub-flags default **OFF**. |
| **Rationale** | Platform Centers pattern (41–45). |
| **Consequences** | Production stays dark until acceptance enablement gate. |
| **Deferred alternatives** | Flag ON by default (rejected). |

## OD-TENANCY

| Field | Content |
|-------|---------|
| **Context** | Multi-tenant SaaS. |
| **Decision** | All portal data and queries are tenant-scoped; cross-tenant access impossible. |
| **Rationale** | Platform invariant. |
| **Consequences** | `tenantId` on portal aggregates and every query path. |
| **Deferred alternatives** | Shared patient pool (rejected). |

## OD-BRANCH

| Field | Content |
|-------|---------|
| **Context** | Multi-branch clinics. |
| **Decision** | Branch is an **optional filter** on lists (appointments, etc.); branch **never broadens** PHI beyond patient/grant; missing branch claim does not imply all-branches staff power. |
| **Rationale** | Review freeze input. |
| **Consequences** | Explicit branch query params / claims; default = patient’s relevant branches only. |
| **Deferred alternatives** | Branch as second authorization dimension replacing patient link (rejected). |

## OD-STORAGE

| Field | Content |
|-------|---------|
| **Context** | What may portal persist? |
| **Decision** | Portal persists **only** portal-native aggregates (accounts, enrollment, grants, portal prefs/settings). Clinical/billing/files remain in domain stores. |
| **Rationale** | SoR matrix. |
| **Consequences** | No duplicated EMR/billing tables in portal schema. |
| **Deferred alternatives** | Portal clinical cache as SoR (rejected). |

## OD-PORTABILITY

| Field | Content |
|-------|---------|
| **Context** | Future mobile / alternate clients. |
| **Decision** | Public APIs are the portability surface; web is first client; native apps deferred but **must not require API redesign** if contracts stay stable. |
| **Rationale** | OD-API. |
| **Consequences** | Avoid web-only hidden business rules. |
| **Deferred alternatives** | Mobile-specific private APIs as sole path (rejected). |

## OD-EXTENSIBILITY

| Field | Content |
|-------|---------|
| **Context** | Future features without forks. |
| **Decision** | Extend via adapters, versioned DTOs, feature flags, and domain contracts — not marketplace runtime in MVP. |
| **Rationale** | Marketplace deferred; clean core. |
| **Consequences** | Execution Planning slices flags; core BC stays stable. |
| **Deferred alternatives** | Pack-only portal (rejected for Phase 46). |

---

# Implementation Constraints

The following rules are **frozen** for all Execution Planning and Implementation:

1. **No duplicated business logic** across portal and domain modules.  
2. **No duplicated scheduling engine.**  
3. **No duplicated EMR / clinical engine.**  
4. **No duplicated billing / ledger engine.**  
5. **No duplicated notification / delivery engine.**  
6. **Portal consumes public (or approved application-layer) contracts only** — no silent table coupling to foreign schemas as SoR.  
7. **API-first architecture** — UI is a client.  
8. **Stateless backend** processes (standard Nest horizontal scaling).  
9. **Dedicated frontend** patient app — not staff chrome.  
10. **Repository conventions** — extend `patient-portal` module; match existing Nest/Prisma/RBAC/flag patterns.  
11. **Feature flags default OFF.**  
12. **Licensing respected** (`patientPortal`, `caregiverAccess`).  
13. **PHI protection mandatory** (minimize, redact, fail closed).  
14. **Caregiver scope enforcement before PHI reads.**  
15. **Releases 41–45 remain unchanged** (consume only).  
16. **Patient Portal is not a clinical System of Record.**  
17. **Tenant isolation on every path.**  
18. **Result-release policy enforced before results display.**  
19. **Patient session ≠ staff session.**  
20. **Enrollment must complete before PHI facades.**  
21. **Incremental vertical slices** under this architecture — no Option C big-bang as release architecture.  
22. **Architectural changes after freeze require formal change process.**

---

# Upgrade Strategy

| Principle | Rule |
|-----------|------|
| Additive | Prefer additive APIs/models; avoid breaking patient clients without versioning |
| Foundation | Preserve `PortalAccount` / `CaregiverAccessGrant` semantics; evolve via migrations |
| Flags | Ship dark (OFF); enable per acceptance |
| Domains | No forced redesign of Scheduling/EMR/Billing for portal |
| Rollback | Disable master flag to dark-close portal without DB drop |

---

# Governance

| Artifact | Role |
|----------|------|
| This document | **Phase 46 architectural SSOT** |
| Discovery / Review | Historical inputs; superseded on conflicts by this freeze |
| Execution Planning | Must cite OD-* and SoR matrix; cannot contradict freeze without change control |
| Implementation | Authorized only after Execution Planning approval |
| Production Acceptance / Release | Validate against this SSOT |

**Change control:** Any modification to OD-*, SoR matrix, topology, or constraints requires explicit architecture change approval — not silent drift in PRs.

---

# Explicit Freeze Confirmations

- Architecture is **frozen** in this document.  
- All listed Architecture Decisions (**OD-***) are **finalized**.  
- Releases **41–45** remain **unchanged**.  
- Patient Portal is **not** a clinical System of Record.  
- **Implementation is not yet authorized.**  
- Project is **ready for Execution Planning** (planning only — not build).

---

**Document status:** APPROVED AND FROZEN  
**Next authorized phase:** Execution Planning (no code until that plan is approved)
