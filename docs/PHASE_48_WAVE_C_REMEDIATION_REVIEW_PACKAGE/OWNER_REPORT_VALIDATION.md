# OWNER_REPORT_VALIDATION (Round 2 — C-INV-36 isolated datasets)

Semantics (`signedUsageQuantity`):

- `status = REVERSED` → **0**
- `usageType = REVERSAL` → **0**
- otherwise POSTED consumption/correction/etc. → **+|quantity|**

Filter: each case uses its own `clinicalServiceId` so rows from other cases are not mixed in.

Command:

```
npx jest --config jest.integration.config.cjs --runInBand --testNamePattern="C-INV-36" src/modules/inventory/tests/wave-c-inventory-accountability.postgres.integration.spec.ts
```

Result: **PASS** (included in full Wave C packs this pass: 11 suites / 144 tests).

---

## Case 1 — a single usage of 5 ⇒ net **5**

| Row | usageType | status | quantityUsed | signedQuantity |
|-----|-----------|--------|--------------|----------------|
| 1 | CLINICAL_CONSUMPTION | POSTED | 5 | **5** |

**netQuantityTotal = 5**

No other rows in this filter.

---

## Case 2 — that same usage fully reversed ⇒ net **0**

Isolated from Case 1 (new `clinicalServiceId`). One posted usage of 5, then `reverseUsage` on **that** ledger id.

| Row | usageType | status | quantityUsed | signedQuantity |
|-----|-----------|--------|--------------|----------------|
| original | CLINICAL_CONSUMPTION | REVERSED | 5 | **0** |
| compensating | REVERSAL | POSTED | 5 | **0** |

**netQuantityTotal = 0**

There is **no** leftover intact usage of 5 in this case. The earlier “after reverse pair ⇒ 5” figure was from mixing Case 1’s intact row with a reversed pair in the same filter; that mixed dataset is no longer used.

---

## Case 3 — a usage of 5 corrected to 3 ⇒ net **3**

Isolated `clinicalServiceId`. Original usage 5, then `correctUsage` replacement quantity 3.

Observed rows (FIFO may split the replacement across batches):

| Row | usageType | status | quantityUsed | signedQuantity |
|-----|-----------|--------|--------------|----------------|
| original | CLINICAL_CONSUMPTION | REVERSED | 5 | **0** |
| compensating | REVERSAL | POSTED | 5 | **0** |
| replacement line(s) | CORRECTION | POSTED | 2 + 1 (sum **3**) | 2 + 1 (sum **3**) |

**netQuantityTotal = 3**

Replacement may be one or more POSTED `CORRECTION` lines; the test asserts the **sum** of replacement `quantityUsed` / `signedQuantity` is 3, not a single-row shape.
