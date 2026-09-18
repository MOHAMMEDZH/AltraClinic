# D0 — Secrets checklist (no values in git)

Checklist only. **Do not commit passwords, connection strings, or JWT material.**

| Secret / config | Where it lives (ops) | Used by |
|-----------------|----------------------|---------|
| Neon **runtime** `DATABASE_URL` (`pilot_neon_app`) | Azure App Settings / secret store | Nest API |
| Neon **owner / migrate** URL | Local gitignored env / human console only | Ops/migrate — **not** Azure runtime |
| JWT signing / verification secrets | Azure secret store | Nest API |
| CORS / allowed origins | Azure env (Pages HTTPS origin) | Nest API |
| Pages → API base URL | Cloudflare Pages env / build vars | clinic-dashboard |
| Any Stripe / payment keys | — | **OUT** (not this program) |

**Hygiene**

- Follow Phase 49 K2 patterns; never paste secrets into chat, PRs, or evidence files.
- Evidence may name **keys** and redacted hostnames; never full URLs with credentials.
- Local files like `.env.pilot.*` stay gitignored.

```text
no secrets in git = YES
runtime = pilot_neon_app only on Azure
owner URL = not on Azure runtime
D0 = checklist only (no secret rotation in this slice)
```
