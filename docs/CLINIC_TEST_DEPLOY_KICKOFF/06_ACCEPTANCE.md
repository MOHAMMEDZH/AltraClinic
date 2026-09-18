# D0 — Acceptance

| Scope | Criteria | Status |
|-------|----------|--------|
| **D0** | Kickoff docs under `docs/CLINIC_TEST_DEPLOY_KICKOFF/` + thin OPERATOR_INDEX link; no secrets; no cloud provision | **This slice** (docs only) |
| **Program PA** | Reachable clinic-test stack (Pages → Azure API → Neon) with smoke evidence; CTO grant | **PENDING** — after D1–D4 as authorized |
| **Product production cutover** | Separate CTO authorize | **NOT CLAIMED** |

**D0 done when**

1. Files `00`–`06` exist and match slice plan / topology / outs.
2. OPERATOR_INDEX has a thin link to this package.
3. Commit + push on `cursor/clinic-test-deploy-kickoff` from base `96c2971`.

**D0 does not require**

- Azure or Pages resources created
- CI green beyond normal PR process when CTO opens a PR
- Program PA

```text
D0 = docs only
Program PA = PENDING EXTERNAL (CTO)
Product production cutover = NOT CLAIMED
Wait for CTO before D1 (Azure API)
```
