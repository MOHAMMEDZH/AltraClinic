# Phase 48 — Enterprise QA Acceptance Architecture

| Field | Value |
|-------|--------|
| **Stage** | Architecture Review only |
| **Decision** | AR-19 (updated for AR-B01…B04) |
| **Discovery input** | `docs/PHASE_48_QA_TEST_ARCHITECTURE_INVENTORY.md` |
| **Implementation** | NOT AUTHORIZED — packs define future validation |

Reuse Jest, Postgres DB validators, CI workflows, and onepass philosophy. **Do not** introduce a second test framework.

---

## 1. Principles

```text
deterministic one-pass preferred
--runInBand for integrity packs
feature-flag aware fixtures
tenant isolation asserted on every new SoR
EXISTS != GLOBALLY COMPETITIVE
```

---

## 2. P0 Catalog Integrity Pack

| Assert | Layers |
|--------|--------|
| stableKey immutable after publish | unit + DB |
| AR/EN translations required for publish | unit + API |
| **two tenants enable same SYSTEM_CANONICAL service without duplicate definition** | DB |
| **tenant prices differ without duplicate canonical service** | DB |
| **TENANT_CUSTOM cannot collide with canonical stable key namespace** | DB |
| tenant enable/disable via configuration only | API + DB |
| deactivation blocks new booking, preserves history | integration + E2E |
| history preservation on rename/presentation override | DB |

Maps: P0-01, P1-08 (partial), AR-B01.

---

## 3. P0 Pricing / Snapshot Pack

| Assert | Layers |
|--------|--------|
| Clinic A ≠ Clinic B price same canonical service | DB |
| booking creates snapshot **revision 1** | DB |
| explicit pre-confirm service/price change creates **revision 2**; revision 1 unchanged | DB |
| **in-place identity/price mutation impossible** | DB |
| **CONFIRMED locks commercial identity** (global) | API + DB |
| **time-only reschedule after confirm does not reprice** | API + DB |
| future PriceVersion activation does not change snapshot | DB |
| **invoice uses effective snapshot revision** (never live PriceVersion) | API + integration |
| legitimate zero only with snapshot commercial reason | API |
| authz on price publish | API + permissions |
| audit on publish / revision / correction | DB/audit |
| branch override precedence | DB |
| legacy unmapped remains readable | DB |

Maps: P0-02, P0-07, P1-01, P1-02, AR-B04.

---

## 4. P0 Scheduling Concurrency Pack

| Assert | Layers |
|--------|--------|
| **same provider / no existing row / simultaneous create → exactly one success** | Postgres concurrency |
| same resource / simultaneous create → exactly one success | Postgres concurrency |
| **provider + resource locks acquired in deterministic sorted order** | unit + integration |
| overlap re-check under lock | integration |
| reschedule race → exactly one valid state | Postgres |
| cancel/rebook race | Postgres |
| portal idempotency duplicate submit (separate from locks) | API |
| different non-conflicting slots may proceed | Postgres |
| PENDING consumes slot; CANCELLED does not | DB |

Maps: P0-03, AR-B03. Authoritative primitive under test: **advisory locks + re-check**.

---

## 5. P0 Provider Eligibility Pack

| Assert | Layers |
|--------|--------|
| **enforcement ON + zero eligibility rows → booking denied** | API |
| **enforcement ON + zero rows → provider absent from portal slots** | API |
| expired eligibility → denied | API |
| branch mismatch → denied | DB |
| cross-tenant eligibility row → denied | DB security |
| ineligible provider cannot book | API |
| enforcement OFF preserves legacy (flagged compatibility) | API |
| activation blocked without coverage readiness when requiring ON | API |

Maps: P0-04, AR-B02. **No implicit allow.**

---

## 6. P0 Consent Pack

| Assert | Layers |
|--------|--------|
| signed instance references exact published version | DB |
| AR/EN version content | unit + API |
| missing required consent blocks treatment completion | API |
| photo consent gates media access | API |
| historical signed version immutable | DB |

Maps: P0-06, P0-09.

---

## 7. P0 Injectable Traceability Pack

| Assert | Layers |
|--------|--------|
| treatment usage references inventory batch | DB |
| expired/recalled batch blocked for new usage | API |
| cross-tenant batch denied | DB security |
| history preserved after batch deactivate | DB |

Maps: P0-08.

---

## 8. P0 Treatment Plan Link Pack

| Assert | Layers |
|--------|--------|
| plan item ↔ appointment M:N links | DB |
| multi-visit sequencing preserved | integration |
| reschedule keeps links | API |
| completion command updates item status | API |
| new plan booking links use canonical service when write mode ON | API |

Maps: P0-05.

---

## 9. P1 Packs

| Pack | Focus | Layers |
|------|-------|--------|
| Operatory | OPERATORY type + conflict under advisory locks | DB + API |
| Course scheduling | sessions, intervals, package price | API + DB |
| Device/laser | DeviceTreatmentRecord schema key validation | unit + API |
| Derm workflows | Encounter+service+photo without DermatologyRecord | E2E smoke |
| Lab case | DentalLabCase status transitions | API |
| RTL search/booking | Arabic catalog search + RTL booking | E2E + localization |
| Pre/post care | form kinds delivery | API |
| Waitlist auto-fill | offer/accept/timeout races under same lock model | Postgres + API |
| Holiday/leave | AvailabilityException precedence | unit + API |
| Accessibility/tablet | WCAG smoke + tablet calendar targets | UI + a11y |
| Recall | RecallRule due→book→complete; ≠ reminder only | API + notifications |
| **P1-14 Commission** | enable/disable; versioned %; performer≠appointment.providerId; multi-share; basis; refunds; settlement; self-edit deny | unit + API + DB + audit |

---

## 9A. P0-10 Inventory Accountability Pack

| Assert | Layers |
|--------|--------|
| clinical consumption decrements stock + writes usage atomically | Postgres + API |
| clinical consumption without usedBy → reject | API |
| operational consumption with department only / no responsible user → reject | API |
| wastage without responsible user → reject | API |
| damage without responsible user → reject | API |
| expired disposal without accountable human → reject (unless valid SYSTEM workflow) | API |
| sample/promotional without responsible user → reject | API |
| correction without actor + reason → reject | API |
| reversal without actor/reference → reject | API |
| usedBy/responsible may differ from recordedBy → allowed | API |
| owner report resolves accountable human for every posted stock-affecting event | API |
| cross-tenant accountable user → reject | DB security |
| batch-controlled requires valid batch | DB |
| expired/cross-tenant/wrong-branch batch denied | API + DB security |
| insufficient stock denied | API |
| reversal restores per policy; original immutable | DB |
| PHI permission boundary | API |
| P0-08 injectable uses **same** InventoryUsageLedger event (no separate ProductBatchUsage consumption ledger) | integration |

---

## 9B. Combined Traceability Pack

```text
ServicePerformance → Snapshot revision → InvoiceLine → InventoryUsage (+ Batch) → CommissionAccrual
```

Layers: integration + API + DB.

---

## 10. Migration clean/upgrade packs

Assert:

- known standards map to shared canonical (not per-tenant clones)
- every ServicePrice accounted MAPPED / LEGACY_UNMAPPED / AMBIGUOUS
- LEGACY_UNMAPPED readable
- no destructive remap
- no ACTIVE price overlap
- historical dental/beauty nullable mappings preserved

---

## 11. Accessibility ownership

| Class | Owner |
|-------|-------|
| Functional a11y defects blocking booking/consent | Phase 48 QA packs (P1-12) |
| Visual polish | Phase 50 UX |

---

## 12. CI / onepass (future)

```text
test:phase48-p0-concurrency
test:phase48-p0-snapshot-pricing
test:phase48-p0-catalog
test:phase48-p0-eligibility
…
```

Wire after Architecture Freeze + implementation. Do not run full Step 29 to prove design.

---

## 13. Wave I closure criteria

```text
all P0 packs green including P0-10
P1 packs green including P1-14
combined traceability pack green
Release 47 Step 28/29 gates remain green as regression baselines
flaky tests quarantined with deterministic fix — not silenced
```
