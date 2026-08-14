# Phase 48 Wave A — PA-04 Implementation Evidence

```text
STATUS = WAVE A PRODUCTION ACCEPTANCE = ACCEPTED
PA-04 = CLOSED / ACCEPTED
PA-04 Architecture Freeze Amendment = ACCEPTED AND FROZEN
PA-04 Production Acceptance = ACCEPTED
Wave A blocker count = 0
Previously closed defect items (do not reopen):
  PA04-IMP-01 / IMP-02 / IMP-03 / IMP-04 / UI-01 / TEST-01 / PERM-01 / EVID-01/FINAL-DOC-01 = CLOSED
branch = cursor/phase48-wave-a-foundation
base committed HEAD before acceptance checkpoint = 089a3096d0ad8f0183136cd1aa0b4d859dfc7f9b
production DB touched = NO
Wave B = AUTHORIZED
Phase 49 = NOT AUTHORIZED
Step 30 = NOT AUTHORIZED
Step 29 freeze remains unchanged
```

## Architecture SSOT refs

```text
docs/PHASE_48_ARCHITECTURE_FREEZE.md  (AR-04 AMENDED AND FROZEN)
docs/PHASE_48_ARCHITECTURE_FREEZE_AMENDMENT_PA04_PROPOSAL.md  (ACCEPTED AND FROZEN / Option B)
docs/PHASE_48_TARGET_DOMAIN_ARCHITECTURE.md
docs/PHASE_48_FROZEN_DOMAIN_CONTRACT_MATRIX.md
docs/PHASE_48_WAVE_A_PA04_POST_AMENDMENT_IMPLEMENTATION_PLAN.md
docs/PHASE_48_WAVE_A_PA04_POST_AMENDMENT_ACCEPTANCE_TEST_PLAN.md
```

```text
Option B = CONFORMANT
architecture semantic changes = 0
new ACR required = NO
schema semantic change = NO
new migration = NO
20260814150000 SCHEDULED migration = KEEP AS-IS
```

## Corrected semantics (four-blocker closure)

```text
Branch resolution (IMP-01 — preserved):
  CURRENT_ACTIVE after locked reconcile → branch
  CLEAN_NO_CURRENT (future SCHEDULED / historical / gap / never-effective only) → tenant fallback allowed
  reconcile failure / dual ACTIVE → FAIL CLOSED (no tenant fallback)
  unlocked hasPublishedPricingIntent = REMOVED

at semantics (IMP-03 — preserved):
  omit at → live now (may reconcile)
  at <= now → historical READ-ONLY (no lifecycle mutation)
  future at → ClinicalCatalogValidationError
  60-second heuristic = REMOVED

Manual SUPERSEDED (IMP-02 — preserved):
  public POST .../supersede = REMOVED
  public prices.supersede = REMOVED
  SUPERSEDED remains successor-driven under lock only

Controlled replace (IMP-04 — this closure):
  eligible prior = SCHEDULED
    OR INACTIVE-never-effective WITH publishedAt != null
  unpublished DRAFT→INACTIVE discard = NOT eligible (PA04-RPL-06)
  before boundary only
  due SCHEDULED → reconcile (committed) then reject late replace
  canceled-never-effective after boundary → reject
  eligibility checked pre-lock and post-lock on fresh read
```

## Permission routes (synchronized)

```text
GET  /clinical-catalog/prices
GET  /clinical-catalog/prices/lookup
POST /clinical-catalog/prices/drafts
POST /clinical-catalog/prices/:id/publish
POST /clinical-catalog/prices/:id/inactivate
POST /clinical-catalog/prices/:id/replace-scheduled
```

## Commands executed (2026-08-14 four-blocker closure)

| Command | Exit | Count |
|---|---|---|
| jest clinical-price.unit.spec.ts | 0 | 11 tests |
| jest tenant-service-config.unit.spec.ts | 0 | 3 tests |
| jest clinical-price.pa04.acceptance.postgres.integration.spec | 0 | 53 tests |
| jest clinical-price.concurrency.postgres.integration.spec | 0 | 10 tests |
| jest clinical-catalog.cross-tenant.api.postgres.integration.spec | 0 | 28 tests |
| vitest run src/features/clinical-catalog | 0 | 16 tests |
| validate-phase48-wave-a-clean.mjs | 0 | — |
| validate-phase48-wave-a-upgrade.mjs | 0 | — |
| validate-phase48-wave-a-permission-routes.mjs | 0 | — |
| npx prisma validate | 0 | — |

Env for Postgres: `ALLOW_TEST_DATABASE_RESET=true`, `RUN_PLATFORM_DB_SECURITY=true`, DB `localhost:5433` only.

```text
Step 29 onepass = NOT RUN / NOT REQUIRED FOR THIS FOCUSED CLOSURE
```

## T1–T44 mapping

Executable suite: `clinical-price.pa04.acceptance.postgres.integration.spec.ts` (+ unit/concurrency/validators as noted).

| Case | Coverage | Result |
|---|---|---|
| T1–T15 | acceptance | PASS |
| T16 | acceptance — publish/schedule/activate/cancel_scheduled/supersede/inactivate (no generic reconcile audit event) | PASS |
| T17 | clean+upgrade validators | PASS |
| T18 | acceptance (scheduler disabled; live gate) | PASS |
| T19–T24 | acceptance | PASS |
| T25 | acceptance — V2 ACTIVE, V1 SUPERSEDED, exactly one activate + one supersede audit | PASS |
| T26–T44 | acceptance | PASS |
| R-PA04-04 | acceptance — final V2 INACTIVE-after-effective, ACTIVE count 0, exact audits | PASS |

```text
T1–T44 implemented = YES
T1–T44 executed = YES
T1–T44 passed = 44
T1–T44 failed = 0
```

## Extra closure regressions

| Id | Result |
|---|---|
| PA04-BR-01..08 | PASS |
| PA04-AT-01..06 | PASS |
| PA04-RPL-01..05 | PASS |
| PA04-RPL-06 unpublished DRAFT→INACTIVE prior rejected | PASS |
| PA04-IMP-02 manual supersede removed | PASS |
| UI-PA04-01..04 (vitest) | PASS |
| R-PA04-01..06 (aligned) | PASS |

## Known limitations

```text
- Background activator disabled when NODE_ENV=test / BACKGROUND_SCHEDULERS_ENABLED=false
- One DRAFT per commercial key remains enforced by DB unique index (Wave A)
- Historical as-of is read-only derivation; does not invent missing timeline materialization
- Controlled-replace UI uses localized window.prompt (EN/AR i18n keys); no new modal framework
```

## Production Acceptance state

```text
PA-01 = CLOSED
PA-02 = CLOSED
PA-03 = CLOSED
PA-04 = CLOSED / ACCEPTED
PA-05 = CLOSED
PA-06 = CLOSED
PA-07 = CLOSED
PA-08 = CLOSED
EVIDENCE-PA-01 = CLOSED

WAVE A PRODUCTION ACCEPTANCE = ACCEPTED
Wave A blocker count = 0
Wave B = AUTHORIZED
Phase 49 = NOT AUTHORIZED
Step 30 = NOT AUTHORIZED
```
