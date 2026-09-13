# L3 — Preconditions / stop-the-line (fail-closed)

**Rule:** If any item below fails, **do not** proceed to provision/license for go-live.

---

## Stop-the-line

| # | Gate | Fail action |
|---|------|-------------|
| S1 | Canonical lineage includes Phase 50 merge `9a2e89d` (or later accepted tip) | STOP — wrong base |
| S2 | Phase 49 / 50 SoR not being “fixed” as launch work | STOP — reopen requires CTO + product failure |
| S3 | Environment secrets/config known good (K2 posture); no placeholder JWT in prod-like env | STOP — see K2 |
| S4 | Backup / restore SoR understood; no reliance on Backup Center flag-OFF as cutover | STOP — see K3 |
| S5 | Rollback path known (K5) before any deploy change; D-17 remains EXTERNAL | STOP — no inventing CD |
| S6 | Tenant provisioning enabled **only** when intentionally activated; otherwise expect fail-closed 503 | STOP — see provisioning SoR |
| S7 | Commercial assignment roles correct (no silent privilege expansion) | STOP — see subscription assignment SoR |
| S8 | Payment/Stripe **not** required to be live for this checklist — but also **not** claimed live | STOP if sales script claims payment complete |
| S9 | Smoke evidence format not fabricated in L3 — wait for L6 authorize to claim runs | STOP if asked to “tick smoke done” without L6 |

---

## Preconditions (should be true before §2 provision)

- [ ] OPERATOR_INDEX + this L3 package reviewed with owner on call  
- [ ] L2 pricing clarity used for what is sold / not sold  
- [ ] Target plan version is **published** and assignment-eligible per SoR  
- [ ] Support knows K7 first-15 path (handoff detail may wait for L4)  
- [ ] Deferred register seed acknowledged (D5 picker remains DEFERRED)
