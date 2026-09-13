# Pilot Cutover C3 — Neon source backup / restore drill

| Field | Value |
|-------|--------|
| **Program** | Pilot Production Cutover (P0) — NOT Phase 52 |
| **Lineage** | C2b tip `b7bbf3a` |
| **Branch** | `cursor/pilot-production-cutover-kickoff` |
| **Source** | Neon pilot `altraclinic-pilot` / `neondb` (Frankfurt) |
| **Overall** | **PARTIAL** |

```text
Offsite / PITR = EXTERNAL (not claimed)
Neon branch label "production" ≠ product production cutover
Neon primary wiped = NO
self-granted Pilot Cutover PA = NO
C4 = NOT STARTED
```

| File | Purpose |
|------|---------|
| [01_PROCEDURE.md](./01_PROCEDURE.md) | Backup → verify → disposable restore |
| [02_EXPLICIT_OUT.md](./02_EXPLICIT_OUT.md) | Softening / wipe primary / secrets |
| [03_RESULTS.md](./03_RESULTS.md) | PASS/PARTIAL/FAIL + evidence |

**Evidence (uncommitted):** `apps/api/.ci-evidence/pilot-c3-b7bbf3a/`  
**Aligns with:** [`PHASE_49_K3_BACKUP_RESTORE/`](../PHASE_49_K3_BACKUP_RESTORE/) (reuse semantics; Neon PG18 client for dump)
