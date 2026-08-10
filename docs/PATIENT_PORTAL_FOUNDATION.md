# Patient Portal Foundation (Phase 46a)

**Phase:** 46a — Portal Foundation & Dedicated Application  
**Status:** **IMPLEMENTED** · 2026-07-19  
**Architecture SSOT:** [`PATIENT_PORTAL_ARCHITECTURE.md`](./PATIENT_PORTAL_ARCHITECTURE.md)  
**Execution plan:** [`PHASE_46_EXECUTION_PLAN.md`](./PHASE_46_EXECUTION_PLAN.md)  
**Quality gate:** **QG-A — Portal Foundation Ready**

---

## Application architecture

Option B topology:

| Layer | Location | Role |
|-------|----------|------|
| Dedicated frontend | `apps/patient-portal` (`@booking/patient-portal`) | Patient UX shell only |
| Backend BC | `apps/api/src/modules/patient-portal` | Extended foundation; consumer facade |
| Staff chrome | `apps/clinic-dashboard` | Unchanged primary staff product |

Public foundation probes:

- `GET /patient-portal/health` — readiness / dormant status (public, no PHI)
- `GET /patient-portal/foundation` — foundation metadata + deferred list

Product controllers (`/patient-portal/accounts`, `/patient-portal/me/*`) are gated by `PatientPortalCenterEnabledGuard` and remain **dormant** when the master flag is OFF.

---

## Frontend foundation

- Vite + React + React Router shell on port **5175**
- Providers: Config, Theme (White Label tokens), Localization, ErrorBoundary, Suspense loading
- Semantic layout: skip link, banner, main, contentinfo
- Disabled UX: `UnavailablePage` when `VITE_PATIENT_PORTAL_CENTER_ENABLED` is false
- API client: correlation / tenant / branch header propagation; same-origin credentials; no auth product
- Secure storage: in-memory only; **rejects credential keys**
- CSP + security headers in Vite dev/preview and HTML meta

Scripts (repo root): `dev:patient-portal`, `build:patient-portal`, `test:patient-portal`

---

## Backend foundation

| Component | Purpose |
|-----------|---------|
| `patient-portal.constants.ts` | Flag names, health contributors, error codes, namespaces |
| `config/patient-portal-config.ts` | Fail-closed flag loader (default OFF) |
| `PatientPortalCenterEnabledGuard` | Product API dormant when flag OFF |
| `PatientPortalFoundationController` | Health / foundation probes |
| `EffectivePatientPortalViewService` | `flag ∧ allowPatientPortal ∧ permission` |
| Tenant / branch context helpers | Fail-closed tenant; branch filter never expands auth |
| Observability / licensing contracts | Registration hooks only |
| Health contributors | Dormant when flag OFF |

---

## Configuration

| Variable | Default | Notes |
|----------|---------|-------|
| `PATIENT_PORTAL_CENTER_ENABLED` | `false` | Master API flag |
| Sub-flags (`APPOINTMENTS`, `CAREGIVER`, …) | `false` | Registered; dark in 46a |
| `VITE_PATIENT_PORTAL_CENTER_ENABLED` | `false` | Frontend gate |
| `VITE_API_BASE_URL` | `/api` | Proxied to API in Vite |
| `VITE_DEFAULT_LOCALE` | `en` | Localization seed |

See `apps/api/.env.example` and `apps/patient-portal/.env.example`.

---

## Feature flags

All default **OFF**:

- `PATIENT_PORTAL_CENTER_ENABLED`
- `PATIENT_PORTAL_APPOINTMENTS_ENABLED`
- `PATIENT_PORTAL_CAREGIVER_ENABLED`
- `PATIENT_PORTAL_PROFILE_ENABLED`
- `PATIENT_PORTAL_RECORDS_ENABLED`
- `PATIENT_PORTAL_MESSAGING_ENABLED`
- `PATIENT_PORTAL_BILLING_ENABLED`
- `PATIENT_PORTAL_PAYMENTS_ENABLED`
- `PATIENT_PORTAL_DOCUMENTS_ENABLED`

---

## Licensing

- Module license: `patientPortal` (`@RequireLicensedModule`)
- Tenant advanced policy gate: **`allowPatientPortal`** (default `false`)
- Plan feature (registered): `caregiverAccess`
- No bypass: effective view requires flag + `allowPatientPortal` + read permission

---

## White Label

Frontend consumes brand tokens (clinic name, primary/secondary, optional logo). Missing assets degrade safely. No per-tenant code forks. Design tokens via `@booking/design-tokens`.

---

## Observability integration

Consumes Release 45 patterns only:

- Metrics namespace `patient_portal`
- Trace namespace `patient_portal`
- Log kind `patient_portal` with `phi: false` contract fields
- Health contributor definitions registered on `/patient-portal/health`

No parallel APM / metrics DB / alert engine.

---

## Accessibility

- Skip link to `#main`
- Landmarks: banner / main / contentinfo
- Focus-visible button styles
- `tabIndex={-1}` on main for skip-target focus
- RTL-ready `dir` from locale

---

## Localization

- `en` / `ar` message catalogs
- Locale provider sets `lang` / `dir`
- `Intl.DateTimeFormat` helper for future appointment slices

---

## Responsive foundation

- Fluid type and spacing (`clamp`)
- Max-width shell
- Mobile brand typography adjustment at 640px

---

## Disabled behavior

| Surface | Flag OFF |
|---------|----------|
| Frontend | Unavailable page; no workflows |
| Product APIs | HTTP 503 `PATIENT_PORTAL_DISABLED` |
| Health / foundation | `ready: true`, `dormant: true` |
| Effective view | `visible: false` |

No runtime crashes when disabled.

---

## Known limitations

- No patient authentication / enrollment / MFA / sessions (46b)
- Existing domain handlers remain in module but product HTTP paths are center-gated
- White Label does not yet call live branding API (bootstrap defaults + merge only)
- Observability hooks are registration-level (no full pipeline emit)

---

## Deferred functionality

Identity · enrollment · MFA · sessions · appointments · caregiver product · clinical · messaging · billing · payments · documents · portal home/dashboard/settings · notification preferences UI

---

## Test coverage

| Suite | Location |
|-------|----------|
| Backend foundation | `apps/api/src/modules/patient-portal/tests/patient-portal-foundation.spec.ts` |
| Tenant policy `allowPatientPortal` | `tenant-policy.service.spec.ts` |
| Frontend foundation | `apps/patient-portal/src/foundation.spec.tsx` |

Coverage includes: flag OFF, licensing gate, tenant/branch, WL, API client, routing shell, config validation, disabled UX, observability registration, a11y landmarks, i18n init. **No** auth, appointment, or PHI tests (by design for 46a).
