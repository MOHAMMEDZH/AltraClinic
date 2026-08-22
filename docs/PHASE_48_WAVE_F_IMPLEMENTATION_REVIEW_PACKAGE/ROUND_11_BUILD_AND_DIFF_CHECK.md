# ROUND 11 — Build and Diff Check

| Check | Exit | Classification |
|-------|------|----------------|
| `npx tsc -p tsconfig.build.json --pretty false` | 2 | **PASS_BASELINE** |
| `git diff --check` | 0 | PASS |

## Build diagnostics

Only known baseline:

- `TS6059` — `prisma/seeds/permission-seeds.ts` is not under `rootDir` `apps/api/src`

No new Round 11 / Wave F TypeScript diagnostics.

Raw: `ROUND_11_RAW_GATE_OUTPUTS/30_build.txt`, `31_diffcheck.txt`
