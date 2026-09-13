# Phase 50 — Test Plan

Working directories noted per gate. Reuse existing Vitest / Playwright / Jest — **no** second framework.

| Gate | Command / surface | Notes |
|------|-------------------|--------|
| D6 unit | `apps/clinic-dashboard`: `npx vitest run src/components/NamedIdentityDisplay.spec.tsx` | Name primary / UUID fail-closed |
| D4 a11y e2e (touched) | `apps/clinic-dashboard`: Playwright `e2e/scheduling-a11y.spec.ts` `e2e/ai-a11y.spec.ts` (+ beauty/encounters if exercised) | Requires API + `E2E_API_READY`; else skip via `isE2eApiReady()` — **PR CI authoritative** |
| Progressive a11y list | `.github/workflows/clinic-dashboard-ci.yml` → `progressive-inventory` | Already lists `scheduling-a11y` / `ai-a11y` / beauty / encounters — **no new GH Checks in D7** |
| Inventory E2E | same workflow → `inventory-e2e` (`npm run test:e2e`) | Includes Wave H3/H4 specs when full suite runs |
| Wave H3 helper | `npm run test:phase48-p1-accessibility-tablet` | Optional local; reception chrome without contrast silence |
| Clinic unit (smoke) | existing clinic-dashboard Vitest as needed | Thin; not a new pack brand |
| Step 28 / 29 / Wave I onepass | `apps/api` scripts (optional/heavy) | Lineage stance — not re-required for every D slice |

## Evidence layout (uncommitted)

```text
apps/api/.ci-evidence/phase50-d4-<shortsha>/
```

Do **not** commit evidence unless CTO authorizes separately.
