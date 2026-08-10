# Patient Portal — Appointments & Scheduling Self-Service (Phase 46c)

**Status:** Implemented (QG-C)  
**Architecture:** Frozen — no Architecture Decision changes  
**SoR:** Scheduling remains the sole System of Record for appointments, availability, booking, rescheduling, cancellation, concurrency, and slot ownership.

Related:

- [`PATIENT_PORTAL_ARCHITECTURE.md`](./PATIENT_PORTAL_ARCHITECTURE.md)
- [`PHASE_46_EXECUTION_PLAN.md`](./PHASE_46_EXECUTION_PLAN.md)
- [`PATIENT_PORTAL_FOUNDATION.md`](./PATIENT_PORTAL_FOUNDATION.md)
- [`PATIENT_PORTAL_IDENTITY_AND_ENROLLMENT.md`](./PATIENT_PORTAL_IDENTITY_AND_ENROLLMENT.md)

---

## Scope

Patient-safe appointment **list**, **detail**, **availability discovery**, **booking**, **rescheduling**, and **cancellation** for the authenticated self patient through the Patient Portal consumer facade.

Out of scope (deferred): caregiver/delegated access, clinical records/results, messaging, billing/payments, documents, waitlists/recurring/group/telemedicine product surfaces, Phases 46d–46f.

---

## Scheduling ownership

| Concern | Owner |
|---------|--------|
| Appointment persistence | Scheduling |
| Availability calculation | Scheduling (`GetAvailabilityHandler`) |
| Conflict / concurrency / slot ownership | Scheduling |
| Booking / reschedule / cancel rules | Scheduling (`CreateAppointmentHandler`, `UpdateAppointmentHandler`) |
| Patient-safe DTO mapping, ownership checks, portal flags | Patient Portal facade |

Patient Portal **does not** implement a second scheduling engine and **does not** persist authoritative appointment state.

---

## Facade boundary

APIs live under `/patient-portal/me/*` and call Scheduling application handlers / repository contracts only.

Handlers:

- `ListMyAppointmentsHandler`
- `GetMyAppointmentHandler`
- `BookMyAppointmentHandler`
- `UpdateMyAppointmentHandler` (cancel / reschedule)
- `GetMyAvailabilityHandler`
- `ListMyProvidersHandler`

Mapping: `portal-scheduling.mapper.ts` strips PHI-heavy Scheduling fields (e.g. `patientName`, `notes`) from patient responses.

---

## API contracts

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/patient-portal/me/appointments` | List (optional `scope=upcoming\|past\|all`, `from`, `to`, `branchId`, pagination) |
| GET | `/patient-portal/me/appointments/:appointmentId` | Detail |
| POST | `/patient-portal/me/appointments` | Book (`Idempotency-Key` required) |
| PATCH | `/patient-portal/me/appointments/:appointmentId` | Cancel (`action=cancel`) or reschedule (`start`/`end`); `Idempotency-Key` required |
| GET | `/patient-portal/me/providers` | Provider discovery |
| GET | `/patient-portal/me/availability` | Slot discovery (`providerId`, `date`, `durationMin`) |

Guards (fail-closed):

1. `PatientPortalCenterEnabledGuard` — `PATIENT_PORTAL_CENTER_ENABLED`
2. `PatientPortalAppointmentsEnabledGuard` — `PATIENT_PORTAL_APPOINTMENTS_ENABLED` (requires center ON)
3. `PatientPortalEnrollmentCompleteGuard` — patient `sessionClass`, ACTIVE enrollment
4. `PatientPortalPermissionGuard` + `@RequirePermission`
5. `@RequireLicensedModule('patientPortal')`

Staff sessions are rejected by enrollment/session class checks. Anonymous booking is not permitted.

---

## Authentication & enrollment

Every appointment API requires:

- valid patient session class (`sessionClass: patient`)
- patient-portal audience / portal account ACTIVE
- completed enrollment (consent)
- tenant context
- master flag + appointments sub-flag
- `patientPortal` license (+ tenant `allowPatientPortal` via licensing enforcement path)

Authoritative patient identity is resolved from `PortalAccount` linked to the authenticated user (`sub` / principal id). Request-body patient IDs are never trusted for ownership.

---

## Patient ownership

Fail-closed:

- List always filters by portal `patientId` + tenant.
- Detail / update load Scheduling appointment then assert `appt.patientId === portal.patientId`.
- Book always binds `CreateAppointmentCommand.patientId` to portal patient.
- Cross-patient access → `PATIENT_PORTAL_APPOINTMENT_ACCESS_DENIED`.

---

## Tenant and branch rules

- Tenant isolation via `TenantContextService` + portal account tenant match.
- Optional `branchId` query **narrows** results only (`parsePatientPortalBranchFilter`).
- Branch never expands authorization, never substitutes for tenant scope, never bypasses ownership.

---

## Booking / reschedule / cancel flows

1. Resolve portal patient context.
2. Validate inputs / eligibility (terminal statuses block cancel/reschedule where applicable).
3. Enforce idempotency key (tenant + patient + operation scoped).
4. Delegate to Scheduling handlers.
5. Map success to patient-safe DTO.
6. Emit Notification intent, Audit record, Activity reference (non-PHI).
7. Map Scheduling conflicts to patient-safe codes (`SLOT_UNAVAILABLE`, etc.).

Notification delivery failure does **not** roll back Scheduling state.

---

## Idempotency

- Header: `Idempotency-Key` (required on book / reschedule / cancel).
- Store: `PortalSchedulingIdempotencyService` (process-local portal-native metadata; not appointment SoR).
- Same key + same fingerprint → replay safe result.
- Same key + different fingerprint → `PATIENT_PORTAL_IDEMPOTENCY_MISMATCH`.

Known limitation: durable multi-instance idempotency persistence is not a Prisma-backed table in this milestone; process-local store satisfies CI and single-process semantics.

---

## Concurrency and stale-slot handling

Scheduling remains authoritative. Portal maps:

- slot conflicts → `PATIENT_PORTAL_SLOT_UNAVAILABLE`
- changed / stale appointment signals → `PATIENT_PORTAL_STALE_APPOINTMENT`
- already cancelled cancel → idempotent safe cancelled DTO
- terminal status reschedule/cancel → not permitted codes

Internal lock/SQL details are never exposed.

---

## Notification / Audit / Activity / Observability

| Concern | Behavior |
|---------|----------|
| Notification | `NotificationIntentProducerService.produceInApp` — producer `patient-portal.appointments` |
| Audit | `PortalAuditLog.record` — `patient_portal.appointment.{booked\|rescheduled\|cancelled}` with actorType patient / actingContext self |
| Activity | `PatientPortalActivityEmitter` non-PHI event refs |
| Observability | Release 45 contracts via `PatientPortalObservabilityContracts` structured logs (no PHI) |

---

## Feature flags & licensing

| Flag / gate | Default |
|-------------|---------|
| `PATIENT_PORTAL_CENTER_ENABLED` | OFF |
| `PATIENT_PORTAL_APPOINTMENTS_ENABLED` | OFF (also requires center ON) |
| Frontend `VITE_PATIENT_PORTAL_*` mirrors | OFF |
| License `patientPortal` | enforced |
| Tenant `allowPatientPortal` | enforced via existing licensing path |

---

## Safe error model

Stable codes include: appointments disabled, enrollment incomplete, invalid session, appointment not found, access denied, booking/reschedule/cancel not permitted, slot unavailable, stale appointment, idempotency mismatch/required, scheduling unavailable, rate limited, license/disabled/tenant errors.

---

## Frontend experience

Dedicated app `apps/patient-portal`:

- `/appointments` list (upcoming/past)
- `/appointments/:id` detail + cancel
- `/appointments/book` booking flow
- `/appointments/:id/reschedule` reschedule flow

Route protection: session required + appointments flag. Loading/empty/conflict/success states, keyboard-operable slots, localized EN/AR messages, RTL via existing `dir` provider, responsive layout.

Clinic-dashboard `MyAppointmentsPage` is **not** the primary patient UX.

---

## Security controls

Session class, tenant isolation, ownership/IDOR prevention, flag/license fail-closed, output minimization, mutation idempotency, correlation without PHI, XSS-safe React rendering, cookie credentials `same-origin` on client.

No caregiver access in 46c.

---

## Test coverage

- API: `apps/api/src/modules/patient-portal/tests/portal-scheduling-46c.spec.ts`
- UI: `apps/patient-portal/src/appointments.spec.tsx`
- Regression: Phase 46a/46b foundation and identity suites remain in place

---

## Performance validation

No fabricated numeric SLOs. Validate against repository standards when present. This milestone records qualitative acceptance:

- List/detail/availability/book/reschedule/cancel are thin facade calls over Scheduling
- Frontend appointment routes are code-split only by route modules already in the SPA
- Observability limited to structured log fields (no PHI payloads)

Unresolved formal latency budgets: document as acceptance targets when platform standards publish numeric thresholds.

---

## Known limitations

- Idempotency store is process-local (not shared durable store).
- Waitlists / recurring / group / telemedicine not exposed.
- Provider list may narrow by account/tenant branch context.
- Notification channel selection remains Notification Center policy authority.

---

## Deferred functionality

Caregiver grants & delegated appointment access (46d), profile editing, clinical records/results display, messaging, billing/payments, documents, notification preference product UX, advanced dashboard (46e–46f).
