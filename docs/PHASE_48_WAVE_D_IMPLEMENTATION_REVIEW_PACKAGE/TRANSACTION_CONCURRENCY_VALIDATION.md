# Wave D Transaction / Concurrency Validation

## B3 correction serialization

`ServicePerformanceService.correct()` now:

1. starts single `withPlatformBypass` transaction
2. sets correction-hatch local flag
3. locks target row with `SELECT ... FOR UPDATE`
4. validates `COMPLETED` state inside lock scope
5. reads previous participants after lock
6. inserts correction history
7. replaces participant rows
8. records audit
9. returns updated row

No nested transaction and no writes outside caller transaction.

## Concurrency evidence

`wave-d-dental.postgres.integration.spec.ts` proves:
- two concurrent corrections serialize safely
- final participants are a valid serial outcome
- correction history includes both before/after snapshots
- no lost update / no partial delete-create
- forced audit failure rolls back participant/history/audit together

## Other Wave D transaction checks

- OPERATORY booking conflict still uses frozen Wave B lock strategy
- plan-item completion updates only on explicit command + valid link + COMPLETED appointment
