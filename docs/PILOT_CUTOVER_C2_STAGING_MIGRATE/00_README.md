# Pilot Cutover C2 — Staging-or-local migrate / RLS / isolation proof

| Field | Value |
|-------|--------|
| **Program** | Pilot Production Cutover (P0) — NOT Phase 52 |
| **Lineage** | C1 tip `54d9983` |
| **Branch** | `cursor/pilot-production-cutover-kickoff` |
| **Target class** | **Local disposable Postgres** (`docker-compose.test.yml` @ `:5433`) — **not** real cloud staging |
| **Overall** | **PARTIAL** (local proof PASS; real staging = **EXTERNAL** until host exists) |

```text
Real staging / pilot cloud host = NOT USED (EXTERNAL until provisioned)
Production cutover = NOT CLAIMED
Roles exist in production = NOT CLAIMED
self-granted Pilot Cutover PA = NO
```

| File | Purpose |
|------|---------|
| [01_PROCEDURE.md](./01_PROCEDURE.md) | Ordered steps (C1 SQL → verify → migrate → RLS/triggers → isolation) |
| [02_EXPLICIT_OUT.md](./02_EXPLICIT_OUT.md) | Fake green / secrets / C3+ |
| [03_RESULTS.md](./03_RESULTS.md) | PASS/PARTIAL/FAIL + evidence paths |

**Evidence (uncommitted):** `apps/api/.ci-evidence/pilot-c2-54d9983/`
