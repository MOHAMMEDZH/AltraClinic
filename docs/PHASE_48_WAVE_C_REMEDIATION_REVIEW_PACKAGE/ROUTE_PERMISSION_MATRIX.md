# Route / Permission Matrix Alignment

| Runtime route | Controller method | Required permission | Corresponding check |
|---|---|---|---|
| POST /inventory/usage | `postUsage` | api.inventory update; **plus** api.clinical-injectable create when injectable payload present | matrix + runtime HTTP + posting fail-closed |
| POST /inventory/usage/:id/reverse | `reverseUsage` | api.inventory approve | matrix + runtime HTTP |
| POST /inventory/usage/:id/correct | `correctUsage` | api.inventory approve | matrix + DTO 400 + runtime HTTP |
| GET /inventory/usage | `listUsage` | api.inventory view | matrix |
| GET /inventory/usage/owner-report | `ownerReport` | api.inventory export (route); api.patients view (PHI) | matrix + runtime PHI derivation |
| GET /inventory/usage/:id/injectable | `getInjectable` | api.clinical-injectable view | matrix |
| POST /inventory/item/consume | `consume` | api.inventory update | existing + usedBy DTO |
| POST /inventory/batch/:batchId/dispose | `disposeBatch` | api.inventory update | canonical disposeBatch |
| POST /clinical-forms/instances/:id/void | `voidInstance` | api.clinical-forms update | all three matrices + validator CLINICAL_FORMS_OPS + HTTP 403/2xx |

Runtime e2e: `wave-c-http-permission`, `wave-c-clinical-forms-http`, `wave-c-permission-contract`, `wave-c-tenant-references`.
