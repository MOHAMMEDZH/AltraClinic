# Phase 48 — Target Domain Architecture

| Field | Value |
|-------|--------|
| **Stage** | Target Domain Architecture — architecture-review artifact promoted under accepted Freeze SSOT |
| **Historical origin** | Authored during Architecture Review (companion: `docs/PHASE_48_ARCHITECTURE_REVIEW.md`) |
| **Current authority** | Governed by Freeze SSOT: `docs/PHASE_48_ARCHITECTURE_FREEZE.md` (this document is **not** a competing SSOT) |
| **Implementation** | GOVERNED BY FREEZE SSOT — Wave A authorized; Waves B–I not yet authorized; PA-04 Option B ACCEPTED AND FROZEN; PA-04 implementation AUTHORIZED NEXT |
| **Phase 49** | NOT AUTHORIZED |

Conceptual models only. Exact Prisma names may vary at Freeze/implementation.
Does **not** claim PA-04 implementation complete, tests complete, or Production Acceptance.

---

## 1. CanonicalClinicalServiceDefinition (shared) + TENANT_CUSTOM

```text
CanonicalClinicalServiceDefinition
    ↓
TenantServiceConfiguration
    ↓
Tenant/Branch PriceVersion
```

**HealthcareCatalog ≠ Clinical Service Catalog.**

| Provenance | Scope | Ownership | Stable key namespace |
|------------|-------|-----------|---------------------|
| `SYSTEM_CANONICAL` | Platform/shared clinical catalog | Platform clinical catalog admin | `canonical.<domain>.<key>` (global unique) |
| `TENANT_CUSTOM` | Tenant only | Tenant catalog.admin | `tenant.<tenantId>.custom.<key>` (unique within tenant; **cannot** collide with canonical namespace) |

### Cross-tenant rule (standard services)

```text
Clinic A SYSTEM_CANONICAL identity == Clinic B SYSTEM_CANONICAL identity
Commercial configuration (TenantServiceConfiguration + PriceVersion) differs by tenant/branch
```

### Tenant custom rule

```text
scope = tenant only
no cross-tenant semantic equivalence assumed
must not silently replace or duplicate a known SYSTEM_CANONICAL service
```

### What a clinic may do

- enable/disable a canonical service via TenantServiceConfiguration
- optional **display-only** presentation override (never changes identity)
- configure duration/resource behavior
- set tenant/branch PriceVersion
- create explicit TENANT_CUSTOM when genuinely needed

### What a clinic must NOT do

- duplicate a SYSTEM_CANONICAL definition merely to set a different price
- use free-text as service identity for new canonical bookings

### Conceptual fields (definition)

```text
id
stableKey                 # immutable after publish; namespace by provenance
provenance                # SYSTEM_CANONICAL | TENANT_CUSTOM
tenantId?                 # null for SYSTEM_CANONICAL; required for TENANT_CUSTOM
status                    # DRAFT | PUBLISHED | DEPRECATED | INACTIVE
categoryId
clinicalDomain            # DENTAL | AESTHETIC | DERM | GENERAL | OTHER
specialtyRef              # optional platform specialty key (not HealthcareCatalog as procedure)
defaultDurationMin
bookingEligible
requiresConsent
requiresClinicalRecord
requiresInjectableTraceability
requiresPhotoConsent
defaultPricingUnit
createdAt / updatedAt / publishedAt
```

### Policies

| Policy | Rule |
|--------|------|
| Stable key | Immutable after PUBLISHED; no reuse of retired keys; TENANT_CUSTOM cannot use `canonical.*` namespace |
| Rename | Translations / tenant presentation override; stableKey unchanged |
| Deprecate | DEPRECATED; bookable=false via config; history intact |
| Delete | Hard delete **forbidden** after any snapshot/reference |
| Marketing alias | Alias table; **never** identity |
| Variants | ServiceVariant under definition for body-area / presentation |

### ServiceCategory / ServiceVariant / DentalApplicability

Unchanged intent: hierarchical categories; variants for area/presentation; dental applicability flags — **do not** replace odontogram or TreatmentPlanItem toothNumbers.

### Legacy vs new workflow (clarification)

| Record class | Rule |
|--------------|------|
| Historical dental/beauty rows | `clinicalServiceId` may remain **nullable / unmapped** (`LEGACY_UNMAPPED`) |
| New bookings (canonical write ON) | **Must** use CanonicalClinicalServiceDefinition identity — free-text identity **FORBIDDEN** |
| New treatment-plan booking links | Use canonical identity where workflow requires a bookable service |
| New aesthetic catalog-managed treatments | Link canonical identity; free-text remains note/history only |

---

## 2. Localization (AR-02)

```text
ClinicalServiceTranslation { serviceId, locale, name, description }
ClinicalServiceAlias { serviceId, locale, alias, kind=SEARCH|MARKETING }
TenantServicePresentationOverride? { tenantId, serviceId, locale, displayName?, displayDescription? }  # display-only
```

Locales: `ar`, `en` (map to ar-SY / en-US at UI).  
Fallback: tenant override → canonical translation → tenant locale → en → stableKey.  
**Duplicate language definition rows = FORBIDDEN.**

---

## 3. TenantServiceConfiguration / PriceVersion (AR-03/04)

```text
TenantServiceConfiguration
  tenantId
  clinicalServiceId          # SYSTEM_CANONICAL or TENANT_CUSTOM id
  enabled
  branchId?                  # null = tenant default
  defaultDurationOverride?
  requiresResourceTypes[]
  bookingVisibleOnPortal

PriceVersion
  tenantId
  branchId?                  # null = tenant default; branch overrides tenant
  clinicalServiceId          # same shared identity — no definition copy
  (optional) serviceVariantId
  pricingUnit
  currency
  unitPrice
  taxPercent?
  effectiveFrom              # authoritative commercial start
  effectiveTo?               # optional immutable explicit terminal bound
  status                     # DRAFT | SCHEDULED | ACTIVE | SUPERSEDED | INACTIVE
  publishedAt?
  publishedBy?
  supersededAt?              # operational evidence; NOT commercial boundary
  inactivatedAt?             # ACTIVE→INACTIVE commercial withdrawal boundary
  # activation evidence: audit-backed / operational (activatedAt conceptual);
  # physical column not required by freeze if audit trail proves first ACTIVE entry
```

**Commercial key:** tenantId + branchId/default + clinicalServiceId + pricingUnit + currency + serviceVariantId/default.

**ACTIVE cardinality:** persisted 0..1 per commercial key; successful live resolution requires exactly one interval-valid ACTIVE after due/terminal reconciliation.

**SCHEDULED:** published immutable future commitment; not live before reconciliation; due SCHEDULED must reconcile before successful live commercial price return; stale predecessor success after successor.effectiveFrom = FORBIDDEN.

**Overlap / interval validation:** no two ACTIVE overlapping ranges; explicit finite published intervals non-overlapping; bidirectional / insertion-order-independent validation (predecessor + successor); contiguous boundaries allowed; uncontrolled duplicate effectiveFrom rejected (controlled replace under lock only).

**Historical commercialEnd:** earliest applicable among {explicit effectiveTo, next effectiveTimelineMember.effectiveFrom, inactivatedAt}; canceled-never-effective does not contribute; published commercial fields never rewritten.

**Terminal cause:** successor → SUPERSEDED; explicitTo expiry without successor or ACTIVE→INACTIVE → INACTIVE-after-effective (semantic subclass of INACTIVE); canceled-before-effective → INACTIVE-never-effective.

**Concurrency:** same-key `pg_advisory_xact_lock` + post-lock re-read for publish/schedule/cancel/replace/reconcile.

**Lookup:** branch override → tenant default → fail closed if none (after due/terminal reconciliation; ACTIVE status alone insufficient).

**Clinic A ≠ Clinic B price:** different tenant PriceVersions on the **same** SYSTEM_CANONICAL `clinicalServiceId`.

**PA-04 Option B:** ACCEPTED AND FROZEN (`docs/PHASE_48_ARCHITECTURE_FREEZE_AMENDMENT_PA04_PROPOSAL.md`).

---

## 4. Pricing units (P1-02)

| Unit | Typical domains | Invalid with |
|------|-----------------|--------------|
| PER_SESSION / PER_VISIT | General, aesthetic sessions | — |
| PER_TOOTH / PER_SURFACE / PER_QUADRANT / PER_ARCH | Dental | aesthetic body-area-only services |
| PER_AREA | Aesthetic/laser | tooth-only dental |
| PER_UNIT | Injectables (by unit/ml) | — |
| PER_COURSE / PER_PACKAGE | Courses | single-session-only services without course |

Validation matrix enforced at PriceVersion publish and booking.

---

## 5. AppointmentServiceSnapshot (AR-05) — append-only revisions

```text
AppointmentServiceSnapshotRevision
  id
  appointmentId
  revisionNumber              # 1..n append-only
  previousRevisionId?
  clinicalServiceId?          # null if LEGACY_UNMAPPED
  stableKey
  displayNameAr / displayNameEn
  tenantServiceConfigurationId?
  priceVersionId?
  pricingUnit
  quantity
  currency
  unitPrice
  taxPercent?
  lineBasisAmount
  commercialReason?           # e.g. complimentary zero
  changeReason?               # required when revision > 1
  actorId
  capturedAt
  changeCommandContext?
```

```text
Appointment.effectiveSnapshotRevisionId → current revision
```

| Rule | Decision |
|------|----------|
| Initial revision | Created **atomically** with successful booking (revision 1) |
| In-place mutation of identity/price/currency/unit/qty/tax/display | **FORBIDDEN** |
| Pre-CONFIRMED service/price change | Creates **new** revision; prior revisions unchanged |
| Commercial lock state | **CONFIRMED** — global, **not** tenant-configurable |
| Post-CONFIRMED | Ordinary edits cannot change service/price; audited correction workflow only |
| Time-only reschedule | **Does not reprice** / does not create price revision |
| Invoice | Uses **effective snapshot revision** — never live PriceVersion lookup for history |
| Zero price | Allowed only when snapshot explicitly records it + commercial reason |
| New canonical booking free-text identity | **FORBIDDEN** when canonical write ON |

---

## 6. ProviderServiceEligibility (AR-07) — fail closed

```text
tenantId
providerUserId
clinicalServiceId
branchId?
specialtyRequirementRef?
active
effectiveFrom / effectiveTo?
```

| Mode | Behavior |
|------|----------|
| `booking.eligibility.enforcement` **OFF** | Legacy behavior preserved (bounded compatibility) |
| **ON** | **Default DENY**. Zero active rows ⇒ booking **denied**; portal **excludes** provider. Expired/inactive/branch mismatch/cross-tenant ⇒ **DENY**. |
| Activation | Requires readiness coverage report (providers × enabled services); no accidental mixed semantics |
| Emergency bypass | **None silent** |

Booking + portal slot search must enforce when ON. Encode by display name = FORBIDDEN.

---

## 6A. Scheduling concurrency (AR-06) — authoritative primitive

**Authoritative:** transaction-scoped **PostgreSQL advisory locks** on deterministic keys + overlap re-check under lock + commit iff conflict-free.  
**EXCLUDE:** optional defense-in-depth only.

```text
keys = { tenant+provider, tenant+resource[, branch material] }
sort(keys) → lock in order → re-query overlap → reject or insert/update → commit
```

Slot-consuming statuses: `PENDING`, `CONFIRMED`, `CHECKED_IN`, `IN_PROGRESS`.  
Non-consuming for future overlap: `CANCELLED`, soft-deleted, `COMPLETED`, `NO_SHOW`.  
Idempotency keys ≠ locking (both required).

---

## 7. ServiceResourceRequirement

```text
clinicalServiceId
resourceType required (ROOM|EQUIPMENT|OPERATORY)
optional quantity/constraints
```

Appointment allocation must satisfy or fail.

---

## 8. TreatmentPlan ↔ Appointment (AR-08)

```text
TreatmentPlanItemAppointment
  planItemId
  appointmentId
  linkRole
  sortOrder
```

Rules: dependencies on items remain plan-owned; appointment completion can mark items COMPLETED via explicit clinical command; cancel/reschedule does not auto-cancel plan items; snapshots stay appointment-specific.

---

## 9. Consent / forms (AR-09 / AR-10 / P1-09)

```text
ClinicalFormTemplate { tenantId?, kind, stableKey, status }
ClinicalFormVersion { templateId, version, localeContents[], immutable after PUBLISHED }
PatientFormInstance { patientId, versionId, appointmentId?, serviceId?, signedAt, signer, method, status }
```

Kinds include: CONSENT, PHOTO_CONSENT, TREATMENT_CONSENT, INTAKE, PRE_CARE, POST_CARE.  
**Single architecture.** Photo consent does not create a second SoR.  
Required-before-treatment: gating rule by ClinicalService flags + kind.

---

## 10. Injectable/clinical usage specialization (AR-11 / AR-20 / INV-B02)

```text
InventoryUsageLedger = single authoritative accountable usage ledger
InventoryBatch = single batch SoR
```

Injectable/aesthetic clinical detail (dose, site, treatment refs) is a **typed extension / projection / 1:1 specialization** of the same `InventoryUsageLedger` event.

```text
separate ProductBatchUsage consumption ledger = NO
stock decrement authority = InventoryStockMovement / Inventory domain
```

If a compatibility name `ProductBatchUsage` appears in implementation, it must not independently decrement stock.

---

## 11. OPERATORY resource (AR-12)

Extend enum: `ROOM | EQUIPMENT | OPERATORY`. Branch-owned SchedulingResource. Concurrency same as P0-03. Maintenance via AvailabilityException (P1-11).

---

## 12. TreatmentCourse (AR-13)

```text
TreatmentCourse { patient, clinicalService, plannedSessions, intervalMin/Max, packagePriceVersionId?, status }
CourseSession { courseId, sequence, appointmentId?, status PLANNED|BOOKED|COMPLETED|SKIPPED|CANCELLED }
```

Cross-specialty reusable. No silent auto-book.

---

## 13. DeviceTreatmentRecord (AR-14)

```text
deviceId / deviceType
clinicalServiceId
bodyArea?
parameterPayload (JSON)
parameterSchemaKey
patientId, providerId, branchId, recordedAt
beautyAnnotationId? / encounterId?
```

Schema registry validates per deviceType later — no giant unsafe enum of medical settings.

---

## 14. Dermatology (AR-15)

**Decision:** No `DermatologyRecord` EMR.  
Use: Encounter + clinical notes/diagnoses + MediaAsset + ClinicalService (derm category) + forms. BeautyRecord stays anatomy/injectable map for aesthetics.

---

## 15. DentalLabCase (AR-16)

```text
patientId, providerId, planItemId?, labVendor, caseType, tooth/arch, shade/specs,
sentAt, expectedAt, receivedAt, status, mediaAttachments[], notes, costRef?
```

No duplicate procurement engine.

---

## 16. Recall (AR-17) vs reminders

```text
RecallRule { tenantId, clinicalServiceId?, intervalDays, eligibilityExpr, active }
PatientRecallInstance { patientId, ruleId, dueAt, status DUE|SNOOZED|BOOKED|COMPLETED|OPTED_OUT, lastQualifyingServiceAt }
```

Notifications deliver; journey registry may orchestrate but **RecallRule is operational SoR**.

---

## 17. Waitlist auto-fill (P1-10)

```text
on Appointment CANCELLED → select OPEN waitlist candidates by rules
→ offer with TTL (notify)
→ first valid accept wins under concurrency locks
→ timeout expires offer
```

**Default:** no auto-book without tenant policy flag.

---

## 18. AvailabilityException (P1-11)

Types: PROVIDER_LEAVE, BRANCH_HOLIDAY, RESOURCE_MAINTENANCE, EXTRA_AVAILABILITY.  
Precedence: exception deny > weekly open; EXTRA adds slots. Timezone = branch/tenant policy.

---

## 19. Ownership / authorization / audit matrix

| Concept | Scope | Write authz (conceptual) | Audit | Lifecycle |
|---------|-------|--------------------------|-------|-----------|
| CanonicalClinicalServiceDefinition (SYSTEM_CANONICAL) | platform/shared clinical catalog — **not** HealthcareCatalog | platform clinical catalog admin | YES | draft→published; no hard delete if referenced |
| ClinicalService (TENANT_CUSTOM) | tenant | tenant catalog.admin | YES | draft→published; namespace `tenant.<id>.custom.*` |
| ServiceCategory / Variant | platform for canonical; tenant for custom | matching catalog admin | YES | soft |
| Translation/Alias | follows definition ownership | matching catalog admin | YES | mutable with audit; snapshots freeze display |
| Tenant presentation override | tenant | tenant catalog.admin | YES | display-only |
| TenantServiceConfiguration | tenant/branch | catalog.admin / branch.admin | YES | soft |
| PriceVersion | tenant/branch | billing.price.admin | YES | append-only publish |
| AppointmentServiceSnapshot revision | appointment | system on book/change/correction | YES create revision | append-only; never overwrite identity/price fields |
| ProviderServiceEligibility | tenant/branch | staffing.admin | YES | soft + effective dates; enforcement fail-closed |
| ServiceResourceRequirement | follows service definition | catalog.admin | YES | soft |
| ClinicalFormTemplate/Version | tenant (or platform pack) | clinical.forms.admin | YES publish | version immutable |
| PatientFormInstance | patient | clinical staff / portal patient | YES sign/withdraw | signed immutable |
| InventoryUsageLedger | tenant | inventory.usage.* | YES | append-only; sync with StockMovement; accountable human required (INV-B01) |
| Injectable/clinical usage specialization | tenant | clinical.injectable | YES | **projection of InventoryUsageLedger only** — not a second ledger (INV-B02) |
| ServicePerformance / Participant | tenant | service.performance.* | YES | completed immutable except audited correction |
| StaffCommissionPlanVersion | tenant/branch/user | staff.commission.configure | YES | published versions immutable |
| CommissionAccrual | tenant | staff.commission.* | YES | append-only; reversals reference original |
| TreatmentCourse/Session | tenant | clinical / reception | YES | soft |
| DeviceTreatmentRecord | tenant | clinical.device | YES | append/correct with audit |
| DentalLabCase | tenant | dental.lab | YES | soft |
| RecallRule/Instance | tenant | outreach.admin | YES | soft |
| AvailabilityException | tenant/branch | schedule.admin | YES | soft |

Cross-tenant: **deny**. PHI minimized in audit payloads (IDs + action metadata).

---

## 20. Conceptual events / sync boundaries

**Synchronous transactions:** book appointment (conflict+eligibility+snapshot), publish price version, sign consent, record batch usage, accept waitlist offer.  
**Async side effects:** notifications, reminder fan-out, recall due scans, waitlist offers.

Events (conceptual): `ClinicalServicePublished`, `PriceVersionActivated`, `AppointmentBooked`, `AppointmentServiceSnapshotted`, `ConsentSigned`, `TreatmentBatchRecorded`, `TreatmentPlanItemScheduled`, `RecallDue`, `WaitlistCandidateOffered`.

---

## 21. Aesthetic separation rule

```text
marketing display name / alias
≠ canonical ClinicalService
≠ ServiceVariant
≠ BodyArea
≠ device
≠ product/batch
≠ protocol / form version
≠ PriceVersion
```

Ambiguous labels: `NEEDS_CLINICAL_TERMINOLOGY_REVIEW` — do not seed as canonical medical terms.
