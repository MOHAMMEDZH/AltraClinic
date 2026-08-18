# Phase 48 Wave C — Implementation Plan

```text
branch = cursor/phase48-wave-c-clinical-safety
base = ec084dd (Wave B accepted)
ADRs = AR-09, AR-10, AR-11, AR-18, AR-19, AR-20
```

## Deliverables

1. Discovery doc + schema/migration (`InventoryUsageLedger` evolution, clinical forms, injectable detail, media flag, immutability triggers, RLS)
2. `ClinicalFormsModule` — templates/versions/instances/requirements + consent + photo gates
3. `InventoryUsagePostingService` — transactional post/reverse/correct; consume handler refactor
4. Consent gates on appointment COMPLETED, EMR completeEncounter, beauty consume (when clinicalServiceId)
5. Photo consent gate on media get/download
6. Permissions + Wave C validators + integration packs + evidence docs

## Non-goals

Wave D–I, production DB, inventing historical usedBy/batch/signatures, second usage/consent SoRs
