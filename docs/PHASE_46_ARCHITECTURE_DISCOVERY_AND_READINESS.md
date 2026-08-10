# Phase 46 — Architecture Discovery and Readiness Report

**Document type:** Architecture discovery & readiness  
**Date:** 2026-07-18  
**Capability:** Patient Portal (patient self-service experience)  
**Dynamic Platform phase:** **46**  
**Prior release baselines:** Release **41.0** (Notification) · **42.0** (Import/Export) · **43.0** (Backup & Restore) · **44.0** (API Keys & Integrations) · **45.0** (Observability) — **PRODUCTION ACCEPTED**

| Constraint | Status |
|------------|--------|
| Production / application code changed during discovery | **No** |
| Migrations / modules / APIs / UI / schemas introduced | **No** |
| Final architecture designed | **Yes** — frozen in [`PATIENT_PORTAL_ARCHITECTURE.md`](./PATIENT_PORTAL_ARCHITECTURE.md) (post-Discovery) |
| Architecture Decisions created | **Yes** — OD-* register in Freeze SSOT (post-Discovery) |
| Execution plan written | **No** |
| Feature flags / DB schema modified | **No** |
| Phases 1–45 / Releases 41–45 redesigned | **No** |

---

# Executive Summary

After Production Acceptance of **System Monitoring & Observability** (Phase **45** / Release **45.0**), the next Dynamic Platform product capability permanently numbered **Phase 46** is the **Patient Portal**.

Authoritative numbering appears in [`CURRENT_SYSTEM_AUDIT_AND_EXPLANATION.md`](./CURRENT_SYSTEM_AUDIT_AND_EXPLANATION.md) (roadmap rows assigning **46 = Patient Portal**, **47 = Super Admin**). Phase **37** remains reserved for Department / Franchise hardening and must not be renumbered into 46.

The Healthcare ERP already contains a **partial Patient Portal bounded context** (~25% of product intent): portal-account lifecycle, caregiver consent grants, notification preference storage, audited domain events, licensed module gating (`patientPortal`), RBAC resource `api.patient_portal`, and a scheduling self-service slice (`/patient-portal/me/*`) consumed by a clinic-dashboard `MyAppointmentsPage`. What is **missing** is a **dedicated patient-facing application**, a coherent patient identity/auth experience (enrollment, MFA, session model distinct from staff clinic login), and the remaining self-service domains (medical records, prescriptions/refills, secure messaging, billing visibility, documents) under PHI-safe, tenant-isolated, caregiver-scoped access.

**Discovery conclusion:** Business problem, reuse opportunities, integration boundaries, constraints, risks, assumptions, and review questions are sufficiently understood to authorize **Architecture Review**. Technology freezes, Architecture Decisions, and execution sequencing remain **out of scope for this document**.

**Final readiness verdict:**

# READY FOR ARCHITECTURE REVIEW

---

# Business Motivation

## Problem

Patients and caregivers cannot complete a modern self-service care loop without staff intermediaries:

- Booking / rescheduling / canceling appointments without calling reception (partially available via staff-app surfaces, not a patient app).
- Viewing their own medical records, lab results, prescriptions, and documents securely.
- Requesting refills and messaging the clinic for non-urgent questions.
- Viewing billing status and (optionally) paying deposits.
- Managing family/caregiver access with clear consent scopes.

Today, clinic staff operate a mature Dynamic Platform (Phases 30–45). Patients remain a **second-class channel**: APIs exist for accounts and appointments, but UX is embedded in the **clinic dashboard**, with no dedicated patient app (`docs/MONOREPO.md` plans `apps/patient-portal` — not built).

## Business goals

1. **Patient convenience & retention** — reduce no-shows and phone load via self-service.  
2. **Operational efficiency** — shift routine scheduling and information access off reception.  
3. **Caregiver inclusion** — consent-based family access with least-privilege scopes.  
4. **Compliance & trust** — strong auth, PHI minimization, audited consent and access.  
5. **Monetization alignment** — professional+ licensing already anticipates `patientPortal` / `caregiverAccess`.  
6. **Platform completeness** — close the patient-facing gap after platform/ops Centers (41–45).

## Success signals (discovery-level)

- Dedicated patient experience separable from staff clinic-dashboard.  
- Clear enrollment → activation → active use lifecycle.  
- Appointments self-service production-ready on the patient surface.  
- Roadmap path for records, messaging, billing without redesigning EMR/Billing SoRs.  
- Observability, Notification, Audit, and Activity boundaries respected.

---

# Scope

## In scope for Phase 46 discovery (this document)

- Affirm Phase **46 = Patient Portal** numbering.  
- Document business/functional/non-functional requirements at discovery depth.  
- Assess existing portal module, Prisma models, RBAC, licensing, UI stubs.  
- Map integrations to Scheduling, Patients, EMR, Billing, Notifications, Journey, Auth, White Label, Observability.  
- Identify candidate architecture options and a recommended direction for Review.  
- List risks, assumptions, open questions, deferred capabilities.

## Intended product scope (to be refined at Architecture Review — not frozen here)

Candidate product themes for Phase 46 (not decided):

- Patient-facing application shell (web; mobile later).  
- Patient identity / enrollment / session model.  
- Portal account lifecycle & staff administration UX.  
- Appointment self-service (complete vs today’s slice).  
- Caregiver grant enforcement on read APIs.  
- Incremental self-service domains (records, messaging, billing, documents) as Review-scoped increments.  
- Notification preferences wiring to Notification Center.  
- Audit / Activity / Observability integration for portal actions.

---

# Out of Scope

| Out of scope | Rationale |
|--------------|-----------|
| Architecture Decisions / SSOT freeze | Next phase (Review / Freeze) |
| Execution planning / implementation | Later phases |
| Code, API, schema, flag changes | Discovery constraint |
| Redesign of Releases 41–45 Centers | Frozen baselines |
| Phase **37** Department / Franchise | Reserved numbering |
| Phase **47** Super Admin console | Separate roadmap row |
| Full Marketplace / Plugin SDK runtime | Unnumbered strategic future |
| FHIR/HIE mesh, telehealth, wearables | FEATURE_INVENTORY Future / separate programs |
| Becoming EMR / Billing / Messaging SoR | Portal is a **consumer** surface |
| SIEM, synthetic monitoring product | Observability deferred ODs — not Portal |
| Replacing clinic-dashboard staff UX | Staff SoR remains clinic-dashboard |

---

# Functional Requirements

Discovery requirements (to be prioritized/sliced at Review):

### F1 — Portal identity & enrollment
- Invite / activate / suspend / reactivate / deactivate portal accounts (exists in API).  
- Link portal account to Patient + optional User identity.  
- Patient-facing enrollment completion (invite acceptance, password/MFA) — **gap**.  
- Locale preferences (AR/EN) — stored; UX incomplete on patient surface.

### F2 — Appointment self-service
- List / book / cancel / reschedule own appointments (API exists).  
- Provider browse + availability (API exists).  
- Configurable cancellation window / confirmation flows (product rules TBD).  
- Reminder integration via Notification Center (partial automation for invite).

### F3 — Caregiver / family access
- Grant / revoke scoped caregiver access (API exists).  
- Enforce scopes (`appointments`, `medical_records`, `prescriptions`, `billing`, `messages`) on read APIs — **largely unimplemented**.  
- Caregiver UX — **missing**.

### F4 — Medical records access (patient-safe)
- View encounters, medications, allergies, lab results, prescriptions, documents — **missing portal APIs/UI**.  
- Clinician release gates / delay abnormal results — open clinical policy question.  
- Never elevate portal to write clinical SoR without staff workflows.

### F5 — Prescription refill requests
- Request / track refill approvals — **missing**.

### F6 — Secure messaging
- Non-urgent patient↔clinic messaging with SLA / triage — **missing** (scope token only).

### F7 — Billing visibility (and optional payment)
- View invoices / balances; optional deposit at booking — **missing** portal APIs.

### F8 — Preferences & notifications
- Email/SMS/push preference flags (stored).  
- Map to Notification Center templates/channels — incomplete.

### F9 — Staff administration
- Staff invite/governance of portal accounts — API exists; **Settings/ops UI missing**.

### F10 — Branding / white-label
- Portal surface branding slots exist in White Label — apply in dedicated patient app.

---

# Non-Functional Requirements

| Category | Discovery requirement |
|----------|----------------------|
| Security | Strong patient auth; MFA; session isolation from staff; PHI least privilege; caregiver consent audited |
| Privacy | Fail-closed PHI; no cross-tenant leakage; caregiver scope enforcement |
| Tenancy | Strict tenant (+ optional branch) isolation on all portal queries |
| Availability | Portal degradation must not take down clinic clinical path |
| Performance | Mobile-first; acceptable p95 for list/book on shared API |
| Scalability | Multi-tenant portal sessions; rate limits for patient auth and booking |
| Accessibility | WCAG-oriented patient UX (AR/EN, RTL) |
| Observability | Portal SLIs via Observability Center (Phase 45) — consume, do not redesign |
| Auditability | Privileged staff portal actions + caregiver consent in Audit Center |
| Operability | Feature/license gates; dormant-safe when module not licensed |
| DR | Portal is secondary to clinical SoR; restore via existing BR Center |

---

# Repository Assessment

## Numbering affirmation

| Claim | Authority |
|-------|-----------|
| Phase 46 = Patient Portal | [`CURRENT_SYSTEM_AUDIT_AND_EXPLANATION.md`](./CURRENT_SYSTEM_AUDIT_AND_EXPLANATION.md) |
| Phase 47 = Super Admin | Same audit |
| Phase 37 = Department / Franchise (reserved) | Multi-Branch §23; Activity/Journey numbering notes |
| Releases 41–45 complete | Phase/Production Acceptance + Release docs (audit table rows for 42–45 may lag — treat release docs as authoritative for completion) |

## Existing codebase snapshot (as discovered)

| Area | Path / signal | Maturity |
|------|---------------|----------|
| Backend module | `apps/api/src/modules/patient-portal` | Foundation + scheduling slice |
| Prisma | `PortalAccount`, `CaregiverAccessGrant`, `PortalAccountStatus` | Present |
| Staff/patient UX | `apps/clinic-dashboard/.../MyAppointmentsPage.tsx` | Stub patient surface inside staff app |
| Dedicated patient app | `apps/patient-portal` | **Not present** (MONOREPO planned) |
| Mobile app | None under `apps/` | Missing |
| Module registry | `patientPortal` builtin manifest | Present |
| Licensing | `patientPortal` module; `caregiverAccess` plan limit | Present |
| RBAC | `api.patient_portal` | Present |
| Tests | Multiple handler/domain specs under `patient-portal/tests` | Present for foundation |

## Public API surface (existing — not redesigned here)

**Accounts:** `POST/GET /patient-portal/accounts`, lifecycle activate/suspend/reactivate/deactivate, preferences PATCH, caregiver grant/revoke.  
**Self-service:** `GET/POST/PATCH /patient-portal/me/appointments`, `GET /patient-portal/me/providers`, `GET /patient-portal/me/availability`.

## Domain boundaries (current)

- **Portal owns:** portal enrollment aggregate, preferences, caregiver grants, portal scheduling facade.  
- **Portal does not own:** EMR write model, billing ledger, notification delivery, scheduling engine core, identity SoR, audit SoR.

---

# Existing Components That Can Be Reused

| Component | Reuse for Phase 46 |
|-----------|-------------------|
| `PatientPortalModule` + Prisma models | Extend; do not replace bounded context |
| Scheduling handlers (`Create/UpdateAppointment`, availability) | Continue via portal facade |
| Auth / JWT / MFA infrastructure | Extend for patient enrollment/session (Review decides model) |
| Permission matrix `api.patient_portal` | Extend actions/roles carefully |
| Licensing `patientPortal` / `caregiverAccess` | Keep as product gates |
| Notification Center intents + templates | Portal lifecycle & reminders |
| Audit Center + portal audit log adapter | Consent & privileged staff actions |
| Activity Center emitters | Patient-visible breadcrumbs (optional) |
| White Label `patientPortal` surface | Brand patient app |
| Dynamic Module Registry / routing | Nav discoverability for staff admin + optional portal routes |
| Observability Center (45) | Portal metrics/logs/traces/health contributors |
| Import/Export / Backup / Integrations | No redesign; portal data covered by existing clinical DR where applicable |
| DESIGN_SYSTEM / i18n EN-AR | Patient app UX foundations |

---

# Integration Analysis

```
                    ┌─────────────────────────────┐
                    │   Patient-facing app (gap)  │
                    └──────────────┬──────────────┘
                                   │ HTTPS / JWT
                    ┌──────────────▼──────────────┐
                    │   Patient Portal APIs       │
                    │   accounts + me/*           │
                    └──────┬─────┬─────┬──────────┘
           ┌───────────────┘     │     └────────────────┐
           ▼                     ▼                      ▼
    Scheduling SoR         Patients / EMR          Billing (future)
           │                     │                      │
           └──────────┬──────────┴──────────┬───────────┘
                      ▼                     ▼
              Notification Center     Audit / Activity
                      │
                      ▼
              Observability Center (signals only)
```

### Integration boundaries (must preserve)

| System | Portal may | Portal must not |
|--------|------------|-----------------|
| Scheduling | Book/cancel/reschedule for linked patient | Bypass slot rules / double-book engines |
| EMR / clinical | Read patient-safe projections | Become clinical write SoR |
| Billing | Read invoices / initiate allowed payments | Rewrite ledger SoR |
| Notification | Emit intents / honor prefs | Own delivery queues |
| Audit | Record consent & privileged ops | Dump clinical charts as audit blobs |
| Activity | Optional ops/patient breadcrumbs | Replace Activity timeline product |
| Observability | Emit PHI-safe telemetry | Store PHI in metrics/traces |
| Integrations (44) | Use for future FHIR/payment providers | Bypass credential/scope model |
| Identity | Link User↔PortalAccount | Collapse staff & patient auth indiscriminately |

---

# Security Considerations

- Patient accounts are **high-value PHI gateways**; stolen sessions expose clinical data.  
- Must separate **staff clinic sessions** from **patient portal sessions** (open question: same IdP vs distinct client).  
- Caregiver grants are a privacy surface — scopes must be enforced server-side, not UI-only.  
- MFA for patients strongly recommended (FEATURE_INVENTORY critique).  
- Rate-limit invite, login, booking, messaging.  
- Align role naming mismatch (`admin`/`tenant_admin` vs matrix `owner`/`general_manager`) during Review — security consistency risk.  
- RLS still app-enforced (platform known limitation) — portal queries must remain tenant-scoped in application layer.  
- Observability scrubbing (Phase 45) applies to portal telemetry — no patient identifiers in metric labels.

---

# Multi-Tenant Considerations

- Every portal account is tenant-scoped (`tenantId`, optional `branchId`).  
- Patients must never see cross-tenant data.  
- Caregiver grants are within-tenant; cross-tenant caregivers rejected.  
- Platform operators (Super Admin — Phase 47) are out of Phase 46 scope except as non-interference.  
- Branch scoping for multi-branch clinics needs Review clarity (patient “home branch” vs multi-branch booking).

---

# Licensing Considerations

- Module id `patientPortal` — `minPlan: 'professional'` (discovered in licensing config).  
- Plan limit `caregiverAccess` false on starter; true on professional+.  
- Controllers already use `@RequireLicensedModule('patientPortal')`.  
- Discovery note: `FEATURE_GATE_MATRIX.md` may lag code — Review should reconcile documentation.  
- Enabling portal must not enable Observability/IE/BR/Integrations flags (no side-enable).

---

# Configuration Considerations

- Portal policies (cancellation windows, reminder offsets, messaging SLA, result-release delay) need a configuration ownership model at Review (Settings vs portal policy service).  
- Existing `PatientPortalPolicyService` is a starting point.  
- White-label portal branding configuration already partially modeled.  
- Locale defaults AR/EN already on account preferences.

---

# Observability Considerations

- Reuse Phase 45 Observability Center: portal request rates, booking failures, auth failures, caregiver grant events (ops-safe labels only).  
- Health contributor for portal module (dormant when unlicensed/flagged).  
- Correlation IDs on portal HTTP and notification intents.  
- Do not invent a second APM/SIEM for portal.

---

# Performance Considerations

- Patient traffic is bursty around clinic hours; booking + availability reads must stay cheap.  
- Availability queries should reuse scheduling caches/indexes — avoid N+1 across providers.  
- Patient app should be mobile-first; minimize payload PHI.  
- Messaging/attachments (future) need upload size limits and async processing.

---

# Scalability Considerations

- Horizontal API scale already assumed; portal sessions must work multi-instance (shared session/JWT validation).  
- Caregiver grant checks should be indexed (`portalAccountId`, active grants).  
- Avoid unbounded caregiver fan-out per patient.  
- Future messaging may need dedicated queue — Review decides; do not merge notification-delivery / import-export / integrations-webhooks queues.

---

# Risks

| ID | Risk | Sev | Notes |
|----|------|-----|-------|
| R1 | PHI leak via portal / caregiver over-scope | Critical | Enforce scopes; audit consent |
| R2 | Staff/patient auth confusion | High | Distinct UX + session model |
| R3 | Scope creep into full EMR/telehealth | High | Hard out-of-scope list |
| R4 | Building inside clinic-dashboard forever | High | Blocks true patient UX |
| R5 | Role-name mismatch causes broken gates | Med | Align during Review |
| R6 | Result release without clinician gate | Med | Clinical policy needed |
| R7 | Messaging liability / doctor overload | Med | Triage + disclaimers |
| R8 | Payment PCI scope expansion | Med | Prefer existing payment adapters |
| R9 | Neglecting AR/RTL accessibility | Med | Brand + i18n requirements |
| R10 | Interfering with frozen Centers 41–45 | High | Boundary tests |

---

# Assumptions

1. Phase **46** permanently means **Patient Portal** (audit roadmap).  
2. Existing `patient-portal` bounded context remains the SoR for portal enrollment.  
3. Scheduling, Patients, EMR, Billing engines remain authoritative SoRs; portal is a facade/consumer.  
4. Notification Center remains delivery SoR.  
5. Observability Center remains telemetry SoR for ops signals.  
6. A dedicated patient-facing web app will be required for a credible Release 46.0 (exact packaging decided at Review).  
7. Mobile native apps are deferred unless Review expands scope.  
8. Phase 37 Department hierarchy is not a Phase 46 dependency (nullable-safe only).  
9. Marketplace packs for portal extensions are future, not required for MVP discovery.  
10. Releases 41–45 remain frozen and flag-default-OFF where applicable.

---

# Open Questions

Architecture Review must resolve (without freezing decisions in this document):

1. **Patient app packaging:** new `apps/patient-portal` vs branded subdomain of clinic-dashboard vs BFF?  
2. **Auth model:** shared Identity users with `patient` role vs portal-specific credentials vs magic-link invite?  
3. **MFA policy:** mandatory vs optional by tenant policy?  
4. **Caregiver identity:** caregivers as portal accounts, linked users, or invite-only delegates?  
5. **MVP slice for Release 46.0:** accounts+appointments only vs include records read?  
6. **Clinical release gate** for lab results / notes before patient visibility?  
7. **Messaging SoR:** new portal messaging module vs extend an existing communications model?  
8. **Payments:** deposit at booking in MVP or defer?  
9. **Feature flag:** new `PATIENT_PORTAL_*` master flag vs license-only gating (today license-centric)?  
10. **Branch booking rules** for multi-branch tenants?  
11. **Staff admin UX location:** Settings hub parity vs Patients module tabs?  
12. **Offline / PWA** expectations for patient app?  
13. **Relation to Journey packs:** patient-visible journey status in portal MVP?  
14. **API versioning** for breaking patient clients?  
15. **Data residency / export** of portal consent history under Import/Export or Audit only?

---

# Candidate Architecture Options

> Options only — **not** Architecture Decisions.

### Option A — “Complete the facade” (API-first, clinic-dashboard patient mode)

- Expand `/patient-portal/*` APIs; keep UX inside clinic-dashboard routes (`/portal/*`, `/my-appointments`).  
- **Pros:** fastest; reuses shell.  
- **Cons:** fails dedicated-app expectation; staff chrome leakage; weak patient brand; security confusion.

### Option B — Dedicated patient web app + shared API (recommended direction)

- New patient app consumes existing portal APIs; staff admin remains clinic-dashboard.  
- Extend APIs for records/messaging/billing behind same bounded context / anti-corruption facades.  
- **Pros:** clear UX/security separation; white-label ready; aligns MONOREPO plan.  
- **Cons:** more front-end work; auth/session design required.

### Option C — Full clinical self-service platform in one release

- App + records + messaging + billing + refills + payments in a single big-bang.  
- **Pros:** product completeness.  
- **Cons:** high risk; likely blocks acceptance; scope collision with EMR/Billing.

### Option D — Portal as Marketplace-pack runtime

- Treat patient portal primarily as installable packs.  
- **Pros:** strategic extensibility.  
- **Cons:** Marketplace runtime not ready; delays patient value.

---

# Recommended Direction

**Recommend Option B** as the starting posture for Architecture Review:

1. Affirm Phase **46 = Patient Portal** product capability.  
2. Preserve and extend the existing `patient-portal` bounded context (do not rewrite).  
3. Introduce a **dedicated patient-facing web application** as the primary patient UX.  
4. Keep staff portal administration in clinic-dashboard/Settings.  
5. Treat scheduling self-service as the first vertical completion path.  
6. Enforce caregiver scopes on any new read APIs before expanding PHI surfaces.  
7. Integrate Notification, Audit, Activity, and Observability as **consumers/emitters**, not redesigns.  
8. Slice subsequent domains (records → messaging → billing → refills) as Review-approved increments — avoid Option C big-bang.  
9. Explicitly defer Phase 37, Phase 47, Marketplace runtime, FHIR mesh, and native mobile.

This direction maximizes reuse, respects frozen Centers, and closes the largest patient-experience gap with controlled risk.

---

# Readiness Assessment

| Criterion | Status |
|-----------|--------|
| Business problem clearly defined | **Yes** |
| Numbering affirmed (46 = Patient Portal) | **Yes** |
| Repository reuse opportunities identified | **Yes** |
| Integration points documented | **Yes** |
| Architectural constraints identified | **Yes** |
| Risks & assumptions documented | **Yes** |
| Open questions listed for Review | **Yes** |
| Candidate options + recommended direction | **Yes** |
| No code / ADs / execution plan produced | **Yes** |
| Ready for Architecture Review | **Yes** |

**Blocking unknowns:** None that prevent Review from starting. Open questions are appropriate Review inputs, not discovery blockers.

---

## Appendix A — Key references

- [`CURRENT_SYSTEM_AUDIT_AND_EXPLANATION.md`](./CURRENT_SYSTEM_AUDIT_AND_EXPLANATION.md) — Phase 46 numbering  
- [`FEATURE_INVENTORY.md`](./FEATURE_INVENTORY.md) §5.1 — product backlog  
- [`INFORMATION_ARCHITECTURE.md`](./INFORMATION_ARCHITECTURE.md) §7 — portal UX target + implemented slice  
- [`PERMISSIONS.md`](./PERMISSIONS.md) / permission matrices — `api.patient_portal`  
- [`RELEASE_45_0.md`](./RELEASE_45_0.md) — prior baseline  
- [`MONOREPO.md`](./MONOREPO.md) — planned `patient-portal` app  
- Module: `apps/api/src/modules/patient-portal`  
- UI stub: `apps/clinic-dashboard/src/features/patient-portal`

## Appendix B — Deferred capabilities (explicit)

- Native mobile patient apps  
- Telehealth video visits  
- Wearables / remote monitoring  
- FHIR patient access APIs as primary portal protocol  
- Marketplace portal packs runtime  
- Super Admin (47)  
- Department/Franchise (37)  
- Full result-interpretation AI / clinical chatbots  

---

**Document control:** Discovery only. Does not authorize implementation. Does not freeze architecture. Does not create Architecture Decisions.
