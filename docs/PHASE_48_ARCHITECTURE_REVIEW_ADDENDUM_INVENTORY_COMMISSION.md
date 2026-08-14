# Phase 48 — Architecture Review Addendum
## Inventory Usage Accountability + Staff Commission / Revenue Share

| Field | Value |
|-------|--------|
| **Master Roadmap** | Healthcare ERP Master Roadmap v6 |
| **Phase** | 48 — Enterprise QA & Testing |
| **Stage** | Architecture Review **Addendum** |
| **Status** | **Addendum ACCEPTED AND COMPLETE.** Architecture Freeze **ACCEPTED AND COMPLETE**. Implementation **AUTHORIZED** — **Wave A ONLY**. Waves B–I / Phase 49 **NOT AUTHORIZED**. |
| **Branch** | `cursor/phase48-enterprise-qa-architecture-review` |
| **Discovery HEAD** | `daf15c8bf1303f09780685ff5cf7df50da2f13ec` |
| **Implementation** | **AUTHORIZED** — Wave A only |

**Companion deep-dives:**

- `docs/PHASE_48_INVENTORY_USAGE_ACCOUNTABILITY_ARCHITECTURE.md`
- `docs/PHASE_48_STAFF_COMMISSION_REVENUE_SHARE_ARCHITECTURE.md`

**Preserved accepted ADRs:** AR-01 … AR-19 (unchanged intent).

**New ADRs:** AR-20, AR-21, AR-22.

---

## 1. Repository evidence (read-only)

### Inventory (reuse)

| SoR | Evidence |
|-----|----------|
| Inventory item | `InventoryItem` — `apps/api/prisma/schema.prisma` |
| Stock qty | `InventoryItem.quantityOnHand` + `InventoryWarehouseStock` |
| Batch/lot/expiry | `InventoryBatch` (lotNumber, expiryDate, quantityOnHand, status) |
| Stock movement ledger | `InventoryStockMovement` (INITIAL/RECEIVE/CONSUME/ADJUST) |
| Consumption log (PARTIAL) | `InventoryConsumptionLog` — encounter/patient/procedureCode/`consumedBy` only; **no** usedBy≠recordedBy, **no** batchId, **no** usageType/reversal |
| Disposal | `InventoryDisposalLog` |
| Warehouses/transfers/counts/POs | `InventoryWarehouse*`, `InventoryStockTransfer*`, `InventoryStockCount*`, `PurchaseOrder*` |
| Default procedure material maps | `DentalProcedureMaterial`, `BeautyProcedureMaterial` |
| Consume path | `apps/api/src/modules/inventory/application/handlers/consume-inventory.handler.ts` — FIFO batches + warehouse delta + consumption log + stock movement (**not one atomic guarantee documented**; `consumedBy` doubles as performer+recorder) |
| Permissions | `inventory-permission.guard.ts` |

```text
duplicate inventory SoR required = NO
```

### Staff / finance (reuse)

| SoR | Evidence |
|-----|----------|
| User/provider | `User` + appointment `providerId` |
| Invoice lines / payments / refunds | `Invoice`, `InvoiceLineItem`, `InvoicePayment`, `InvoiceRefund`, `InvoiceWriteOff` |
| Commission module (PARTIAL) | `apps/api/src/modules/commission/*` + `CommissionRule`, `CommissionCalculation`, `CommissionLineItem` |
| Commission UX | `apps/clinic-dashboard/.../CommissionRulesPage` |
| Rate types | `CommissionRateType` PERCENTAGE \| FIXED_AMOUNT |
| Calculation status | DRAFT → CALCULATED → APPROVED → PAID \| DISPUTED |
| Gaps vs P1-14 | Rules use free-text `serviceType`; period calc from invoices by `providerId` — **not** actual ServicePerformance; no explicit owner YES/NO + default % UX contract; limited refund/reversal/version immutability vs global bar |
| Payroll engine | **Not** present as full payroll SoR |

```text
full payroll engine introduced = NO
existing commission SoR = YES (IMPROVE, do not replace with parallel engine)
```

---

## 2. Priority register update

```text
P0-01 … P0-09 = unchanged
P0-10 = Inventory Consumption & User Attribution  (mandatory; DEFER invalid)

P1-01 … P1-13 = unchanged
P1-14 = Staff Commission / Revenue Share  (Phase 48 planning mandatory)
```

---

## 3. AR-20 — Inventory Usage & Accountability

| Field | Content |
|-------|---------|
| Problem | Silent/weak attribution: consumption log lacks usedBy≠recordedBy, batch FK, typed usage, reversals; P0-08 must not create a second ledger |
| Options | (1) New parallel usage SoR (2) **Evolve InventoryConsumptionLog → InventoryUsageLedger** (3) StockMovement-only |
| **Chosen** | **IMPROVE** existing Inventory domain: generalize consumption into **InventoryUsageLedger** (or equivalent evolution of `InventoryConsumptionLog`) paired 1:1 with authoritative `InventoryStockMovement`; keep `InventoryItem`/`InventoryBatch` masters |
| Invariant | Posted consumption ⇒ attributable usage entry **and** stock movement in **one synchronous transaction** |
| usedBy / recordedBy | Distinct mandatory semantics; **INV-B01:** every human-driven stock-affecting event requires accountable human (usedBy/responsible/approver as applicable); department alone insufficient |
| P0-08 | Clinical/injectable specialization **of the same InventoryUsageLedger event** — **INV-B02:** no separate ProductBatchUsage consumption ledger |
| P0/P1 | P0-10 (+ integrates P0-08) |

```text
duplicate inventory master = NO
duplicate batch SoR = NO
silent stock consumption = NO
departmentOnlyStockAccountabilityAllowed = NO
separateProductBatchUsageConsumptionLedger = NO
INV-B01 = CLOSED
INV-B02 = CLOSED
```

---

## 4. AR-21 — Service Performance Attribution

| Field | Content |
|-------|---------|
| Problem | Commission/revenue attribution must not blindly use `Appointment.providerId` |
| **Chosen** | First-class `ServicePerformance` + `ServicePerformanceParticipant` (PRIMARY + optional ASSISTING + attributionShare ≤ 100%) |
| Appointment.providerId | Scheduling/ownership context only — **not** automatic performer |
| Immutability | Completed performance attribution immutable except audited correction |
| P0/P1 | Supports P1-14; also owner “who performed what” |

```text
Appointment.providerId treated as automatic performer = NO
```

---

## 5. AR-22 — Staff Commission / Revenue Share

| Field | Content |
|-------|---------|
| Problem | Owner needs YES/NO + %; historical rates must not mutate past accruals; refunds/settlement needed |
| Options | (1) New parallel commission engine (2) **IMPROVE existing commission module** |
| **Chosen** | **IMPROVE** `CommissionRule` → versioned **StaffCommissionPlanVersion** semantics; **IMPROVE** `CommissionCalculation`/`CommissionLineItem` toward append-only accruals with reversals; settlement via APPROVED→PAID (or settlement reference) — **no** full payroll engine |
| Owner UX | `commissionEnabled` YES/NO + default percentage 0–100 + effectiveFrom |
| Default basis | `SERVICE_NET_AFTER_DISCOUNT` (extensible enum) |
| Default earning trigger | Invoice/service charge **finalized** for NET bases; **COLLECTED_REVENUE** earns as payments collect |
| Historical recalculation from current rate | **NO** |
| Eligibility | ProviderServiceEligibility ≠ commission eligibility |
| P0/P1 | P1-14 |

---

## 6. Implementation waves (updated)

```text
Wave A — Foundation (canonical services, translations, tenant config, PriceVersion, migration)
Wave B — Booking Integrity (snapshots, eligibility, resources, concurrency)
Wave C — Clinical Safety & Inventory Accountability
        forms/consent, photo consent, InventoryUsageLedger, P0-08 specialization, owner inventory reports
Wave D — Dental Integration (+ dental material usage via usage ledger, ServicePerformance)
Wave E — Aesthetic / Dermatology (+ aesthetic material/batch usage, ServicePerformance)
Wave F — Workforce Commercials
        StaffCommissionPlanVersion, ServicePerformance finalization, CommissionAccrual/reversals,
        settlement reference, owner commission reports
Wave G — Engagement (recall, waitlist, AvailabilityException)
Wave H — UX / Localization / Accessibility (+ owner inventory/commission UX)
Wave I — Enterprise QA Closure (P0/P1 packs including P0-10 & P1-14 + combined traceability)
```

---

## 7. Freeze blockers (addendum)

```text
P0-10 freeze blockers = 0
P1-14 freeze blockers = 0
INV-B01 human accountability = CLOSED
INV-B02 ProductBatchUsage ledger ambiguity = CLOSED
inventory SoR ambiguity = 0
commission basis ambiguity = 0 (default chosen; enum extensible)
performance attribution ambiguity = 0
refund/reversal ambiguity = 0
legacy fabrication risk = 0 (LEGACY_UNATTRIBUTED; commission default OFF)
```

---

## 8. Acceptance

All Part 32 criteria met. INV-B01/B02 closed.  
**Architecture Review Addendum = ACCEPTED AND COMPLETE.**  
**Freeze SSOT:** `docs/PHASE_48_ARCHITECTURE_FREEZE.md`.

```text
Architecture Review Addendum = ACCEPTED AND COMPLETE
ready for external Phase 48 Architecture Freeze acceptance = YES
Architecture Freeze authorized = NO (pending external)
Architecture Freeze externally accepted = YES
Implementation authorized = YES
current wave = A
Waves B–I authorized = NO
Phase 49 authorized = NO
```
