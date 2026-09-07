# Phase 48 Wave C — Implementation Discovery

```text
branch = cursor/phase48-wave-c-clinical-safety
base Wave B accepted SHA = ec084dd
Wave B Production Acceptance = ACCEPTED (HEAD)
new ACR required = NO
ADRs = AR-09, AR-10, AR-11, AR-18, AR-19, AR-20
```

## Reuse decisions

| Concern | Path / decision |
|---------|-----------------|
| Append-only DB triggers | Extend `apps/api/prisma/triggers.sql` (Wave B snapshot revision pattern) |
| RLS tenant policies | Extend `apps/api/prisma/rls-policies.sql` (inventory / media style) |
| Audit port/adapter | Clone scheduling/`AuditEntryFactory` under `clinical-forms` |
| Postgres harness | Reuse `createPlatformDbSecurityClient` from clinical-catalog / platform-db-security harness |
| Inventory consume path | Refactor `ConsumeInventoryHandler` → `InventoryUsagePostingService` (single txn) |
| Consent gate call sites | Appointment lifecycle COMPLETED, EMR completeEncounter, beauty material consume |
| Photo consent gate | Media get/download handlers when `requiresPhotoConsent` |
| Permissions | Additive matrix entries in packages/api-config/docs |
| Validators | Clone Wave B clean / upgrade / permission-routes scripts |
| Legacy dental plan consent | Keep timestamps; do **not** fabricate PatientFormInstance rows |

## Exact touchpoints

### Inventory SoR (AR-20 / AR-11)
- `InventoryConsumptionLog` → evolve to `InventoryUsageLedger` (`@@map("inventory_consumption_logs")`)
- `InventoryBatch` — add `recalled` + `recalledAt`
- `InventoryStockMovement` — link via `sourceStockMovementId` on usage ledger
- New: `InjectableUsageDetail` (1:1 specialization)
- Handlers: `consume-inventory.handler.ts`, `prisma-inventory.repository.ts`
- New: `inventory-usage-posting.service.ts`, `inventory-usage-owner-report.service.ts`

### Clinical forms (AR-09 / AR-10)
- New tables: `ClinicalFormTemplate`, `ClinicalFormVersion`, `PatientFormInstance`, `ClinicalServiceFormRequirement`
- New module: `apps/api/src/modules/clinical-forms/`
- Gates: `required-consent-gate.service.ts`, `photo-consent-media-gate.service.ts`
- Media: `MediaAsset.requiresPhotoConsent` (patientId already present)

### Completion / treatment paths
- `appointment-lifecycle-mutation.service.ts` — COMPLETED + clinicalServiceId
- `emr-encounter.service.ts` `completeEncounter` — via linked appointment clinicalServiceId when present
- `beauty-material.handlers.ts` ConsumeBeautyMaterial — TREATMENT_CONSENT / CONSENT

### Out of scope (confirmed)
Wave D/E/F/G/H/I, production DB, inventing historical usedBy/batch/signatures, second usage ledger, second consent SoR

## Pre-existing gaps addressed by Wave C

1. **No ClinicalForm*** SoR — consent is fragmented (dental plan timestamps, beauty assert handlers, no unified template/version/instance)
2. **InventoryConsumptionLog incomplete vs InventoryUsageLedger** — missing usedBy≠recordedBy, usageType, batch FK, sourceStockMovementId, reversals, attributionStatus
3. **Consume not transactional** — FIFO batch decrement, warehouse delta, consumption log, and stock movement are separate awaits (partial failure window)
4. **No photo-consent media gate** — MediaAsset lacks `requiresPhotoConsent`; download/get unrestricted by consent
5. **No injectable specialization** — batch usage not 1:1 with clinical dose/site detail
6. **No append-only enforcement** on consumption logs (UPDATE/DELETE possible at DB level)

## Non-destructive migration rules (AR-18)

- Keep table name `inventory_consumption_logs`; Prisma model rename only
- Keep `quantityUsed` / `consumedBy` columns; additive columns only
- `recordedByUserId = consumedBy` where null
- Historical rows with null `usedByUserId` → `attributionStatus = LEGACY_UNATTRIBUTED`
- Do **not** invent batch, usedBy, or signed form instances from legacy timestamps
