# Round 17 — Build Results

| Check | Exit | Classification |
|-------|------|----------------|
| `npx tsc -p tsconfig.build.json` | 2 | **PASS_BASELINE** |
| `git diff --check` | 0 | PASS |

## Baseline diagnostic (only)
```
error TS6059: File '.../prisma/seeds/permission-seeds.ts' is not under 'rootDir' '.../src'
```

No new Wave F or Round 17 TypeScript diagnostics.

Raw: `ROUND_17_RAW_GATE_OUTPUTS/39_API_BUILD.txt`, `40_DIFF_CHECK.txt`
