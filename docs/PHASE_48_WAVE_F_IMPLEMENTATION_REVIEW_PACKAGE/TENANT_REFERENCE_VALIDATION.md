# TENANT_REFERENCE_VALIDATION (Round 6)

| Control | Result |
|---------|--------|
| Prior F6 13-ref exhaustive QA | CLOSED (not reopened) |
| `invoice_line_items.clinicalServiceId` SYSTEM_CANONICAL / TENANT_CUSTOM | PASS (R5-CSVC regression) |
| Cross-tenant TENANT_CUSTOM rejected on INSERT/UPDATE | PASS |
| Package provenance tenant chain (course/session/performance/invoice) | PASS (R6-PKG-PROVENANCE) |

See `ROUND_5_CLINICAL_SERVICE_TENANT_INTEGRITY_MATRIX.md` + `ROUND_6_PACKAGE_PROVENANCE_CHAIN_MATRIX.md`.
