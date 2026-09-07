# Round 16 — Long History Validation Matrix (R16-B)

## Algorithm

1. Normalize observations with Prisma.Decimal + `roundMoney` (no binary float).
2. Reject duplicate refundIds, bad shapes, aggregate > capacity.
3. Partition **exact** (`observed == proposal` both dims) vs **special**.
4. Subtract exact aggregates from capacity; add exact refund bases to cumulative basis.
5. Validate specials with bitmask DP over specials only: `O(2^s · s)` memoized on `(remRev, remComm, basisUsed, mask)`.
6. Each special application uses Round 16 saturation rule (`applyAuthoritativeRefundEffect`).

**No arbitrary hard limit on total effect count n.**
Pathological `s > 24` non-exact anomalies reject as `TOO_MANY_NON_EXACT_EFFECTS` (forged/corrupt), not a product refund-count cap.

## Results

| Case | Count | Result | Runtime bound |
|---|---|---|---|
| R16-B-T1 / U1 | 13 | PASS create + nets 0/0 | < 5s unit / PG ok |
| R16-B-T2 | 13 | PASS replay, no SET_TOO_LARGE | PG |
| R16-B-T3 | 13 | PASS correct/carry | PG |
| R16-B-T4 / U2 | 25 | PASS | < 5s unit; PG < 120s |
| R16-B-T5 / U3 | **50** | PASS nets 0/0 | < 10s unit; PG < 180s |
| R16-B-T6 / U5 | 13 forged | REJECT not realizable | PG/unit |
| R16-B-T7 | 10 asymmetric | PASS saturation 0/0 | PG |
| R16-B-T8 | 13 package | PASS provenance | PG |

Largest stress/property count tested: **50**.
