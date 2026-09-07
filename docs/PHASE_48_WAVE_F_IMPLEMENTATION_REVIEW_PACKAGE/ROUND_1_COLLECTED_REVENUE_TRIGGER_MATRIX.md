# ROUND_1_COLLECTED_REVENUE_MATRIX

| Rule | Enforcement |
|------|-------------|
| Allowed combos | SERVICE_* + INVOICE_OR_CHARGE_FINALIZED; COLLECTED_REVENUE + PAYMENT_COLLECTED |
| User-default only | `branchId` / `clinicalServiceId` must be null at create + publish |
| Publish lock | `pg_advisory_xact_lock(hashtext(tenantId\|\|':'\|\|userId))` |
| Future publish | `effectiveFrom > today(UTC)` → do **not** supersede prior ACTIVE |
| Current publish | `effectiveFrom <= today` → supersede same-scope ACTIVE |
| Invoice post path | Requires INVOICE_OR_CHARGE_FINALIZED; rejects COLLECTED_REVENUE |
| Payment post path | `POST .../accruals/post-collected`; requires COLLECTED_REVENUE + PAYMENT_COLLECTED |
| Cap | Cumulative EARNED/SETTLED for (perf,user,line,COLLECTED) ≤ round(attributedNet × %) |
| Idempotency | `earn_pay:{perf}:{user}:{line}:{payment}` |
