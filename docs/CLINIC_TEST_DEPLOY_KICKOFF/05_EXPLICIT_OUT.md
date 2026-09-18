# D0 — Explicit OUT

| OUT | Why |
|-----|-----|
| Azure Database for PostgreSQL (or any new cloud Postgres) | Neon pilot + `pilot_neon_app` is SoR for clinic-test |
| Full CD pipeline / in-repo k8s SoR / D-17 topology as product | Remains **EXTERNAL**; not invented here |
| Payment live / Stripe | Phase 51 honesty; not this program |
| Multi-clinic fleet / multi-tenant sales cutover | Clinic-test = one reachable stack; not fleet ops |
| Product production cutover claim | **NOT CLAIMED** (pilot STOP ≠ production) |
| Phase 52 product program | **NOT AUTHORIZED** |
| Provisioning Azure or Pages in D0 | Docs only |
| Committing secrets / passwords / `.env` | Forbidden |
| Super-admin UI as D0–D3 gate | Optional later |
| Self-granted Clinic Test Deploy PA | PA = **PENDING EXTERNAL** |
| Fake “live for paying clinics” claims | Forbidden |

```text
Azure Postgres = OUT
full CD/k8s = OUT
payment live = OUT
multi-clinic fleet = OUT
D0 provisioning = OUT
```
