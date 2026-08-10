# Phase 46 — Production Acceptance

**Document type:** Production Acceptance Report (QG-F)  
**Date:** 2026-07-19  
**Release:** **46.0**  
**Capability:** Patient Portal (Option B — dedicated patient web application)  
**Architecture SSOT:** [`PATIENT_PORTAL_ARCHITECTURE.md`](./PATIENT_PORTAL_ARCHITECTURE.md) — **FROZEN**  
**Execution plan:** [`PHASE_46_EXECUTION_PLAN.md`](./PHASE_46_EXECUTION_PLAN.md) — **APPROVED**  
**Quality gate:** **QG-F — Production Acceptance Passed**  
**Result:** **PASS**

---

## Entry criteria

| Criterion | Status |
|-----------|--------|
| QG-A Portal Foundation Ready | **PASS** |
| QG-B Identity & Session Ready | **PASS** |
| QG-C Appointments Self-Service Ready | **PASS** |
| QG-D Caregiver & Safe Access Ready | **PASS** |
| QG-E Portal Release Experience Ready | **PASS** |
| Architecture frozen / Option B preserved | **PASS** |
| No product features in 46f | **PASS** (acceptance docs only) |

---

## Acceptance Summary

Release **46.0** implements the frozen Patient Portal architecture as a **consumer facade** behind `PATIENT_PORTAL_CENTER_ENABLED` (default **OFF**). Milestones **46a–46e** are complete. This report records objective evidence for Production Acceptance. **No Architecture Decisions were modified. No new product features were added. Deferred capabilities remain deferred.**

Controlled tenant enablement remains a **post–QG-F** operational act and is **not** automatic production ON.

---

## 1. Architecture compliance

| Check | Result |
|-------|--------|
| Frozen SSOT unchanged (OD-* text not rewritten) | **PASS** |
| Option B dedicated app preserved (`apps/patient-portal`) | **PASS** |
| Portal remains consumer facade / not clinical SoR | **PASS** |
| No new Systems of Record introduced | **PASS** |
| Releases 41–45 not redesigned / not owned by portal | **PASS** |
| All OD register preserved (boundary, app, API, auth, enrollment, MFA, session, caregiver, PHI, results, messaging, billing, payments, documents, notify, audit, activity, observability, whitelabel, license, flags, tenancy, branch, storage, portability, extensibility) | **PASS** |

---

## 2. Execution-plan compliance

| Milestone | Gate | Evidence |
|-----------|------|----------|
| 46a Foundation | QG-A | Dedicated app, flags, license, RBAC, WL bootstrap, docs |
| 46b Identity | QG-B | Enrollment, patient session class, MFA, password lifecycle |
| 46c Appointments | QG-C | Scheduling SoR facade only |
| 46d Caregiver | QG-D | Grant lifecycle, scope-before-PHI, safe profile, results gate plumbing |
| 46e Experience | QG-E | Home/dashboard, account/security/prefs, a11y/i18n/responsive, Centers wiring |
| 46f Acceptance | QG-F | This report + [`RELEASE_46_0.md`](./RELEASE_46_0.md) |

---

## 3. Feature completeness (Release 46.0 MVP only)

### In scope — validated present

- Dedicated patient application bootstrap, routing, configuration  
- Identity, enrollment, patient session class, MFA  
- Appointments via Scheduling facade  
- Caregiver lifecycle + delegated authorization  
- Patient-safe profile facade  
- Portal-owned preferences (locale + channels)  
- Dashboard / home experience  
- White Label consume, accessibility, localization, responsive UI  

### Deferred — validated **not** shipped as product

Clinical records/results **display** · messaging product · billing · payments · documents · telemedicine · Marketplace packs · FHIR · native mobile · advanced family accounts · PGHD  

Results path remains **gate-only** (`productEnabled: false` / always deny until future change control).

---

## 4. System of Record validation

| Capability | Authoritative SoR | Portal role | Validation |
|------------|-------------------|-------------|------------|
| Portal accounts / enrollment / caregiver grants / portal preferences | **Patient Portal** | Owner | **PASS** |
| Patient demographics | **Patients** | Consumer facade | **PASS** |
| Appointments / availability | **Scheduling** | Facade only (no local slot engine) | **PASS** |
| Clinical documentation / results | **EMR / Clinical** | Not displayed in 46.0; gate enforcer only | **PASS** |
| Messaging | **Messaging** | Deferred | **PASS** |
| Notifications delivery | **Notification Center** | Intent / prefs consume | **PASS** |
| Billing / Payments / Documents | Respective Centers | Deferred | **PASS** |
| Audit / Activity / Observability | Respective Centers | Emitters / instrumentation | **PASS** |
| Licensing / Feature Flags / White Label | Platform Centers | Gate / consume | **PASS** |

**No ownership drift detected.**

---

## 5. Application acceptance

| Surface | Result |
|---------|--------|
| `apps/patient-portal` dedicated app | **PASS** |
| Bootstrap / providers / config fail-closed | **PASS** |
| Routing + session / flag gates | **PASS** |
| Identity / enrollment / MFA / session class `patient` | **PASS** |
| Appointments + Scheduling facade | **PASS** |
| Caregiver lifecycle + scope | **PASS** |
| Safe profile + preferences | **PASS** |
| Dashboard / account / security UI | **PASS** |
| White Label / a11y / i18n / responsive | **PASS** |

---

## 6. Security acceptance

| Control | Result | Evidence |
|---------|--------|----------|
| Patient session isolation / staff rejection | **PASS** | `PatientPortalSessionGuard` requires `sessionClass === 'patient'` |
| Tenant isolation | **PASS** | Tenant context + repository scoping; isolation tests |
| Branch non-expansion | **PASS** | Branch filter does not expand authz |
| Patient ownership / IDOR | **PASS** | Ownership guards + caregiver subject headers |
| Caregiver scope before PHI | **PASS** | Acting-context service + MVP scopes `profile`/`appointments` |
| License enforcement | **PASS** | `patientPortal` / `caregiverAccess` |
| Feature flags fail-closed | **PASS** | Defaults OFF (`?? 'false'`) |
| MFA / password lifecycle | **PASS** | Reuses Auth primitives; portal auth APIs |
| Rate limiting | **PASS** | Identity rate-limiter port on credential paths |
| PHI-minimized / safe errors | **PASS** | Safe error codes; no enumeration on forgot-password |
| Auditability | **PASS** | Portal audit log adapter |
| Privacy-safe observability | **PASS** | Logs/metrics fields force `phi: false` |

### Penetration-test readiness checklist

- [x] Public attack surface limited to gated `/patient-portal/*`  
- [x] Session class separation documented and tested  
- [x] Caregiver role-without-grant deny paths tested  
- [x] Cross-tenant / IDOR suites present in 46d tests  
- [x] Flag/license deny paths present  
- [x] No deferred clinical/financial product surfaces exposed  
- [x] Secrets not persisted outside approved portal session keys  

---

## 7. PHI acceptance

| Check | Result |
|-------|--------|
| No clinical records product exposed | **PASS** |
| No clinical results product exposed | **PASS** (gate only) |
| No PHI in logs / metrics / traces / Activity | **PASS** (contractual `phi: false`; Activity event/tenant/correlation only) |
| Patient-safe DTOs only on profile facade | **PASS** |

---

## 8. Integration acceptance

| Center | Portal usage | Duplicate engine? | Result |
|--------|--------------|-------------------|--------|
| Scheduling | Appointment CRUD/availability handlers | No | **PASS** |
| Identity / Auth | Login, MFA, password | No | **PASS** |
| Patients | Safe profile read | No | **PASS** |
| Notification | Intents + portal-owned channel prefs | No Notification Center redesign | **PASS** |
| Audit / Activity | Emitters | No | **PASS** |
| Observability (45) | Namespaces / health contributors | No parallel stack | **PASS** |
| White Label | Branding resolve consume | No redesign | **PASS** |
| Licensing / Flags | Gates | No | **PASS** |

---

## 9. Testing summary

### Automated results (acceptance run 2026-07-19)

| Suite | Location | Result |
|-------|----------|--------|
| Frontend Vitest | `apps/patient-portal` | **20 passed / 20** (4 files) |
| API Jest | `apps/api/.../patient-portal/tests` | **156 passed / 156** (18 suites) |

### Coverage map

| Area | Coverage |
|------|----------|
| Unit / domain | PortalAccount, caregiver grant, scopes, prefs VO |
| Contract / API | Foundation health, branding, auth guards, scheduling facade, caregiver, preferences |
| Integration | Audit adapter, Scheduling handlers, Patients profile, acting context |
| Frontend / component | Foundation, appointments gates, home/account experience, a11y landmarks |
| E2E-style | Authenticated home → account path (`e2e-experience.spec.tsx`) |
| Security | Session class, ownership, caregiver deny, flag/license |
| Tenant isolation | Tenant mismatch / cross-tenant deny paths |
| Identity / appointments / caregiver | Dedicated 46b/46c/46d suites |
| Localization / responsive / WL | Experience + foundation frontend tests |
| Observability | Metric registry + foundation health contributors |
| Regression (portal) | Full module suite green; master flag default OFF protects dormant product |

**Releases 41–45:** Portal consumes Centers; does not modify their SoR engines. Master flag default **OFF** keeps Release 46.0 dormant. No portal-driven redesign of 41–45 accepted.

---

## 10. Performance acceptance

Per execution plan: **no unsupported latency targets invented**.

| Item | Acceptance position |
|------|---------------------|
| Formal platform SLOs unresolved | Recorded as **pre-implementation / operational baseline inputs** — not invented here |
| Booking correctness | Stale-slot / conflict handling via Scheduling SoR (priority over raw speed) |
| Availability | Consumed from Scheduling; portal must not add local engine (validated) |
| Frontend budgets | No separate portal budget inventing; shell uses existing monorepo patterns |

---

## 11. Operational readiness

### Feature enablement checklist (post–QG-F; controlled)

1. Confirm tenant license `patientPortal` (+ `caregiverAccess` if caregiver surfaces needed).  
2. Confirm tenant policy `allowPatientPortal`.  
3. Enable `PATIENT_PORTAL_CENTER_ENABLED` **only** for target environment/tenant process.  
4. Enable required sub-flags (`APPOINTMENTS`, `CAREGIVER`, `PROFILE`) as approved.  
5. Mirror Vite build flags for `apps/patient-portal`.  
6. Validate `/patient-portal/health` → `experienceReady`, dormant→live transition.  
7. Validate `/patient-portal/branding?tenantId=…`.  
8. Keep shared templates / default env files **OFF**.

### Rollback guidance

1. Set `PATIENT_PORTAL_CENTER_ENABLED=false` (and Vite mirrors).  
2. Confirm health shows dormant / not live.  
3. Optionally revoke patient sessions via logout-all playbook.  
4. Do **not** delete Scheduling/Patients data — portal is facade.  
5. Releases 41–45 remain unchanged.

### Support diagnostics

- `GET /patient-portal/health` / `foundation`  
- Correlation id on portal API calls  
- Session class must remain `patient`  
- Runbooks in [`PATIENT_PORTAL_EXPERIENCE_AND_INTEGRATIONS.md`](./PATIENT_PORTAL_EXPERIENCE_AND_INTEGRATIONS.md)

---

## 12. Documentation acceptance

| Document | Status |
|----------|--------|
| `PATIENT_PORTAL_ARCHITECTURE.md` | Frozen; status pointer only |
| `PHASE_46_EXECUTION_PLAN.md` | Approved; milestone status updated |
| `PATIENT_PORTAL_FOUNDATION.md` | Accepted |
| `PATIENT_PORTAL_IDENTITY_AND_ENROLLMENT.md` | Accepted |
| `PATIENT_PORTAL_APPOINTMENTS_AND_SCHEDULING.md` | Accepted |
| `PATIENT_PORTAL_CAREGIVER_AND_SAFE_ACCESS.md` | Accepted |
| `PATIENT_PORTAL_EXPERIENCE_AND_INTEGRATIONS.md` | Accepted |
| `PHASE_46_PRODUCTION_ACCEPTANCE.md` | **This document** |
| `RELEASE_46_0.md` | Created |

Consistency with architecture SoR matrix and OD register: **PASS**.

---

## 13. Corrective fixes (46f)

**None.** No acceptance defects requiring code correction were found during QG-F review.

---

## 14. Outstanding non-blocking items

- Jest workers occasionally require `--forceExit` due to open-handle teardown noise (does not fail suites).  
- React Router v7 future-flag console warnings in Vitest (non-blocking).  
- Formal platform latency SLOs remain operational baseline inputs (by plan).  
- Controlled tenant enablement is **out of band** after QG-F.

---

## 15. Explicit confirmations

- No Architecture Decision changed  
- No new features added in 46f  
- No scope expansion  
- Deferred capabilities remain deferred  
- Feature flags remain **OFF** by default  
- Patient Portal remains a **consumer facade**  
- Scheduling remains the appointment System of Record  
- Patients remains the demographic System of Record  
- EMR remains the clinical System of Record  
- Releases **41–45** remain unchanged  

---

## Quality Gate QG-F

| Dimension | Result |
|-----------|--------|
| Entry criteria (QG-E) | **PASS** |
| Deliverables (acceptance + release notes + enablement + rollback) | **PASS** |
| Automated tests | **PASS** (20 FE + 156 API) |
| Security / PT readiness checklist | **PASS** |
| Integration | **PASS** |
| Documentation | **PASS** |
| Flags default OFF / no OD drift / no feature creep | **PASS** |

**QG-F Result: PASS**

**Authorizes:** Release **46.0** packaging and controlled enablement process only (not automatic production ON).
