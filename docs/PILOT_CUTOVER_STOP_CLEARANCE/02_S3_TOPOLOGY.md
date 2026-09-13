# S3 — Pilot topology record (D-17 lite)

Honest record of **current pilot** placement. Not a production CD claim.

| Layer | Where (2026-09-13) | Notes |
|-------|-------------------|--------|
| **Postgres** | Neon project `altraclinic-pilot` / id `little-moon-83905788` | Region: AWS `eu-central-1` (Frankfurt). DB name: `neondb`. Neon branch label `production` = **pilot only**. |
| **DB roles** | C1 model on Neon | `migrate-admin` + `runtime-app` (`NOBYPASSRLS`). Owner `neondb_owner` for privileged dump/admin only. |
| **API (Nest)** | **Not deployed to a public host yet** | STOP S2: run locally (or future host) with **runtime-app** `DATABASE_URL`. |
| **UI (clinic / super-admin / portal)** | **Local dev** for now | Later candidate: Cloudflare Pages for SPAs only — API stays separate. |
| **Redis** | Local / optional for pilot health | Not required to claim S3. |
| **Secrets** | Password manager + `apps/api/.env.pilot.local` (gitignored) | Never commit; never paste into chat. |
| **Backup SoR** | Ops `pg_dump` scripts (Phase 49 K3) | Schema drill PASS (C3); full-data = S1/C3b. Offsite/PITR = **EXTERNAL**. |
| **CD / ingress / k8s** | **EXTERNAL** | Not invented in-repo (D-17). |

```text
S3 topology recorded = YES (this file)
D-17 full production topology = still EXTERNAL until ops fills real prod hosts
Cloudflare Pages = future UI option only — not selected as sole platform
```
