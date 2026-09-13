# C0 — Acceptance criteria (program + this slice)

## C0 slice (this package)

| Criterion | Required |
|-----------|----------|
| Kickoff docs exist under `docs/PILOT_CUTOVER_KICKOFF_PACKAGE/` | YES |
| Lineage cites Phase 49/50/51 PA ACCEPTED; cutover **not** executed | YES |
| Gate map points at Step 29 §§7–14 with EXTERNAL called out | YES |
| Credential model: migrate-admin vs runtime-app NOBYPASSRLS; no passwords in git | YES |
| Secrets map references K2 / `.env.example` key **names** only | YES |
| Slice plan C0→C5 recorded | YES |
| Explicit OUT includes cloud provision, secret manager, D-17, PITR, payment, Phase 52, fake cutover | YES |
| Thin `OPERATOR_INDEX` link | YES |
| No product code / secrets / cutover execution in C0 | YES |

```text
C0 acceptance = kickoff docs only
green docs ≠ pilot cutover
self-granted Pilot Cutover PA = NO
```

---

## Program Production Acceptance (later — CTO only)

Not claimed by C0. Future exit (after authorized C1–C5 evidence) must still satisfy Step 29 cutover gates at deploy time. CTO grants program PA externally.

```text
Pilot Production Cutover PA = PENDING
Evidence tip = ________
Cutover executed = ________
Authority = CTO-granted (not self-grant)
```
