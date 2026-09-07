# ROUND_2_COMPLETE_TENANT_REFERENCE_QA_MATRIX

## CommissionAccrual parent/ref fields (schema)

| reference | INSERT cross-tenant | UPDATE parent-switch | DB mechanism |
|-----------|---------------------|----------------------|--------------|
| userId | reject covered | append-only blocks | tenant_refs + append_only |
| servicePerformanceId | reject covered | append-only blocks | tenant_refs + append_only |
| commissionPlanVersionId | trigger | append-only | tenant_refs + append_only |
| createdBy | trigger | append-only | tenant_refs + append_only |
| invoiceId | trigger | append-only | tenant_refs + append_only |
| invoiceLineId | trigger | append-only | tenant_refs + append_only |
| paymentId | trigger | append-only | tenant_refs + append_only |
| refundId | trigger | append-only | tenant_refs + append_only |
| appointmentId | trigger | append-only | tenant_refs + append_only |
| branchId | trigger | append-only | tenant_refs + append_only |
| clinicalServiceId | trigger (null tenant canonical OK) | append-only | tenant_refs + append_only |
| snapshotRevisionId | trigger | append-only | tenant_refs + append_only |
| reversalOfAccrualId | trigger | append-only | tenant_refs + append_only |

No `settledBy` / `participantId` columns on CommissionAccrual (actual schema).
Settlement actor = `commission_settlement_allocations.createdBy` (tenant-ref trigger).

## Tests
- F6-R2 INSERT mixed-parent (userId) PASS
- F6-R2 parent-switch UPDATE PASS
- Round 1 F6 suite retained
- invoice_line_items.servicePerformanceId tenant trigger PASS (clean validator)

NOBYPASSRLS: wave-f-rls suite PASS
