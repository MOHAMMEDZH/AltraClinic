# Phase 48 Wave B — Implementation Plan

```text
Wave A Production Acceptance = ACCEPTED
Wave B = AUTHORIZED CURRENT IMPLEMENTATION WAVE
Wave C = NOT AUTHORIZED
Phase 49 = NOT AUTHORIZED
Step 30 = NOT AUTHORIZED
branch = cursor/phase48-wave-b-booking-integrity
base = c09f46d (Wave A acceptance checkpoint)
```

## Scope map

| Priority / ADR | Deliverable | Primary files | Status |
|----------------|-------------|---------------|--------|
| P0-02 / AR-05 | AppointmentServiceSnapshotRevision + effectiveSnapshotRevisionId; invoice-from-snapshot | schema, `appointment-snapshot.service.ts`, invoice handler, snapshot tests | DONE |
| P0-03 / AR-06 | PostgreSQL advisory xact locks + sorted keys + post-lock overlap re-check | `booking-concurrency.service.ts`, create/update/waitlist/portal, concurrency tests | DONE |
| P0-04 / AR-07 | ProviderServiceEligibility + booking.eligibility.enforcement fail-closed | `provider-eligibility.service.ts`, availability/providers, eligibility tests | DONE |
| AR-12 | ServiceResourceRequirement + allocation validation in same lock set | `service-resource-requirement.service.ts`, resource tests | DONE |

## Feature flags

| Flag | Default | Behavior |
|------|---------|----------|
| `catalog.canonical.write` | missing → ON | Free-text identity forbidden when ON for new canonical booking |
| `booking.eligibility.enforcement` | missing → OFF | ON = DEFAULT DENY |
| `billing.invoice.from.snapshot` | missing → OFF | ON = effective snapshot; fail closed if canonical missing |

## Migration / backfill

- Additive migration `20260815010000_phase48_wave_b_booking_integrity`
- Additive PA migration `20260815120000_phase48_wave_b_pa_blockers` (append-only trigger, allocations, portal ledger, RLS; provider ownership enforced in service — no hard FK due to synthetic/orphan test UUIDs)
- Additive re-review migration `20260815200000_phase48_wave_b_rereview_closure` (`commercialLockedAt`, ledger status/expires)
- Additive final-defect migration `20260815210000_phase48_wave_b_final_defect_closure` (ledger `attemptVersion`/`ownerToken`, allocation association integrity trigger)
- Additive 3-blocker migration `20260815220000_phase48_wave_b_legacy_cancelled_lock` (legacy CANCELLED `commercialLockedAt` from queue/encounter/snapshot evidence)
- Additive final-2-blocker migration `20260815230000_phase48_wave_b_final_2blocker_closure` (runtime markers table + series discovery index; initial insert used migration-filename pseudo-cutover — superseded)
- Additive narrow cutover migration `20260815240000_phase48_wave_b_cutover_execution_time` (sets `snapshot_backfill_cutover_at = CURRENT_TIMESTAMP` at actual migration execution; corrects pseudo timestamp; ON CONFLICT DO NOTHING stability)
- Additive provenance migration `20260815250000_phase48_wave_b_snapshot_write_mode` (`Appointment.snapshotWriteMode` enum `LEGACY` | `CANONICAL_REQUIRED`; historical default `LEGACY`; DB default `LEGACY`)
- Preserve `Appointment.resourceId` as primary/legacy (= resourceIds[0])
- Preserve `Appointment.serviceType`

## Queue / Beauty integrity closure (residual)

### Queue walk-in
- `status=CHECKED_IN` create stamps `commercialLockedAt` atomically (same `now`)
- `authenticatedActorId` required; snapshot + audit actor = command actor (never providerId)
- canonical path reuses `ProviderEligibilityService` + `ServiceResourceRequirementService` + allocations in same booking tx

### Queue assignRoom
- `AssignQueueRoomHandler` uses advisory locks → `FOR UPDATE` → fresh allocations → overlap/requirements → `AppointmentResourceAllocation` authoritative; `Appointment.resourceId` legacy mirror
- `queue-board.assignRoom` no longer mutates appointment scheduling fields
- `room_assigned` QueueTicketEvent writes inside the same `withBookingTransaction` client; `actorUserId` = authenticated actor; event failure rolls assignment back
- post-commit work is presentation/realtime only

### Queue lifecycle (check-in / status / call-next)
- Appointment status mutations go through `AppointmentLifecycleMutationService` with `FOR UPDATE` via `BookingConcurrencyService.lockAppointmentsForUpdate`
- commercialLockedAt stamped only if absent on fresh locked row; never re-stamped/cleared
- `applied=false` → callers throw → QueueTicket + Appointment + QueueTicketEvent roll back together
- QueueTicketEvent written with the same transaction client (not post-commit)

### Beauty LEGACY create
- create (canonical write OFF): under `BookingConcurrencyService`; provider same-tenant + clinical-service accessibility independent of eligibility
- clinicalServiceId present → `ServiceResourceRequirementService.assertRequirementsSatisfied` + allocations + resource advisory locks
- eligibility ON still requires clinicalServiceId + assertEligible
- create (canonical write ON): fail closed
- existing appointment mutations delegate to `UpdateAppointmentHandler`

| Item | Value |
|------|-------|
| Peer discovery | `AppointmentRepository.listSeriesFutureMembers` — `tenantId` + `recurrenceSeriesId` + `scheduledStart >= anchor`; order `scheduledStart ASC, id ASC`; page until exhausted (no fixed truncation) |
| Lock acquisition | collect all provider/resource keys → `buildGlobalLockKeys` → one global sort → `acquireSortedLockKeys` **exactly once per transaction attempt** |
| Appointment row stabilization | after advisory locks: `SELECT … FROM appointments WHERE id IN (…) ORDER BY id ASC FOR UPDATE` via `lockAppointmentsForUpdate` — held through validation + writes |
| Post-row-lock | fresh reread under FOR UPDATE → if lock-relevant identity changed vs advisory key assumptions → throw sentinel → **rollback** → **NEW transaction** attempt |
| Retry | bounded max 3 attempts; each attempt rediscovers peers and rebuilds complete key set from zero |
| Atomicity | one successful `withBookingTransaction` commits all peer moves; failed attempts leave zero partial writes |
| UpdateAppointment provider change | acquires oldProvider+newProvider (+ resources) in same globally sorted advisory pass, then appointment row FOR UPDATE |
| BulkReschedule | same authoritative pattern as series: one tx for all candidates → discovery → global advisory keys once → `FOR UPDATE` all rows → fresh identity/overlap validation → all-or-nothing commit; identity change → NEW-tx retry |
| UpdateAppointment omitted fields | after `FOR UPDATE`, unspecified `scheduledStart`/`scheduledEnd`/`providerId`/resources/status come from **post-lock fresh row** (never stale pre-tx domain); final lock-set mismatch → NEW-tx retry |

### Production backfill (authoritative)

| Item | Value |
|------|-------|
| Authoritative implementation | `apps/api/scripts/lib/phase48-wave-b-snapshot-backfill.cjs` |
| Production CLI wrapper | `apps/api/scripts/backfill-phase48-wave-b-snapshots-production.mjs` (imports `.mjs` thin re-export of `.cjs`) |
| Test / Jest thin re-export | `apps/api/src/modules/scheduling/application/services/phase48-wave-b-snapshot-backfill.ts` (requires same `.cjs`) |
| Duplicate business logic | **NO** |
| Cutover watermark | `phase48_wave_b_runtime_markers.snapshot_backfill_cutover_at` = **operational/diagnostic only** (CURRENT_TIMESTAMP at `20260815240000`); **NOT** the provenance classifier |
| Appointment provenance | `Appointment.snapshotWriteMode` written at create time |
| Legacy eligible | missing snapshot AND `snapshotWriteMode = LEGACY` → synthetic migration snapshot allowed |
| Canonical integrity failure | missing snapshot AND `snapshotWriteMode = CANONICAL_REQUIRED` → **no** synthetic history; count + non-zero exit |
| Canonical create contract | flag ON + commercial resolve → `CANONICAL_REQUIRED` + revision 1 + effective pointer in **same** booking transaction |
| Legacy create contract | flag OFF / no canonical resolve → `LEGACY` (DB default remains LEGACY for rolling deploy safety) |
| Final counts | bounded keyset iteration (`id ASC`, `id > cursor`, batch size); **no** unbounded `findMany` |
| Pseudo-cutover guard | live marker equal to `2026-08-15T01:00:00.000Z` → fail closed when loading marker for diagnostics |
| Batch size default | `1000` (`WAVE_B_BACKFILL_BATCH_SIZE` / `opts.batchSize`) |
| Loop termination | empty scan batch |
| Success criterion | `legacyEligibleRemaining === 0` AND `canonicalIntegrityFailures === 0` |
| Resume / idempotency | re-query missing snapshots; safe rerun; no pointer churn |
| RLS bypass | per-batch `$transaction` + `set_config('app.platform_rls_bypass','true', true)` (transaction-local) |
| sourceSystem filter | `LEGACY_APPOINTMENT_SERVICE_TYPE` only |
| TENANT_CUSTOM safety | mapped service `tenantId` must equal appointment `tenantId`; else reject / leave unmapped |
| Confirmation | `--confirm-production-backfill` required (no DB reset; no localhost hostname requirement) |

### Appointment creation path matrix (production)

| path | classification | evidence |
|------|----------------|----------|
| `CreateAppointmentHandler` (admin/API) | CANONICAL_REQUIRED when `catalog.canonical.write` ON + commercial resolve; else LEGACY | `create-appointment.handler.ts` |
| Portal booking | same (delegates to CreateAppointmentHandler) | `portal-scheduling.handlers.ts` |
| Waitlist → appointment | same | `schedule-settings.handlers.ts` |
| Queue walk-in | flag ON + clinicalServiceId + commercial → CANONICAL_REQUIRED + rev1 atomic; flag ON without resolve → fail closed; flag OFF → LEGACY | `walk-in-queue.handler.ts` |
| Beauty session sync | flag ON → fail closed (bounded compatibility; Wave E redesign out of scope); flag OFF → LEGACY | `beauty-session-sync.service.ts` |
| Appointment template create | NOT_A_BOOKING_CREATE | template handlers |
| Tests/factories | NOT production | N/A |

### snapshotWriteMode immutability

| Item | Value |
|------|-------|
| Mechanism | BEFORE UPDATE trigger `appointments_snapshot_write_mode_immutable` |
| Migration | `20260815260000_phase48_wave_b_snapshot_write_mode_immutable` |
| Behavior | insert OK; same-value update OK; LEGACY↔CANONICAL_REQUIRED change raises exception |
| Runtime | ordinary appointment updates must not mutate provenance |

- Clean/upgrade validators: `validate-phase48-wave-b-clean.mjs`, `validate-phase48-wave-b-upgrade.mjs`
- Permission-route validator: `validate-phase48-wave-b-permission-routes.mjs`

## PA blockers (WB-PA-01..07)

Closed in dirty worktree: snapshot immutability + correction auth, authoritative eligibility activation, cancel/delete/series locks, DB portal idempotency, multi-resource allocations, RLS + tenant checks, scheduling audit, pack fidelity. See IMPLEMENTATION_EVIDENCE.

## Exit criteria (frozen)

```text
CONFIRMED commercial lock works (generic update never post-confirm corrects)
provider eligibility fail-closed when ON
same-provider no-existing-row race = exactly one success
resource conflict race = exactly one success (including allocation table)
authoritative activation readiness blocks partial coverage
```

Do not self-grant Wave B Production Acceptance.
