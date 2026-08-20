# ROUND_1_PRICING_CONTEXT_MATRIX

| Case | Expected | Evidence |
|------|----------|----------|
| E1-T1 Standalone PER_COURSE | reject before lookupActivePrice | `assertCoursePackageBookingContext` + wave-d-pricing-production-path |
| E1-T2 Standalone PER_PACKAGE | reject | same |
| E1-T3 Course-aware PER_COURSE | success with treatmentCourseId + ACTIVE package PV | wave-d-pricing-production-path |
| E1-T4 Course-aware PER_PACKAGE | success; PER_PACKAGE binds to TreatmentCourse.packagePriceVersionId (no separate package SoR) | same |
| E1-T5 Wrong tenant course | reject | BookingCommercialResolver.assertTreatmentCourseCommercialContext |
| E1-T6 Wrong patient/service | reject | course.clinicalServiceId must match booking service |
| E1-T7 Wrong unit vs package PV | reject | pricingUnit must equal PV.pricingUnit |
| E1-T8 No side effects on reject | no appt/allocation/invoice/PV mutation | wave-d-pricing-production-path |

Mutation ordering: domain check → course-context assert → course commercial assert → getEffectiveConfig → lookupActivePrice.
