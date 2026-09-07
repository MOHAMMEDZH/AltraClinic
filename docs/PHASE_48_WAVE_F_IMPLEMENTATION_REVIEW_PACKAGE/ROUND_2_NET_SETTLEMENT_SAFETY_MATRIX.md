# ROUND_2_NET_SETTLEMENT_SAFETY_MATRIX

## Model
Append-only `commission_settlement_allocations`

settleable = original.commission − Σ|reversals| − Σ(settlements)

- settleable ≤ 0 → reject
- allocation amount = settleable (net remaining)
- status → SETTLED only when net fully covered

## Tests
| ID | Result |
|----|--------|
| F7-R2-T2 partial reverse then settle net | PASS |
| F7-R2-T3 full reverse then settle reject | PASS |
| idempotent settle key settle:{id}:{ref} | covered |
