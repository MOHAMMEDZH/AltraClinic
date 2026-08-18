# Wave C checkpoint intended files

Pre-cleanup classification for the local Wave C checkpoint.

- Branch: `cursor/phase48-wave-c-clinical-safety`
- Pre-checkpoint HEAD / Wave B parent: `ec084dd7dbdc8e3d46b0adde92d1e33940a7a3c5`
- Wave C Production Acceptance: ACCEPTED
- This file classifies the worktree **before** generated/temp cleanup.

## Totals

- Classified entries: 544
- Intended YES: 142
- Do not commit NO: 402
- Unclassified: 0

| path | Git state | category | intended commit | reason |
|---|---|---|---|---|
| `apps/api/prisma/seeds/permission-seeds.d.ts` | modified (CRLF only; empty diff) | temporary/generated | NO | Tracked compiled seed output; status dirty from CRLF only (empty git diff). Restore to HEAD; do not stage. |
| `apps/api/prisma/seeds/permission-seeds.js` | modified (CRLF only; empty diff) | temporary/generated | NO | Tracked compiled seed output; status dirty from CRLF only (empty git diff). Restore to HEAD; do not stage. |
| `apps/api/scripts/tmp-wave-c-r2-db-prep.mjs` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `apps/api/scripts/validate-phase48-wave-c-permission-routes.mjs.d.ts` | untracked | temporary/generated | NO | Generated declaration for validator script. |
| `apps/api/tmp-apply-wave-c-remediation-sql.cjs` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `apps/api/tmp-void.sql` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `apps/api/tmp-wave-c-r2.sql` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `audit-trail-inventory-audit-log.ts` | untracked | temporary/generated | NO | Repo-root scratch copy of a file that lives in apps/; not the canonical path. |
| `clinical-forms.controller.ts` | untracked | temporary/generated | NO | Repo-root scratch copy of a file that lives in apps/; not the canonical path. |
| `clinical-form-version.service.ts` | untracked | temporary/generated | NO | Repo-root scratch copy of a file that lives in apps/; not the canonical path. |
| `consume-inventory.handler.ts` | untracked | temporary/generated | NO | Repo-root scratch copy of a file that lives in apps/; not the canonical path. |
| `dispose-inventory-batch.handler.ts` | untracked | temporary/generated | NO | Repo-root scratch copy of a file that lives in apps/; not the canonical path. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/source/apps__api__prisma__migrations__20260816010000_phase48_wave_c_clinical_safety__migration.sql` | untracked | review-only | NO | Flattened review-package duplicate of canonical source; production files remain under apps/. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/source/apps__api__prisma__rls-policies.sql` | untracked | review-only | NO | Flattened review-package duplicate of canonical source; production files remain under apps/. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/source/apps__api__prisma__triggers.sql` | untracked | review-only | NO | Flattened review-package duplicate of canonical source; production files remain under apps/. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/source/apps__api__scripts__validate-phase48-wave-c-permission-routes.mjs` | untracked | review-only | NO | Flattened review-package duplicate of canonical source; production files remain under apps/. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/source/apps__api__src__modules__billing__application__handlers__cancel-invoice.handler.ts` | untracked | review-only | NO | Flattened review-package duplicate of canonical source; production files remain under apps/. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/source/apps__api__src__modules__billing__infrastructure__prisma-invoice.repository.ts` | untracked | review-only | NO | Flattened review-package duplicate of canonical source; production files remain under apps/. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/source/apps__api__src__modules__clinical-forms__api__clinical-forms.controller.ts` | untracked | review-only | NO | Flattened review-package duplicate of canonical source; production files remain under apps/. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/source/apps__api__src__modules__clinical-forms__api__clinical-forms.dto.ts` | untracked | review-only | NO | Flattened review-package duplicate of canonical source; production files remain under apps/. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/source/apps__api__src__modules__clinical-forms__services__clinical-form-reference.validation.ts` | untracked | review-only | NO | Flattened review-package duplicate of canonical source; production files remain under apps/. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/source/apps__api__src__modules__clinical-forms__services__clinical-form-version.service.ts` | untracked | review-only | NO | Flattened review-package duplicate of canonical source; production files remain under apps/. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/source/apps__api__src__modules__clinical-forms__services__clinical-service-form-requirement.service.ts` | untracked | review-only | NO | Flattened review-package duplicate of canonical source; production files remain under apps/. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/source/apps__api__src__modules__clinical-forms__services__patient-form-instance.service.ts` | untracked | review-only | NO | Flattened review-package duplicate of canonical source; production files remain under apps/. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/source/apps__api__src__modules__clinical-forms__tests__wave-c-clinical-forms-http.postgres.integration.spec.ts` | untracked | review-only | NO | Flattened review-package duplicate of canonical source; production files remain under apps/. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/source/apps__api__src__modules__clinical-forms__tests__wave-c-consent.postgres.integration.spec.ts` | untracked | review-only | NO | Flattened review-package duplicate of canonical source; production files remain under apps/. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/source/apps__api__src__modules__clinical-forms__tests__wave-c-media-patient.postgres.integration.spec.ts` | untracked | review-only | NO | Flattened review-package duplicate of canonical source; production files remain under apps/. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/source/apps__api__src__modules__clinical-forms__tests__wave-c-permission-contract.postgres.integration.spec.ts` | untracked | review-only | NO | Flattened review-package duplicate of canonical source; production files remain under apps/. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/source/apps__api__src__modules__inventory__application__dto__inventory-usage.dto.ts` | untracked | review-only | NO | Flattened review-package duplicate of canonical source; production files remain under apps/. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/source/apps__api__src__modules__inventory__application__dto__stock-request.dto.ts` | untracked | review-only | NO | Flattened review-package duplicate of canonical source; production files remain under apps/. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/source/apps__api__src__modules__inventory__application__handlers__consume-inventory.handler.ts` | untracked | review-only | NO | Flattened review-package duplicate of canonical source; production files remain under apps/. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/source/apps__api__src__modules__inventory__application__handlers__dispose-inventory-batch.handler.ts` | untracked | review-only | NO | Flattened review-package duplicate of canonical source; production files remain under apps/. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/source/apps__api__src__modules__inventory__application__handlers__stock-request.handlers.ts` | untracked | review-only | NO | Flattened review-package duplicate of canonical source; production files remain under apps/. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/source/apps__api__src__modules__inventory__application__services__inventory-usage-owner-report.service.ts` | untracked | review-only | NO | Flattened review-package duplicate of canonical source; production files remain under apps/. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/source/apps__api__src__modules__inventory__application__services__inventory-usage-posting.service.ts` | untracked | review-only | NO | Flattened review-package duplicate of canonical source; production files remain under apps/. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/source/apps__api__src__modules__inventory__controllers__inventory.controller.ts` | untracked | review-only | NO | Flattened review-package duplicate of canonical source; production files remain under apps/. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/source/apps__api__src__modules__inventory__domain__repositories__inventory-warehouse.repository.interface.ts` | untracked | review-only | NO | Flattened review-package duplicate of canonical source; production files remain under apps/. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/source/apps__api__src__modules__inventory__domain__repositories__stock-request.repository.interface.ts` | untracked | review-only | NO | Flattened review-package duplicate of canonical source; production files remain under apps/. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/source/apps__api__src__modules__inventory__infrastructure__audit-trail-inventory-audit-log.ts` | untracked | review-only | NO | Flattened review-package duplicate of canonical source; production files remain under apps/. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/source/apps__api__src__modules__inventory__infrastructure__prisma-inventory-warehouse.repository.ts` | untracked | review-only | NO | Flattened review-package duplicate of canonical source; production files remain under apps/. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/source/apps__api__src__modules__inventory__infrastructure__prisma-stock-request.repository.ts` | untracked | review-only | NO | Flattened review-package duplicate of canonical source; production files remain under apps/. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/source/apps__api__src__modules__inventory__ports__inventory-audit-log.port.ts` | untracked | review-only | NO | Flattened review-package duplicate of canonical source; production files remain under apps/. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/source/apps__api__src__modules__inventory__tests__wave-c-http-permission.postgres.integration.spec.ts` | untracked | review-only | NO | Flattened review-package duplicate of canonical source; production files remain under apps/. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/source/apps__api__src__modules__inventory__tests__wave-c-injectable.postgres.integration.spec.ts` | untracked | review-only | NO | Flattened review-package duplicate of canonical source; production files remain under apps/. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/source/apps__api__src__modules__inventory__tests__wave-c-inventory-accountability.postgres.integration.spec.ts` | untracked | review-only | NO | Flattened review-package duplicate of canonical source; production files remain under apps/. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/source/apps__api__src__modules__inventory__tests__wave-c-rls.postgres.integration.spec.ts` | untracked | review-only | NO | Flattened review-package duplicate of canonical source; production files remain under apps/. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/source/apps__api__src__modules__media__application__handlers__upload-media.handler.ts` | untracked | review-only | NO | Flattened review-package duplicate of canonical source; production files remain under apps/. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/source/apps__api__src__modules__media__domain__entities__media-asset.entity.ts` | untracked | review-only | NO | Flattened review-package duplicate of canonical source; production files remain under apps/. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/source/apps__api__src__modules__media__domain__value-objects__media-category.vo.ts` | untracked | review-only | NO | Flattened review-package duplicate of canonical source; production files remain under apps/. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/source/apps__clinic-dashboard__src__features__inventory__api__fulfill-stock-request-body.ts` | untracked | review-only | NO | Flattened review-package duplicate of canonical source; production files remain under apps/. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/source/apps__clinic-dashboard__src__features__inventory__api__inventory-api.ts` | untracked | review-only | NO | Flattened review-package duplicate of canonical source; production files remain under apps/. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/source/apps__clinic-dashboard__src__features__inventory__components__AccountableStaffSelect.tsx` | untracked | review-only | NO | Flattened review-package duplicate of canonical source; production files remain under apps/. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/source/apps__clinic-dashboard__src__features__inventory__hooks__useInventory.ts` | untracked | review-only | NO | Flattened review-package duplicate of canonical source; production files remain under apps/. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/source/apps__clinic-dashboard__src__features__inventory__StockRequestsPage.tsx` | untracked | review-only | NO | Flattened review-package duplicate of canonical source; production files remain under apps/. |
| `inventory.controller.ts` | untracked | temporary/generated | NO | Repo-root scratch copy of a file that lives in apps/; not the canonical path. |
| `inventory-audit-log.port.ts` | untracked | temporary/generated | NO | Repo-root scratch copy of a file that lives in apps/; not the canonical path. |
| `inventory-usage-owner-report.service.ts` | untracked | temporary/generated | NO | Repo-root scratch copy of a file that lives in apps/; not the canonical path. |
| `inventory-usage-posting.service.ts` | untracked | temporary/generated | NO | Repo-root scratch copy of a file that lives in apps/; not the canonical path. |
| `media-asset.entity.ts` | untracked | temporary/generated | NO | Repo-root scratch copy of a file that lives in apps/; not the canonical path. |
| `media-category.vo.ts` | untracked | temporary/generated | NO | Repo-root scratch copy of a file that lives in apps/; not the canonical path. |
| `migration.sql` | untracked | temporary/generated | NO | Repo-root scratch copy of a file that lives in apps/; not the canonical path. |
| `packages/dashboard-export/src/build-dashboard-csv.d.ts` | untracked | temporary/generated | NO | Untracked compiled dashboard-export artifact. |
| `packages/dashboard-export/src/build-dashboard-csv.js` | untracked | temporary/generated | NO | Untracked compiled dashboard-export artifact. |
| `packages/dashboard-export/src/build-dashboard-excel.d.ts` | untracked | temporary/generated | NO | Untracked compiled dashboard-export artifact. |
| `packages/dashboard-export/src/build-dashboard-excel.js` | untracked | temporary/generated | NO | Untracked compiled dashboard-export artifact. |
| `packages/dashboard-export/src/build-dashboard-pdf.d.ts` | untracked | temporary/generated | NO | Untracked compiled dashboard-export artifact. |
| `packages/dashboard-export/src/build-dashboard-pdf.js` | untracked | temporary/generated | NO | Untracked compiled dashboard-export artifact. |
| `packages/dashboard-export/src/build-dashboard-sections.d.ts` | untracked | temporary/generated | NO | Untracked compiled dashboard-export artifact. |
| `packages/dashboard-export/src/build-dashboard-sections.js` | untracked | temporary/generated | NO | Untracked compiled dashboard-export artifact. |
| `packages/dashboard-export/src/build-dashboard-word.d.ts` | untracked | temporary/generated | NO | Untracked compiled dashboard-export artifact. |
| `packages/dashboard-export/src/build-dashboard-word.js` | untracked | temporary/generated | NO | Untracked compiled dashboard-export artifact. |
| `packages/dashboard-export/src/format.d.ts` | untracked | temporary/generated | NO | Untracked compiled dashboard-export artifact. |
| `packages/dashboard-export/src/format.js` | untracked | temporary/generated | NO | Untracked compiled dashboard-export artifact. |
| `packages/dashboard-export/src/labels.d.ts` | untracked | temporary/generated | NO | Untracked compiled dashboard-export artifact. |
| `packages/dashboard-export/src/labels.js` | untracked | temporary/generated | NO | Untracked compiled dashboard-export artifact. |
| `packages/dashboard-export/src/load-arabic-fonts-node.d.ts` | untracked | temporary/generated | NO | Untracked compiled dashboard-export artifact. |
| `packages/dashboard-export/src/load-arabic-fonts-node.js` | untracked | temporary/generated | NO | Untracked compiled dashboard-export artifact. |
| `packages/dashboard-export/src/node.d.ts` | untracked | temporary/generated | NO | Untracked compiled dashboard-export artifact. |
| `packages/dashboard-export/src/node.js` | untracked | temporary/generated | NO | Untracked compiled dashboard-export artifact. |
| `packages/dashboard-export/src/prepare-arabic-pdf-text.d.ts` | untracked | temporary/generated | NO | Untracked compiled dashboard-export artifact. |
| `packages/dashboard-export/src/prepare-arabic-pdf-text.js` | untracked | temporary/generated | NO | Untracked compiled dashboard-export artifact. |
| `packages/dashboard-export/src/types.d.ts` | untracked | temporary/generated | NO | Untracked compiled dashboard-export artifact. |
| `packages/dashboard-export/src/types.js` | untracked | temporary/generated | NO | Untracked compiled dashboard-export artifact. |
| `packages/module-registry/src/activity/activity-types.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/activity/activity-types.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/activity/build-activity-contributions.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/activity/build-activity-contributions.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/activity/canonical-activity-categories.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/activity/canonical-activity-categories.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/activity/canonical-activity-feeds.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/activity/canonical-activity-feeds.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/activity/canonical-activity-hubs.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/activity/canonical-activity-hubs.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/activity/canonical-activity-severities.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/activity/canonical-activity-severities.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/activity/canonical-activity-surfaces.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/activity/canonical-activity-surfaces.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/activity/canonical-activity-types.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/activity/canonical-activity-types.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/activity/canonical-cross-module-activity.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/activity/canonical-cross-module-activity.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/activity/validate-activity-integrity.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/activity/validate-activity-integrity.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/activity/validate-canonical-activity-vocabulary.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/activity/validate-canonical-activity-vocabulary.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/analytics/analytics-capability-contract.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/analytics/analytics-capability-contract.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/analytics/analytics-types.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/analytics/analytics-types.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/analytics/build-analytics-contributions.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/analytics/build-analytics-contributions.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/analytics/canonical-analytics-categories.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/analytics/canonical-analytics-categories.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/analytics/canonical-analytics-domains.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/analytics/canonical-analytics-domains.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/analytics/canonical-analytics-hubs.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/analytics/canonical-analytics-hubs.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/analytics/canonical-analytics-metrics.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/analytics/canonical-analytics-metrics.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/analytics/canonical-analytics-widgets.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/analytics/canonical-analytics-widgets.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/analytics/canonical-cross-module-analytics.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/analytics/canonical-cross-module-analytics.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/analytics/index.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/analytics/index.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/analytics/static-analytics-catalog-authority.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/analytics/static-analytics-catalog-authority.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/analytics/validate-analytics-integrity.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/analytics/validate-analytics-integrity.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/analytics/validate-analytics-layer-parity.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/analytics/validate-analytics-layer-parity.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/analytics/validate-canonical-analytics-vocabulary.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/analytics/validate-canonical-analytics-vocabulary.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/analytics/validate-static-analytics-catalog-parity.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/analytics/validate-static-analytics-catalog-parity.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/audit/audit-types.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/audit/audit-types.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/audit/build-audit-contributions.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/audit/build-audit-contributions.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/audit/canonical-audit-actions.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/audit/canonical-audit-actions.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/audit/canonical-audit-categories.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/audit/canonical-audit-categories.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/audit/canonical-audit-event-types.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/audit/canonical-audit-event-types.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/audit/canonical-audit-feeds.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/audit/canonical-audit-feeds.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/audit/canonical-audit-outcomes.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/audit/canonical-audit-outcomes.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/audit/canonical-audit-policies.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/audit/canonical-audit-policies.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/audit/canonical-audit-risks.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/audit/canonical-audit-risks.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/audit/canonical-audit-severities.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/audit/canonical-audit-severities.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/audit/canonical-audit-surfaces.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/audit/canonical-audit-surfaces.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/audit/validate-audit-integrity.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/audit/validate-audit-integrity.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/audit/validate-canonical-audit-vocabulary.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/audit/validate-canonical-audit-vocabulary.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/branch/branch-capability-contract.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/branch/branch-capability-contract.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/branch/branch-types.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/branch/branch-types.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/branch/build-branch-contributions.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/branch/build-branch-contributions.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/branch/canonical-branch-address.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/branch/canonical-branch-address.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/branch/canonical-branch-analytics.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/branch/canonical-branch-analytics.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/branch/canonical-branch-categories.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/branch/canonical-branch-categories.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/branch/canonical-branch-clinical.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/branch/canonical-branch-clinical.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/branch/canonical-branch-financial.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/branch/canonical-branch-financial.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/branch/canonical-branch-identity.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/branch/canonical-branch-identity.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/branch/canonical-branch-inventory.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/branch/canonical-branch-inventory.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/branch/canonical-branch-reporting.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/branch/canonical-branch-reporting.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/branch/canonical-branch-surfaces.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/branch/canonical-branch-surfaces.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/branch/canonical-branch-white-label.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/branch/canonical-branch-white-label.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/branch/validate-branch-integrity.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/branch/validate-branch-integrity.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/branch/validate-branch-surface-ownership.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/branch/validate-branch-surface-ownership.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/branch/validate-canonical-branch-vocabulary.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/branch/validate-canonical-branch-vocabulary.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/builtin/builtin-manifests.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/builtin/builtin-manifests.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/builtin/extension-builders.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/builtin/extension-builders.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/dashboard/build-dashboard-contributions.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/dashboard/build-dashboard-contributions.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/dashboard/canonical-dashboard-widgets.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/dashboard/canonical-dashboard-widgets.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/dashboard/index.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/dashboard/index.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/dashboard/validate-dashboard-integrity.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/dashboard/validate-dashboard-integrity.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/events/registry-events.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/events/registry-events.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/graph/dependency-resolver.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/graph/dependency-resolver.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/index.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/index.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/journey/build-journey-contributions.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/journey/build-journey-contributions.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/journey/canonical-journey-approvals.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/journey/canonical-journey-approvals.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/journey/canonical-journey-automations.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/journey/canonical-journey-automations.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/journey/canonical-journey-categories.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/journey/canonical-journey-categories.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/journey/canonical-journey-definitions.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/journey/canonical-journey-definitions.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/journey/canonical-journey-escalations.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/journey/canonical-journey-escalations.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/journey/canonical-journey-guards.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/journey/canonical-journey-guards.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/journey/canonical-journey-packs.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/journey/canonical-journey-packs.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/journey/canonical-journey-stages.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/journey/canonical-journey-stages.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/journey/canonical-journey-surfaces.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/journey/canonical-journey-surfaces.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/journey/canonical-journey-timers.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/journey/canonical-journey-timers.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/journey/canonical-journey-transitions.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/journey/canonical-journey-transitions.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/journey/journey-types.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/journey/journey-types.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/journey/validate-canonical-journey-vocabulary.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/journey/validate-canonical-journey-vocabulary.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/journey/validate-journey-integrity.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/journey/validate-journey-integrity.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/loader/registry-bootstrap.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/loader/registry-bootstrap.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/build-notification-contributions.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/build-notification-contributions.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/canonical-consent-policies.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/canonical-consent-policies.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/canonical-delivery-policies.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/canonical-delivery-policies.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/canonical-escalation-policies.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/canonical-escalation-policies.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/canonical-notification-categories.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/canonical-notification-categories.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/canonical-notification-channels.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/canonical-notification-channels.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/canonical-notification-packs.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/canonical-notification-packs.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/canonical-notification-providers.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/canonical-notification-providers.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/canonical-notification-surfaces.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/canonical-notification-surfaces.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/canonical-notification-templates.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/canonical-notification-templates.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/canonical-notification-types.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/canonical-notification-types.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/canonical-preference-policies.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/canonical-preference-policies.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/canonical-redaction-policies.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/canonical-redaction-policies.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/canonical-retention-policies.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/canonical-retention-policies.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/canonical-retry-policies.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/canonical-retry-policies.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/foundation-runtime-mapping.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/foundation-runtime-mapping.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/index.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/index.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/notification-types.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/notification-types.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/static-notification-catalog-authority.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/static-notification-catalog-authority.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/validate-canonical-notification-vocabulary.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/validate-canonical-notification-vocabulary.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/validate-notification-integrity.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/validate-notification-integrity.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/validate-notification-layer-parity.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/validate-notification-layer-parity.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/validate-static-notification-catalog-parity.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/notification/validate-static-notification-catalog-parity.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/reporting/build-report-contributions.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/reporting/build-report-contributions.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/reporting/canonical-report-categories.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/reporting/canonical-report-categories.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/reporting/canonical-report-hubs.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/reporting/canonical-report-hubs.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/reporting/canonical-report-templates.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/reporting/canonical-report-templates.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/reporting/index.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/reporting/index.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/reporting/reporting-types.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/reporting/reporting-types.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/reporting/validate-canonical-report-vocabulary.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/reporting/validate-canonical-report-vocabulary.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/reporting/validate-reporting-layer-parity.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/reporting/validate-reporting-layer-parity.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/reporting/validate-report-integrity.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/reporting/validate-report-integrity.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/reporting/validate-static-report-catalog-parity.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/reporting/validate-static-report-catalog-parity.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/resolver/effective-module-resolver.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/resolver/effective-module-resolver.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/search/api-search-parity.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/search/api-search-parity.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/search/build-search-contributions.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/search/build-search-contributions.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/search/canonical-discovery-search.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/search/canonical-discovery-search.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/search/canonical-search-entities.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/search/canonical-search-entities.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/search/index.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/search/index.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/search/validate-search-integrity.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/search/validate-search-integrity.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/semver.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/semver.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/types.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/types.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/validation/manifest-validator.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/validation/manifest-validator.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/whitelabel/build-white-label-contributions.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/whitelabel/build-white-label-contributions.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/whitelabel/canonical-brand-assets.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/whitelabel/canonical-brand-assets.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/whitelabel/canonical-branding-categories.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/whitelabel/canonical-branding-categories.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/whitelabel/canonical-layout-profiles.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/whitelabel/canonical-layout-profiles.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/whitelabel/canonical-localization-options.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/whitelabel/canonical-localization-options.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/whitelabel/canonical-surface-slots.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/whitelabel/canonical-surface-slots.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/whitelabel/canonical-theme-tokens.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/whitelabel/canonical-theme-tokens.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/whitelabel/validate-canonical-white-label-vocabulary.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/whitelabel/validate-canonical-white-label-vocabulary.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/whitelabel/validate-white-label-integrity.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/whitelabel/validate-white-label-integrity.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/whitelabel/white-label-types.d.ts` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `packages/module-registry/src/whitelabel/white-label-types.js` | untracked | temporary/generated | NO | Untracked compiled module-registry artifact; caused prior vite CANONICAL_BRANCH_SURFACES failure. |
| `patient-form-instance.service.ts` | untracked | temporary/generated | NO | Repo-root scratch copy of a file that lives in apps/; not the canonical path. |
| `rls-policies.sql` | untracked | temporary/generated | NO | Repo-root scratch copy of a file that lives in apps/; not the canonical path. |
| `tmp-2blocker.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-2blocker2.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-bmig05.json` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-bmig05.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-bmig05b.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-bmig05-out.json` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-build-promt-package.ps1` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-consume-unit.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-narrow.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-narrow2.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-pa04.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-patch-mig.cjs` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-tsc.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-tsc-remediation.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-wave-a.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-wave-a-int.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-wave-a-int2.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-wave-a-unit2.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-wave-b-full.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-wave-b-reg.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-wave-b-unit.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-wave-c-clean.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-wave-c-packs.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-wave-c-perm.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-wave-c-r2-billing-unit.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-wave-c-r2-cinv36.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-wave-c-r2-clean.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-wave-c-r2-packs.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-wave-c-r2-perm.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-wave-c-r2-tsc-build.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-wave-c-r2-unit-reg.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-wave-c-r2-upgrade.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-wave-c-r2-wave-a.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-wave-c-r2-wave-b.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-wave-c-remediation.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-wave-c-remediation-rerun.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-wave-c-remediation-rerun2.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-wave-c-remediation-rerun3.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-wave-c-upgrade.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-wb-assignroom.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-wb-final.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-wb-final2.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-wb-latr.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-wb-latr2.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-wb-lifecycle.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-wb-narrow3.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `tmp-wb-targeted.txt` | untracked | temporary/generated | NO | Temporary local script/log/SQL; not production Wave C source. |
| `triggers.sql` | untracked | temporary/generated | NO | Repo-root scratch copy of a file that lives in apps/; not the canonical path. |
| `wave-c-consent.postgres.integration.spec.ts` | untracked | temporary/generated | NO | Repo-root scratch copy of a file that lives in apps/; not the canonical path. |
| `wave-c-injectable.postgres.integration.spec.ts` | untracked | temporary/generated | NO | Repo-root scratch copy of a file that lives in apps/; not the canonical path. |
| `wave-c-inventory-accountability.postgres.integration.spec.ts` | untracked | temporary/generated | NO | Repo-root scratch copy of a file that lives in apps/; not the canonical path. |
| `apps/api/config/permission-matrix.json` | modified | permission/config | YES | Authoritative permission matrix / package / guard used by Wave C. |
| `apps/api/prisma/migrations/20260816010000_phase48_wave_c_clinical_safety/migration.sql` | untracked | migration/database | YES | Accepted Wave C schema/RLS/triggers/migration. |
| `apps/api/prisma/rls-policies.sql` | modified | migration/database | YES | Accepted Wave C schema/RLS/triggers/migration. |
| `apps/api/prisma/schema.prisma` | modified | migration/database | YES | Accepted Wave C schema/RLS/triggers/migration. |
| `apps/api/prisma/triggers.sql` | modified | migration/database | YES | Accepted Wave C schema/RLS/triggers/migration. |
| `apps/api/scripts/validate-phase48-wave-a-upgrade.mjs` | modified | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/scripts/validate-phase48-wave-b-upgrade.mjs` | modified | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/scripts/validate-phase48-wave-c-clean.mjs` | untracked | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/scripts/validate-phase48-wave-c-permission-routes.mjs` | untracked | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/scripts/validate-phase48-wave-c-upgrade.mjs` | untracked | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/app.module.ts` | modified | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/analytics/application/services/analytics-domain.service.ts` | modified | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/auth/api/guards/permission.guard.ts` | modified | permission/config | YES | Authoritative permission matrix / package / guard used by Wave C. |
| `apps/api/src/modules/beauty/application/dto/beauty-material.dto.ts` | modified | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/beauty/application/handlers/beauty-material.handlers.ts` | modified | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/beauty/beauty.module.ts` | modified | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/beauty/controllers/beauty.controller.ts` | modified | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/billing/application/handlers/cancel-invoice.handler.ts` | modified | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/billing/infrastructure/prisma-invoice.repository.ts` | modified | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/billing/tests/cancel-invoice.handler.spec.ts` | modified | test | YES | Wave C / regression test source. |
| `apps/api/src/modules/clinical-forms/api/clinical-forms.controller.ts` | untracked | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/clinical-forms/api/clinical-forms.dto.ts` | untracked | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/clinical-forms/clinical-forms.module.ts` | untracked | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/clinical-forms/infrastructure/audit-trail-clinical-forms-audit-log.ts` | untracked | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/clinical-forms/ports/clinical-forms-audit-log.port.ts` | untracked | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/clinical-forms/services/clinical-form-reference.validation.ts` | untracked | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/clinical-forms/services/clinical-form-template.service.ts` | untracked | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/clinical-forms/services/clinical-form-version.service.ts` | untracked | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/clinical-forms/services/clinical-service-form-requirement.service.ts` | untracked | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/clinical-forms/services/patient-form-instance.service.ts` | untracked | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/clinical-forms/services/photo-consent-media-gate.service.ts` | untracked | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/clinical-forms/services/required-consent-gate.service.ts` | untracked | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/clinical-forms/tests/wave-c-clinical-forms-http.postgres.integration.spec.ts` | untracked | test | YES | Wave C / regression test source. |
| `apps/api/src/modules/clinical-forms/tests/wave-c-clinical-form-version-concurrency.postgres.integration.spec.ts` | untracked | test | YES | Wave C / regression test source. |
| `apps/api/src/modules/clinical-forms/tests/wave-c-consent.postgres.integration.spec.ts` | untracked | test | YES | Wave C / regression test source. |
| `apps/api/src/modules/clinical-forms/tests/wave-c-media-owner.postgres.integration.spec.ts` | untracked | test | YES | Wave C / regression test source. |
| `apps/api/src/modules/clinical-forms/tests/wave-c-media-patient.postgres.integration.spec.ts` | untracked | test | YES | Wave C / regression test source. |
| `apps/api/src/modules/clinical-forms/tests/wave-c-permission-contract.postgres.integration.spec.ts` | untracked | test | YES | Wave C / regression test source. |
| `apps/api/src/modules/dental/application/dto/dental-material.dto.ts` | modified | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/dental/application/handlers/dental-material.handlers.ts` | modified | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/dental/controllers/dental.controller.ts` | modified | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/emr/application/services/emr-billing.service.ts` | modified | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/emr/application/services/emr-encounter.service.ts` | modified | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/emr/emr.module.ts` | modified | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/inventory/application/dto/consume-inventory.dto.ts` | modified | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/inventory/application/dto/dispose-inventory-batch.dto.ts` | modified | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/inventory/application/dto/inventory-usage.dto.ts` | untracked | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/inventory/application/dto/stock-request.dto.ts` | modified | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/inventory/application/handlers/consume-inventory.handler.ts` | modified | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/inventory/application/handlers/dispose-inventory-batch.handler.ts` | modified | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/inventory/application/handlers/get-inventory-analytics.handler.ts` | modified | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/inventory/application/handlers/stock-request.handlers.ts` | modified | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/inventory/application/services/inventory-usage-owner-report.service.ts` | untracked | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/inventory/application/services/inventory-usage-posting.service.ts` | untracked | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/inventory/controllers/inventory.controller.ts` | modified | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/inventory/domain/repositories/inventory-warehouse.repository.interface.ts` | modified | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/inventory/domain/repositories/stock-request.repository.interface.ts` | modified | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/inventory/infrastructure/audit-trail-inventory-audit-log.ts` | untracked | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/inventory/infrastructure/in-memory-inventory.repository.ts` | modified | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/inventory/infrastructure/prisma-inventory.repository.ts` | modified | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/inventory/infrastructure/prisma-inventory-warehouse.repository.ts` | modified | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/inventory/infrastructure/prisma-stock-request.repository.ts` | modified | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/inventory/inventory.module.ts` | modified | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/inventory/ports/inventory-audit-log.port.ts` | untracked | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/inventory/tests/consume-inventory.handler.spec.ts` | modified | test | YES | Wave C / regression test source. |
| `apps/api/src/modules/inventory/tests/wave-c-billing-production-path.postgres.integration.spec.ts` | untracked | test | YES | Wave C / regression test source. |
| `apps/api/src/modules/inventory/tests/wave-c-http-permission.postgres.integration.spec.ts` | untracked | test | YES | Wave C / regression test source. |
| `apps/api/src/modules/inventory/tests/wave-c-injectable.postgres.integration.spec.ts` | untracked | test | YES | Wave C / regression test source. |
| `apps/api/src/modules/inventory/tests/wave-c-inventory-accountability.postgres.integration.spec.ts` | untracked | test | YES | Wave C / regression test source. |
| `apps/api/src/modules/inventory/tests/wave-c-migration.postgres.integration.spec.ts` | untracked | test | YES | Wave C / regression test source. |
| `apps/api/src/modules/inventory/tests/wave-c-rls.postgres.integration.spec.ts` | untracked | test | YES | Wave C / regression test source. |
| `apps/api/src/modules/inventory/tests/wave-c-tenant-references.postgres.integration.spec.ts` | untracked | test | YES | Wave C / regression test source. |
| `apps/api/src/modules/media/api/media.controller.ts` | modified | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/media/application/dto/upload-media.dto.ts` | modified | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/media/application/handlers/download-media.handler.ts` | modified | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/media/application/handlers/get-media.handler.ts` | modified | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/media/application/handlers/upload-media.handler.ts` | modified | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/media/domain/entities/media-asset.entity.ts` | modified | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/media/domain/value-objects/media-category.vo.ts` | modified | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/media/infrastructure/repositories/prisma-media-asset.repository.ts` | modified | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/media/media.module.ts` | modified | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/media/services/media-owner-reference.validation.ts` | untracked | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/scheduling/application/services/appointment-lifecycle-mutation.service.ts` | modified | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/api/src/modules/scheduling/scheduling.module.ts` | modified | backend production | YES | Wave C backend production, validators, or wiring. |
| `apps/clinic-dashboard/e2e/inventory-workflows.spec.ts` | modified | test | YES | Wave C / regression test source. |
| `apps/clinic-dashboard/src/features/inventory/api/fulfill-stock-request-body.test.ts` | untracked | test | YES | Wave C / regression test source. |
| `apps/clinic-dashboard/src/features/inventory/api/fulfill-stock-request-body.ts` | untracked | dashboard production | YES | Clinic Dashboard Wave C fulfillment / related production source. |
| `apps/clinic-dashboard/src/features/inventory/api/inventory-api.fulfill.spec.ts` | untracked | test | YES | Wave C / regression test source. |
| `apps/clinic-dashboard/src/features/inventory/api/inventory-api.ts` | modified | dashboard production | YES | Clinic Dashboard Wave C fulfillment / related production source. |
| `apps/clinic-dashboard/src/features/inventory/components/AccountableStaffSelect.spec.tsx` | untracked | test | YES | Wave C / regression test source. |
| `apps/clinic-dashboard/src/features/inventory/components/AccountableStaffSelect.tsx` | untracked | dashboard production | YES | Clinic Dashboard Wave C fulfillment / related production source. |
| `apps/clinic-dashboard/src/features/inventory/hooks/useInventory.fulfill.spec.tsx` | untracked | test | YES | Wave C / regression test source. |
| `apps/clinic-dashboard/src/features/inventory/hooks/useInventory.ts` | modified | dashboard production | YES | Clinic Dashboard Wave C fulfillment / related production source. |
| `apps/clinic-dashboard/src/features/inventory/StockRequestsPage.fulfill.spec.tsx` | untracked | test | YES | Wave C / regression test source. |
| `apps/clinic-dashboard/src/features/inventory/StockRequestsPage.tsx` | modified | dashboard production | YES | Clinic Dashboard Wave C fulfillment / related production source. |
| `apps/clinic-dashboard/src/features/inventory/utils/accountable-staff-options.test.ts` | untracked | test | YES | Wave C / regression test source. |
| `apps/clinic-dashboard/src/features/inventory/utils/accountable-staff-options.ts` | untracked | dashboard production | YES | Clinic Dashboard Wave C fulfillment / related production source. |
| `apps/clinic-dashboard/src/i18n/inventory-messages.ts` | modified | i18n | YES | Dashboard accountable-staff i18n. |
| `docs/permission-matrix.json` | modified | permission/config | YES | Authoritative permission matrix / package / guard used by Wave C. |
| `docs/PHASE_48_WAVE_C_ACCEPTANCE_TEST_PLAN.md` | untracked | evidence | YES | Accepted Wave C evidence/docs that belong in the repo. |
| `docs/PHASE_48_WAVE_C_EXTERNAL_PRODUCTION_ACCEPTANCE_PRECHECK.md` | untracked | evidence | YES | Accepted Wave C evidence/docs that belong in the repo. |
| `docs/PHASE_48_WAVE_C_IMPLEMENTATION_DISCOVERY.md` | untracked | evidence | YES | Accepted Wave C evidence/docs that belong in the repo. |
| `docs/PHASE_48_WAVE_C_IMPLEMENTATION_EVIDENCE.md` | untracked | evidence | YES | Accepted Wave C evidence/docs that belong in the repo. |
| `docs/PHASE_48_WAVE_C_IMPLEMENTATION_PLAN.md` | untracked | evidence | YES | Accepted Wave C evidence/docs that belong in the repo. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/ARCHITECTURE_INVARIANT_MATRIX.md` | untracked | evidence | YES | Accepted Wave C evidence/docs that belong in the repo. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/BILLING_REGRESSION_VALIDATION.md` | untracked | evidence | YES | Accepted Wave C evidence/docs that belong in the repo. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/CHANGE_SUMMARY.md` | untracked | evidence | YES | Accepted Wave C evidence/docs that belong in the repo. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/CHANGED_FILES_MANIFEST.md` | untracked | evidence | YES | Accepted Wave C evidence/docs that belong in the repo. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/CLINICAL_FORM_DTO_VALIDATION.md` | untracked | evidence | YES | Accepted Wave C evidence/docs that belong in the repo. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/CLINICAL_FORM_PATH_QUERY_VALIDATION.md` | untracked | evidence | YES | Accepted Wave C evidence/docs that belong in the repo. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/CLINICAL_FORM_REFERENCE_VALIDATION.md` | untracked | evidence | YES | Accepted Wave C evidence/docs that belong in the repo. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/CLINICAL_FORM_VERSION_CONCURRENCY.md` | untracked | evidence | YES | Accepted Wave C evidence/docs that belong in the repo. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/DTO_VALIDATION.md` | untracked | evidence | YES | Accepted Wave C evidence/docs that belong in the repo. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/EXTERNAL_REVIEW_BLOCKER_MATRIX.md` | untracked | evidence | YES | Accepted Wave C evidence/docs that belong in the repo. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/GIT_DIFF_STAT.txt` | untracked | evidence | YES | Accepted Wave C evidence/docs that belong in the repo. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/GIT_STATUS.txt` | untracked | evidence | YES | Accepted Wave C evidence/docs that belong in the repo. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/HTTP_PERMISSION_VALIDATION.md` | untracked | evidence | YES | Accepted Wave C evidence/docs that belong in the repo. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/INJECTABLE_RBAC_VALIDATION.md` | untracked | evidence | YES | Accepted Wave C evidence/docs that belong in the repo. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/INVENTORY_ACCOUNTABILITY_VALIDATION.md` | untracked | evidence | YES | Accepted Wave C evidence/docs that belong in the repo. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/INVENTORY_HTTP_VALIDATION.md` | untracked | evidence | YES | Accepted Wave C evidence/docs that belong in the repo. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/KNOWN_LIMITATIONS.md` | untracked | evidence | YES | Accepted Wave C evidence/docs that belong in the repo. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/MEDIA_OWNER_REFERENCE_VALIDATION.md` | untracked | evidence | YES | Accepted Wave C evidence/docs that belong in the repo. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/MEDIA_PATIENT_TENANT_VALIDATION.md` | untracked | evidence | YES | Accepted Wave C evidence/docs that belong in the repo. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/MIGRATION_VALIDATION.md` | untracked | evidence | YES | Accepted Wave C evidence/docs that belong in the repo. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/OWNER_REPORT_PHI_AUTHORIZATION.md` | untracked | evidence | YES | Accepted Wave C evidence/docs that belong in the repo. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/OWNER_REPORT_VALIDATION.md` | untracked | evidence | YES | Accepted Wave C evidence/docs that belong in the repo. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/PATIENT_FORM_SIGN_VOID_AUTHORIZATION.md` | untracked | evidence | YES | Accepted Wave C evidence/docs that belong in the repo. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/PATIENT_FORM_SIGN_VOID_ROLE_CONTRACT.md` | untracked | evidence | YES | Accepted Wave C evidence/docs that belong in the repo. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/PERMISSION_CONTRACT_VALIDATION.md` | untracked | evidence | YES | Accepted Wave C evidence/docs that belong in the repo. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/PHOTO_CONSENT_UPGRADE_VALIDATION.md` | untracked | evidence | YES | Accepted Wave C evidence/docs that belong in the repo. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/RLS_VALIDATION.md` | untracked | evidence | YES | Accepted Wave C evidence/docs that belong in the repo. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/ROUTE_PERMISSION_MATRIX.md` | untracked | evidence | YES | Accepted Wave C evidence/docs that belong in the repo. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/STOCK_REQUEST_ACCOUNTABILITY_VALIDATION.md` | untracked | evidence | YES | Accepted Wave C evidence/docs that belong in the repo. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/STOCK_REQUEST_DASHBOARD_ACCOUNTABILITY.md` | untracked | evidence | YES | Accepted Wave C evidence/docs that belong in the repo. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/STOCK_REQUEST_FULFILLMENT_ATOMICITY.md` | untracked | evidence | YES | Accepted Wave C evidence/docs that belong in the repo. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/TENANT_REFERENCE_VALIDATION.md` | untracked | evidence | YES | Accepted Wave C evidence/docs that belong in the repo. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/TEST_RESULTS.md` | untracked | evidence | YES | Accepted Wave C evidence/docs that belong in the repo. |
| `docs/PHASE_48_WAVE_C_REMEDIATION_REVIEW_PACKAGE/TRANSACTION_VALIDATION.md` | untracked | evidence | YES | Accepted Wave C evidence/docs that belong in the repo. |
| `docs/PHASE_48_WAVE_C_STATIC_BYPASS_AUDIT.md` | untracked | evidence | YES | Accepted Wave C evidence/docs that belong in the repo. |
| `packages/permissions/permission-matrix.json` | modified | permission/config | YES | Authoritative permission matrix / package / guard used by Wave C. |
| `packages/permissions/src/index.ts` | modified | permission/config | YES | Authoritative permission matrix / package / guard used by Wave C. |
| `packages/permissions/src/permissions.test.ts` | modified | test | YES | Wave C / regression test source. |
