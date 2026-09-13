# C0 — Slice plan (C0→C5)

CTO authorizes slices in order. **C0 does not start C1.**

| Slice | Deliverable | Notes |
|-------|-------------|--------|
| **C0** | This kickoff package + OPERATOR_INDEX link | Docs only — **this slice** |
| **C1** | Prod SQL template + role runbook (migrate-admin vs runtime-app NOBYPASSRLS) | Still no cloud provision required in docs; no passwords in git |
| **C2** | Staging migrate / RLS apply / K6-style isolation evidence | Against staging/pilot target when available |
| **C3** | Backup / restore on clone (K3 SoR) | Offsite/PITR remain EXTERNAL |
| **C4** | K5 dry-run **execution** evidence | Honest FAIL/PARTIAL if blocked; no fake cutover |
| **C5** | Pilot go-live packet | Ties gates + evidence; program PA still CTO-external |

```text
C0 kickoff alone ≠ C1 authorize
Green docs ≠ cutover executed
Program PA = PENDING until CTO after authorized exit slice
```
