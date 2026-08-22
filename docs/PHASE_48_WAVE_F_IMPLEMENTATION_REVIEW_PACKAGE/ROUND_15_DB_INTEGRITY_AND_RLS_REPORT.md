# Round 15 — DB Integrity and RLS Report

## Enforcement

- Trigger `enforce_commission_correction_lineage_provenance` on INSERT/UPDATE of `commission_correction_lineages`
- Validates: selectedAccrual same tenant; invoiceLineId/source parity; SP parity; calculationBasis parity; packageAllocationId NULL/value parity; source/replacement/SP/package/createdBy tenant membership via `users.tenantId`
- Replacement line: **tenant only** at insert (not ACTIVE/bound — compatible with correction txn order)
- Append-only trigger + UPDATE/DELETE policies `USING (false)` retained
- Unique `(tenantId, correctionEventId)` retained

## NOBYPASSRLS proof

From `03_R15_RLS.txt` / suite “Wave F Round 15 commission_correction_lineages RLS (booking_app)”:

- `current_user` = `booking_app`
- `pg_roles.rolbypassrls` = **false**
- ENABLE + FORCE RLS on `commission_correction_lineages`
- Same-tenant insert/select succeed; cross-tenant select count 0; cross-tenant insert fails
- Cross-tenant parent pointers and semantic mismatches rejected
- Update/delete denied; platform bypass under admin contract works

Raw catalog: `ROUND_15_RAW_GATE_OUTPUTS/38_DB_CATALOG.json`
