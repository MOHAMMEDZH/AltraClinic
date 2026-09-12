# Wave I Scope

| Field | Value |
|-------|--------|
| Branch | `cursor/phase48-wave-i-enterprise-qa` |
| Base | Wave H merge `d53ff77` |

## IN

- Named pack matrix + I1 runners (`run-phase48-pack.mjs`, `test:phase48-*`)
- Fail-closed Postgres packs (0 passed / skip without DB = FAIL)
- P0 green (I2) and P1 API + clinic-dashboard e2e green (I3 evidence)
- Combined Traceability (R4-TRACE) + Migration clean/upgrade A–**G** (I4)
- Wave G validators **wired** (real G1–G3 migrations)
- Wave H validators **ABSENT** (no Prisma/SQL migrations)
- Phase 48 onepass orchestrator reusing I1 runner only (I5)
- Step 28 security + Step 29 release regression baselines (I5)
- Lean review package + external PA precheck (PENDING EXTERNAL)
- Optional `workflow_dispatch` pack matrix workflow (not required checks)

## OUT

- Wave I Production Acceptance (self-grant forbidden)
- Required GitHub Checks / branch protection changes
- Second test framework
- Wave A–H SoR reopen / product SoR dumps
- AppointmentForm catalog picker identity binding (deferred)
- Phase 49 / 50 / 51
- Always-green stub migration validators
- Flake silence (skip / disableRules / retry-to-green)
