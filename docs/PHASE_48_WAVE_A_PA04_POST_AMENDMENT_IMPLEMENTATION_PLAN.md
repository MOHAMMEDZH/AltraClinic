# Phase 48 Wave A — PA-04 Post-Amendment Implementation Plan

```text
STATUS = IMPLEMENTATION COMPLETE — READY FOR EXTERNAL PRODUCTION ACCEPTANCE
IMPLEMENTATION AUTHORIZED = YES
IMPLEMENTATION PERFORMED = YES
Depends on = accepted PA-04 Freeze Amendment SSOT
Option B = ACCEPTED AND FROZEN
Conditions 01–04 + FA-01/02/03 + FC-01/02 = CLOSED
Evidence = docs/PHASE_48_WAVE_A_PA04_IMPLEMENTATION_EVIDENCE.md
```

## Goal (completed in implementation task)

Re-align provisional SCHEDULED work to the **accepted** Option B + FA/FC contract.
Do not rubber-stamp provisional lookup-includes-SCHEDULED or stale-predecessor behavior.

## Mandatory correctness components

| # | Component |
|---|-----------|
| 1 | Proactive background activator |
| 2 | On-demand due-schedule reconciliation gate |
| 3 | Same-key advisory lock reuse |
| 4 | Atomic multi-due / finite-window catch-up |
| 5 | Canceled-before-effective exclusion |
| 6 | Interval-validated ACTIVE-only live lookup after reconciliation |
| 7 | Activation/audit metadata for effectiveTimelineMember |
| 8 | Monitoring hooks / metrics contract |

### FA / FC deltas (binding)

As frozen in `docs/PHASE_48_ARCHITECTURE_FREEZE_AMENDMENT_PA04_PROPOSAL.md`
(FA-01/02/03, FC-01/02).

## Acceptance binding

```text
Required architecture acceptance cases = T1–T44
Plan = docs/PHASE_48_WAVE_A_PA04_POST_AMENDMENT_ACCEPTANCE_TEST_PLAN.md
Tests executed = YES (see PA04_IMPLEMENTATION_EVIDENCE)
```

## Explicit non-goals (still)

```text
Wave B / Phase 49 / Step 30 = NOT AUTHORIZED
effectiveTo rewrite = FORBIDDEN
external Production Acceptance self-grant = FORBIDDEN
```

```text
implementation performed = YES
```
