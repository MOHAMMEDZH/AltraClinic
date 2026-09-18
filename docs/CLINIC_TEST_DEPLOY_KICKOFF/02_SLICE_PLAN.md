# D0 — Slice plan (D0→D4)

CTO authorizes slices in order. **D0 does not start D1.**

| Slice | Deliverable | Notes |
|-------|-------------|--------|
| **D0** | This kickoff package + thin OPERATOR_INDEX link | **Docs only** — this slice |
| **D1** | Azure API deploy runbook + evidence | Provision/run Nest on chosen Azure option; health against Neon runtime-app; uncommitted evidence pattern |
| **D2** | Cloudflare Pages deploy (clinic-dashboard) | Wire API base URL to Azure; CORS origin match |
| **D3** | Tenant + smoke on public URLs | Login / patients (or equivalent) against public Pages + Azure; reuse internal pilot tenant where possible |
| **D4** | Handoff packet for clinic | URLs, roles, support path; still not product production cutover |

```text
D0 = docs only (this package)
D1+ = wait for CTO authorize
Azure / Pages provisioning = NOT in D0
Program PA = PENDING (see 06_ACCEPTANCE.md)
Product production cutover = NOT CLAIMED
Stripe = NOT IN SCOPE
```
