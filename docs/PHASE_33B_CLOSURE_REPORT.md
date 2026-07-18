# Phase 33b Closure Report — Dynamic Reporting Provider & Integration

**Phase:** 33b (Provider & client integration only)  
**Date:** 2026-07-14  
**Status:** **CLOSED**  
**SSOT:** `docs/DYNAMIC_REPORTING_ARCHITECTURE.md` (architecture frozen; Phase 33c not started)

---

## 1. Executive Summary

Phase **33b** is complete. The clinic dashboard now has a registry-driven reporting configuration pipeline:

```
EffectiveModuleView → reporting contributions → STATIC_REPORT_CATALOG → DynamicReportingProvider → existing Reporting UI → existing APIs
```

Reporting pages consume `useDynamicReporting()` for catalog metadata, capability flags, and template visibility. Report execution, APIs, analytics, search, dashboard, navigation, and routing remain unchanged.

**Critical constraint honored:** Configuration source migration only — no rendering rewrite, no API rewrite, no Playwright, no production closure.

---

## 2. Files Created

### Dynamic reporting feature

- `apps/clinic-dashboard/src/features/dynamic-reporting/context/DynamicReportingProvider.tsx`
- `apps/clinic-dashboard/src/features/dynamic-reporting/lib/reporting-types.ts`
- `apps/clinic-dashboard/src/features/dynamic-reporting/lib/reporting-resolver.ts`
- `apps/clinic-dashboard/src/features/dynamic-reporting/lib/reporting-snapshot-builder.ts`
- `apps/clinic-dashboard/src/features/dynamic-reporting/lib/reporting-cache.ts`
- `apps/clinic-dashboard/src/features/dynamic-reporting/lib/static-report-flags.ts`
- `apps/clinic-dashboard/src/features/dynamic-reporting/lib/reporting-validation.ts`
- `apps/clinic-dashboard/src/features/dynamic-reporting/lib/report-template-adapter.ts`
- `apps/clinic-dashboard/src/features/dynamic-reporting/ReportingProviderShell.tsx`
- `apps/clinic-dashboard/src/features/dynamic-reporting/dynamic-reporting.spec.ts`
- `apps/clinic-dashboard/src/features/dynamic-reporting/dynamic-reporting-rollback.spec.ts` *(final remediation)*
- `apps/clinic-dashboard/src/features/dynamic-reporting/dynamic-reporting-provider.spec.ts` *(final remediation)*

### Documentation

- `docs/PHASE_33B_CLOSURE_REPORT.md` (this file)

---

## 3. Files Modified

- `apps/clinic-dashboard/src/features/reporting/ReportingHomePage.tsx` — reads snapshot templates + provider capabilities
- `apps/clinic-dashboard/src/features/reporting/ReportCategoryPage.tsx` — reads `templatesByCategory`
- `apps/clinic-dashboard/src/features/reporting/ReportBuilderPage.tsx` — reads generate templates from snapshot
- `apps/clinic-dashboard/src/features/reporting/ExportCenterPage.tsx` — reads provider capability flags
- `apps/clinic-dashboard/src/features/reporting/ReportDetailPage.tsx` — reads provider capability flags
- `apps/clinic-dashboard/src/features/reporting/components/ReportCategoryNav.tsx` — reads snapshot categories
- `apps/clinic-dashboard/src/features/reporting/lazy-reporting-routes.tsx` — wraps pages with `ReportingProviderShell`
- `apps/clinic-dashboard/src/features/module-registry/lib/clear-registry-caches.ts` — adds `clearReportingCache()`

- `docs/DYNAMIC_REPORTING_ARCHITECTURE.md`
- `docs/DYNAMIC_MODULE_MANAGEMENT_ARCHITECTURE.md`
- `docs/CURRENT_SYSTEM_AUDIT_AND_EXPLANATION.md`
- `docs/PRODUCTION_REMEDIATION_VERIFICATION.md`

---

## 4. Provider Architecture

`DynamicReportingProvider` mirrors Phase 32b search provider pattern:

| Responsibility | Implementation |
|----------------|----------------|
| Consume EffectiveModuleView | via `useModuleRegistry().modules` |
| Build snapshot | `buildRegistryReportingSnapshot()` / `buildStaticReportingSnapshot()` |
| Fail-closed loading | last snapshot → identity cache → registry cache → restricted snapshot |
| Rollback | `VITE_USE_STATIC_REPORTING_ONLY=true` bypasses registry |
| Hooks | `useDynamicReporting()`, `useOptionalDynamicReporting()` |
| Refresh | `refresh()` clears reporting cache + registry refresh |
| Context | snapshot, templates, categories, hubs, capabilities, source, registryStatus |

Mounting: page-local via `ReportingProviderShell` on all reporting routes (home, category, builder, export, detail).

---

## 5. Reporting Snapshot

Immutable `ReportSnapshot` includes:

- **Identity:** tenantId, userId, rolesHash
- **Templates:** 40 user-facing entries (filtered by EffectiveModuleView or static RBAC)
- **Hubs:** catalog, builder, export-center (when accessible)
- **Categories:** derived from included templates
- **Lookups:** deepLinkByReportId, labelKeyByReportId, providerKeyByReportId
- **Capabilities:** canViewReporting, canCreateReports, canExportReports (data-driven per §8.5.1)
- **Metadata:** source, catalogGeneration, entitlementVersion, enabledModuleIds

---

## 6. Cache Design

Identity-scoped in-memory cache (`reporting-cache.ts`):

| Dimension | Included |
|-----------|----------|
| tenantId | ✓ |
| userId | ✓ |
| rolesHash | ✓ |
| catalogGeneration | ✓ |
| entitlementVersion | ✓ |
| moduleCount | ✓ |
| source | ✓ |

Cleared via `clearModuleRegistryCaches()` on login/logout/identity change/registry refresh.

---

## 7. Integration Summary

| Surface | Change |
|---------|--------|
| `ReportingHomePage` | `useDynamicReporting()` templates + capabilities; favorites/recents resolve via snapshot |
| `ReportCategoryPage` | `templatesByCategory[categoryId]` |
| `ReportBuilderPage` | generate templates from snapshot |
| `ExportCenterPage` | provider `canExportReports` / `canViewReporting` |
| `ReportDetailPage` | provider capability flags |
| `ReportCategoryNav` | snapshot categories (non-empty only) |

Legacy `REPORT_TEMPLATES` / `reporting-config.ts` remain for rollback static path and existing unit tests — not removed.

---

## 8. Capability Resolution

Derived from resolved snapshot per architecture §8.5.1:

- **canViewReporting:** accessible templates ∪ hubs length > 0
- **canCreateReports:** ∃ template with `delivery === 'generate'` AND `permissionAction === 'create'`
- **canExportReports:** ∃ entry with `permissionAction === 'export'` OR `delivery === 'export'`

Registry mode: gates on EffectiveModuleView only (no client RBAC).  
Static rollback: gates on `hasPermission(roles, resource, action)`.

---

## 9. Test Results (exact counts)

### `@booking/clinic-dashboard`

- **Test files:** 92 passed
- **Tests:** **380 passed** (+23 dynamic-reporting tests across 5 files; includes rollback + provider specs from final remediation)

### `@booking/module-registry`

- **Tests:** **53 passed** (unchanged)

No tests skipped. No weakened assertions. No `test.only`.

---

## 10. Documentation Updated

- `docs/DYNAMIC_REPORTING_ARCHITECTURE.md` — 33b marked CLOSED; deliverables annotated IMPLEMENTED
- `docs/DYNAMIC_MODULE_MANAGEMENT_ARCHITECTURE.md` — §9.10 + §27 updated
- `docs/CURRENT_SYSTEM_AUDIT_AND_EXPLANATION.md` — Phase 33 status ~90%
- `docs/PRODUCTION_REMEDIATION_VERIFICATION.md` — §20.7 added

---

## 11. Honest Completion Percentage

- **Phase 33b (provider + integration): 100%**
- **Phase 33 overall:** ~90% (33c Playwright + production closure not started)

---

## 12. Remaining Technical Debt (33c scope)

- Playwright acceptance (`e2e/dynamic-reporting.spec.ts`)
- Playwright rollback server (port 5176)
- Search ↔ reporting deep-link alignment
- Production closure documentation

---

## 13. Explicitly NOT Done

Per mission constraints, **not implemented**:

- Playwright / runtime acceptance
- Production closure records
- Reporting API changes
- Database/schema changes
- Report execution changes
- Analytics / search / dashboard / navigation / routing changes
- Marketplace / Plugin SDK

---

**Phase 33b is permanently closed. Phase 33c is authorized but has NOT started. Runtime reporting behavior remains functionally identical for end users — only the configuration source changed. Runtime acceptance belongs to Phase 33c.**
