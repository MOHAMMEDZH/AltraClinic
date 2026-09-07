# ROUND_2_HISTORICAL_PLAN_RESOLUTION_MATRIX

## Resolver
`resolvePlanAt(tenant, user, eventDate)` / `resolveActivePlan` alias

Status filter: `ACTIVE | SUPERSEDED` (never DRAFT)
Interval: `effectiveFrom ≤ day ≤ effectiveTo|∞`
Order: `effectiveFrom desc, publishedAt desc`

## Publish
On ACTIVE→SUPERSEDED, close prior `effectiveTo` to day before new `effectiveFrom` (allowed by Round 2 immutability amendment).

## Tests
| ID | Result |
|----|--------|
| F5-R2-T1/T3 historical SUPERSEDED | PASS |
| F5-R2-T2 new version after effectiveFrom | PASS |
| F5-R2-T9 immutability | PASS |
