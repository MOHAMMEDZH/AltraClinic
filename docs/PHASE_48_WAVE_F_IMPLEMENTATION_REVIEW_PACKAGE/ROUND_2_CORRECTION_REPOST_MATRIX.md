# ROUND_2_CORRECTION_REPOST_MATRIX

Frozen: Invoice correction = reverse + re-post (append-only).

## Path
`POST /workforce-commercials/accruals/:id/correct`
→ `correctAndRepost` → `reverseAccrual` (refund-linked) → `postFromServicePerformance`

Successor earn key: `earn:{perf}:{user}:after:{priorId}` when prior fully reversed.

## Tests
| ID | Result |
|----|--------|
| F4-R2-T8 correction reverse+repost | PASS |
