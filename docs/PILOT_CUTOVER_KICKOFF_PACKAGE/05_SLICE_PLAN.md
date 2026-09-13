# C0 — Slice plan (C0→C5)

CTO authorizes slices in order. **C0 does not start C1.**

| Slice | Deliverable | Notes |
|-------|-------------|--------|
| **C0** | This kickoff package + OPERATOR_INDEX link | Docs only — delivered @ `2d1158d` |
| **C1** | Prod SQL template + role runbook (migrate-admin vs runtime-app NOBYPASSRLS) | **PASS-local** @ [`PILOT_CUTOVER_C1_DB_ROLES/`](../PILOT_CUTOVER_C1_DB_ROLES/) — roles not claimed in prod |
| **C2** | Staging migrate / RLS apply / K6-style isolation evidence | **PARTIAL** @ [`PILOT_CUTOVER_C2_STAGING_MIGRATE/`](../PILOT_CUTOVER_C2_STAGING_MIGRATE/) — local disposable PASS; real staging EXTERNAL |
| **C2b** | Neon staging/pilot migrate → RLS → isolation | **PASS** @ [`PILOT_CUTOVER_C2B_NEON/`](../PILOT_CUTOVER_C2B_NEON/) — Neon `neondb` (Frankfurt); branch label ≠ product prod |
| **C3** | Backup / restore on clone (K3 SoR) | **PARTIAL** @ [`PILOT_CUTOVER_C3_BACKUP_RESTORE/`](../PILOT_CUTOVER_C3_BACKUP_RESTORE/) — schema drill PASS; full-data blocked by FORCE RLS w/o owner dump role; offsite/PITR EXTERNAL |
| **C4** | K5 dry-run **execution** evidence | **PARTIAL** @ [`PILOT_CUTOVER_C4_K5_DRY_RUN/`](../PILOT_CUTOVER_C4_K5_DRY_RUN/) — migrate status + obs readiness + rollback rehearsal; health/CD SKIP; no fake cutover |
| **C5** | Pilot go-live packet | **PASS** (docs) @ [`PILOT_CUTOVER_C5_GOLIVE_PACKET/`](../PILOT_CUTOVER_C5_GOLIVE_PACKET/) — PA **PENDING EXTERNAL**; STOP S1–S4 open |

```text
C0–C5 packaging delivered; Packaging PA = ACCEPTED (CTO @ b2e1b40)
STOP S1–S4 remain OPEN before real tenant pilot
Neon branch label "production" ≠ product production cutover
Offsite / PITR = EXTERNAL
Green docs ≠ cutover executed
Real tenant pilot = NOT AUTHORIZED
PR merge = wait for CTO authorize
```
