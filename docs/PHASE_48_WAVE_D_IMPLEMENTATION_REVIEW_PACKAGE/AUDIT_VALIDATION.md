# Wave D Audit Validation

Round 1 audit invariants:

- `complete-from-appointment` emits success audit only when completion succeeds.
- Failed completion (no-link/non-COMPLETED appointment) emits **no** success audit and leaves item unchanged.
- ServicePerformance correction writes correction-history + participant replacement + audit in one transaction.
- Forced failure at audit step rolls back correction history and participant writes together.

## Verified actions

- `dental.plan_item.complete_from_appointment`
- `service_performance.correct`

Evidence: `wave-d-dental.postgres.integration.spec.ts` (`AR-21 correction failure rolls back participants/history/audit together`).
