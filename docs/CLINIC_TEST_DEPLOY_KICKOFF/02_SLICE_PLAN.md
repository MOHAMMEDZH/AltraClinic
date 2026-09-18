# D0 — Slice plan (D0→D4)

CTO authorizes slices in order. **D0 does not start D1.**

| Slice | Deliverable | Notes |
|-------|-------------|--------|
| **D0** | This kickoff package + thin OPERATOR_INDEX link | **PASS** (docs) @ `dd48e85` |
| **D1** | Azure API deploy runbook + evidence | **PARTIAL** @ [`CLINIC_TEST_DEPLOY_D1_AZURE_API/`](../CLINIC_TEST_DEPLOY_D1_AZURE_API/) — Dockerfile + runbook; public `/health` blocked until human Azure |
| **D2** | Cloudflare Pages deploy (clinic-dashboard) | Wire API base URL to Azure; CORS origin match — **wait for CTO** |
| **D3** | Tenant + smoke on public URLs | Login / patients (or equivalent) against public Pages + Azure; reuse internal pilot tenant where possible |
| **D4** | Handoff packet for clinic | URLs, roles, support path; still not product production cutover |

```text
D0 = ACCEPTED (CTO @ dd48e85)
D1 = PARTIAL (runbook + Dockerfile; no public health yet)
D2+ = wait for CTO authorize
Program PA = PENDING (see 06_ACCEPTANCE.md)
Product production cutover = NOT CLAIMED
Stripe = NOT IN SCOPE
```
