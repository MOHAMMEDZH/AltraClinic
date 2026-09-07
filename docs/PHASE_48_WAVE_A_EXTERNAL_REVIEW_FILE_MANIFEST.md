# Phase 48 Wave A — External Review File Manifest

| Field | Value |
|-------|--------|
| **Branch** | `cursor/phase48-wave-a-foundation` |
| **HEAD** | `416c0981728a8cc2c88494352e1ec4413727efdf` |
| **Working tree** | clean at evidence capture (post-commit) |
| **Wave A delta source** | commit `416c098` vs parent `daf15c8` |

## Exact git capture note

At evidence time:

```text
git status --short = empty
git diff = empty
git ls-files --others --exclude-standard = empty
```

Wave A implementation is committed. Commit name-status/stat captured as:

- `phase48_wave_a_commit_416c098_name_status.txt`
- `phase48_wave_a_commit_416c098_stat.txt`

## Changed files in commit 416c098 (complete)

| path | status | classification |
|------|--------|----------------|
| apps/api/config/permission-matrix.json | M | authorization |
| apps/api/prisma/migrations/20260814010000_phase48_wave_a_clinical_catalog/migration.sql | A | database migration |
| apps/api/prisma/schema.prisma | M | Prisma/schema |
| apps/api/scripts/phase48-wave-a-backfill.mjs | A | migration tooling |
| apps/api/scripts/validate-phase48-wave-a-clean.mjs | A | QA/test |
| apps/api/scripts/validate-phase48-wave-a-upgrade.mjs | A | QA/test |
| apps/api/src/app.module.ts | M | API/controller |
| apps/api/src/modules/auth/platform-rbac/platform-rbac.catalog.ts | M | authorization |
| apps/api/src/modules/clinical-catalog/api/clinical-catalog-configs.controller.ts | A | API/controller |
| apps/api/src/modules/clinical-catalog/api/clinical-catalog-prices.controller.ts | A | API/controller |
| apps/api/src/modules/clinical-catalog/api/clinical-catalog.controller.ts | A | API/controller |
| apps/api/src/modules/clinical-catalog/api/platform-clinical-catalog.controller.ts | A | API/controller |
| apps/api/src/modules/clinical-catalog/application/clinical-catalog.service.ts | A | domain/application |
| apps/api/src/modules/clinical-catalog/application/clinical-price-version.service.ts | A | domain/application |
| apps/api/src/modules/clinical-catalog/application/dto/clinical-catalog.dto.ts | A | domain/application |
| apps/api/src/modules/clinical-catalog/application/ports/clinical-catalog-audit-log.port.ts | A | audit |
| apps/api/src/modules/clinical-catalog/application/tenant-service-config.service.ts | A | domain/application |
| apps/api/src/modules/clinical-catalog/clinical-catalog.module.ts | A | API/controller |
| apps/api/src/modules/clinical-catalog/domain/clinical-catalog.errors.ts | A | domain/application |
| apps/api/src/modules/clinical-catalog/domain/clinical-catalog.lifecycle.ts | A | domain/application |
| apps/api/src/modules/clinical-catalog/domain/feature-flag.helpers.ts | A | domain/application |
| apps/api/src/modules/clinical-catalog/domain/scheduling-seed.inventory.ts | A | migration tooling |
| apps/api/src/modules/clinical-catalog/domain/stable-key.helpers.ts | A | domain/application |
| apps/api/src/modules/clinical-catalog/infrastructure/audit-trail-clinical-catalog-audit-log.ts | A | audit |
| apps/api/src/modules/clinical-catalog/migration/run-wave-a-backfill.ts | A | migration tooling |
| apps/api/src/modules/clinical-catalog/migration/wave-a-backfill.service.ts | A | migration tooling |
| apps/api/src/modules/clinical-catalog/tests/clinical-catalog.integrity.unit.spec.ts | A | QA/test |
| apps/api/src/modules/clinical-catalog/tests/clinical-price.unit.spec.ts | A | QA/test |
| apps/api/src/modules/clinical-catalog/tests/support/fake-clinical-catalog-audit-log.ts | A | QA/test |
| apps/clinic-dashboard/src/features/billing/components/BillingQuickNav.tsx | M | Clinic UI / routing |
| apps/clinic-dashboard/src/features/clinical-catalog/ClinicalPricingPage.tsx | A | Clinic UI |
| apps/clinic-dashboard/src/features/clinical-catalog/ClinicalServicesPage.tsx | A | Clinic UI |
| apps/clinic-dashboard/src/features/clinical-catalog/api/clinical-catalog-api.ts | A | Clinic UI |
| apps/clinic-dashboard/src/features/clinical-catalog/clinical-catalog.spec.tsx | A | QA/test |
| apps/clinic-dashboard/src/features/clinical-catalog/hooks/useClinicalCatalog.ts | A | Clinic UI |
| apps/clinic-dashboard/src/features/clinical-catalog/lazy-clinical-catalog-routes.tsx | A | Clinic UI / routing |
| apps/clinic-dashboard/src/features/dynamic-routing/lib/route-component-registry.tsx | M | routing |
| apps/clinic-dashboard/src/features/dynamic-routing/lib/static-route-catalog.ts | M | routing |
| apps/clinic-dashboard/src/features/settings/config/settings-config.ts | M | routing |
| apps/clinic-dashboard/src/i18n/billing-messages.ts | M | i18n |
| apps/clinic-dashboard/src/i18n/clinical-catalog-messages.ts | A | i18n |
| apps/clinic-dashboard/src/i18n/messages.ts | M | i18n |
| apps/clinic-dashboard/src/i18n/settings-messages.ts | M | i18n |
| apps/super-admin/src/app/router/index.tsx | M | routing |
| apps/super-admin/src/auth/platform-auth-api.ts | M | Super Admin UI |
| apps/super-admin/src/i18n/messages.ts | M | i18n |
| apps/super-admin/src/pages/ClinicalCatalogPage.tsx | A | Super Admin UI |
| apps/super-admin/src/pages/clinical-catalog.spec.tsx | A | QA/test |
| apps/super-admin/src/routing/route-registry.ts | M | routing |
| docs/PHASE_48_ARCHITECTURE_FREEZE.md | A | governance documentation |
| docs/PHASE_48_ARCHITECTURE_REVIEW.md | A | governance documentation |
| docs/PHASE_48_ARCHITECTURE_REVIEW_ADDENDUM_INVENTORY_COMMISSION.md | A | governance documentation |
| docs/PHASE_48_ENTERPRISE_QA_ACCEPTANCE_ARCHITECTURE.md | A | governance documentation |
| docs/PHASE_48_FROZEN_DOMAIN_CONTRACT_MATRIX.md | A | governance documentation |
| docs/PHASE_48_FROZEN_IMPLEMENTATION_AND_QA_PLAN.md | A | governance documentation |
| docs/PHASE_48_INVENTORY_USAGE_ACCOUNTABILITY_ARCHITECTURE.md | A | governance documentation |
| docs/PHASE_48_MIGRATION_AND_BACKWARD_COMPATIBILITY_REVIEW.md | A | governance documentation |
| docs/PHASE_48_STAFF_COMMISSION_REVENUE_SHARE_ARCHITECTURE.md | A | governance documentation |
| docs/PHASE_48_TARGET_DOMAIN_ARCHITECTURE.md | A | governance documentation |
| docs/PHASE_48_WAVE_A_IMPLEMENTATION_REPORT.md | A | implementation report |
| docs/permission-matrix.json | M | authorization |
| packages/permissions/permission-matrix.json | M | authorization |

**Total:** 62 files in commit `416c098`.
