# C3 — Explicit OUT

| OUT | Why |
|-----|-----|
| Claiming offsite backup / PITR complete | Remains **EXTERNAL** |
| Claiming product production cutover | Neon pilot drill only |
| Restoring over / wiping the only Neon primary as “success” | Forbidden without CTO approve (not given) |
| Softening verify (skip checksum / gzip -t) | Forbidden |
| Committing dumps, passwords, or `.ci-evidence` by default | Uncommitted policy |
| Treating schema-only as full-data PASS | Honesty required |
| C4 / C5 / program PA self-grant | Wait for CTO |
| Phase 52 / D5 / Stripe / SoR reopen | Out of program |
