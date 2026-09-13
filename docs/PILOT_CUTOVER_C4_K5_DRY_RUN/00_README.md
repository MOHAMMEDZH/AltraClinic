# Pilot Cutover C4 — K5 dry-run execution evidence

| Field | Value |
|-------|--------|
| **Program** | Pilot Production Cutover (P0) — NOT Phase 52 |
| **Lineage** | C3 tip `1b8b56e` |
| **Branch** | `cursor/pilot-production-cutover-kickoff` |
| **Overall** | **PARTIAL** |
| **Reuse** | [`PHASE_49_K5_DEPLOY_ROLLBACK/`](../PHASE_49_K5_DEPLOY_ROLLBACK/) |

```text
Product production cutover = NOT CLAIMED
D-17 topology / CD / k8s = EXTERNAL (not invented)
Neon primary wipe = NOT RUN
self-granted Pilot Cutover PA = NO
C5 = NOT STARTED
```

| File | Purpose |
|------|---------|
| [01_DRY_RUN_EXECUTION.md](./01_DRY_RUN_EXECUTION.md) | What was executed vs skipped |
| [02_CHECKLIST_RESULTS.md](./02_CHECKLIST_RESULTS.md) | K5 dry-run rows → status |
| [03_KNOWN_LIMITATIONS.md](./03_KNOWN_LIMITATIONS.md) | C3 full-data gap; EXTERNAL bounds |
| [04_EXPLICIT_OUT.md](./04_EXPLICIT_OUT.md) | Fake cutover / wipe / C5 |

**Evidence (uncommitted):** `apps/api/.ci-evidence/pilot-c4-1b8b56e/`
