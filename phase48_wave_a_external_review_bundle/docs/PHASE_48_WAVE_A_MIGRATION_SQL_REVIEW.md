# Phase 48 Wave A — Migration SQL Review

| Field | Value |
|-------|--------|
| **Migration** | `apps/api/prisma/migrations/20260814010000_phase48_wave_a_clinical_catalog/migration.sql` |
| **HEAD** | `416c098` |

## Created enums

```text
ClinicalServiceProvenance
ClinicalServiceLifecycle
ClinicalServiceDomain
ClinicalPricingUnit
ClinicalPriceVersionStatus
LegacyClinicalMappingStatus
```

## Created tables

```text
canonical_clinical_service_definitions
clinical_service_translations
clinical_service_aliases
tenant_service_presentation_overrides
tenant_service_configurations
clinical_service_price_versions
legacy_clinical_service_mappings
legacy_clinical_price_mappings
```

## Indexes / partial unique indexes

| Index | Purpose |
|-------|---------|
| `tenant_service_configurations_tenant_default_uidx` | UNIQUE (tenantId, clinicalServiceId) WHERE branchId IS NULL |
| `tenant_service_configurations_tenant_branch_uidx` | UNIQUE (tenantId, clinicalServiceId, branchId) WHERE branchId IS NOT NULL |
| `clinical_service_price_versions_draft_tenant_default_uidx` | UNIQUE DRAFT commercial key (tenant default) |
| `clinical_service_price_versions_draft_branch_uidx` | UNIQUE DRAFT commercial key (branch) |
| `legacy_clinical_service_mappings_platform_uidx` | UNIQUE (sourceSystem, sourceCode) WHERE tenantId IS NULL |
| `legacy_clinical_service_mappings_tenant_uidx` | UNIQUE (tenantId, sourceSystem, sourceCode) WHERE tenantId IS NOT NULL |
| plus lookup indexes | provenance/lifecycle, effective price lookup, etc. |

## FKs

All new FKs use `ON DELETE RESTRICT ON UPDATE CASCADE` to tenants/branches/canonical definitions/service_prices.

## CHECK constraints

```text
canonical: provenance↔tenantId
canonical: stableKey prefix by provenance
price versions: effectiveTo IS NULL OR effectiveTo > effectiveFrom
```

## Triggers / functions

```text
NONE
```

## Data backfill SQL in migration

```text
NONE — backfill is application tooling (phase48-wave-a-backfill.mjs)
```

## Legacy objects touched

```text
service_prices referenced by FK from legacy_clinical_price_mappings (additive)
Appointment.serviceType not altered
ServicePrice table not altered/dropped
```

## DROP / destructive ALTER scan

```text
DROP statements = 0
ALTER TABLE ... DROP = 0
UPDATE of historical rows = 0
TRUNCATE = 0
```

## Required conclusions

```text
migration additive only = YES
legacy ServicePrice dropped = NO
Appointment.serviceType dropped = NO
historical rows destructively rewritten = NO
tenant standard clones created = NO
```

```text
unexpected destructive SQL = NONE
Production Acceptance blocker from migration SQL = NONE
```
