# Pilot Cutover — STOP clearance (S1–S4)

**Purpose:** Clear C5 stop-the-line items before a **real tenant** pilot.  
**Lineage:** Packaging PA ACCEPTED @ `b2e1b40` / merge `cbb8eca`.  
**Rule:** Packaging merge ≠ real tenant go-live.

| STOP | Meaning | Owner |
|------|---------|--------|
| **S4** | Neon owner password rotated; URL only in gitignored local env | Human (Neon console) |
| **S1** | Full-data backup → verify → restore to disposable Docker | Agent + local owner URL |
| **S2** | Nest API `/health` against Neon runtime-app | Agent + human |
| **S3** | Topology recorded (this package) | Docs |

```text
Do not paste DATABASE_URL / passwords into chat or PRs
Do not wipe Neon primary without CTO authorize
Product production cutover = NOT CLAIMED
```
