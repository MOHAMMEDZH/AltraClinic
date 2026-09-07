# Phase 48 Wave A — Schema Review Evidence

| Field | Value |
|-------|--------|
| **Source** | `apps/api/prisma/schema.prisma` |
| **HEAD** | `416c098` |
| **Scope** | P0-01 / P0-07 / P1-01 / AR-01..04 / AR-18 |

## Model inventory

### CanonicalClinicalServiceDefinition

| Aspect | Actual |
|--------|--------|
| actual model name | `CanonicalClinicalServiceDefinition` → `canonical_clinical_service_definitions` |
| scope | Platform (`SYSTEM_CANONICAL`, `tenantId=null`) or tenant (`TENANT_CUSTOM`) |
| identity | `stableKey` globally unique; `id` UUID PK |
| FKs | `tenantId` → `tenants` ON DELETE Restrict (nullable) |
| unique | `@@unique([stableKey])` |
| indexes | provenance+lifecycle; tenantId+lifecycle; domain+lifecycle |
| lifecycle | `ClinicalServiceLifecycle`: DRAFT/PUBLISHED/DEPRECATED/INACTIVE |
| delete policy | Restrict on children; no soft-delete field; hard-delete not exposed in Wave A API |
| audit fields | publishedAt/By, deprecatedAt/By, inactivatedAt/By, createdAt, updatedAt |
| migration relationship | created in `20260814010000_phase48_wave_a_clinical_catalog` |

**DB CHECK (SQL migration, not Prisma):** provenance↔tenantId; stableKey prefix `canonical.%` / `tenant.%`.

### ClinicalServiceTranslation

| Aspect | Actual |
|--------|--------|
| actual model name | `ClinicalServiceTranslation` |
| identity | `(clinicalServiceId, locale)` unique |
| FKs | clinicalServiceId → CanonicalClinicalServiceDefinition Restrict |
| delete policy | Restrict |

### ClinicalServiceAlias

| Aspect | Actual |
|--------|--------|
| actual model name | `ClinicalServiceAlias` |
| identity | no unique on alias text (search-only) |
| FKs | clinicalServiceId Restrict |
| note | never identity-bearing |

### TenantServicePresentationOverride

| Aspect | Actual |
|--------|--------|
| actual model name | `TenantServicePresentationOverride` |
| unique | `(tenantId, clinicalServiceId, locale)` |
| purpose | display-only |

### TenantServiceConfiguration

| Aspect | Actual |
|--------|--------|
| actual model name | `TenantServiceConfiguration` |
| scope | tenant default (`branchId=null`) or branch override |
| FKs | tenantId, branchId?, clinicalServiceId — all Restrict |
| Prisma unique | **none** (NULL-safe uniqueness in SQL only) |
| SQL unique | partial unique indexes (see Migration SQL review) |
| branch↔tenant same-tenant | **application-enforced only** (`assertBranchBelongsToTenant`) |

### ClinicalServicePriceVersion (PriceVersion)

| Aspect | Actual |
|--------|--------|
| actual model name | `ClinicalServicePriceVersion` |
| commercial key fields | tenantId, branchId?, clinicalServiceId, serviceVariantId?, pricingUnit, currency |
| status | DRAFT/ACTIVE/SUPERSEDED/INACTIVE |
| append-only semantics | application: published not rewritten in place; new versions via draft→publish |
| overlap race safety | application advisory lock + re-check (see Price Concurrency review) |
| Prisma unique | none for ACTIVE ranges; SQL partial unique for DRAFT commercial keys |
| branch↔tenant | **application-enforced only** |

### LegacyClinicalServiceMapping / LegacyClinicalPriceMapping

| Aspect | Actual |
|--------|--------|
| statuses | MAPPED / LEGACY_UNMAPPED / AMBIGUOUS |
| ServicePrice FK | LegacyClinicalPriceMapping.servicePriceId unique → service_prices Restrict |
| ServicePrice model | **preserved** (not dropped/renamed) |

## Invariant verification

| Invariant | Enforcement |
|-----------|-------------|
| SYSTEM_CANONICAL shared across tenants | YES — `tenantId` null + shared stableKey; DB CHECK |
| TENANT_CUSTOM requires tenant ownership | YES — DB CHECK provenance↔tenantId |
| canonical namespace protected | YES — DB CHECK stableKey prefix + application validateStableKeyNamespace |
| duplicate translation locale prevented | YES — UNIQUE (clinicalServiceId, locale) |
| duplicate tenant-default config prevented | YES — SQL partial unique WHERE branchId IS NULL |
| duplicate branch config prevented | YES — SQL partial unique WHERE branchId IS NOT NULL |
| branch belongs to same tenant | **application-only** (no composite FK) |
| cross-tenant custom/config/price linkage denied | **application-only** (`assertServiceReadable` / tenantId filters); no RLS on Wave A tables |
| legacy ServicePrice preserved | YES — model remains |
| Appointment.serviceType preserved | YES — `Appointment.serviceType` still in schema (`String?`) |

## RLS

```text
Wave A clinical-catalog tables RLS policies in this migration = NONE
Platform bypass transactions used by services = YES (withPlatformBypass)
Tenant isolation relies on application tenantId scoping = YES
```
