# Round 14 Correction Lineage and DB Integrity

## Migration

`apps/api/prisma/migrations/20260821180000_phase48_wave_f_round14_correction_lineage/migration.sql`

- Table `commission_correction_lineages`
- Unique index `(tenantId, correctionEventId)`
- FKs to tenants, commission_accruals, invoice_line_items, service_performances
- ENABLE + FORCE RLS; SELECT/INSERT tenant-scoped via `app.current_tenant_id`; UPDATE/DELETE `USING (false)`
- Append-only trigger `commission_correction_lineages_append_only`

Also mirrored in `prisma/rls-policies.sql` and `prisma/triggers.sql`. Clean validator asserts migration applied, table present, RLS/FORCE, unique index, deny-delete.

## Prisma model

`CommissionCorrectionLineage` in `schema.prisma`.

## App-role behavior

Service uses platform-bypass transaction path consistent with other Wave F financial writes; policies enforce tenant isolation when session vars are set without bypass.
