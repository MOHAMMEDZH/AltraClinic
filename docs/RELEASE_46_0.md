# Release 46.0 — Patient Portal

**Release:** **46.0**  
**Date:** 2026-07-19  
**Status:** **PRODUCTION ACCEPTED** (QG-F **PASS**) · master flag default **OFF**  
**Architecture:** [`PATIENT_PORTAL_ARCHITECTURE.md`](./PATIENT_PORTAL_ARCHITECTURE.md) — **FROZEN** (Option B)  
**Acceptance report:** [`PHASE_46_PRODUCTION_ACCEPTANCE.md`](./PHASE_46_PRODUCTION_ACCEPTANCE.md)  
**Execution plan:** [`PHASE_46_EXECUTION_PLAN.md`](./PHASE_46_EXECUTION_PLAN.md)

---

## Summary

Release **46.0** delivers the Healthcare ERP **Patient Portal**: a dedicated patient web application and portal bounded context that operates as a **consumer facade** over existing Systems of Record. The product ships **dormant by default** behind `PATIENT_PORTAL_CENTER_ENABLED` until controlled post-acceptance enablement.

---

## Completed capabilities

### Foundation (46a)

- Dedicated app `apps/patient-portal`
- Backend module hardening, flags, licensing, RBAC, tenant/branch rules
- Public health/foundation probes
- White Label / a11y / i18n / responsive bootstrap

### Identity & enrollment (46b)

- Patient enrollment activation
- Login / MFA / password change & reset flows
- Distinct **patient** session class (staff sessions rejected)
- Rate-limited credential paths

### Appointments (46c)

- List / detail / book / reschedule / cancel via **Scheduling** SoR facade
- Availability and provider listing from Scheduling
- Idempotency on mutations; no portal-owned slot engine

### Caregiver & safe access (46d)

- Caregiver invite / accept / decline / revoke lifecycle
- Per-request scope evaluation (`profile`, `appointments` MVP)
- Acting-context headers for delegated reads
- Patient-safe demographics profile facade (Patients SoR)
- Clinical results **release gate plumbing only** (product display deferred)

### Experience & integrations (46e)

- Authenticated home / dashboard
- Account & security UI (password, MFA, sessions)
- Portal-owned notification preferences (locale + email/sms/push)
- Caregiver management UX with accessible revoke confirmation
- White Label branding resolve (`GET /patient-portal/branding`)
- Accessibility, localization (en/ar + RTL), responsive completion
- Notification / Audit / Activity / Observability wiring for MVP
- API documentation and operational runbooks

---

## Deferred capabilities (not in 46.0 product)

- Clinical records display  
- Clinical results display (beyond gate)  
- Messaging product slice  
- Billing / payments product slices  
- Documents product slice  
- Telemedicine  
- Marketplace portal packs  
- FHIR exposure  
- Native mobile apps  
- Advanced family accounts beyond grants  
- Patient-generated health data (PGHD)  

Dark sub-flags for deferred domains may exist for future activation; **no product implementation** in 46.0.

---

## Architecture confirmation

- Option **B** preserved (dedicated patient app)  
- Patient Portal is **not** a clinical System of Record  
- All Architecture Decisions (**OD-***) unchanged  
- Scheduling = appointments SoR · Patients = demographics SoR · EMR = clinical SoR  
- Releases **41–45** unchanged and consumed, not redesigned  

---

## Execution confirmation

| Gate | Result |
|------|--------|
| QG-A … QG-E | **PASS** |
| QG-F Production Acceptance | **PASS** |

Milestones **46a → 46f** completed in sequence without OD or scope expansion.

---

## Security confirmation

- Patient session isolation; staff session rejection  
- Tenant isolation; branch filter non-expansion  
- Caregiver scope-before-PHI; IDOR protections  
- License + feature-flag fail-closed (defaults **OFF**)  
- MFA and password lifecycle via Auth primitives  
- PHI minimization in DTOs, logs, metrics, traces, Activity  
- Audit of privileged portal actions  

---

## Operational readiness

- Health: `GET /patient-portal/health` (`phase: 46e` experience readiness retained; product dormant when flag OFF)  
- Branding: `GET /patient-portal/branding`  
- Enablement / rollback / support diagnostics: see acceptance report and experience doc  
- **Default:** `PATIENT_PORTAL_CENTER_ENABLED=false` (and Vite mirrors unset/false)

### Enablement (controlled)

Do **not** enable globally by default. Follow tenant license + policy + staged flag enablement in [`PHASE_46_PRODUCTION_ACCEPTANCE.md`](./PHASE_46_PRODUCTION_ACCEPTANCE.md).

### Rollback

Disable master flag → confirm dormant health → optional session revoke. Facade only — do not purge Scheduling/Patients data.

---

## Known limitations

- Results display not available (gate returns product disabled)  
- Profile editing limited to frozen safe facade scope  
- Portal preferences are portal-owned channels only (not full Notification Center UI)  
- Staff portal admin remains existing accounts API / clinic-dashboard surfaces  
- Formal platform latency SLOs not invented; operational baselining remains ops input  

---

## Corrective fixes in 46f

None. Acceptance was evidence- and documentation-only.

---

## Test snapshot (acceptance)

| Suite | Result |
|-------|--------|
| `apps/patient-portal` Vitest | 20 / 20 passed |
| `patient-portal` API Jest | 156 / 156 passed |

---

## Companion documents

- [`PATIENT_PORTAL_FOUNDATION.md`](./PATIENT_PORTAL_FOUNDATION.md)  
- [`PATIENT_PORTAL_IDENTITY_AND_ENROLLMENT.md`](./PATIENT_PORTAL_IDENTITY_AND_ENROLLMENT.md)  
- [`PATIENT_PORTAL_APPOINTMENTS_AND_SCHEDULING.md`](./PATIENT_PORTAL_APPOINTMENTS_AND_SCHEDULING.md)  
- [`PATIENT_PORTAL_CAREGIVER_AND_SAFE_ACCESS.md`](./PATIENT_PORTAL_CAREGIVER_AND_SAFE_ACCESS.md)  
- [`PATIENT_PORTAL_EXPERIENCE_AND_INTEGRATIONS.md`](./PATIENT_PORTAL_EXPERIENCE_AND_INTEGRATIONS.md)  
- [`PHASE_46_PRODUCTION_ACCEPTANCE.md`](./PHASE_46_PRODUCTION_ACCEPTANCE.md)
