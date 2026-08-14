# Phase 48 Wave A — UI Review

| Field | Value |
|-------|--------|
| **HEAD** | `416c098` |

## Super Admin

| Surface | Path / file | Status |
|---------|-------------|--------|
| SYSTEM_CANONICAL management | `/clinical-catalog` → `ClinicalCatalogPage.tsx` | present |
| AR/EN management | create form EN+AR display names | present |
| Separate from Healthcare Catalog | `/catalog` untouched as clinical SoR | confirmed |

## Clinic Dashboard

| Surface | Path / file | Status |
|---------|-------------|--------|
| Canonical + custom listing | `/settings/clinical-services` | present |
| TENANT_CUSTOM creation | create form with tenant.* stable key suffix | present |
| tenant enablement | upsert config enabled true/false | present |
| branch enablement UI | tenant-default focused; branchId optional in API | functional foundation (branch override primarily via pricing page/API) |
| tenant default pricing | `/billing/clinical-pricing` | present |
| branch pricing override | clinical pricing accepts branchId | present |
| price history | version list on clinical pricing page | present |
| legacy ServicePrice UI | `/billing/pricing` preserved | confirmed |

## Cloning check

```text
tenant pricing/config clones SYSTEM_CANONICAL definition rows = NO
enable/config/price reference clinicalServiceId only
```

## Explicit incompleteness

```text
P1-08 full Arabic search/RTL quality = NOT COMPLETE
P1-02 full pricing applicability = NOT COMPLETE
```
