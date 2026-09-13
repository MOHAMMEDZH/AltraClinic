# C0 — Slice plan (C0→C5)

CTO authorizes slices in order. **C0 does not start C1.**

| Slice | Deliverable | Notes |
|-------|-------------|--------|
| **C0** | This kickoff package + OPERATOR_INDEX link | Docs only — delivered @ `2d1158d` |
| **C1** | Prod SQL template + role runbook (migrate-admin vs runtime-app NOBYPASSRLS) | **PASS-local** @ [`PILOT_CUTOVER_C1_DB_ROLES/`](../PILOT_CUTOVER_C1_DB_ROLES/) — roles not claimed in prod |
| **C2** | Staging migrate / RLS apply / K6-style isolation evidence | **PARTIAL** @ [`PILOT_CUTOVER_C2_STAGING_MIGRATE/`](../PILOT_CUTOVER_C2_STAGING_MIGRATE/) — local disposable PASS; real staging EXTERNAL |
| **C2b** | Neon staging/pilot migrate → RLS → isolation | **PASS** @ [`PILOT_CUTOVER_C2B_NEON/`](../PILOT_CUTOVER_C2B_NEON/) — Neon `neondb` (Frankfurt); branch label ≠ product prod |
| **C3** | Backup / restore on clone (K3 SoR) | **PARTIAL** @ [`PILOT_CUTOVER_C3_BACKUP_RESTORE/`](../PILOT_CUTOVER_C3_BACKUP_RESTORE/) — schema drill PASS; full-data blocked by FORCE RLS w/o owner dump role; offsite/PITR EXTERNAL |
| **C4** | K5 dry-run **execution** evidence | Honest FAIL/PARTIAL if blocked; no fake cutover |
| **C5** | Pilot go-live packet | Ties gates + evidence; program PA still CTO-external |

```text
C0–C3 delivered (C2 local PARTIAL; C2b Neon PASS; C3 backup PARTIAL schema drill)
C3 alone ≠ C4 authorize
Neon branch label "production" ≠ product production cutover
Offsite / PITR = EXTERNAL
Green docs ≠ cutover executed
Program PA = PENDING until CTO after authorized exit slice
```
