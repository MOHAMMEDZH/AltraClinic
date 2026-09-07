# Phase 48 Wave B — Implementation Discovery

```text
branch = cursor/phase48-wave-b-booking-integrity
base Wave A accepted SHA = c09f46d44971ebc6ebbe82bc74b67e19d1c96a78
Wave A Production Acceptance = ACCEPTED
new ACR required = NO
```

## Reuse decisions

| Concern | Path / decision |
|---------|-----------------|
| Advisory lock pattern | Reuse `pg_advisory_xact_lock(hashtext(...))` from `clinical-price-version.service.ts` |
| Price resolution | Reuse `ClinicalPriceVersionService.lookupActivePrice` |
| Feature flags | Extend `Tenant.features` helpers beside `feature-flag.helpers.ts` |
| Postgres harness | Clone `clinical-catalog-db.harness.ts` patterns under scheduling tests |
| Module home | Extend `apps/api/src/modules/scheduling` (+ thin billing invoice consumer) |
| Portal | Keep wrapping scheduling handlers in `patient-portal` |

## Exact touchpoints

### Appointment SoR
- `apps/api/prisma/schema.prisma` — `Appointment`, `AppointmentStatus`
- `apps/api/src/modules/scheduling/domain/appointment.entity.ts`
- `apps/api/src/modules/scheduling/domain/appointment-status.enum.ts`
- `apps/api/src/modules/scheduling/infrastructure/prisma-appointment.repository.ts`
- Create: `application/handlers/create-appointment.handler.ts`
- Update/confirm/reschedule/cancel: `application/handlers/appointment.handlers.ts`
- Waitlist book (must gain same lock primitive): `schedule-settings.handlers.ts` `BookWaitlistEntryHandler`

### Portal
- `apps/api/src/modules/patient-portal/api/portal-scheduling.controller.ts`
- `application/handlers/portal-scheduling.handlers.ts`
- Idempotency: `application/services/portal-scheduling-idempotency.service.ts` (process-local today; preserve + integrate)

### Billing
- `create-invoice-from-appointment.handler.ts` — currently hardcodes `unitPrice: 0` (must become snapshot-driven when flag ON)

### Resources
- `SchedulingResource` + `SchedulingResourceType` (ROOM | EQUIPMENT; OPERATORY not added in Wave B)
- Appointment soft-FK `resourceId` (no junction today)
- Config foundation JSON: `TenantServiceConfiguration.requiresResourceTypes`

### Feature flags (pre-Wave B)
- Exists: `catalog.canonical.write`
- Missing (add): `booking.eligibility.enforcement`, `billing.invoice.from.snapshot`

### Audit / permissions / harness
- Audit pattern: `clinical-catalog` audit port/adapter
- Permissions: `packages/permissions/permission-matrix.json` (`api.scheduling`, `api.billing`, `api.patient_portal`)
- Harness: `clinical-catalog/tests/clinical-catalog-db.harness.ts`, `auth/tests/platform-db-security.harness.ts`

## Pre-existing gaps addressed by Wave B

1. Read-then-write overlap (no advisory lock)
2. Invoice `unitPrice: 0`
3. No snapshot / eligibility / ServiceResourceRequirement SoRs
4. Waitlist book bypasses conflict checks
5. Portal provider list is role-only

## Out of scope (confirmed)

P0-05/06/08/09/10, P1-03 OPERATORY workflow, Wave C+, Phase 49, Step 30
