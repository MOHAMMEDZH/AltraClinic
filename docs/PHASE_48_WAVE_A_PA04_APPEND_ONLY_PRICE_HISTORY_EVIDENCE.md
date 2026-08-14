# Phase 48 Wave A — PA-04 Append-Only Price History Evidence

| Field | Value |
|-------|--------|
| **Function** | `ClinicalPriceVersionService.publish` |
| **Status** | CLOSED |

## Old behavior

On future publish, prior ACTIVE rows were updated in place:

```text
prior.effectiveTo = fresh.effectiveFrom
```

This mutated published commercial history.

## Corrected behavior

```text
publish draft → ACTIVE only (status/publishedAt/publishedBy)
do NOT update any prior published commercial fields
multiple ACTIVE versions may coexist
lookup = latest ACTIVE where effectiveFrom <= T
  and (effectiveTo is null OR effectiveTo > T)
  for the full commercial key
```

Conflict on publish only when another ACTIVE shares the same `effectiveFrom`
(or both have explicit closed ranges that traditionally overlap).

## Proof

PostgreSQL integration tests:

```text
PA-04 future publish … prior commercial row immutable = PASS
PA-04-D future scheduling chain = PASS
concurrent superseding without mutating prior = PASS
```

Unit test:

```text
does not mutate prior ACTIVE commercial fields = PASS
```
