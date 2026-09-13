# Phase 51 — Scope (Implementation Review)

| Field | Value |
|-------|--------|
| **Program** | Phase 51 — Commercial Launch |
| **Base** | `9a2e89d` (Phase 50 PA ACCEPTED merge) |
| **Branch** | `cursor/phase51-commercial-launch-kickoff` |

## IN

- L0 kickoff contracts (frozen scope, current-vs-exit, acceptance criteria, slices)
- L1 discovery inventories (pricing, go-live, support/ops, legal, smoke precursors, deferred seed, gaps)
- L2 pricing / packaging sale clarity (what we sell / what is not sold)
- L3 tenant go-live checklist + stop-the-line (≠ executed cutover)
- L4 support / ops launch handoff (ownership, first-15, runbook index)
- L5 legal / commercial in-product vs external boundary register
- L6 launch smoke evidence format + thin authorized local run (reuse K4/K6 wrappers)
- L7 deferred register + lean implementation review + external PA precheck
- Explicit documentation that deferred / PARTIAL / MISSING / EXTERNAL items do **not** block PA if honest

## OUT

- Self-granted Phase 51 Production Acceptance
- D5 AppointmentForm clinical-catalog picker implementation
- New product / payment-live / fake cutover claims
- Reopening Wave A–I or Phase 49 / Phase 50 SoR
- Second test framework / new required GitHub Checks brand
- Full brand redesign / new product domains
- Mandatory full Step 28/29 or phase48-onepass for L7 packaging
- Committing `.ci-evidence` unless CTO authorizes

## Authority model

```text
CTO slice authorize L0→L7 packaging = YES (as accepted through L6; L7 this slice)
Phase 51 PA = PENDING EXTERNAL (CTO decides; not self-grant)
Kickoff alone ≠ PA
D5 picker = DEFERRED (CTO) — not started
Wave A–I / Phase 49 / Phase 50 SoR reopen = NOT AUTHORIZED
```
