# Phase 51 — Test Plan

Working directories noted per gate. Reuse existing Jest / Wave I / Phase 49 wrappers — **no** second framework / **no** new GH Checks brand.

| Gate | Command / surface | Notes |
|------|-------------------|--------|
| L6 thin smoke (required for L6) | `apps/api`: `npm run test:phase49-observability-readiness` | K4 readiness reuse |
| L6 thin smoke (Postgres) | `apps/api`: `npm run test:phase49-tenant-isolation-check` | K6 reuse; **SKIP** honestly if Postgres down |
| L6 optional alias | `npm run test:phase51-launch-smoke` | Wraps the two scripts above only |
| Complementary CI | Clinic Progressive + Inventory on accepting lineage | Pointer only — not re-required locally for L7 |
| Wave I / Step 28–29 onepass | existing `apps/api` scripts | **Optional** — not mandatory for L7 packaging |
| Docs packaging | L0–L7 markdown review | Manual / git tip inspection |

## Evidence layout (uncommitted)

```text
apps/api/.ci-evidence/phase51-l6-<shortsha>/
  00_SUMMARY.md
  01_observability.txt
  02_tenant_isolation.txt
```

Cited L6 run path: `apps/api/.ci-evidence/phase51-l6-77a7091/` (uncommitted OK).  
Do **not** commit evidence unless CTO authorizes separately.
