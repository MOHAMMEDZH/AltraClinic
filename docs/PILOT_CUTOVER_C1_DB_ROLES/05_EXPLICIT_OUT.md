# C1 — Explicit OUT

| OUT | Why |
|-----|-----|
| Creating / provisioning cloud Postgres host | **EXTERNAL** — not C1 |
| Installing secret manager / vault | **EXTERNAL** |
| Committing passwords, filled templates, or `.env` | Forbidden |
| Claiming roles exist in production | Template only — verify later (C2) |
| Executing cutover / fake PASS on gates | Cutover = NO |
| Pointing API `DATABASE_URL` at migrate-admin | Violates credential model |
| Granting `BYPASSRLS` / `SUPERUSER` to runtime-app | Forbidden |
| Rewriting `MIGRATION_STRATEGY.md` / Wave–Phase 49–51 SoR | Pointers only |
| Product code / new CI checks / Phase 52 / D5 / Stripe | Out of program |
| Starting C2–C5 | Wait for CTO |
| Self-granted Pilot Cutover PA | **PENDING** |
