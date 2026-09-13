# C0 — Cutover gate map (Step 29 → owner → evidence)

**SSOT:** [`RELEASE_47_STEP29_RELEASE_READINESS.md`](../RELEASE_47_STEP29_RELEASE_READINESS.md) §§7–14  
**Rule:** In-repo packaging PASS is necessary but **not sufficient**. Gates must still be executed at pilot deploy time.

| Gate (Step 29) | Accountable owner (Form B) | Evidence artifact (expected) | Boundary |
|----------------|----------------------------|------------------------------|----------|
| §9 Backup / restore verify | Database/Backup Operator | Backup artifact + verify log; K3 drill evidence path | Offsite / PITR = **EXTERNAL** |
| §10 Deploy topology / edge CSP | Platform Operations + Platform Security | Topology record + CSP/header fetch notes (`SECURITY_RUNBOOKS.md` §11) | D-17 topology = **EXTERNAL** |
| §11 Monitoring / alerts / on-call | Platform Security on-call | Alert route + on-call ack; K4 readiness complement | Paging / APM / SIEM SaaS = **EXTERNAL** |
| §12 Deploy + rollback authority | Release Manager + Platform Operations | Deploy window record; K5 runbook cite; rollback decision log | Fake cutover = OUT |
| §13 Least-privilege access | Release Manager + Platform Security | Access review notes; secrets access list (names only) | No passwords in tickets/git |
| §14 Support / domain ownership | Per Step 29 matrix | Handoff cite L4 / K7 | — |
| §8.1–8.5 ownership matrix | As named in Step 29 | This map + Step 29 tables | — |
| Migrate + RLS apply | Database/Backup Operator + Platform Ops | `db:migrate:deploy` + `db:rls:apply` exit evidence (C2+) | Migrate-admin credential **EXTERNAL** to secret store |
| Tenant isolation check | Platform Security / DB Operator | K6 / `test:phase49-tenant-isolation-check` (or prod-equivalent) | Needs Postgres target |
| Secrets hygiene | Platform Security | K2 checklist complete; no `.env` in git | Secret manager install = **EXTERNAL** |

```text
Production cutover gates pending execution = YES
Production may proceed if a cutover gate fails = NO
EXTERNAL gates still require operator evidence — not invented in-repo CD
```
