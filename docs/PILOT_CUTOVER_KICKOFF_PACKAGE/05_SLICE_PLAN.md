# C0 — Slice plan (C0→C5)

CTO authorizes slices in order. **C0 does not start C1.**

| Slice | Deliverable | Notes |
|-------|-------------|--------|
| **C0** | This kickoff package + OPERATOR_INDEX link | Docs only — delivered @ `2d1158d` |
| **C1** | Prod SQL template + role runbook (migrate-admin vs runtime-app NOBYPASSRLS) | **PASS-local** @ [`PILOT_CUTOVER_C1_DB_ROLES/`](../PILOT_CUTOVER_C1_DB_ROLES/) — roles not claimed in prod |
| **C2** | Staging migrate / RLS apply / K6-style isolation evidence | **PARTIAL** @ [`PILOT_CUTOVER_C2_STAGING_MIGRATE/`](../PILOT_CUTOVER_C2_STAGING_MIGRATE/) — local disposable PASS; real staging EXTERNAL |
| **C3** | Backup / restore on clone (K3 SoR) | Offsite/PITR remain EXTERNAL |
| **C4** | K5 dry-run **execution** evidence | Honest FAIL/PARTIAL if blocked; no fake cutover |
| **C5** | Pilot go-live packet | Ties gates + evidence; program PA still CTO-external |

```text
C0–C2 delivered (C2 = PARTIAL local disposable; real staging EXTERNAL)
C2 alone ≠ C3 authorize
Green docs ≠ cutover executed
Program PA = PENDING until CTO after authorized exit slice
```
