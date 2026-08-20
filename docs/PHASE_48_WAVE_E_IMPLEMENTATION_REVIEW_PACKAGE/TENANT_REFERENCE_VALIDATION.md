# Wave E Tenant Reference Validation (Round 2)

Fail-closed same-tenant reference checks for Wave E writes. Application layer: `wave-e-reference.validation.ts` (+ booking commercial resolver for course pricing). DB triggers: second line — see `CHILD_PARENT_TENANT_INVARIANT_MATRIX.md` / `ROUND_2_DB_RELATION_TEST_MATRIX.md`.

## TreatmentCourse create / mutate

| Reference | Check | Location |
|-----------|-------|----------|
| `patientId` | Exists + `tenantId` match | `assertTenantPatient` |
| `clinicalServiceId` | Readable for tenant (tenant-owned or system canonical) | `assertReadableClinicalService` |
| `packagePriceVersionId` (optional) | Same tenant; service + PER_COURSE/PER_PACKAGE unit + ACTIVE when used commercially | `assertPackagePriceVersionForCourse` / booking exact bind |
| `createdBy` / actor | Authenticated actor required | service + accountability trigger |

Evidence: aesthetic cross-tenant patient; rls mixed-parent INSERT/UPDATE on patient/service/PV/createdBy.

## Course commercial booking (R2-B1)

| Reference | Check | Location |
|-----------|-------|----------|
| `treatmentCourseId` | Same tenant; exists; not COMPLETED/CANCELLED | `resolveExactCoursePackagePrice` |
| Course patient | **Must equal** booking `patientId` | same |
| Course service | Must equal booking `clinicalServiceId` | same |
| Final price | `priceVersionId === course.packagePriceVersionId` (no generic override) | same |

Evidence: `wave-d-pricing-production-path` R2-B1-T1..T7.

## CourseSession link appointment

| Reference | Check | Location |
|-----------|-------|----------|
| Session belongs to course + tenant | findFirst scoped | `linkSessionAppointment` |
| `appointmentId` | Same tenant | `assertTenantAppointment` |
| Appointment patient | Must equal course patient | service |
| Appointment clinical service (when set) | Must match course service | service |
| Intervals | Signed chronology + prior/next neighbors | `assertCourseSessionInterval` |
| Status gate | No link when COMPLETED / CANCELLED / SKIPPED | service |

Evidence: round2 intervals; production-path R2-B6-B; aesthetic link.

## DeviceTreatmentRecord create / correct

| Reference | Check | Location |
|-----------|-------|----------|
| `patientId` | Same tenant | `assertTenantPatient` |
| `providerId` | Same-tenant user (performer; not inferred) | `assertTenantUser` |
| `clinicalServiceId` | Readable for tenant | `assertReadableClinicalService` |
| `branchId` (optional) | Same tenant | `assertTenantBranch` |
| `encounterId` (optional) | Same tenant; patient (+ branch when set) | `assertTenantEncounter` + guards |
| `beautyAnnotationId` (optional) | Same tenant; BeautyRecord patient | `assertTenantBeautyAnnotation` |
| `parameterSchemaKey` | Registry type↔key | `assertDeviceTypeSchemaKey` |
| `deviceId` | Opaque external ≤120; **not** a tenant FK | `assertOpaqueExternalDeviceId` |

Evidence: round1 device; http R2-B3; rls mixed-parent; production-path R2-B6-C.

## Dermatology via Encounter + photo (R2 derm)

| Reference | Check | Location |
|-----------|-------|----------|
| `patientId` / `clinicianId` | Same tenant | patient + user asserts |
| `clinicalServiceId` | Readable; categoryKey dermatology; reject DENTAL | `assertDermatologyServiceEligibility` |
| `appointmentId` (optional) | Same tenant; patient/service/branch match | open path |
| Photo attach | Encounter dermatology-valid; MediaAsset same tenant | `attachDermatologyPhoto` |

Evidence: round2 R2-DERM-T1..T4; production-path R2-B6-D.

## Pre/Post care (R2-B4)

| Reference | Check | Location |
|-----------|-------|----------|
| Published version | Must exist; PUBLISHED; kind match; same tenant | `createInstance` |
| Template/version create | **Forbidden** in this path | service (counts proven) |
| `PatientFormInstance` assert | Same tenant; kind PRE_CARE/POST_CARE | `assertInstanceKind` |

Evidence: round2 R2-B4; production-path R2-B6-E.
