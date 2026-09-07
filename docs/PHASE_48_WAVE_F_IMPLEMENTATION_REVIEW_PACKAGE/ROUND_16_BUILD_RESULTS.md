# Round 16 — Build Results

Command (apps/api):

```
npx tsc -p tsconfig.build.json --pretty false
```

Exit code: **2**
Classification: **PASS_BASELINE**

Only diagnostic:

```
error TS6059: File '.../apps/api/prisma/seeds/permission-seeds.ts' is not under 'rootDir' '.../apps/api/src'
```

No new Wave F / Round 16 TypeScript diagnostics. Raw: `ROUND_16_RAW_GATE_OUTPUTS/37_API_BUILD.txt`.
