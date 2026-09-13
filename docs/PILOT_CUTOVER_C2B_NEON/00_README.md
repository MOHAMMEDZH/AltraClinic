# Pilot Cutover C2b — Neon staging/pilot migrate / RLS / isolation

| Field | Value |
|-------|--------|
| **Program** | Pilot Production Cutover (P0) — NOT Phase 52 |
| **Lineage** | C2 tip `224229e` |
| **Branch** | `cursor/pilot-production-cutover-kickoff` |
| **Target** | Neon project **altraclinic-pilot** / DB **neondb** (Frankfurt / `eu-central-1`) |
| **Neon branch label** | `production` — **≠ product production cutover** |
| **Overall** | **PASS** |

```text
Product production cutover = NOT CLAIMED
Neon branch name "production" ≠ product production
self-granted Pilot Cutover PA = NO
C3 = NOT STARTED
```

| File | Purpose |
|------|---------|
| [01_PROCEDURE.md](./01_PROCEDURE.md) | Neon-specific steps |
| [02_EXPLICIT_OUT.md](./02_EXPLICIT_OUT.md) | Secrets / cutover / C3 |
| [03_RESULTS.md](./03_RESULTS.md) | PASS/PARTIAL/FAIL + evidence |

**Evidence (uncommitted):** `apps/api/.ci-evidence/pilot-c2b-224229e/`
