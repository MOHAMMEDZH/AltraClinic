# Known Limitations (Wave D Round 2)

## Resolved in Round 2

- ServicePerformance same-tenant branch/encounter inconsistency
- Snapshot contextual consistency (within derivable snapshot↔appointment model)
- Mixed-tenant child/parent DB safety
- Incomplete RLS INSERT lifecycle proof
- Booking pricing resolver-only proof (now includes `CreateAppointmentHandler`)
- Missing dental consume production-path postgres proof

## Remaining legitimate boundaries

- AR-21 start only; AR-22 commission/revenue share not implemented
- PER_COURSE / PER_PACKAGE fail closed until Wave E pricing domains
- API TS6059 baseline on `permission-seeds.ts`
- No dedicated unknown/cross-tenant **providerId** ServicePerformance test (participant userId tenant checks remain authoritative)
- Snapshot cannot enforce encounter relations not present on `AppointmentServiceSnapshotRevision` schema beyond encounter↔appointment bridge

## Status

Wave D Round 2 remediation complete locally. **Production Acceptance still requires external actual-file review.**
