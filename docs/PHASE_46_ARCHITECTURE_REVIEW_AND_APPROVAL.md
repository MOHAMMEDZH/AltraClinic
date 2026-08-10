# Phase 46 — Architecture Review and Approval

**Document type:** Architecture governance — review, freeze readiness  
**Date:** 2026-07-18  
**Capability:** Patient Portal (patient self-service experience)  
**Dynamic Platform phase:** **46**  
**Authoritative input:** [`PHASE_46_ARCHITECTURE_DISCOVERY_AND_READINESS.md`](./PHASE_46_ARCHITECTURE_DISCOVERY_AND_READINESS.md)  
**Prior release baselines:** Release **41.0** (Notification) · **42.0** (Import/Export) · **43.0** (Backup & Restore) · **44.0** (API Keys & Integrations) · **45.0** (Observability) — **PRODUCTION ACCEPTED / FROZEN**  
**Review posture:** Independent governance review against discovery + frozen Releases 41–45 SSOTs  

| Constraint | Status |
|------------|--------|
| Production / application code changed during review | **No** |
| Migrations / APIs / UI / schemas introduced | **No** |
| Architecture Decisions (formal OD register) | **Deferred from this review** — finalized in Freeze SSOT |
| Architecture SSOT freeze document | **DONE** — [`PATIENT_PORTAL_ARCHITECTURE.md`](./PATIENT_PORTAL_ARCHITECTURE.md) |
| Execution planning document | **DONE** — [`PHASE_46_EXECUTION_PLAN.md`](./PHASE_46_EXECUTION_PLAN.md) |
| Execution / implementation | **NOT AUTHORIZED** until Execution Plan approval; then **46a only** |
| Phases 1–45 / Releases 41–45 redesigned | **No** |

---

# Executive Review

## Purpose

Validate that Discovery’s recommended direction — **dedicated patient web app + shared/extended `patient-portal` bounded context (Option B)** — is architecturally sound, compatible with frozen Centers, and ready for Architecture Freeze.

## Discovery quality

| Discovery claim | Review finding |
|-----------------|----------------|
| Phase 46 = Patient Portal | **Accepted** — audit roadmap; Phase 37 reserved; Phase 47 = Super Admin |
| Existing portal BC ~25% foundation | **Accepted** — accounts, caregiver grants, `/me` scheduling |
| Dedicated patient app is missing | **Accepted** — clinic-dashboard stub is not a patient product |
| Portal must remain consumer of SoRs | **Accepted and reinforced** |
| Option B recommended | **Accepted** as freeze posture |
| No blocking unknowns for Review | **Accepted** — open questions are freeze inputs, not discovery defects |

**Discovery quality:** Sufficient. **No return-to-discovery required.**

## Overall verdict

Discovery’s boundaries, reuse model, and recommended direction are **approved** for Architecture Freeze. Formal Architecture Decisions must be written in the Freeze SSOT (this review intentionally does **not** mint an OD register). Implementation remains unauthorized until Freeze + Execution Planning complete.

---

# Architecture Assessment

## Business alignment

**PASS.** Patient self-service closes a material product gap after platform/ops Centers (41–45), aligns with FEATURE_INVENTORY §5.1 and IA §7, and matches licensing already anticipating `patientPortal` / `caregiverAccess`.

## Scope definition

**PASS with freeze discipline required.**

| Must be in Freeze MVP framing | Must stay deferred / out |
|------------------------------|---------------------------|
| Dedicated patient web app | Native mobile (readiness only) |
| Patient auth/enrollment/session distinct from staff chrome | Telehealth, wearables, FHIR-as-portal |
| Portal account lifecycle + staff admin UX | Phase 37 Department / Phase 47 Super Admin |
| Appointment self-service completion | Marketplace pack runtime |
| Caregiver grant **enforcement** on any PHI read | Full messaging/billing/refills big-bang unless sliced |
| Notification / Audit / Activity / Observability integration as consumers | Redesign of Releases 41–45 |

Freeze must adopt **incremental vertical slices** (appointments → scoped reads → messaging/billing) and reject Option C big-bang.

## Functional completeness (for freeze, not for one release)

Functional themes F1–F10 are **complete enough as a product map**. Freeze must map each theme to owning bounded context and MVP vs later increment — not attempt all themes in Release 46.0.

## Non-functional requirements

NFR table in discovery is **accepted**: security-first patient identity, fail-closed PHI, tenant isolation, clinical-path independence, Observability consumption, Audit for consent/privileged ops, DR secondary to clinical SoR.

## Recommended direction (Option B)

| Alternative | Review decision |
|-------------|-----------------|
| A — Clinic-dashboard patient mode only | **Rejected** as primary architecture — security/UX confusion; fails dedicated-app need |
| B — Dedicated patient web app + shared API | **Approved** for Freeze |
| C — Full clinical self-service big-bang | **Rejected** as release architecture — scope/risk |
| D — Marketplace-first portal | **Rejected** for Phase 46 — runtime not ready |

---

# Repository Compatibility

| Platform / Release | Compatibility rule for Phase 46 |
|--------------------|----------------------------------|
| **Identity / Auth** | Extend patient enrollment/session; do not collapse staff and patient UX; reuse JWT/MFA primitives where safe |
| **RBAC** | Keep/extend `api.patient_portal`; align coarse portal roles with matrix vocabulary during Freeze |
| **Licensing** | Keep `patientPortal` module + `caregiverAccess` limits; no side-enable of other Center flags |
| **Patients domain** | Portal links to Patient; demographics SoR remains Patients module |
| **Scheduling** | Portal facade calls existing appointment/availability handlers; scheduling engine remains SoR |
| **EMR / clinical** | Portal may expose **patient-safe read projections** only; clinical write SoR unchanged |
| **Billing / payments** | Portal may view/initiate allowed payments via existing billing/payment adapters; ledger SoR unchanged |
| **Notification (41)** | Intents/templates for invite, reminders, messaging notifications; do not own delivery queues |
| **Import/Export (42)** | No redesign; portal consent/export policy via Audit/IE rules as applicable |
| **Backup & Restore (43)** | Portal data secondary; clinical SoR restore priority unchanged |
| **Integrations (44)** | Future payment/FHIR providers via Integrations contracts; no bypass |
| **Observability (45)** | Emit PHI-safe portal SLIs; health contributor; do not build second APM |
| **Activity Center** | Optional breadcrumbs; not patient chart SoR |
| **Audit Center** | Consent + privileged staff portal actions; not telemetry dump |
| **White Label (35)** | Apply `patientPortal` surface branding to dedicated app |
| **Module Registry / Dynamic Routing** | Staff admin discoverability; patient app may be separate deployable |
| **Queues (BullMQ)** | Observe/notify only; **no** merge into notification-delivery / import-export / integrations-webhooks / backup queues |

**Repository fit:** **PASS** — maximizes existing `patient-portal` BC; fills documented MONOREPO gap (`apps/patient-portal`).

---

# Boundary Validation

Responsibility → correct bounded context (review enforcement):

| Responsibility | Owner | Portal role |
|----------------|-------|-------------|
| Patient UI | Dedicated patient app (new) | Presents |
| Staff portal admin UI | Clinic-dashboard / Settings | Presents |
| Patient APIs / enrollment aggregate | `patient-portal` module | **Owns** |
| Authentication / sessions | Identity / Auth | Owns; portal consumes |
| MFA / password reset | Identity / Auth | Owns |
| Authorization (RBAC + ownership ABAC + caregiver scopes) | RBAC + portal guards/domain service | Enforced at portal edge |
| Appointments engine | Scheduling | SoR |
| Appointment self-service facade | `patient-portal` `/me` | Facade |
| Clinical records | EMR / clinical modules | SoR; portal read projection only |
| Messaging | Future messaging BC or approved extension | SoR TBD at Freeze; portal is client |
| Notifications delivery | Notification Center | SoR |
| Notification preferences | Portal account prefs → Notification mapping | Portal stores prefs; NC delivers |
| Billing / invoices | Billing | SoR |
| Payments | Payment adapters / billing | SoR |
| Documents | Document/storage clinical modules | SoR; portal download via authorized projection |
| Observability | Observability Center | SoR for ops telemetry |
| Audit | Audit Center | SoR for evidence |
| Activity | Activity Center | SoR for timeline |
| Reporting / Analytics KPIs | Reporting / Analytics | Unchanged |
| Administration (staff) | Clinic-dashboard + portal admin APIs | Staff only |

### SoR / duplication checks

| Check | Result |
|-------|--------|
| Portal does not become clinical SoR | **PASS** (required) |
| No duplicated scheduling engine | **PASS** — facade pattern already present |
| Caregiver scopes enforced server-side before PHI expansion | **PASS** as Freeze requirement (today: gap) |
| Releases 41–45 not redesigned | **PASS** |
| Bounded contexts preserved | **PASS** |

**Boundary validation:** **PASS**

---

# Security Review

| Topic | Assessment | Freeze requirement |
|-------|------------|--------------------|
| Patient identity lifecycle | Foundation exists (`invited→active→suspended→deactivated`) | Complete patient-facing enrollment acceptance |
| Enrollment | Staff invite API exists; patient accept UX missing | Define invite token / verify / activate path |
| MFA | Platform MFA exists for staff | Patient MFA policy (mandatory vs tenant-optional) |
| Password reset | Auth primitives exist | Patient-safe reset flows; no staff-session reuse |
| Session management | JWT global today | Distinct patient client/audience or equivalent separation from clinic-dashboard sessions |
| Device trust | Not specified | Deferred or minimal (rate limits first) |
| Caregiver authorization | Domain service exists; API enforcement incomplete | **Mandatory** before medical_records/billing/messages reads |
| Caregiver verification | CTO review backlog (contact verify) | Include verification/opt-in in Freeze security model |
| PHI exposure | Redaction for staff viewers of caregiver PII exists | Extend minimization to all portal read projections |
| API authorization | `api.patient_portal` + ownership ABAC | Align role names with permission matrix |
| Cross-tenant isolation | Tenant-scoped reads | Keep fail-closed; never trust client tenant headers alone |
| Rate limiting | Platform limiter exists | Explicit limits for login, invite accept, book, message |
| Public attack surface | New patient app increases exposure | Harden auth endpoints; no `@Public` clinical reads |

**Security assessment:** **ACCEPTABLE for Freeze** if Freeze SSOT mandates session separation, caregiver enforcement-before-PHI, MFA policy, and rate limits. Not acceptable to ship PHI reads without those controls.

---

# Tenant Isolation Review

| Control | Status |
|---------|--------|
| PortalAccount per `(tenantId, patientId)` | Present / required |
| All portal queries tenant-scoped | Required |
| Caregiver grants within tenant only | Required |
| Branch rules for multi-branch booking | Open — Freeze must specify |
| No cross-tenant caregiver | Required |
| Platform Super Admin (47) out of Phase 46 | Affirmed |

**Tenant isolation assessment:** **PASS** (with branch-policy clarification at Freeze).

---

# PHI Protection Review

| Control | Status |
|---------|--------|
| Least-privilege caregiver scopes | Model present; enforcement gap → Freeze gate |
| Owner-only consent (ABAC) | Present — preserve |
| Staff cannot manage patient consent | Present — preserve |
| Clinical write via portal | **Forbidden** |
| Result release / clinician gate | Open clinical policy → Freeze must decide MVP stance |
| Observability labels | No patient identifiers (Phase 45 OD-PHI applies) |
| Audit of grant/revoke | Present — preserve/extend |
| Deactivation cascades grant revocation | Present — preserve |

**PHI protection assessment:** **PASS for Freeze** if SSOT makes caregiver enforcement a hard prerequisite to any clinical/billing/message read APIs.

---

# Integration Review

| Integration | Assessment |
|-------------|------------|
| Scheduling | Sound facade; complete UX on patient app; preserve engine rules |
| Notification | Sound intent consumption; wire prefs; no queue ownership |
| Audit | Sound port/adapter; privileged + consent events |
| Activity | Optional; keep observational |
| Observability | Contribute SLIs/health; fail-open clinical path |
| Licensing / flags | License today; Freeze decides master flag vs license-only |
| White Label | Compatible via existing portal surface |
| Journey (40) | Optional patient-visible status later; not MVP-blocking |
| Payments | Prefer existing adapters; PCI scope caution |

**Integration assessment:** **PASS**

---

# Scalability Review

| Topic | Assessment |
|-------|------------|
| Dedicated frontend deployment | Supported by Option B; CDN-friendly static shell |
| Backend scalability | Stateless Nest APIs; shared JWT validation |
| Caching | Availability/provider catalogs cacheable; patient PHI caches short-TTL + tenant-keyed if used |
| CDN | Suitable for patient app assets; APIs origin-only |
| Future mobile | API-first `/patient-portal/*` enables later native clients |
| API compatibility | Prefer additive versioning; avoid breaking `/me` without policy |
| Horizontal scale | Caregiver grant indexes / optimistic concurrency (CTO backlog) for Freeze hardening list |

**Scalability assessment:** **PASS**

---

# White Label Compatibility

| Topic | Assessment |
|-------|------------|
| Portal branding surface | Exists in White Label architecture |
| Dedicated app | Correct place to apply tenant branding (logo, colors, domain) |
| Staff clinic-dashboard | Remains staff-branded; do not force patient chrome there |
| RTL / AR-EN | Required for patient app |

**White Label assessment:** **PASS**

---

# Risks

| ID | Risk | Sev | Review disposition |
|----|------|-----|--------------------|
| R1 | PHI leak via caregiver over-scope | Critical | Freeze gate: enforce scopes before PHI APIs |
| R2 | Staff/patient auth confusion | High | Freeze: distinct app + session audience |
| R3 | Scope creep (EMR/telehealth) | High | Explicit out-of-scope in Freeze |
| R4 | Clinic-dashboard-only forever | High | Option A rejected |
| R5 | Role-name mismatch | Med | Freeze alignment task |
| R6 | Ungated result release | Med | Clinical policy in Freeze |
| R7 | Messaging liability | Med | Defer messaging or require triage/disclaimer |
| R8 | PCI expansion | Med | Defer payments or use existing adapters |
| R9 | AR/RTL gaps | Med | NFR in patient app |
| R10 | Interference with 41–45 | High | Boundary tests; no Center redesigns |
| R11 | Caregiver contact unverified | Med | Include verification in security model |
| R12 | Concurrent grant races | Med | Optimistic concurrency in hardening |

No risk **blocks Freeze** if Required Changes below are incorporated into the SSOT.

---

# Deferred Capabilities

Freeze SSOT must explicitly defer (non-exhaustive):

- Native mobile apps (API readiness only)
- Telehealth / video visits
- Wearables / remote monitoring
- FHIR patient-access as primary portal protocol
- Marketplace portal packs runtime
- Phase 37 Department / Franchise
- Phase 47 Super Admin
- Full SIEM / synthetic monitoring products
- Workforce surveillance
- Ungoverned clinician chatbots over PHI

---

# Required Changes Before Freeze (if any)

These are **documentation / SSOT obligations for the Freeze phase** — not implementation tasks and not Architecture Decisions minted here:

1. **Adopt Option B** as the frozen application topology (dedicated patient web app + `patient-portal` API BC).  
2. **State SoR matrix** exactly as Boundary Validation above.  
3. **Mandate caregiver scope enforcement** before any `medical_records` / `prescriptions` / `billing` / `messages` portal reads.  
4. **Define patient session separation** from clinic-dashboard (client id / audience / cookie strategy — choose at Freeze).  
5. **Define enrollment completion** (invite accept, credential set, optional MFA).  
6. **Define MVP slice** for Release 46.0 (recommended: app shell + auth/enrollment + appointments + staff admin + caregiver enforcement plumbing).  
7. **Decide clinical result-release policy** for MVP (block records entirely vs released-only).  
8. **Decide feature-flag strategy** (new master flag vs license-only) without side-enabling Centers 41–45.  
9. **Clarify multi-branch booking policy**.  
10. **Align portal coarse roles with permission-matrix vocabulary**.  
11. **List hardening backlog** from CTO review (verification handshake, optimistic concurrency, E2E enrollment).  
12. **Prohibit queue merges** and Center redesigns in Freeze constraints.

No return-to-discovery. No code changes required before Freeze may begin.

---

# Final Recommendation

**Approve** Phase 46 Patient Portal architecture direction for **Architecture Freeze**.

Freeze must write the Architecture SSOT and formal Architecture Decision register. Execution planning and implementation remain **blocked** until Freeze completes.

---

## Review gates checklist

| Gate | Result |
|------|--------|
| G1 Numbering (46 = Patient Portal) | **PASS** |
| G2 Releases 41–45 frozen / not redesigned | **PASS** |
| G3 SoR ownership preserved | **PASS** |
| G4 Dedicated app boundary (Option B) | **PASS** |
| G5 Security model acceptable for Freeze | **PASS** |
| G6 Tenant isolation preserved | **PASS** |
| G7 PHI protection sufficient (with Freeze gates) | **PASS** |
| G8 Integration contracts sound | **PASS** |
| G9 Scalability / White Label compatible | **PASS** |
| G10 No ADs minted prematurely | **PASS** (deferred to Freeze) |
| G11 Ready for Architecture Freeze | **PASS** |

---

## Explicit confirmations

- No code implemented in Review  
- No execution plan written in Review  
- Architecture freeze completed in [`PATIENT_PORTAL_ARCHITECTURE.md`](./PATIENT_PORTAL_ARCHITECTURE.md)  
- Formal Architecture Decision register finalized in Freeze SSOT (not in this review body)  
- No existing modules modified  
- Discovery Option B upheld  
- Patient Portal remains a consumer facade, not a clinical SoR  

---

**PASS — PHASE 46 ARCHITECTURE APPROVED**

**ARCHITECTURE FREEZE COMPLETE** — see [`PATIENT_PORTAL_ARCHITECTURE.md`](./PATIENT_PORTAL_ARCHITECTURE.md)
