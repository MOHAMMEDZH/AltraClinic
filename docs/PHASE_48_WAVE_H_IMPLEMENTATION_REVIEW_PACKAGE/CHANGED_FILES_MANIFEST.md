# Wave H Changed Files Manifest

**Range:** `52ef5ad^..c64a435` (H0 through H4 inclusive)  
**Command:** `git diff --name-status 52ef5ad^..c64a435`

## Product — API (H1)

| Status | Path |
|--------|------|
| M | `apps/api/src/modules/clinical-catalog/application/clinical-catalog.service.ts` |
| A | `apps/api/src/modules/clinical-catalog/domain/clinical-catalog-search.ts` |
| A | `apps/api/src/modules/clinical-catalog/tests/wave-h1-arabic-catalog-search.unit.spec.ts` |
| A | `apps/api/src/modules/clinical-catalog/tests/wave-h1-arabic-catalog-search.postgres.integration.spec.ts` |

## Product — clinic-dashboard (H2–H4)

| Status | Path |
|--------|------|
| A | `apps/clinic-dashboard/e2e/wave-h2-arabic-rtl-booking.spec.ts` |
| A | `apps/clinic-dashboard/e2e/wave-h3-a11y-tablet.spec.ts` |
| A | `apps/clinic-dashboard/e2e/wave-h4-owner-ux.spec.ts` |
| M | `apps/clinic-dashboard/src/features/clinical-catalog/ClinicalServicesPage.tsx` |
| M | `apps/clinic-dashboard/src/features/clinical-catalog/clinical-catalog.spec.tsx` |
| M | `apps/clinic-dashboard/src/features/clinical-catalog/hooks/useClinicalCatalog.ts` |
| M | `apps/clinic-dashboard/src/features/scheduling/AppointmentsPage.tsx` |
| M | `apps/clinic-dashboard/src/features/scheduling/AppointmentsPage.module.css` |
| M | `apps/clinic-dashboard/src/features/scheduling/components/AppointmentForm.tsx` |
| M | `apps/clinic-dashboard/src/features/scheduling/components/AppointmentForm.module.css` |
| M | `apps/clinic-dashboard/src/features/inventory/InventoryReportsPage.tsx` |
| M | `apps/clinic-dashboard/src/features/inventory/InventoryReportsPage.module.css` |
| M | `apps/clinic-dashboard/src/features/inventory/api/inventory-api.ts` |
| M | `apps/clinic-dashboard/src/features/inventory/hooks/useInventory.ts` |
| M | `apps/clinic-dashboard/src/features/billing/CommissionPage.tsx` |
| M | `apps/clinic-dashboard/src/features/billing/billing-layout.module.css` |
| A | `apps/clinic-dashboard/src/features/billing/api/staff-commission-api.ts` |
| A | `apps/clinic-dashboard/src/features/billing/hooks/useStaffCommissionOwnerReport.ts` |
| M | `apps/clinic-dashboard/src/i18n/clinical-catalog-messages.ts` |
| M | `apps/clinic-dashboard/src/i18n/scheduling-messages.ts` |
| M | `apps/clinic-dashboard/src/i18n/inventory-messages.ts` |
| M | `apps/clinic-dashboard/src/i18n/billing-messages.ts` |
| M | `apps/clinic-dashboard/src/i18n/reports-messages.ts` |

## Kickoff docs (H0)

| Status | Path |
|--------|------|
| A | `docs/PHASE_48_WAVE_H_KICKOFF_PACKAGE/README.md` |
| A | `docs/PHASE_48_WAVE_H_KICKOFF_PACKAGE/WAVE_H_ACCEPTANCE_CRITERIA.md` |
| A | `docs/PHASE_48_WAVE_H_KICKOFF_PACKAGE/WAVE_H_CURRENT_STATE_VS_EXIT.md` |
| A | `docs/PHASE_48_WAVE_H_KICKOFF_PACKAGE/WAVE_H_FROZEN_SCOPE_EXTRACT.md` |
| A | `docs/PHASE_48_WAVE_H_KICKOFF_PACKAGE/WAVE_H_IMPLEMENTATION_SLICES.md` |

## Explicitly excluded from product commits

- `apps/api/.ci-evidence/**` (local proofs only)
- Unrelated dirt (`vite.config.js`, diagnostics, tmp junk)
