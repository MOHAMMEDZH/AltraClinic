# Wave D Change Summary

Round 1 remediation addressed only externally confirmed blockers B1-B6.

## Remediation changes

- **B1 / P0-05:** `complete-from-appointment` now fails closed unless linked appointment status is canonical `COMPLETED` (from Wave B scheduling lifecycle/domain). Non-completed statuses reject without item mutation or success audit.
- **B2 / AR-21 references:** `ServicePerformanceService.create()` now enforces cross-reference integrity between appointment/patient/branch/encounter/snapshot/clinicalService, including mismatch rejection and no silent patient overwrite.
- **B3 / AR-21 correction concurrency:** `ServicePerformanceService.correct()` now locks target performance row (`SELECT ... FOR UPDATE`) before reading mutable state and writing correction history/participants/audit in one transaction.
- **B4 / RLS proof:** RLS tests now cover all Wave D tenant-owned tables including child tables with NOBYPASSRLS role proof and cross-tenant write denial.
- **B5 / pricing production path:** Added postgres integration proof for publish and booking resolver paths, including `PER_COURSE`/`PER_PACKAGE` fail-closed and no booking/invoice side effects on rejection.
- **B6 / evidence gaps:** Added explicit rollback/audit tests and foreign-reference rejection cases in Wave D postgres suite.

## Additional DB change in Round 1

- New migration: `20260819163000_phase48_wave_d_round1_reference_integrity`
  - Adds DB FKs from `service_performances.branchId -> branches.id`
  - Adds DB FKs from `service_performances.encounterId -> encounters.id`
  - Adds `service_performances_tenantId_encounterId_idx`

## What did not change

- No Wave E / AR-22 / Phase 49 / Step 30 work
- No commit, no push
