# Phase 48 Wave A — API Surface Review

| Field | Value |
|-------|--------|
| **HEAD** | `416c098` |

## Platform — `/platform/clinical-catalog`

| Method | Path | Permission | Scope | Handler |
|--------|------|------------|-------|---------|
| GET | `/platform/clinical-catalog/services` | `clinical_catalog.admin` | platform | ClinicalCatalogService.listServices |
| POST | `/platform/clinical-catalog/services` | `clinical_catalog.admin` | platform SYSTEM_CANONICAL | createDraft |
| GET | `/platform/clinical-catalog/services/:id` | `clinical_catalog.admin` | platform | getService |
| PATCH | `/platform/clinical-catalog/services/:id` | `clinical_catalog.admin` | DRAFT only | updateDraft |
| POST | `/platform/clinical-catalog/services/:id/publish` | `clinical_catalog.admin` | lifecycle | publish |
| POST | `/platform/clinical-catalog/services/:id/deprecate` | `clinical_catalog.admin` | lifecycle | deprecate |
| POST | `/platform/clinical-catalog/services/:id/inactivate` | `clinical_catalog.admin` | lifecycle | inactivate |

## Tenant — `/clinical-catalog/services`

| Method | Path | Permission | Scope |
|--------|------|------------|-------|
| GET | `/clinical-catalog/services` | api.clinical-catalog view | shared canonical + own TENANT_CUSTOM |
| POST | `/clinical-catalog/services` | create | TENANT_CUSTOM forced |
| GET | `/clinical-catalog/services/:id` | view | isolation checked |
| PATCH | `/clinical-catalog/services/:id` | update | DRAFT TENANT_CUSTOM only |
| POST | `.../publish` | manage | lifecycle |
| POST | `.../deprecate` | manage | lifecycle |
| POST | `.../inactivate` | manage | lifecycle |

## Tenant — `/clinical-catalog/configs`

| Method | Path | Permission |
|--------|------|------------|
| GET | `/clinical-catalog/configs` | view |
| GET | `/clinical-catalog/configs/effective` | view |
| PUT | `/clinical-catalog/configs` | update |
| PATCH | `/clinical-catalog/configs/:id/enabled` | manage |

## Tenant — `/clinical-catalog/prices`

| Method | Path | Permission |
|--------|------|------------|
| GET | `/clinical-catalog/prices` | api.billing view |
| GET | `/clinical-catalog/prices/lookup` | api.billing view (fail closed) |
| POST | `/clinical-catalog/prices/drafts` | api.billing manage |
| POST | `/clinical-catalog/prices/:id/publish` | manage |
| POST | `/clinical-catalog/prices/:id/supersede` | manage |
| POST | `/clinical-catalog/prices/:id/inactivate` | manage |

## Hard-delete

```text
@Delete routes in clinical-catalog module = NONE
hard-delete API for published/referenced history = NO
historical mutation risk on publish = supersede prior ACTIVE (status transition), not in-place commercial rewrite of published amounts
```
