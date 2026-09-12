# K6 — Explicit OUT

| Out | Why |
|-----|-----|
| New RLS engine / second isolation framework | Reuse Platform DB + existing specs/packs only |
| Reopening Phase 48 Wave A–I SoR | Closed; product-failure + CTO only |
| Requiring full Wave I onepass for K6 | Pointer OK; full onepass optional/heavy |
| Incident one-pager + Phase 49 review/PA package | **K7** (not authorized) |
| Required GitHub check / workflow path-filter changes | Document force-run / local evidence instead |
| Claiming Phase 49 PA | **PENDING** external only |
| Committing `.ci-evidence` | Forbidden |
| Fake PASS when Postgres missing | STOP and report |

```text
K6 = thin tenant isolation production-check packaging
K7 = NOT AUTHORIZED by K6 acceptance alone
```
