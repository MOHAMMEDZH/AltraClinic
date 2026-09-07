# Phase 48 Wave C — Static Bypass Audit

```text
scope = apps/api/src (production handlers/services)
date = 2026-08-15
goal = inventory BLOCKER_BYPASS = 0 AND consent completion BLOCKER_BYPASS = 0
```

## INVENTORY MUTATION AUDIT

| PATH | OPERATION | ACCOUNTABLE HUMAN | SAME TX USAGE+MOVEMENT | CLASSIFICATION |
|------|-----------|-------------------|------------------------|----------------|
| `inventory-usage-posting.service.ts` `postUsage` / `postClinicalUsage` | typed usage | recordedBy + usedBy | YES | SAFE |
| `inventory-usage-posting.service.ts` `reverseUsage` / `correctUsage` | REVERSAL / correction | recordedBy | YES | SAFE |
| `consume-inventory.handler.ts` | consume via posting service | consumedBy / usedBy / recordedBy | YES | SAFE |
| `beauty-material.handlers.ts` ConsumeBeautyMaterialHandler | beauty clinical consume | consumedBy | YES | SAFE |
| `dental-material.handlers.ts` ConsumeDentalMaterialHandler | dental clinical consume | consumedBy | YES | SAFE |
| `dispose-inventory-batch.handler.ts` | dispose via `usagePosting.disposeBatch` (EXPIRED/DAMAGE/WASTAGE + DisposalLog + audit atomic) | disposedBy (explicit usedBy on disposal) | YES | SAFE |
| `prisma-inventory.repository.ts` `disposeBatch` | throws — must use DisposeInventoryBatchHandler / posting.disposeBatch | N/A | N/A | SAFE (fail-closed) |
| `beauty-material.handlers.ts` ConsumeBeautyMaterialHandler | beauty clinical consume | explicit usedByUserId (not recorder) | YES | SAFE |
| `consumeFifoBatches` / `recordStockMovement` | primitives | caller-dependent | N/A | SAFE when only used by posting / receive / adjust paths; fulfill+dispose no longer call FIFO consume without ledger |
| Read-only analytics/AI/alerts | SELECT | N/A | N/A | SAFE |

```text
inventory BLOCKER_BYPASS count = 0
```

## CONSENT COMPLETION AUDIT

| PATH | COMPLETION OPERATION | REQUIRED-CONSENT GATE | CLASSIFICATION |
|------|----------------------|-----------------------|----------------|
| `appointment-lifecycle-mutation.service.ts` | → COMPLETED when clinicalServiceId | RequiredConsentGateService | SAFE |
| `emr-encounter.service.ts` completeEncounter | → COMPLETED when linked appt has clinical service | RequiredConsentGateService | SAFE |
| `beauty-material.handlers.ts` | material consume when clinicalServiceId | RequiredConsentGateService | SAFE |
| media get/download | protected media | PhotoConsentMediaGateService | SAFE |
| Queue/portal via lifecycle | COMPLETED | inherited | SAFE |
| Dental TreatmentPlan.consentSignedAt | legacy timestamp | does not fabricate PatientFormInstance | SAFE |
| Analytics COMPLETED counts | read-only | N/A | OUT_OF_SCOPE_NON_TREATMENT |

```text
consent completion BLOCKER_BYPASS count = 0
```
