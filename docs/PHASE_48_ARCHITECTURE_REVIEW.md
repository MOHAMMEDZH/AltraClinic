# Phase 48 — Architecture Review

| Field | Value |
|-------|--------|
| **Master Roadmap** | Healthcare ERP Master Roadmap v6 |
| **Phase** | 48 — Enterprise QA & Testing |
| **Stage** | Architecture Review **only** |
| **Status** | **ACCEPTED AND COMPLETE.** Architecture Freeze **ACCEPTED AND COMPLETE**. Implementation **AUTHORIZED** — **Wave A ONLY**. Waves B–I / Phase 49 **NOT AUTHORIZED**. |
| **Branch** | `cursor/phase48-enterprise-qa-architecture-review` |
| **Discovery HEAD** | `daf15c8bf1303f09780685ff5cf7df50da2f13ec` |
| **Release 47 checkpoint** | `ae6307dfda8207e06db842318323d391c8fc8f18` |
| **Implementation** | **AUTHORIZED** — Wave A only |
| **Waves B–I** | **NOT YET AUTHORIZED** |
| **Phases 49–51** | **NOT AUTHORIZED** |

**Companion review artifacts:**

- `docs/PHASE_48_TARGET_DOMAIN_ARCHITECTURE.md`
- `docs/PHASE_48_MIGRATION_AND_BACKWARD_COMPATIBILITY_REVIEW.md`
- `docs/PHASE_48_ENTERPRISE_QA_ACCEPTANCE_ARCHITECTURE.md`
- `docs/PHASE_48_ARCHITECTURE_REVIEW_ADDENDUM_INVENTORY_COMMISSION.md`
- `docs/PHASE_48_INVENTORY_USAGE_ACCOUNTABILITY_ARCHITECTURE.md`
- `docs/PHASE_48_STAFF_COMMISSION_REVENUE_SHARE_ARCHITECTURE.md`

**Frozen SSOT (pending external Freeze acceptance):**

- `docs/PHASE_48_ARCHITECTURE_FREEZE.md`
- `docs/PHASE_48_FROZEN_DOMAIN_CONTRACT_MATRIX.md`
- `docs/PHASE_48_FROZEN_IMPLEMENTATION_AND_QA_PLAN.md`

**Authoritative discovery inputs (accepted):**

- `docs/PHASE_48_ENTERPRISE_QA_ARCHITECTURE_DISCOVERY.md`
- `docs/PHASE_48_GLOBAL_COMPETITIVE_CAPABILITY_MATRIX.md`
- `docs/PHASE_48_DENTAL_AESTHETIC_BOOKING_GAP_MATRIX.md`
- `docs/PHASE_48_QA_TEST_ARCHITECTURE_INVENTORY.md`

---

## 1. Architecture principles (frozen for this review)

| ID | Principle |
|----|-----------|
| A | **One shared CanonicalClinicalServiceDefinition SoR** for standard services — tenants enable via TenantServiceConfiguration; do **not** duplicate standard definitions per tenant. Super Admin `HealthcareCatalogItem` remains **platform entitlement/specialty/facility** SoR — **not** clinical procedures. Provenance: `SYSTEM_CANONICAL` \| `TENANT_CUSTOM`. |
| B | **Definition ≠ commercial configuration** — CanonicalClinicalServiceDefinition ≠ TenantServiceConfiguration ≠ PriceVersion. |
| C | **Historical appointments are reproducible** via append-only AppointmentServiceSnapshot **revisions** with one global commercial lock at **CONFIRMED**. |
| D | **Existing clinical SoRs stay authoritative** — Patient, Appointment, DentalRecord, TreatmentPlan, MediaAsset, Inventory batches, Invoice lines, Notifications, Audit, User/provider, Branch, SchedulingResource. No parallel EMRs. |
| E | **Safety-critical data is first-class** when validation/search/audit depends on it (consent version, batch usage, eligibility, required resource, device record). |
| F | **Arabic and English are first-class data** on one stable identity — never duplicate rows per language. |
| G | **Provider eligibility fail-closed** when enforcement ON: zero active eligibility rows = DENY. |
| H | **Scheduling concurrency** uses one authoritative primitive: transaction-scoped PostgreSQL advisory locks on deterministic keys + overlap re-check under lock. |

---

## 2. Architecture Decision Records (AR-01 … AR-19)

### AR-01 Clinical service SoR

| Field | Content |
|-------|---------|
| Problem | Competing service identities; risk of every tenant duplicating standard definitions |
| Options | (1) HealthcareCatalog as procedures (2) ServicePrice-as-catalog (3) Per-tenant ClinicalService copies (4) **Shared CanonicalClinicalServiceDefinition + TenantServiceConfiguration** (5) Free-text |
| **Chosen** | **Shared `CanonicalClinicalServiceDefinition` (SYSTEM_CANONICAL)** for standard services; tenants **enable/configure/price** without copying definitions; **`TENANT_CUSTOM`** only for genuine custom services with separate key namespace |
| Why | Clinic A and Clinic B must share the same canonical identity for a standard service while keeping independent prices/config; avoids taxonomy drift |
| Rejected | (1) entitlement coupling (2) price-as-identity (3) tenant copies of standard services (5) free-text drift |
| Reused | Optional specialty refs to platform specialty keys; dental/beauty clinical records remain SoRs |
| New model | YES — CanonicalClinicalServiceDefinition, ServiceCategory, translations/aliases, TENANT_CUSTOM path |
| Migration | Map known legacy codes → shared canonical; config+price separately; `LEGACY_UNMAPPED` / `AMBIGUOUS` for unknowns — **no** auto tenant-local copies of known standards |
| Security | Canonical write = platform clinical catalog admin; tenant custom write = tenant catalog.admin; tenants cannot mutate SYSTEM_CANONICAL definition body |
| Audit | canonical publish/deprecate; tenant custom create; config enable/disable; translate |
| QA | P0 Catalog Integrity Pack (cross-tenant same identity, independent prices) |
| P0/P1 | P0-01 |
| Open | Exact clinical terminology seed content = CLINICAL_TERMINOLOGY_REVIEW (not model freeze blocker) |

### AR-02 Service localization

| Field | Content |
|-------|---------|
| **Chosen** | One canonical `stableKey` + translations/aliases for `ar`/`en`; optional **tenant presentation override** (display-only) that never changes identity |
| Rejected | Duplicate AR/EN definition rows; per-tenant duplicate definitions for localization |
| P0/P1 | P0-01, P1-08 |

### AR-03 Tenant/branch service config

| Field | Content |
|-------|---------|
| **Chosen** | `TenantServiceConfiguration` only — enable/disable, duration/resource defaults, portal visibility, optional branch override; **pricing never requires duplicating CanonicalClinicalServiceDefinition** |
| P0/P1 | P0-01, P1-01 |

### AR-04 Price versioning

| Field | Content |
|-------|---------|
| **Chosen** | Append-only `PriceVersion` under tenant (+ optional branch override); `effectiveFrom`/`effectiveTo` with overlap prevention; deactivate ≠ hard delete |
| Rejected | In-place overwrite of `ServicePrice.unitPrice` as SoR; requiring tenant-local service copies to hold different prices |
| Required | Clinic A ≠ Clinic B **price** on the **same** SYSTEM_CANONICAL identity |
| P0/P1 | P0-07, P1-01, P1-02 |

### AR-05 Appointment snapshot

| Field | Content |
|-------|---------|
| **Chosen** | **Append-only AppointmentServiceSnapshot revisions**. Revision 1 created atomically with successful booking. Identity/price/currency/unit/quantity/tax/display fields **never overwritten**. Explicit service/price change creates a **new** revision (`previousRevisionId`, reason, actor, timestamp). Appointment references **effectiveRevisionId**. |
| Commercial lock | **Global lock state = CONFIRMED** (not tenant-configurable). After CONFIRMED: ordinary edits cannot change service/price; corrections only via audited correction workflow. Time-only reschedule **does not reprice**. |
| Invoice | Uses **effective snapshot revision** referenced by appointment/commercial txn — **never** re-queries live PriceVersion for historical reconstruction. Legitimate zero only if snapshot records it with commercial reason. |
| New bookings | Free-text service identity **FORBIDDEN** once canonical write mode enabled |
| P0/P1 | P0-02 |

### AR-06 Scheduling concurrency

| Field | Content |
|-------|---------|
| Options | (1) EXCLUDE as base (2) lock table as base (3) Redis only (4) **advisory locks + overlap re-check** |
| **Chosen (authoritative)** | **Transaction-scoped PostgreSQL advisory locking** on deterministic scheduling conflict keys + **overlap re-check inside the same transaction** + commit only if conflict-free |
| EXCLUDE role | **Optional defense-in-depth only** — not the authoritative base mechanism |
| Lock keys | At least `hash(tenantId, 'provider', providerId)` and `hash(tenantId, 'resource', resourceId)` (include branch in key material when branch-scoped conflict applies) |
| Algorithm | (1) collect required keys (2) **sort deterministically** (3) acquire all advisory locks in that order (4) re-query overlapping active appointments while locks held (5) reject if conflict (6) insert/update (7) commit → locks release |
| No-existing-row | Protected — locks acquired **before** insert; two concurrent creates for same slot → exactly one success |
| Statuses that consume slot | `PENDING`, `CONFIRMED`, `CHECKED_IN`, `IN_PROGRESS` (and any non-terminal active status). **Do not conflict:** `CANCELLED`, soft-deleted, `COMPLETED`, `NO_SHOW` (completed/no-show do not hold future slot; historical rows ignored for future overlap) |
| Operations | create, reschedule, provider change, resource change, recurring/course creation, waitlist acceptance, portal booking — same model |
| Cancellation | Releases slot on commit to CANCELLED/soft-delete; subsequent bookers may proceed |
| Idempotency | **Separate** from locking: idempotency keys protect duplicate HTTP submits; advisory locks protect cross-request slot conflicts. **Both required.** |
| Rejected | UI-only / read-then-write alone; Redis-only; ambiguous “advisory OR lock-table OR EXCLUDE” |
| P0/P1 | P0-03 |

### AR-07 Provider eligibility

| Field | Content |
|-------|---------|
| **Chosen** | First-class `ProviderServiceEligibility`; when **enforcement ON**: **default = DENY / FAIL CLOSED**. Zero active eligibility rows for (provider, service[, branch]) ⇒ **booking denied** and **portal availability excludes provider**. No implicit allow. |
| Branch | Branch-scoped eligibility required when appointment has branch; mismatch ⇒ DENY |
| Expired / inactive | DENY |
| Cross-tenant row | DENY |
| Specialty | Specialty requirement is additional constraint; does not replace eligibility row |
| Emergency override | **None silent.** If product later needs emergency override, it must be an **explicit audited** command with reason — not inventable as default |
| Legacy | Feature flag `booking.eligibility.enforcement`: OFF = legacy preserved; ON = fail-closed. Activation requires readiness coverage report (providers×enabled services) — no mixed accidental semantics |
| P0/P1 | P0-04 |
### AR-08 Treatment-plan ↔ appointment

| Field | Content |
|-------|---------|
| **Chosen** | Junction `TreatmentPlanItemAppointment` (M:N) with role (primary/supporting); preserve TreatmentPlan/Phase/Item SoRs |
| P0/P1 | P0-05 |

### AR-09 Consent/forms

| Field | Content |
|-------|---------|
| **Chosen** | Unified `ClinicalFormTemplate` + immutable `ClinicalFormVersion` (polymorphic kinds: CONSENT, INTAKE, PHOTO_CONSENT, PRE_CARE, POST_CARE, OTHER) + `PatientFormInstance` |
| Rejected | Separate aesthetic-only consent domain |
| P0/P1 | P0-06, P0-09, P1-09 |

### AR-10 Photo consent

| Field | Content |
|-------|---------|
| **Chosen** | Form kind PHOTO_CONSENT (+ treatment consent kinds) under AR-09; MediaAsset access gated by signed instance |
| P0/P1 | P0-09 |

### AR-11 Injectable batch usage

| Field | Content |
|-------|---------|
| **Chosen** | Clinical/injectable specialization of **InventoryUsageLedger** (AR-20) → existing `InventoryBatch`; no duplicate batch master or second consumption ledger |
| P0/P1 | P0-08 (with P0-10) |

### AR-12 Resource/chair model

| Field | Content |
|-------|---------|
| **Chosen** | Extend `SchedulingResourceType` with **`OPERATORY`** (covers dental chair/operatory); keep ROOM/EQUIPMENT; optional display subtype label |
| Rejected | Separate Operatory table; CHAIR+OPERATORY dual enums without need |
| P0/P1 | P1-03 |

### AR-13 Treatment courses

| Field | Content |
|-------|---------|
| **Chosen** | Cross-specialty `TreatmentCourse` + `CourseSession` linked to ClinicalService + appointments + price package version |
| P0/P1 | P1-04 |

### AR-14 Device/laser record

| Field | Content |
|-------|---------|
| **Chosen** | First-class `DeviceTreatmentRecord` with device identity + JSON parameter payload validated by device-type schema registry (not one giant enum) |
| Rejected | Unstructured BeautyAnnotation.parameters alone as SoR |
| P0/P1 | P1-05 |

### AR-15 Dermatology architecture

| Field | Content |
|-------|---------|
| Options | Dedicated DermatologyRecord vs Encounter + extensions |
| **Chosen** | **No separate Dermatology EMR** — use Encounter + diagnosis/notes + MediaAsset + ClinicalService + optional structured finding attachments; BeautyRecord remains aesthetics anatomy map |
| Why | Avoid parallel EMR; derm depth via clinical forms + service taxonomy + photo consent |
| P0/P1 | P1-06 |

### AR-16 Dental lab cases

| Field | Content |
|-------|---------|
| **Chosen** | First-class `DentalLabCase` linked to patient, provider, optional TreatmentPlanItem, tooth/arch, statuses, dates, attachments (MediaAsset) |
| P0/P1 | P1-07 |

### AR-17 Recall

| Field | Content |
|-------|---------|
| **Chosen** | Operational `RecallRule` + `PatientRecallInstance` SoR; reminders/notifications are delivery channels — not SoR |
| P0/P1 | P1-13 |

### AR-18 Legacy migration

| Field | Content |
|-------|---------|
| **Chosen** | Non-destructive dual-read/dual-write; known standard legacy codes **map to shared SYSTEM_CANONICAL** definitions; TenantServiceConfiguration + PriceVersion created separately; unknowns stay `LEGACY_UNMAPPED` / `AMBIGUOUS`; TENANT_CUSTOM only after deterministic/human-approved classification — **never** auto-create tenant-local copies of known canonical services; inventory usedBy / commission history **not invented** (`LEGACY_UNATTRIBUTED`; commission default OFF) |
| Destructive remapping | **NO** |
| Details | See migration companion + inventory/commission addendum |

### AR-19 Enterprise QA architecture

| Field | Content |
|-------|---------|
| **Chosen** | Jest + Postgres DB validators + onepass; packs include catalog, snapshot, concurrency, eligibility, consent, injectable + **P0-10 inventory accountability**, plan-link, **P1-14 commission**, combined service→inventory→commission traceability |
| Rejected | New parallel test framework |

### AR-20 Inventory Usage & Accountability

| Field | Content |
|-------|---------|
| **Chosen** | Evolve `InventoryConsumptionLog` → InventoryUsageLedger; sync txn with `InventoryStockMovement`; usedBy/responsible ≠ recordedBy; **INV-B01** accountable human required for all human-driven stock-affecting types; typed usage; batch FK; append-only reversals; **INV-B02** P0-08 = specialization of same ledger only |
| Reused | InventoryItem, InventoryBatch, InventoryStockMovement, warehouses |
| P0/P1 | P0-10 |
| Details | `docs/PHASE_48_INVENTORY_USAGE_ACCOUNTABILITY_ARCHITECTURE.md` |

### AR-21 Service Performance Attribution

| Field | Content |
|-------|---------|
| **Chosen** | ServicePerformance + Participants; Appointment.providerId ≠ automatic performer; share sum ≤ 100% |
| P0/P1 | Supports P1-14 |
| Details | `docs/PHASE_48_STAFF_COMMISSION_REVENUE_SHARE_ARCHITECTURE.md` |

### AR-22 Staff Commission / Revenue Share

| Field | Content |
|-------|---------|
| **Chosen** | IMPROVE existing commission module: versioned plans; owner YES/NO + 0–100%; append-only accruals; refund reversals; settlement via PAID; **no** full payroll engine |
| Reused | CommissionRule/Calculation/LineItem, Invoice*, User |
| P0/P1 | P1-14 |
| Details | `docs/PHASE_48_STAFF_COMMISSION_REVENUE_SHARE_ARCHITECTURE.md` |

---

## 3. P0 mapping (mandatory — no DEFER)

| P0 | Decision | Design | New model | Reused SoR | Migration | Freeze blocker |
|----|----------|--------|-----------|------------|-----------|----------------|
| P0-01 | AR-01/02/03 | Shared CanonicalClinicalServiceDefinition + tenant config | YES shared + TENANT_CUSTOM | Specialty refs optional | Map known→canonical; no tenant copies of standards | NO |
| P0-02 | AR-05 | Append-only snapshot revisions; lock=CONFIRMED | YES | Appointment, Invoice lines | Synthetic/LEGACY snapshots | NO |
| P0-03 | AR-06 | Advisory locks + overlap re-check (EXCLUDE optional depth) | IMPROVE Appointment | Appointment, SchedulingResource | Soft-delete aware | NO |
| P0-04 | AR-07 | Fail-closed ProviderServiceEligibility | YES | User, schedules, roles | Flag OFF legacy; ON deny empty | NO |
| P0-05 | AR-08 | PlanItem↔Appointment junction | YES junction | TreatmentPlan* | Optional backfill | NO |
| P0-06 | AR-09 | ClinicalFormTemplate/Version + Instance | YES | — | Existing plan consent timestamps remain historical | NO |
| P0-07 | AR-04 | PriceVersion append-only on shared service | YES | ServicePrice as legacy source | Map→versions without duplicating definition | NO |
| P0-08 | AR-11/20 | Injectable specialization of InventoryUsageLedger | IMPROVE linkage | InventoryBatch, usage ledger | Historical may stay unlinked | NO |
| P0-09 | AR-10 | PHOTO_CONSENT / TREATMENT via AR-09 | NO new domain | MediaAsset | — | NO |
| P0-10 | AR-20 | InventoryUsageLedger + stock txn; usedBy≠recordedBy | IMPROVE ConsumptionLog | Inventory*, StockMovement | LEGACY_UNATTRIBUTED | NO |

---

## 4. P1 mapping

| P1 | Decision | Design | Disposition |
|----|----------|--------|-------------|
| P1-01 | AR-03/04 | Branch config + branch price override | IMPLEMENT after P0 foundation |
| P1-02 | AR-04 + dental applicability | PricingUnit enum + validation matrix | IMPLEMENT |
| P1-03 | AR-12 | OPERATORY on SchedulingResourceType | IMPROVE |
| P1-04 | AR-13 | TreatmentCourse/CourseSession | IMPLEMENT |
| P1-05 | AR-14 | DeviceTreatmentRecord | IMPLEMENT |
| P1-06 | AR-15 | No DermatologyRecord; Encounter+forms+services | IMPROVE existing |
| P1-07 | AR-16 | DentalLabCase | IMPLEMENT |
| P1-08 | AR-02 | Translations + search + RTL acceptance | IMPROVE |
| P1-09 | AR-09 | PRE_CARE/POST_CARE form kinds | IMPLEMENT |
| P1-10 | Waitlist auto-fill policy | Event on cancel → offer → accept/timeout; **no silent auto-book** without tenant policy | IMPROVE AppointmentWaitlist |
| P1-11 | AvailabilityException SoR | Leave/holiday/maintenance/extra; precedence over weekly | IMPLEMENT |
| P1-12 | A11y/tablet acceptance criteria | Phase 48 functional a11y gates; Phase 50 polish only | IMPROVE UX (criteria owned here) |
| P1-13 | AR-17 | RecallRule + PatientRecallInstance | IMPLEMENT |
| P1-14 | AR-21/22 | ServicePerformance + versioned commission plans/accruals | IMPROVE commission module |

**No P1 moved to P2 in this review.**

---

## 5. Global competitive gap closure (vs Discovery benchmarks)

| Dimension | Closure |
|-----------|---------|
| Dental clinical integration | PARTIALLY_CLOSES → CLOSES_GAP with Waves D |
| Operatory scheduling | CLOSES_GAP (AR-12 + concurrency) |
| Online booking integrity | CLOSES_GAP (snapshot + eligibility + concurrency) |
| Recall | CLOSES_GAP (AR-17) |
| Forms/consent | CLOSES_GAP (AR-09/10) |
| Aesthetic traceability | CLOSES_GAP (AR-11/14) |
| Patient self-service | PARTIALLY_CLOSES (portal filters + consents; channels DEFERRED) |
| Multi-location | CLOSES_GAP (branch config/price/exceptions) |
| Service catalog flexibility | CLOSES_GAP (AR-01) |
| Tenant pricing | CLOSES_GAP (AR-04) |
| Arabic/English | CLOSES_GAP (AR-02) + PARTIALLY_CLOSES UX polish → Wave G |

No vendor equivalence claimed.

---

## 6. Freeze blockers

```text
P0 freeze blockers = 0
AR-B01 canonical service scope = CLOSED
AR-B02 provider eligibility empty-set = CLOSED (FAIL CLOSED)
AR-B03 concurrency primitive = CLOSED (advisory locks + re-check)
AR-B04 snapshot immutability = CLOSED (append-only revisions; lock=CONFIRMED)
P1 freeze blockers = 0
clinical terminology reviews = open (seed labels, gingival botox, marketing aliases) — CLINICAL_TERMINOLOGY_REVIEW — not model freeze blockers
legal/jurisdiction reviews = marketing photo-use consent scope; jurisdiction-sensitive procedures — LEGAL/JURISDICTION_REVIEW
implementation-only details = exact advisory-lock hash function / bit packing; search index technology (pg_trgm vs external); optional EXCLUDE DDL as defense-in-depth
```

### Freeze-blocker counters (must all be 0)

```text
canonicalServiceScopeAmbiguity = 0
tenantDuplicateStandardServiceArchitecture = 0
providerEligibilityEmptyPolicyAmbiguity = 0
providerEligibilityImplicitAllow = 0
concurrencyPrimitiveAmbiguity = 0
concurrencyNoExistingRowGap = 0
snapshotImmutabilityPointAmbiguity = 0
snapshotInPlaceMutationAllowed = 0
newBookingFreeTextIdentityAllowed = 0
destructiveLegacyRemapping = 0
```

---

## 7. Implementation waves (post-Freeze only)

```text
Wave A — Foundation: ClinicalService, translations, tenant config, PriceVersion, migration compatibility
Wave B — Booking Integrity: snapshots, eligibility, resource requirements, concurrency
Wave C — Clinical Safety & Inventory Accountability: forms/consent, photo consent, InventoryUsageLedger, P0-08 specialization, owner inventory reports
Wave D — Dental Integration: plan↔appointment, dental applicability, OPERATORY, DentalLabCase, dental material usage, ServicePerformance
Wave E — Aesthetic/Dermatology: courses, DeviceTreatmentRecord, pre/post care, derm via Encounter+forms, aesthetic material usage, ServicePerformance
Wave F — Workforce Commercials: StaffCommissionPlanVersion, CommissionAccrual/reversals, settlement reference, owner commission reports
Wave G — Engagement: RecallRule, waitlist auto-fill, AvailabilityException
Wave H — UX / Localization / Accessibility: Arabic search, RTL booking, tablet/a11y, owner inventory/commission UX
Wave I — Enterprise QA Closure: P0/P1 packs (incl. P0-10, P1-14, combined traceability), migration validators, regression gates
```

Dependencies: A before B–I; C before invasive completion gates; F after ServicePerformance + snapshots/invoices stable; I closes after packs exist.

---

## 8. Review acceptance

AR-B01…AR-B04 closed. Inventory/Commission Addendum (AR-20…22, P0-10, P1-14, INV-B01/B02) accepted.  
**Architecture Freeze package prepared** — see `docs/PHASE_48_ARCHITECTURE_FREEZE.md`.

```text
ready for external Phase 48 Architecture Freeze acceptance = YES
Architecture Freeze externally accepted = NO (pending)
Architecture Freeze externally accepted = YES
Implementation authorized = YES
current wave = A
Waves B–I authorized = NO
Phase 49 authorized = NO
```
