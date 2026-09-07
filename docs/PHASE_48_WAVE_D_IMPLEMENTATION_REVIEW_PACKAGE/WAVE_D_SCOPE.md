# WAVE D AUTHORITATIVE SCOPE

| Field | Value |
|-------|--------|
| Branch | `cursor/phase48-wave-d-dental-integration` |
| Base | Frozen Wave C `7f11a4bc6b7064c2b63e807cba65eed225546131` |
| Parent / Wave B | `ec084dd7dbdc8e3d46b0adde92d1e33940a7a3c5` |
| Status | Implementation authorized; Production Acceptance = external review only |
| Phase 49 / Step 30 | NOT AUTHORIZED |

Wave D name from frozen implementation plan: **Dental Integration**.

---

## A. Frozen source documents

| File | Section | Exact Wave D responsibility |
|------|---------|-----------------------------|
| `docs/PHASE_48_FROZEN_IMPLEMENTATION_AND_QA_PLAN.md` | Wave D — Dental Integration | P0-05; P1-02, P1-03, P1-07. ADRs AR-08, AR-12, AR-16, AR-21 (start). Domains: PlanItem↔Appointment; OPERATORY; DentalLabCase; dental material via UsageLedger; ServicePerformance. Migration: nullable historical dental service FKs. QA: Plan Link; Operatory; Lab. Exit: multi-visit staging + operatory concurrency + lab statuses. |
| `docs/PHASE_48_ARCHITECTURE_FREEZE.md` | ADR matrix AR-08, AR-12, AR-16, AR-21; P0/P1 registers | Authoritative SoRs and write owners. |
| `docs/PHASE_48_ARCHITECTURE_REVIEW.md` | AR-08, AR-12, AR-16, AR-21; Wave D list | Junction M:N primary/supporting; OPERATORY enum (not separate Operatory table); DentalLabCase; ServicePerformance start. |
| `docs/PHASE_48_TARGET_DOMAIN_ARCHITECTURE.md` | §§4, 7, 8, 11, 15, 19 | Pricing-unit matrix; resourceType ROOM\|EQUIPMENT\|OPERATORY; TreatmentPlanItemAppointment fields; OPERATORY concurrency = P0-03; DentalLabCase fields; ownership matrix. |
| `docs/PHASE_48_FROZEN_DOMAIN_CONTRACT_MATRIX.md` | SchedulingResource, ServicePerformance*, DentalLabCase | Tenant isolation, audit, QA packs, waves. |
| `docs/PHASE_48_ENTERPRISE_QA_ACCEPTANCE_ARCHITECTURE.md` | P0 Treatment Plan Link Pack; P1 Operatory; P1 Lab case | Required assertions and layers. |
| `docs/PHASE_48_STAFF_COMMISSION_REVENUE_SHARE_ARCHITECTURE.md` | §1 AR-21 only | ServicePerformance + Participants shape for Wave D start. AR-22 commission is Wave F. |
| `docs/PHASE_48_ARCHITECTURE_REVIEW_ADDENDUM_INVENTORY_COMMISSION.md` | Wave D line | Dental material usage via existing usage ledger + ServicePerformance. |

Remediation/evidence docs for Waves A–C are **not** architecture authority except where they restated the freeze.

---

## B. In-scope domains

### 1. TreatmentPlanItem ↔ Appointment (AR-08 / P0-05)

| Item | Value |
|------|-------|
| Invariant | M:N junction; links survive reschedule; cancel/reschedule does not auto-cancel plan items; completion of items is an explicit clinical command; dependencies remain plan-owned |
| Production entry | Dental plan-link HTTP (canonical services, not controller-local business logic) |
| Persistence | `TreatmentPlanItemAppointment`; nullable `TreatmentPlanItem.clinicalServiceId` for historical rows |
| RBAC | conceptual `clinical/reception` → `api.treatment-plan-links` |
| Tenant/RLS | tenant-owned junction; fail-closed cross-tenant plan item / appointment IDs |
| Audit | link/unlink and explicit complete-from-appointment |
| Tests | Plan Link pack: M:N, sequencing, reschedule keeps links, completion command, canonical service when write mode ON |

### 2. Pricing units / dental applicability (P1-02)

| Item | Value |
|------|-------|
| Invariant | Validation matrix at PriceVersion publish and booking. PER_TOOTH/PER_SURFACE/PER_QUADRANT/PER_ARCH = dental, not aesthetic-only. PER_AREA = aesthetic/laser, not tooth-only dental. PER_COURSE/PER_PACKAGE invalid without course SoR (Wave E). |
| Production entry | Existing clinical-catalog publish + booking commercial resolver |
| Persistence | Extend `ClinicalPricingUnit`; no new SoR |
| RBAC | existing `api.billing` / catalog price manage |
| Tenant/RLS | existing PriceVersion tenant rules |
| Audit | existing price publish audit |
| Tests | unit + publish reject + booking reject |

### 3. OPERATORY (AR-12 / P1-03)

| Item | Value |
|------|-------|
| Invariant | `SchedulingResourceType` includes OPERATORY; same advisory-lock concurrency as P0-03; optional display subtype label; no separate Operatory table |
| Production entry | List/create scheduling resources; service resource requirements; booking allocations |
| Persistence | enum + optional `displaySubtype` on `SchedulingResource` |
| RBAC | `schedule.admin` → existing `api.scheduling` manage for create |
| Tenant/RLS | existing `scheduling_resources` RLS |
| Audit | resource create |
| Tests | OPERATORY type + conflict under advisory locks |

### 4. DentalLabCase (AR-16 / P1-07)

| Item | Value |
|------|-------|
| Invariant | First-class case; optional plan item; tooth/arch; statuses; dates; MediaAsset attachments; no duplicate procurement engine |
| Production entry | `/dental/lab-cases*` |
| Persistence | `DentalLabCase` + `DentalLabCaseAttachment`; soft delete |
| RBAC | `dental.lab` → `api.dental-lab` |
| Tenant/RLS | tenant-owned; patient/provider/planItem/media same-tenant |
| Audit | create, status transition, attach |
| Tests | status transitions, tenant refs, HTTP 400, RLS |

### 5. ServicePerformance start (AR-21 start)

| Item | Value |
|------|-------|
| Invariant | Appointment.providerId is **not** automatic performer; PRIMARY required; share sum ≤ 100%; cross-tenant participant DENY; inactive user DENY for new posts; COMPLETED immutable except audited correction |
| Production entry | `/service-performances*` |
| Persistence | `ServicePerformance`, `ServicePerformanceParticipant`, `ServicePerformanceCorrection` |
| RBAC | `service.performance.*` → `api.service-performance` |
| Tenant/RLS | tenant-owned; participant user same tenant |
| Audit | create, complete, correct — in the mutation transaction |
| Tests | HTTP, share constraint, immutability, correction, tenant refs, RLS |
| Explicitly not this wave | StaffCommissionPlanVersion, CommissionAccrual, owner commission UX (Wave F / AR-22 / P1-14) |

### 6. Dental material via InventoryUsageLedger

| Item | Value |
|------|-------|
| Invariant | Dental clinical consumption uses Wave C `InventoryUsageLedger` (INV-B02). No second ledger. Accountable human required. Optional appointment/clinicalService linkage, same-tenant. |
| Production entry | Existing `/dental/...` consume material → `ConsumeInventoryHandler` |
| Persistence | existing usage ledger; optional appointmentId/clinicalServiceId on consume |
| RBAC | existing dental + inventory usage |
| Tests | production-path dental consume writes usage ledger |

---

## C. Explicitly out of scope

- Frozen Wave A/B/C contracts (catalog, snapshots, eligibility, concurrency primitive, consent/forms, inventory accountability, photo consent)
- Wave E: TreatmentCourse, DeviceTreatmentRecord, dermatology, aesthetic course pricing completion
- Wave F: AR-22 commission plans/accruals/payroll
- Wave G: RecallRule, waitlist auto-fill, AvailabilityException (operatory *maintenance SoR* is P1-11)
- Wave H: Arabic/RTL/a11y/owner UX
- Wave I: full pack closure / onepass
- Phase 49, Step 30
- Combined Traceability Pack as a Wave I integration (Wave D only starts ServicePerformance)
- Inventing historical plan↔appointment links or performers
- Separate Operatory table, second consent SoR, second usage ledger, Dermatology EMR

---

## D. P0/P1 acceptance cases

| ID | Requirement | Expected proof |
|----|-------------|----------------|
| P0-05 | Plan item ↔ appointment M:N | Postgres + HTTP: create two links; unique pair |
| P0-05 | Multi-visit sequencing preserved | Item dependencies still plan-owned; complete blocked until prerequisite COMPLETED |
| P0-05 | Reschedule keeps links | Reschedule same appointment id; junction rows remain |
| P0-05 | Completion command updates item status | Explicit complete-from-appointment; appointment COMPLETED does not auto-complete items |
| P0-05 | Canonical write ON | Linking/booking requires canonical clinicalServiceId |
| P1-02 | Pricing unit matrix | Publish + booking reject invalid domain/unit pairs |
| P1-03 | OPERATORY type | Create/list OPERATORY; requirement upsert accepts OPERATORY |
| P1-03 | Operatory conflict | Two overlapping bookings of same OPERATORY: one success (advisory locks) |
| P1-07 | Lab status transitions | Allowed vs illegal transitions; SENT/RECEIVED timestamps |
| AR-21 | Performer ≠ providerId | Completing performance requires explicit participants |
| AR-21 | Share ≤ 100% | DB/tx reject over-share |
| AR-21 | Completed immutable | Direct update denied; correction command audited |
| INV-B02 dental | Dental consume uses usage ledger | Integration: consume dental material → InventoryUsageLedger row |

---

## E. Expected production files/modules

- Controllers: treatment-plan-links, dental-lab, service-performance; scheduling resource create; booking-integrity OPERATORY DTO
- Services/handlers: plan-link, lab-case, service-performance, pricing-unit applicability, create scheduling resource
- Repositories: Prisma via existing PrismaService
- Schema/migration: `20260819010000_phase48_wave_d_dental_integration`
- RLS/triggers: `rls-policies.sql`, `triggers.sql`, same SQL in migration
- Permission matrices (3): `api.treatment-plan-links`, `api.dental-lab`, `api.service-performance`; OPERATORY scheduling ops
- Tests: `wave-d-*` postgres/HTTP/RLS/concurrency/migration
- Evidence: this package

---

## F. Ambiguities

Resolved as **implementation naming** (freeze allows naming/SQL/files without amendment):

- Lab statuses: `DRAFT \| SENT \| IN_LAB \| RECEIVED \| SEATED \| CANCELLED` derived from frozen sentAt/expectedAt/receivedAt fields.
- Junction `linkRole`: `PRIMARY \| SUPPORTING` from AR-08.
- HTTP paths: `/dental/treatment-plans/.../appointments`, `/dental/lab-cases`, `/service-performances`, `POST /scheduling/resources`.
- AR-21 “start”: persist + enforce ServicePerformance; do **not** implement AR-22.

No critical architecture ambiguity. Implementation may proceed.
