# K5 — Explicit OUT

| Out | Why |
|-----|-----|
| New in-repo deploy engine (k8s/helm/terraform “completeness”) | Topology remains **external D-17** (Step 29) |
| Turning CI into CD | CI = regression/merge readiness only |
| Fake production cutover evidence | No real prod deploy in this slice — dry-run stays **PARTIAL** |
| Commercial APM/SIEM/on-call SaaS invent | Covered as EXTERNAL in K4 / Step 29 |
| Tenant isolation packaging | **K6** (not authorized) |
| Incident basics one-pager / Phase 49 review package | **K7** (not authorized) |
| Phase 50 UX polish / Phase 51 commercial launch | Separate programs |
| Reopening Phase 48 Wave A–I SoR | Closed; product-failure + CTO only |
| Claiming Phase 49 PA | **PENDING** external only |
| Fixing K3 `booking_test` FK fixture debt | Separate; not K5 |
| Committing `.ci-evidence` | Forbidden |

```text
K5 = thin Deploy + Rollback SSOT docs
K6–K7 = NOT AUTHORIZED by K5 acceptance alone
```
