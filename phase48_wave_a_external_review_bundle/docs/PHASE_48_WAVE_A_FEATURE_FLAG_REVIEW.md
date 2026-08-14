# Phase 48 Wave A — Feature Flag / Booking Cutover Review

| Field | Value |
|-------|--------|
| **Flag helper** | `apps/api/src/modules/clinical-catalog/domain/feature-flag.helpers.ts` |
| **Flag key** | `catalog.canonical.write` on `Tenant.features` JSON |
| **HEAD** | `416c098` |

## Answers

| Question | Evidence |
|----------|----------|
| where flag is read | `ClinicalCatalogService.assertTenantWriteFlag` via `isTenantCanonicalWriteEnabled` |
| default when key missing | **enabled (`true`)** |
| operations gated | Tenant `TENANT_CUSTOM` create (and gated path for tenant custom writes); platform SYSTEM_CANONICAL not gated by this flag |
| does Appointment booking read this flag | **NO** — no clinical-catalog imports under scheduling |
| does portal booking read this flag | **NO** (Wave A surfaces do not wire portal booking to flag) |
| does missing/default state alter Appointment.serviceType | **NO** |
| canonical booking cutover activated | **NO** |
| legacy scheduling fallback preserved | **YES** (`service-types.ts` unchanged; booking path unchanged) |

## Required

```text
canonical booking cutover activated = NO
legacy scheduling fallback preserved = YES
```

## Note on default-enabled writes

Missing `catalog.canonical.write` enables **tenant catalog write foundation**, not booking cutover. This matches the Wave A implementation report. It does **not** switch appointment writes to canonical IDs.

```text
Production Acceptance blocker for booking cutover = NONE
```
