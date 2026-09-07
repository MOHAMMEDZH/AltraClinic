# AUDIT_VALIDATION (Round 6)

| Mutation | Audit action | Captures |
|----------|--------------|----------|
| Package allocation register | `staff_commission.package_allocation.registered` | actor, tenant, course, session, performance, packagePriceVersionId, pricingUnit, basis, currency, allocated |
| Bind performance | `staff_commission.invoice_line.performance_bound` | actor, tenant, provenance ids |
| Correction | `staff_commission.accrual.corrected` | actor, tenant, correctionEventId, stale/replacement lines |
| Collected-payment accrual (package) | existing create action + packageAllocationId in details | actor, tenant, paymentId, packageAllocationId |
| Accrual / reverse / settle | existing Round 1–4 actions | unchanged |

No new public routes in Round 6. Financial mutations retain actor/tenant/source/reason/idempotency requirements.
