# D1 — Explicit OUT

| OUT | Why |
|-----|-----|
| Cloudflare Pages / clinic-dashboard public UI | **D2** |
| Azure Database for PostgreSQL / leaving Neon | Program SoR = Neon pilot + `pilot_neon_app` |
| Product production cutover claim | **NOT CLAIMED** |
| Phase 52 | **NOT AUTHORIZED** |
| Stripe / payment live | Out of program |
| Committing secrets / connection strings | Forbidden |
| Multi-clinic fleet CD / k8s SoR | EXTERNAL; not invented here |
| Faking PASS without public `/health` 200s | Forbidden |
| Super-admin UI deploy | Optional later; not D1 gate |

```text
Pages = D2
Azure Postgres = OUT
cutover claim = OUT
```
