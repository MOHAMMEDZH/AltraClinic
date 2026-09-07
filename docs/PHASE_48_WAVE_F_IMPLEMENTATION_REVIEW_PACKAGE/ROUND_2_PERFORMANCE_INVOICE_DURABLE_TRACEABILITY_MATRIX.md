# ROUND_2_PERFORMANCE_INVOICE_DURABLE_TRACEABILITY_MATRIX

## Authoritative link
`invoice_line_items.servicePerformanceId` → `service_performances.id` (unique when set)

## Removed heuristic
Round 1 `encounterMatch OR serviceCodeMatch` acceptance path removed.

## Posting rules
1. Line must carry `servicePerformanceId`
2. Must equal posted `ServicePerformance.id`
3. Patient/branch consistency
4. Encounter mismatch fail-closed when both set
5. Snapshot revision must belong to same appointment
6. Open economic allocation: cannot accrue same performance to a different open line

## Tests
| ID | Result |
|----|--------|
| F3-R2-T1 durable success | PASS |
| F3-R2-T2 different encounter | PASS |
| F3-R2-T3 serviceCode only | PASS reject |
| F3-R2-T4 wrong appointment/SP | PASS |
| F3-R2-T5 wrong snapshot | PASS |
| F3-R2-T7 second unrelated line | PASS |
| F3-R2-T8 zero side effects | PASS |
| HTTP durable post | PASS |
