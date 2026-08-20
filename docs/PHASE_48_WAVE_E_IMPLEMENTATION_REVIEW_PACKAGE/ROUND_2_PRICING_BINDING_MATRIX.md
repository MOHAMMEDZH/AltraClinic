# ROUND_2_PRICING_BINDING_MATRIX

Invariant: for PER_COURSE / PER_PACKAGE with `treatmentCourseId`, final `priceVersionId` **equals** `TreatmentCourse.packagePriceVersionId`. No generic `lookupActivePrice` override. Patient/service equality required.

Production: `BookingCommercialResolverService.resolveExactCoursePackagePrice` (`booking-commercial-resolver.service.ts`).

| Case | Expected | Evidence | Result |
|------|----------|----------|--------|
| R2-B1-T1 course patient ≠ booking patient | reject; appointments/invoices unchanged | `wave-d-pricing-production-path` `R2-B1-T1` | PASS |
| R2-B1-T2 course service ≠ booking service | reject | `R2-B1-T2` | PASS |
| R2-B1-T3 exact `packagePriceVersionId` | success; `resolved.priceVersionId === course.packagePriceVersionId` | `R2-B1-T3/T4` | PASS |
| R2-B1-T4 other ACTIVE same-unit price present | still binds exact package PV (not other ACTIVE) | `R2-B1-T3/T4` (other ACTIVE unitPrice 9999 ignored) | PASS |
| R2-B1-T5 wrong-tenant course | reject | `R2-B1-T5` | PASS |
| R2-B1-T6 inactive package price on course | reject | `R2-B1-T6` (DRAFT PV) | PASS |
| R2-B1-T7 reject → zero commercial side effects | no appointment/invoice mutation on reject | co-located in `R2-B1-T1` before/after counts; standalone PER_COURSE reject also leaves appointment count unchanged | PASS |

Ordering preserved: `assertCoursePackageBookingContext` → exact course bind (course units) **before** generic `lookupActivePrice` (non-course units only).
