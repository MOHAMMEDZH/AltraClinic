# Phase 48 — Inventory Usage & Accountability Architecture (AR-20)

| Field | Value |
|-------|--------|
| **ADR** | AR-20 |
| **Priority** | P0-10 |
| **Related** | P0-08 injectable batch traceability |
| **Implementation** | NOT AUTHORIZED |

---

## 1. Core invariant

```text
Inventory consumed that reduces available stock
=
an attributable InventoryUsageLedger entry exists
AND
an authoritative InventoryStockMovement exists
in one synchronous transaction
```

```text
silent stock consumption = NO
duplicate inventory master = NO
duplicate batch SoR = NO
```

Authoritative SoRs remain:

- `InventoryItem`
- `InventoryWarehouseStock` / warehouse stock
- `InventoryBatch`
- `InventoryStockMovement`
- `InventoryDisposalLog` (disposal path)
- evolved usage ledger (from `InventoryConsumptionLog`)

---

## 2. Chosen model

**Evolve** `InventoryConsumptionLog` → **InventoryUsageLedger** (name may remain mapped table with additive columns during migration).

Do **not** create a second inventory master or second batch master.

### Conceptual fields

```text
id
tenantId
branchId?
warehouseId?
inventoryItemId
inventoryBatchId?          # required when item/batch-controlled consumption
quantity
unit

usageType                  # CLINICAL_CONSUMPTION | OPERATIONAL_CONSUMPTION |
                           # WASTAGE | DAMAGE | EXPIRED | SAMPLE_OR_PROMOTIONAL |
                           # CORRECTION | REVERSAL

usedByUserId?              # clinical consumer/performer
responsibleUserId?         # accountable human for non-clinical stock-affecting events
approvedByUserId?          # optional authorizer (e.g. disposal approval)
recordedByUserId           # who entered/confirmed (always required for human-posted events)

actorType                  # HUMAN | SYSTEM
systemSource?              # required when actorType=SYSTEM
authorizedByUserId?        # required when SYSTEM event was human-initiated

patientId?                 # PHI-gated
appointmentId?
encounterId?
clinicalServiceId?
servicePerformanceId?
treatmentPlanItemId?
beautyAnnotationId?
dentalClinicalRef?

departmentId? / costCenter? / areaContext?   # OPTIONAL metadata ONLY — never replaces accountable human

reasonCode?                # required for WASTAGE/DAMAGE/EXPIRED/CORRECTION
notes?                     # not identity

occurredAt
recordedAt

sourceStockMovementId      # required for stock-affecting posts
costBasisRef?
reversalOfUsageId?
status                     # POSTED | REVERSED
```

### INV-B01 — Universal human accountability (frozen)

```text
Every posted stock-affecting usage/disposal event
must have an accountable human user,
except a genuinely system-generated event with explicit system provenance
and an authorizing human where applicable.
```

```text
usedByUserId / responsibleUserId / approvedByUserId (as applicable)
!=
recordedByUserId
```

```text
departmentOnlyStockAccountabilityAllowed = NO
anonymousHumanStockConsumptionAllowed = NO
```

Department, room, chair, cost center, or operational area may be **additional context only**.

---

## 3. usedBy / responsible vs recordedBy

```text
accountable human (usedBy / responsible / approver as applicable)
!=
recordedByUserId (allowed and expected to differ)
```

Example: doctor uses product; nurse records → `usedBy=doctor`, `recordedBy=nurse`.

Owner reports must aggregate by **accountable human** (primary) and optionally by **recordedBy**.

Do not attribute clinical or operational stock loss solely to the UI actor.

### System-generated events

```text
actorType = SYSTEM
systemSource = explicit
authorizedByUserId = required where a human authorization initiated the process
recordedAt = required
audit event = required
```

**SYSTEM is not a loophole for anonymous human actions.**

---

## 4. Usage types (INV-B01 frozen semantics)

| Type | Accountable human | reason | batch |
|------|-------------------|--------|-------|
| CLINICAL_CONSUMPTION | **usedByUserId REQUIRED** | optional | required if batch-controlled |
| OPERATIONAL_CONSUMPTION | **responsibleUserId REQUIRED**; department/context MAY be additional only | optional | as applicable |
| WASTAGE | **responsibleUserId REQUIRED** | **REQUIRED** | as applicable |
| DAMAGE | **responsibleUserId REQUIRED** | **REQUIRED** | as applicable |
| EXPIRED | **accountable/approving user REQUIRED** for person who executes/approves disposal | **REQUIRED** | **REQUIRED** when lot-tracked |
| SAMPLE_OR_PROMOTIONAL | **responsibleUserId REQUIRED** | recommended | as applicable |
| CORRECTION | **correcting/authorizing user REQUIRED** | **REQUIRED** | — |
| REVERSAL | **reversal actor REQUIRED**; references original | inherits/links | — |

Hard delete of posted usage = **FORBIDDEN**.

---

## 5. Batch / lot / expiry

```text
InventoryItem → InventoryBatch → Usage → User → Patient/Treatment
```

Rules:

- usage references existing `InventoryBatch`
- expired/recalled batch blocked from **new** clinical usage
- deactivated/depleted batch remains historically readable
- cross-tenant batch denied
- wrong-branch/warehouse denied unless transfer semantics permit
- quantity must reconcile with stock movement + batch decrement

FIFO may remain allocation strategy (`consumeFifoBatches`) but the **posted usage must still record which batch(es)** were consumed (multi-line usage allowed if FIFO splits).

---

## 6. P0-08 injectable/clinical specialization (INV-B02 frozen)

```text
InventoryUsageLedger
=
the single authoritative accountable inventory usage/consumption ledger
```

```text
InventoryUsageLedger event
→ existing InventoryBatch
→ clinical/injectable specialization or extension
   (dose, anatomical site, treatment reference, patient/provider context)
```

```text
separate ProductBatchUsage consumption ledger = NO
duplicate inventory usage SoR = NO
duplicate InventoryBatch SoR = NO
```

If a compatibility model/table named `ProductBatchUsage` is retained, it is **ONLY** a typed extension / projection / 1:1 specialization of the authoritative `InventoryUsageLedger` event. It **must not** independently decrement stock or become a competing usage ledger.

Stock decrement authority remains the existing Inventory domain / authoritative `InventoryStockMovement`.

---

## 7. Stock consistency transaction

Preferred: **one synchronous DB transaction**:

1. validate stock/batch/permissions
2. lock stock/batch rows as needed
3. apply stock + batch decrement
4. write `InventoryStockMovement`
5. write `InventoryUsageLedger` with `sourceStockMovementId`
6. commit

Fail closed on insufficient stock / insufficient batch qty.  
**No silent negative stock.**

| Scenario | Behavior |
|----------|----------|
| Insufficient stock | reject |
| Batch qty insufficient | reject |
| Cancelled treatment after post | REVERSAL usage + compensating movement |
| Corrected quantity | reverse original + post new (append-only) |
| Backdated occurredAt | allowed with permission + audit; stock effect still current-policy constrained |
| Branch transfer | use existing transfer SoR; usage is not a silent transfer |

If an outbox is ever required, reconciliation must prove eventual consistency — prefer sync.

---

## 8. Cost / profitability extension

Preserve optional `costBasisRef` pointing at movement/`costPerUnit` valuation owned by Inventory — **do not** create a second accounting cost engine.

Enables future: revenue − inventory cost − commission contribution views.

---

## 9. Owner reporting dimensions

Owner must resolve for every stock-affecting event:

```text
What item?
How much?
Which batch/lot?
Which branch/warehouse?
What usage/disposal type?
Who was responsible? (usedBy / responsible / approver)
Who recorded it?
When?
Why?
Which service/treatment/patient if authorized and applicable?
Was it later corrected/reversed?
```

Report dimensions:

```text
usage by accountable employee (usedBy/responsible)
usage by recorder
usage by provider/servicePerformance
usage by clinical service
usage by branch/warehouse
usage by inventory item
usage by batch/lot
date range
wastage / damage / expiry disposal
corrections/reversals
remaining stock (from Inventory SoR)
```

PHI (patient identifiers) permission-gated; operational reports must not leak unnecessary clinical detail.

---

## 10. Authorization (conceptual)

```text
inventory.usage.record
inventory.usage.correct
inventory.usage.view
inventory.usage.owner-report
```

Inventory permission ≠ commission permission.

---

## 11. Audit events

```text
usage posted
usage reversed
usage corrected
wastage/damage/expired recorded
batch selected/changed before posting
usedBy changed via correction
recordedBy
stock reconciliation exception
```

---

## 12. Lifecycle

```text
posted usage = append-only
hard delete = forbidden
correction = reversal + new post
```

---

## 13. Migration

| Case | Strategy |
|------|----------|
| Existing `InventoryConsumptionLog` / movements | Preserve; map to usage ledger when deterministic |
| Unknown usedBy | `LEGACY_UNATTRIBUTED` — **do not invent** employee |
| Existing Beauty/Dental material maps | Remain default recipes; not historical usage |
| Historical treatment links | Preserve; link only when deterministic |

```text
invented historical employee attribution = NO
destructive remapping = NO
```

---

## 14. P0-10 QA pack (summary — includes INV-B01/B02)

```text
clinical consumption without usedBy → reject
operational consumption with department only and no responsible user → reject
wastage without responsible user → reject
damage without responsible user → reject
expired disposal without accountable human → reject (unless valid documented SYSTEM workflow)
sample/promotional without responsible user → reject
correction without actor + reason → reject
reversal without actor/reference → reject
usedBy/responsible may differ from recordedBy → allowed
owner report resolves accountable human for every posted stock-affecting event
cross-tenant accountable user reference → reject
clinical consumption decrements stock + writes usage atomically
batch-controlled item requires valid batch
expired/cross-tenant/wrong-branch batch denied
insufficient stock denied
reversal restores per policy; original immutable
P0-08 injectable uses the SAME InventoryUsageLedger event (no separate consumption ledger)
```

Layers: unit, API, Postgres DB, integration, tenant isolation, audit.

### Freeze-blocker counters

```text
anonymousHumanStockConsumptionAllowed = 0
departmentOnlyStockAccountabilityAllowed = 0
wastageWithoutResponsibleUserAllowed = 0
damageWithoutResponsibleUserAllowed = 0
expiredDisposalWithoutAccountableUserAllowed = 0
correctionWithoutActorAllowed = 0
reversalWithoutActorAllowed = 0
duplicateInventoryUsageSoR = 0
duplicateInventoryBatchSoR = 0
separateProductBatchUsageConsumptionLedger = 0
staleProductBatchUsageMigrationWording = 0
INV-B01 = CLOSED
INV-B02 = CLOSED
```
