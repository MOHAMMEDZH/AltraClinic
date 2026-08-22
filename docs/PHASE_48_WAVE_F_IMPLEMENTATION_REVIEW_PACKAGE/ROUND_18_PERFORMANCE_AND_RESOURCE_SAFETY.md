# Round 18 Performance and Resource Safety

- No `exploreBudget` in production validator
- R18-A-U1/U2/U3 pure validation < 5s (observed 77–150ms)
- 25-special shuffle battery (20 seeds): ~1.2s total
- PG R18-A-T1 (125 production reversals): explicit timeout 120s

Pure validator never maps resource limits to economic invalidity.
