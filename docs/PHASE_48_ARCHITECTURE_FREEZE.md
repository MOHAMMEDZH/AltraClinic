# Phase 48 — Architecture Freeze (SSOT)

| Field | Value |
|-------|--------|
| **Master Roadmap** | Healthcare ERP Master Roadmap v6 |
| **Phase** | 48 — Enterprise QA & Testing |
| **Stage** | Architecture Freeze |
| **Status** | **ACCEPTED AND COMPLETE** (external) |
| **Branch** | `cursor/phase48-wave-a-foundation` (implementation); freeze authored on review lineage |
| **Discovery HEAD** | `daf15c8bf1303f09780685ff5cf7df50da2f13ec` |
| **Implementation** | **AUTHORIZED** — **Wave A ONLY** (`P0-01`, `P0-07`, `P1-01`) |
| **Waves B–I** | **NOT YET AUTHORIZED** |
| **Phases 49–51** | **NOT AUTHORIZED** |

**Companion freeze artifacts:**

- `docs/PHASE_48_FROZEN_DOMAIN_CONTRACT_MATRIX.md`
- `docs/PHASE_48_FROZEN_IMPLEMENTATION_AND_QA_PLAN.md`

**Accepted inputs:** Discovery, Architecture Review, Inventory/Commission Addendum (INV-B01/B02 closed).

---

## 1. Freeze governance contract

```text
This freeze is the authoritative implementation contract for Phase 48.
```

### Implementation MAY refine

```text
exact Prisma model names
field naming
indexes
SQL syntax
DTO naming
API route naming
UI component names
internal file structure
advisory-lock hash encoding details
performance optimization that preserves invariants
```

### Implementation may NOT change

```text
domain ownership
Sources of Record
identity semantics
tenant boundaries
historical immutability rules
concurrency guarantees
eligibility behavior
inventory accountability
commission historical behavior
migration safety
accepted P0/P1 scope
QA acceptance semantics
```

### Change control

Any proposal that changes frozen semantics requires:

```text
Architecture Change Request
→ architecture review
→ explicit external approval
→ freeze amendment
```

No silent architecture drift.

| Allowed without freeze amendment | Requires freeze amendment |
|----------------------------------|---------------------------|
| Implementation detail, naming, indexes, SQL, files, API/UI names, perf preserving invariants | Competing SoR; canonical ownership change; tenant duplicates of standard services; snapshot lock boundary; fail-closed eligibility; concurrency model; anonymous stock usage; second inventory usage ledger; commission historical semantics; refund/reversal model; destructive migration; moving P0/P1 out of Phase 48; removing mandatory QA pack |

---

## 2. Frozen ADR matrix (AR-01 … AR-22)

| ADR | Decision | Authoritative SoR | Scope | Write owner | Historical rule | Tenant rule | Migration | QA pack | Wave | Status |
|-----|----------|-------------------|-------|-------------|-----------------|-------------|-----------|---------|------|--------|
| AR-01 | Shared CanonicalClinicalServiceDefinition + TENANT_CUSTOM | CanonicalClinicalServiceDefinition | platform shared + tenant custom | platform catalog / tenant catalog | stableKey immutable after publish | Clinic A==Clinic B for SYSTEM_CANONICAL | map known→canonical; no clones | Catalog | A | **FROZEN** |
| AR-02 | One identity + AR/EN translations/aliases + display-only override | ClinicalServiceTranslation/Alias | follows definition | catalog admin | snapshots freeze display | no language-row duplicates | — | Catalog / RTL | A/H | **FROZEN** |
| AR-03 | Tenant/branch config only | TenantServiceConfiguration | tenant/branch | catalog/branch admin | soft | enable without copying definition | config separate from definition | Catalog | A | **FROZEN** |
| AR-04 | Append-only PriceVersion | PriceVersion | tenant/branch | billing.price.admin | never overwrite published | A≠B price on same canonical | map ServicePrice→versions | Pricing/Snapshot | A | **FROZEN** |
| AR-05 | Append-only snapshot revisions; lock=CONFIRMED | AppointmentServiceSnapshotRevision | appointment | system | no in-place identity/price mutate | global lock not tenant-configurable | synthetic/LEGACY snapshots | Pricing/Snapshot | B | **FROZEN** |
| AR-06 | Advisory locks + sorted keys + overlap re-check | Appointment + SchedulingResource | tenant | scheduling | soft-delete aware | EXCLUDE optional depth only | — | Concurrency | B | **FROZEN** |
| AR-07 | Fail-closed eligibility when ON | ProviderServiceEligibility | tenant/branch | staffing.admin | effective dates | zero rows=DENY | flag OFF legacy only | Eligibility | B | **FROZEN** |
| AR-08 | PlanItem↔Appointment M:N | TreatmentPlanItemAppointment | tenant | clinical/reception | links survive reschedule | — | optional backfill | Plan Link | D | **FROZEN** |
| AR-09 | Unified ClinicalFormTemplate/Version + Instance | Clinical forms | tenant | clinical.forms.admin | published/signed immutable | — | legacy plan consent kept | Consent | C | **FROZEN** |
| AR-10 | Photo/treatment consent via AR-09 | same forms domain | tenant | clinical.forms.admin | signed immutable | no second consent SoR | — | Consent | C | **FROZEN** |
| AR-11 | Injectable specialization of InventoryUsageLedger | InventoryUsageLedger + InventoryBatch | tenant | clinical.injectable | append-only | no second usage ledger | nullable historical | Injectable + P0-10 | C | **FROZEN** |
| AR-12 | OPERATORY on SchedulingResourceType | SchedulingResource | tenant/branch | schedule.admin | soft | same concurrency model | — | Operatory | D | **FROZEN** |
| AR-13 | TreatmentCourse / CourseSession | TreatmentCourse | tenant | clinical/reception | soft | — | — | Course | E | **FROZEN** |
| AR-14 | DeviceTreatmentRecord | DeviceTreatmentRecord | tenant | clinical.device | append/correct+audit | schema-keyed params | — | Device | E | **FROZEN** |
| AR-15 | No DermatologyRecord EMR | Encounter+forms+services+media | tenant | clinical | — | BeautyRecord stays aesthetics | — | Derm | E | **FROZEN** |
| AR-16 | DentalLabCase | DentalLabCase | tenant | dental.lab | soft | — | — | Lab | D | **FROZEN** |
| AR-17 | RecallRule + PatientRecallInstance | Recall SoR | tenant | outreach.admin | soft | reminders ≠ SoR | — | Recall | G | **FROZEN** |
| AR-18 | Non-destructive migration | mapping tables + legacy fields | — | ops/catalog | LEGACY_* preserved | no fabricated history | dual-read/write | Migration | A+I | **FROZEN** |
| AR-19 | Jest/DB/onepass QA packs | QA architecture | — | engineering | deterministic | — | clean/upgrade validators | all packs | I | **FROZEN** |
| AR-20 | InventoryUsageLedger + human accountability | Inventory* + UsageLedger | tenant | inventory.usage.* | append-only | INV-B01 accountable human | LEGACY_UNATTRIBUTED | P0-10 | C | **FROZEN** |
| AR-21 | ServicePerformance + Participants | ServicePerformance* | tenant | service.performance.* | completed immutable except audited correction | providerId ≠ automatic performer | no invented performers | Commission / Combined | D/E/F | **FROZEN** |
| AR-22 | Versioned commission plans + accruals | StaffCommissionPlanVersion + CommissionAccrual (IMPROVE commission module) | tenant | staff.commission.* | no retroactive rate rewrite | ≠ eligibility; no full payroll | default OFF | P1-14 | F | **FROZEN** |

```text
AR count = 22
AR-01…AR-22 frozen = YES
```

---

## 3. Frozen P0 / P1 registers

### P0 (10) — DEFER forbidden

```text
P0-01 Clinical service/procedure catalog
P0-02 Appointment service/price historical snapshot
P0-03 Scheduling concurrency / hard double-book protection
P0-04 Service-specific provider eligibility
P0-05 Treatment-plan ↔ appointment staging integrity
P0-06 Versioned clinical consent/forms baseline
P0-07 Price history / non-destructive audit trail
P0-08 Injectable treatment batch/lot/expiry traceability
P0-09 Treatment-specific + clinical-photo consent
P0-10 Inventory Consumption & User Attribution
```

```text
P0 count = 10
P0 deferred = 0
P0 freeze blockers = 0
```

### P1 (14) — none silently deferred

```text
P1-01 Branch-specific service enablement/pricing
P1-02 Pricing units / dental applicability
P1-03 Chair/operatory first-class resource
P1-04 Aesthetic treatment courses / multi-session booking
P1-05 Device/laser settings Source of Record
P1-06 Dermatology clinical depth
P1-07 Dental laboratory case workflow
P1-08 Arabic catalog search + RTL booking quality
P1-09 Pre/post-care instructions
P1-10 Waitlist auto-fill
P1-11 Holiday/leave availability
P1-12 Accessibility + tablet reception
P1-13 Operational Recall SoR / professional recall workflow
P1-14 Staff Commission / Revenue Share
```

```text
P1 count = 14
P1 moved to P2 = 0
P1 freeze blockers = 0
```

---

## 4. Frozen core contracts (summary)

| Area | Frozen decision |
|------|-----------------|
| Canonical Service | CanonicalClinicalServiceDefinition SYSTEM_CANONICAL + TENANT_CUSTOM; HealthcareCatalog ≠ clinical catalog |
| Tenant Service Config | TenantServiceConfiguration enable/duration/resources/portal; no definition clone for price |
| Price | Append-only PriceVersion tenant/branch |
| Appointment Snapshot | Append-only revisions; lock=CONFIRMED; invoice uses effective revision |
| Concurrency | Advisory locks + sorted keys + overlap re-check; EXCLUDE optional depth |
| Provider Eligibility | Fail-closed when ON; zero rows=DENY |
| Consent | Unified ClinicalFormTemplate/Version/Instance kinds |
| Inventory Usage | InventoryUsageLedger + StockMovement sync txn |
| Inventory Batch | InventoryBatch only |
| Service Performance | ServicePerformance + Participants |
| Commission Plan | StaffCommissionPlanVersion; owner YES/NO + 0–100% |
| Commission Accrual | Append-only PENDING/EARNED/SETTLED/REVERSED |
| Dental | Preserve Dental SoRs + catalog/plan links/OPERATORY/lab/usage/performance/recall |
| Aesthetic/Derm | Beauty + Encounter; no Dermatology EMR; courses/device/forms/batch via usage ledger |
| Recall | RecallRule + PatientRecallInstance |
| Waitlist | Offer/TTL/accept; no silent auto-book without policy |
| Availability | AvailabilityException |

---

## 5. Inventory freeze (AR-20 / P0-10 / INV-B01 / INV-B02)

```text
authoritative inventory usage ledger = InventoryUsageLedger
authoritative batch SoR = InventoryBatch
human accountability invariant = every human-driven stock-affecting event has accountable human
department-only accountability = FORBIDDEN
ProductBatchUsage role = typed specialization only if retained; never independent stock decrement
stock decrement authority = InventoryStockMovement / Inventory domain
correction/reversal = reverse + new post; hard delete forbidden
silent stock consumption = NO
```

---

## 6. Commission freeze (AR-21 / AR-22 / P1-14)

```text
owner enable/disable = YES
default percentage = 0–100
plan versioning = YES
historical recalculation = NO
actual performer source = ServicePerformanceParticipant
Appointment.providerId automatic performer = NO
default calculation basis = SERVICE_NET_AFTER_DISCOUNT
earning trigger = INVOICE_OR_CHARGE_FINALIZED (COLLECTED_REVENUE earns on payment)
refund handling = full reversal
partial refund = proportional
settlement = earned/settled/outstanding/reversed (reuse commission PAID/reference)
payroll engine = NO
```

---

## 7. Migration freeze (AR-18)

```text
destructive remapping = NO
known standard mapping = SYSTEM_CANONICAL + config + PriceVersion
tenant canonical clones = NO
LEGACY_UNMAPPED = YES
AMBIGUOUS = YES
LEGACY_UNATTRIBUTED = YES
historical employee attribution fabricated = NO
historical batch usage fabricated = NO
historical commission fabricated = NO
existing users commission default = OFF
newBookingFreeTextIdentityAllowed = NO
```

---

## 8. Authorization freeze (conceptual)

```text
catalog.admin / billing.price.admin / staffing.admin / clinical.forms.admin /
clinical.injectable / clinical.device / dental.lab / outreach.admin / schedule.admin /
inventory.usage.record|correct|view|owner-report /
service.performance.record|correct /
staff.commission.configure|view|correct|settle|owner-report
```

```text
cross-tenant = DENY
provider eligibility != commission eligibility
inventory permission != commission permission
staff self-edit commission = denied by default
```

---

## 9. Audit freeze

Mandatory categories include: canonical publish/deprecate; config; price publish; snapshot revisions; eligibility; consent publish/sign; material scheduling conflict outcomes; inventory usage/reversal/correction; responsible-user changes; wastage/damage/expiry; batch usage; service performance; commission plan/accrual/settlement/manual correction. Minimize PHI in payloads.

---

## 10. Owner traceability freeze

```text
ServicePerformance
→ Appointment / Encounter
→ Canonical Clinical Service
→ Effective AppointmentServiceSnapshot revision
→ InvoiceLine / revenue source
→ InventoryUsageLedger
→ InventoryBatch
→ CommissionAccrual
```

---

## 11. Non-freeze external reviews (not model blockers)

```text
CLINICAL_TERMINOLOGY_REVIEW
LEGAL/JURISDICTION_REVIEW
```

(e.g. seed terminology, gingival botox aliases, marketing/photo legal scope, jurisdiction-sensitive naming)

---

## 12. Freeze-blocker counters

```text
P0 freeze blockers = 0
P1 freeze blockers = 0

AR-B01 = CLOSED
AR-B02 = CLOSED
AR-B03 = CLOSED
AR-B04 = CLOSED

INV-B01 = CLOSED
INV-B02 = CLOSED

canonicalServiceScopeAmbiguity = 0
tenantDuplicateStandardServiceArchitecture = 0
providerEligibilityEmptyPolicyAmbiguity = 0
providerEligibilityImplicitAllow = 0
concurrencyPrimitiveAmbiguity = 0
concurrencyNoExistingRowGap = 0
snapshotImmutabilityPointAmbiguity = 0
snapshotInPlaceMutationAllowed = 0

anonymousHumanStockConsumptionAllowed = 0
departmentOnlyStockAccountabilityAllowed = 0
duplicateInventoryUsageSoR = 0
duplicateInventoryBatchSoR = 0
separateProductBatchUsageConsumptionLedger = 0
staleProductBatchUsageMigrationWording = 0

commissionHistoricalRecalculationAllowed = 0
appointmentProviderBlindCommissionAttribution = 0
commissionRefundReversalAmbiguity = 0

newBookingFreeTextIdentityAllowed = 0
destructiveLegacyRemapping = 0
```

---

## 13. External acceptance

```text
ready for external Phase 48 Architecture Freeze acceptance = YES
Architecture Freeze externally accepted = YES
Phase 48 Implementation authorized = YES
current wave = A
Waves B–I authorized = NO
Phase 49 authorized = NO
Step 30 created = NO
Implementation authorized = NO
```
