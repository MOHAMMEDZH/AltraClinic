# Tenant Reference Validation (Wave D Round 2)

## ServicePerformance create — cross-reference ordering

All reference and consistency checks execute inside `withPlatformBypass` **before** `servicePerformance.create`, participant inserts, or audit.

### Round 2 additions

| Rule | Behavior | Test |
|------|----------|------|
| branchId ↔ encounterId | If both supplied: `branchId === encounter.branchId`; if branch omitted and encounter has branch: derive branchId | mismatch reject; derive accept |
| snapshotRevisionId context | Match clinicalServiceId; snapshot appointment ↔ appointmentId; snapshot appointment patient/branch ↔ supplied patientId/branchId; encounter appointment ↔ snapshot when encounter supplied | patient/branch mismatch reject; full set accept |

### Snapshot limitation (documented)

`AppointmentServiceSnapshotRevision` links to `appointmentId` only — no direct encounter FK on snapshot. Encounter consistency is enforced via `encounter.appointmentId === snapshot.appointmentId` when both supplied.

## Dental consume (Wave C ledger path)

Optional `appointmentId` / `clinicalServiceId` validated in `InventoryUsagePostingService.assertRelatedTenantReferences` — production-path proof in `wave-d-dental-consume.postgres.integration.spec.ts`.

Status: **Round 2 targeted gaps closed with passing postgres proof.**
