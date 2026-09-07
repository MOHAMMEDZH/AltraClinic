# TENANT_REFERENCE_VALIDATION (Round 4 B1)

Canonical enforcement: `InventoryUsagePostingService.assertRelatedTenantReferences` inside `postUsageInTx` (same transaction as the ledger write). HTTP `POST /inventory/usage` reaches this path via `ConsumeInventoryHandler` (not a mocked mutation service in the Round 4 HTTP proof).

| Field | Owning entity | Validation | Same-tenant | Cross-tenant | Nonexistent | Relationship-consistency |
|-------|---------------|------------|-------------|--------------|-------------|--------------------------|
| `inventoryItemId` | `inventory_items` | Existing FOR UPDATE by tenant | success | not found | not found | — |
| `warehouseId` | `inventory_warehouses` | Existing resolveWarehouseId | success | rejected | rejected | — |
| `inventoryBatchId` | `inventory_batches` | Must be in tenant+item active set | success | rejected (not available) | rejected | Wrong item → not available |
| `usedByUserId` | `users` | `assertTenantUser` | success | rejected | rejected | — |
| `patientId` | `patients` | `tenantId` + not deleted | success | rejected | rejected | — |
| `appointmentId` | `appointments` | `tenantId` + not deleted | success | rejected | rejected | Patient must match `patientId`; service/branch must match when both set |
| `clinicalServiceId` | `canonical_clinical_service_definitions` | Tenant-owned **or** `tenantId IS NULL` + `SYSTEM_CANONICAL` | success | Tenant B custom rejected | rejected | Appointment service mismatch rejected |
| `branchId` | `branches` | `tenantId` + not deleted | success | rejected | rejected | Appointment/encounter branch mismatch rejected |
| `encounterId` | `encounters` | `tenantId` + not deleted | success | rejected | rejected | Patient/appointment/branch must match when supplied |
| `beautyAnnotationId` | `beauty_annotations` (+ parent `beauty_records`) | Annotation `tenantId`; patient via beauty record | success | rejected | rejected | Patient/encounter mismatch rejected |

Null optional references: allowed (posted without those columns populated).

HTTP proof: Tenant A authenticated `POST /inventory/usage` with Tenant B `patientId` → 4xx, no new ledger row.
