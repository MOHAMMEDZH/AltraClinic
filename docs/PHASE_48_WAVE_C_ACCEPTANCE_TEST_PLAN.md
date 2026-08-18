# Phase 48 Wave C — Acceptance Test Plan

```text
Wave C executable packs = REQUIRED
framework = Jest + PostgreSQL harness (localhost:5433)
production DB = FORBIDDEN
```

## Consent Pack (C-CONSENT-01..20)

| Id | Expectation | Spec |
|----|-------------|------|
| C-CONSENT-01 | No requirements → complete/gate OK | `wave-c-consent` |
| C-CONSENT-02 | Missing signed instance fails closed | covered |
| C-CONSENT-03 | Sign then gate passes | covered |
| C-CONSENT-04 | Publish requires contentEn+contentAr | covered |
| C-CONSENT-05 | Sign without actor fails | covered |
| C-CONSENT-06..20 | Photo gate, VOID, supersede, cross-tenant, dental legacy untouched | planned / partial |

## Inventory Accountability (C-INV-01..30)

| Id | Expectation | Spec |
|----|-------------|------|
| C-INV-01 | CLINICAL requires usedBy | `wave-c-inventory-accountability` |
| C-INV-02/03 | Txn posts usage+movement linked | covered |
| C-INV-04 | WASTAGE needs reasonCode | covered |
| C-INV-05 | Reverse + REVERSAL row | covered |
| C-INV-06 | DELETE forbidden | covered |
| C-INV-07..30 | FIFO multi-batch, owner report PHI, concurrency | planned / partial |

## Injectable (C-INJ-01..12)

| Id | Expectation | Spec |
|----|-------------|------|
| C-INJ-01 | Injectable detail 1:1 | `wave-c-injectable` |
| C-INJ-02 | Recalled denied | covered |
| C-INJ-03 | Expired denied | covered |
| C-INJ-04..12 | FIFO split, correction, no second ledger | planned / partial |

## Migration (C-MIG-01..10)

| Id | Expectation | Spec / script |
|----|-------------|---------------|
| C-MIG-01..06 | Tables/columns/triggers/Wave B preserved | `wave-c-migration` |
| C-MIG-07..10 | Clean/upgrade validators, LEGACY_UNATTRIBUTED | `validate-phase48-wave-c-*.mjs` |

## Permission routes

`validate-phase48-wave-c-permission-routes.mjs` — clinical-forms + inventory usage ops × 3 matrices.
