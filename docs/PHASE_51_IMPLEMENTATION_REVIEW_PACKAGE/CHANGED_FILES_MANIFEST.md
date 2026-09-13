# Phase 51 — Changed Files Manifest (lean)

Representative paths only — not a full `git diff` dump.

## Docs

```text
docs/PHASE_51_KICKOFF_PACKAGE/**
docs/PHASE_51_L1_DISCOVERY_INVENTORY/**
docs/PHASE_51_L2_PRICING_PACKAGING/**
docs/PHASE_51_L3_GOLIVE_CHECKLIST/**
docs/PHASE_51_L4_SUPPORT_OPS_HANDOFF/**
docs/PHASE_51_L5_LEGAL_COMMERCIAL_BOUNDARIES/**
docs/PHASE_51_L6_LAUNCH_SMOKE/**
docs/PHASE_51_DEFERRED_REGISTER/**
docs/PHASE_51_IMPLEMENTATION_REVIEW_PACKAGE/**
docs/OPERATOR_INDEX.md
```

## Thin alias only (no new test framework)

```text
apps/api/package.json    # test:phase51-launch-smoke → existing phase49 scripts
```

## Explicitly not in Phase 51 product work

```text
D5 AppointmentForm clinical-catalog picker     # DEFERRED
Payment / Stripe live rails                    # PARTIAL / not claimed
Fake production cutover / in-repo CD           # OUT / EXTERNAL D-17
Required GH Checks / new launch-suite brand    # OUT
Wave A–I / Phase 49 / Phase 50 SoR reopen      # OUT
```

## Explicitly not in manifest (uncommitted)

```text
apps/api/.ci-evidence/phase51-l6-77a7091/
```
