# ROUND_5_CLINICAL_SERVICE_TENANT_INTEGRITY_MATRIX

| Test | Result | Notes |
|------|--------|-------|
| R5-CSVC-T1 | PASS | SYSTEM_CANONICAL (`tenantId` NULL) accepted |
| R5-CSVC-T2 | PASS | same-tenant TENANT_CUSTOM accepted |
| R5-CSVC-T3 | PASS | cross-tenant TENANT_CUSTOM INSERT rejected |
| R5-CSVC-T4 | PASS | parent-switch UPDATE to cross-tenant custom rejected |
| R5-CSVC-T5 | PASS | original line unchanged after rejected switch |
| R5-CSVC-T6 | PASS | app-role/RLS path remains valid |

**Trigger:** `enforce_invoice_line_provenance_tenant` — service valid iff `tenantId IS NULL OR tenantId = invoice_line_items.tenantId`.
