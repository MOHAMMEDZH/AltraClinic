# ROUND_3_PA04_COURSE_PRICING_MATRIX

Invariant: for PER_COURSE / PER_PACKAGE with `treatmentCourseId`, final `priceVersionId` **equals** `TreatmentCourse.packagePriceVersionId` **and** that id remains the PA-04 current ACTIVE price after lock → reconcile → interval validation. No generic `lookupActivePrice` substitute.

Production: `BookingCommercialResolverService.resolveExactCoursePackagePrice` → `ClinicalPriceVersionService.resolveCurrentKeyOutcome` (`booking-commercial-resolver.service.ts`).

Path (order preserved):

1. Course tenant/patient/service/status + required `packagePriceVersionId`
2. Pre-lock identity / currency / unit / branch fail-closed
3. **PA-04** `resolveCurrentKeyOutcome` (advisory lock → reconcile → interval-valid ACTIVE) **once**
4. Post-lock re-read: `outcome.kind === CURRENT_ACTIVE` and `current.id === packagePriceVersionId`
5. Return exact bound price (skips generic lookup for course units)

| Case | Expected | Evidence | Result |
|------|----------|----------|--------|
| R3-B1-T1 ACTIVE + valid effective interval | success; `resolved.priceVersionId === course.packagePriceVersionId` | `wave-d-pricing-production-path` `R3-B1-T1` | PASS |
| R3-B1-T2 / T9 ACTIVE but `effectiveTo` already expired | reject; appointments / invoices / allocations unchanged | `R3-B1-T2/T9` | PASS |
| R3-B1-T3 / T4 due SCHEDULED successor reconciles | current becomes successor; course still bound to V1 → reject (no substitute) | `R3-B1-T3/T4` | PASS |
| R3-B1-T5 branch-specific package + booking `branchId` null | reject | `R3-B1-T5` | PASS |
| R3-B1-T6 branch-specific package + wrong branch | reject | `R3-B1-T6` | PASS |
| R3-B1-T7 global package + booking `branchId` set | success (global applies) | `R3-B1-T7` | PASS |
| R3-B1-T8 concurrent `resolveCanonical` same commercial key | deterministic same `priceVersionId` / unitPrice (lock serialization) | `R3-B1-T8` | PASS |

Round 2 exact-bind cases (R2-B1-T1..T7) remain in force; Round 3 adds PA-04 lifecycle authority on top of exact bind.

See also: `TRANSACTION_CONCURRENCY_VALIDATION.md` (R3-B1-T8).
