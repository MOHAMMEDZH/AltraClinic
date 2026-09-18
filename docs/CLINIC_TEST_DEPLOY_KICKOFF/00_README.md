# Clinic Test Deploy (P1) — Kickoff (D0)

CTO-authorized **D0 kickoff docs only**. Goal: one reachable **clinic-test** stack (UI + API + existing Neon pilot DB).

**This is NOT Phase 52.** Not product production cutover. Not Stripe.  
**D0 does not provision Azure or Cloudflare Pages.** Green docs ≠ deployed stack.

| Field | Value |
|-------|--------|
| **Program** | Clinic Test Deploy (P1) |
| **Canonical base** | `release47-step22-transfer-20260810-0353` @ `96c2971` |
| **Branch** | `cursor/clinic-test-deploy-kickoff` |
| **Status** | **D0 kickoff only**; program PA = **PENDING**; D1+ **NOT STARTED** |

| File | Purpose |
|------|---------|
| [01_TARGET_TOPOLOGY.md](./01_TARGET_TOPOLOGY.md) | Pages (clinic-dashboard) → Azure API → Neon |
| [02_SLICE_PLAN.md](./02_SLICE_PLAN.md) | Ordered D0→D4 |
| [03_AZURE_OPTIONS.md](./03_AZURE_OPTIONS.md) | Container Apps free grant or App Service B1 |
| [04_SECRETS_CHECKLIST.md](./04_SECRETS_CHECKLIST.md) | Runtime URL, JWT, CORS; no secrets in git |
| [05_EXPLICIT_OUT.md](./05_EXPLICIT_OUT.md) | What this program must not invent |
| [06_ACCEPTANCE.md](./06_ACCEPTANCE.md) | Program PA later; D0 = docs only |

**Reuse (do not reinvent):**

- Neon pilot DB + `pilot_neon_app` runtime (NOBYPASSRLS) — see [`PILOT_CUTOVER_C2B_NEON/`](../PILOT_CUTOVER_C2B_NEON/) and STOP clearance
- Internal pilot tenant path — [`PILOT_CUTOVER_STOP_CLEARANCE/07_INTERNAL_PILOT_TENANT.md`](../PILOT_CUTOVER_STOP_CLEARANCE/07_INTERNAL_PILOT_TENANT.md)
- Phase 49 K2 / K5 for secrets hygiene and deploy/rollback patterns
- [`OPERATOR_INDEX.md`](../OPERATOR_INDEX.md)

```text
Cloudflare Pages = UI only (clinic-dashboard)
Azure = API only (Nest)
Neon pilot DB + pilot_neon_app = reuse (no new Azure Postgres)
Product production cutover = NOT CLAIMED
Phase 52 = NOT AUTHORIZED
Stripe / payment live = NOT IN SCOPE
D0 kickoff alone ≠ D1+ authorize
PR merge = wait for CTO authorize
no passwords in git = YES
```
