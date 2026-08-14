# Phase 48 — Frozen Implementation & QA Plan

| Field | Value |
|-------|--------|
| **SSOT** | `docs/PHASE_48_ARCHITECTURE_FREEZE.md` |
| **Status** | Architecture Freeze **ACCEPTED AND COMPLETE**; Implementation **AUTHORIZED**; **Wave A = CURRENT AUTHORIZED IMPLEMENTATION WAVE** |
| **Waves B–I** | **NOT YET AUTHORIZED** |
| **Phase 49** | **NOT AUTHORIZED** |
| **Evidence** | `docs/PHASE_48_WAVE_A_IMPLEMENTATION_REPORT.md` |

---

## Wave dependency graph

```text
A Foundation
 → B Booking Integrity
 → C Clinical Safety & Inventory Accountability
 → D Dental Integration
 → E Aesthetic / Dermatology
 → F Workforce Commercials
 → G Engagement
 → H UX / Localization / Accessibility
 → I Enterprise QA Closure
```

Implementation may not reorder in a way that violates dependencies.

---

## Waves A–I

### Wave A — Foundation

| Item | Value |
|------|-------|
| P0/P1 | **P0-01, P0-07, P1-01**; enables P1-02 and P1-08 |
| ADRs | AR-01, AR-02, AR-03, AR-04, AR-18 |
| Domains | CanonicalClinicalServiceDefinition; translations/localization foundation; TenantServiceConfiguration; **tenant/branch service enablement/configuration (P1-01)**; PriceVersion; **tenant/branch pricing override foundation (P1-01)** |
| Migration | Map known standards→SYSTEM_CANONICAL; config+price separate; LEGACY_UNMAPPED/AMBIGUOUS |
| QA | P0 Catalog Integrity; P0 Pricing / Snapshot foundations; **branch configuration / price precedence assertions (P1-01)**; Migration clean/upgrade start |
| Entry | External Freeze accepted |
| Exit | Canonical publish/enable/price version paths green; **branch enablement + branch price override foundation green (P1-01)**; no tenant clones of standards |

```text
P1-01 implementation wave = A
P1-01 deferred = NO
P1-01 moved to P2 = NO
```

### Wave B — Booking Integrity

| Item | Value |
|------|-------|
| P0/P1 | P0-02, P0-03, P0-04 |
| ADRs | AR-05, AR-06, AR-07, AR-12 (resource requirements) |
| Domains | AppointmentServiceSnapshotRevision, ProviderServiceEligibility, advisory-lock booking |
| Migration | Synthetic/LEGACY snapshots; eligibility flag OFF until coverage ready |
| QA | Pricing/Snapshot; Concurrency; Eligibility |
| Entry | Wave A exit |
| Exit | CONFIRMED lock; fail-closed eligibility; no-existing-row race = one success |

### Wave C — Clinical Safety & Inventory Accountability

| Item | Value |
|------|-------|
| P0/P1 | P0-06, P0-08, P0-09, P0-10 |
| ADRs | AR-09, AR-10, AR-11, AR-20 |
| Domains | ClinicalForm*; InventoryUsageLedger; InventoryBatch specialization; owner inventory reports |
| Migration | LEGACY_UNATTRIBUTED; no fabricated usedBy/batch |
| QA | Consent; Injectable; **P0-10 Inventory Accountability** |
| Entry | Wave B for appointment/service identity where gating needs it |
| Exit | Human accountability INV-B01; single usage ledger INV-B02; consent versioning |

### Wave D — Dental Integration

| Item | Value |
|------|-------|
| P0/P1 | P0-05; P1-02, P1-03, P1-07 |
| ADRs | AR-08, AR-12, AR-16, AR-21 (start) |
| Domains | PlanItem↔Appointment; OPERATORY; DentalLabCase; dental material via UsageLedger; ServicePerformance |
| Migration | Nullable historical dental service FKs |
| QA | Plan Link; Operatory; Lab |
| Entry | A+B+C foundations |
| Exit | Multi-visit staging + operatory concurrency + lab statuses |

### Wave E — Aesthetic / Dermatology

| Item | Value |
|------|-------|
| P0/P1 | P1-04, P1-05, P1-06, P1-09 |
| ADRs | AR-13, AR-14, AR-15, AR-21 |
| Domains | TreatmentCourse; DeviceTreatmentRecord; pre/post care; derm via Encounter; aesthetic usage |
| Migration | Preserve beauty free-text history |
| QA | Course; Device; Derm; Pre/Post Care |
| Entry | C for consent/usage |
| Exit | Courses + device records + no Dermatology EMR |

### Wave F — Workforce Commercials

| Item | Value |
|------|-------|
| P0/P1 | P1-14 |
| ADRs | AR-21, AR-22 |
| Domains | StaffCommissionPlanVersion; CommissionAccrual; refunds; settlement reference; owner reports |
| Migration | commissionEnabled default OFF; no fabricated accruals |
| QA | **P1-14 Commission**; Combined Traceability |
| Entry | Snapshots + invoices + ServicePerformance + inventory usage links |
| Exit | Versioned %; performer≠appointment.providerId; refund reversals; no payroll engine |

### Wave G — Engagement

| Item | Value |
|------|-------|
| P0/P1 | P1-10, P1-11, P1-13 |
| ADRs | AR-17 |
| Domains | RecallRule/Instance; waitlist auto-fill; AvailabilityException |
| QA | Waitlist; Availability; Recall |
| Entry | Booking integrity stable |
| Exit | Operational recall SoR; offer/TTL waitlist; exception precedence |

### Wave H — UX / Localization / Accessibility

| Item | Value |
|------|-------|
| P0/P1 | P1-08, P1-12 |
| ADRs | AR-02 |
| Domains | Arabic search; RTL booking; tablet/a11y; owner inventory/commission UX |
| QA | Arabic/RTL; Accessibility/Tablet |
| Entry | Core APIs from prior waves |
| Exit | Functional a11y gates (not Phase 50 polish dump) |

### Wave I — Enterprise QA Closure

| Item | Value |
|------|-------|
| P0/P1 | All P0/P1 |
| ADRs | AR-19 |
| Domains | Full pack matrix + migration validators + regression/onepass |
| QA | All frozen packs below |
| Entry | Waves A–H deliverables present |
| Exit | All P0 packs green; P1 packs green; combined traceability; Release 47 gates remain green |

---

## Frozen QA packs

### P0

```text
P0 Catalog Integrity Pack = FROZEN
P0 Pricing / Snapshot Pack = FROZEN
P0 Scheduling Concurrency Pack = FROZEN
P0 Provider Eligibility Pack = FROZEN
P0 Consent Pack = FROZEN
P0 Injectable Traceability Pack = FROZEN
P0 Treatment Plan Link Pack = FROZEN
P0-10 Inventory Accountability Pack = FROZEN
```

Key P0-10 assertions (frozen): clinical without usedBy→reject; operational department-only→reject; wastage/damage/expired/sample without accountable human→reject; correction/reversal without actor→reject; cross-tenant accountable user→reject; P0-08 same InventoryUsageLedger event.

### P1

```text
P1 Operatory Pack = FROZEN
P1 Course Scheduling Pack = FROZEN
P1 Device/Laser Pack = FROZEN
P1 Dermatology Pack = FROZEN
P1 Dental Lab Pack = FROZEN
P1 Arabic/RTL Pack = FROZEN
P1 Pre/Post Care Pack = FROZEN
P1 Waitlist Pack = FROZEN
P1 Availability Pack = FROZEN
P1 Accessibility/Tablet Pack = FROZEN
P1 Recall Pack = FROZEN
P1-14 Commission Pack = FROZEN
```

Key P1-14 assertions (frozen): disabled→no accrual; 30% correct; historical 25% survives 30%; performer≠Appointment.providerId; multi-share no double-count; refund/partial refund; cancel before earn; self-edit denied; owner report reconciles.

### Cross-cutting

```text
Combined Traceability Pack = FROZEN
Migration Clean/Upgrade Packs = FROZEN
Regression / onepass closure = FROZEN
```

---

## Framework reuse (frozen)

```text
Jest unit/integration
Postgres DB validators
existing CI philosophy
deterministic --runInBand / onepass patterns
```

Do not invent a second test framework without Freeze amendment.
