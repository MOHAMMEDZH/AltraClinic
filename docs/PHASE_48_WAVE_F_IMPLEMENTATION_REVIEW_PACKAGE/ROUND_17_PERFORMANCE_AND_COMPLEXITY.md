# Round 17 — Performance and Complexity

## Removed
- O(2^s) bitmask DP with s ≤ 24 hard cap
- `TOO_MANY_NON_EXACT_EFFECTS`

## Current
- Equivalence-class memoized DFS
- Worst-case explore budget: max(500_000, n² × 32) states — rejects pathological search without business count cap
- Typical production (k ≪ n): polynomial in n

## Measured (unit, local run)

| Scenario | Effects | Specials | Time bound |
|----------|---------|----------|------------|
| R17-A-T1 | 125 | ≥25 | <30s |
| R17-A-T6 | 150 | 50 | <15s |
| R17-A-T7 | 200 | 100 | <30s |
| R17-D | 125 | ≥25 | <30s |

## PostgreSQL
- R17-A-T1 125 sequential creates: ~3s
- R17-A-T3 correction carry (after batch validation fix): ~4s

See `ROUND_17_RAW_GATE_OUTPUTS/01_R17_UNIT.txt` for exact timings.
