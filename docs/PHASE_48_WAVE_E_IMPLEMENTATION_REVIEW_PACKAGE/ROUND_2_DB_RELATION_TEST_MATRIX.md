# ROUND_2_DB_RELATION_TEST_MATRIX

Evidence suite: `apps/api/src/modules/aesthetic/tests/wave-e-rls.postgres.integration.spec.ts` (NOBYPASSRLS `booking_app`).
DB triggers: Wave E + Round 1 migrations / `apps/api/prisma/triggers.sql`.

| Child table | FK/ref | Tenant-owned parent? | App validation | DB invariant | Mixed-parent INSERT test | Parent-switch UPDATE test | Immutable? | Result |
|-------------|--------|----------------------|----------------|--------------|--------------------------|---------------------------|------------|--------|
| `treatment_courses` | `patientId` | yes (`patients`) | `assertTenantPatient` | `enforce_treatment_course_tenant_integrity` | yes — rejected | yes — rejected; row unchanged | no (mutable but trigger-guarded) | PASS |
| `treatment_courses` | `clinicalServiceId` | yes (or system-canonical null tenant) | `assertReadableClinicalService` | same trigger | yes — tenant-owned foreign rejected | yes — rejected | no | PASS |
| `treatment_courses` | `packagePriceVersionId` | yes (`clinical_service_price_versions`) | `assertPackagePriceVersionForCourse` / assert PV | same trigger | yes — rejected | yes — rejected | no | PASS |
| `treatment_courses` | `branchId` | — | — | — | N/A (column absent) | N/A | N/A | N/A |
| `treatment_courses` | `createdBy` | yes (`users`) | actor required | `enforce_treatment_course_accountability_tenant` | yes — rejected | yes — rejected | yes (accountability) | PASS |
| `course_sessions` | `courseId` | yes (`treatment_courses`) | scoped find + service | `enforce_course_session_tenant_integrity` | yes — dangerous shape / mixed course | yes — `parent-switch UPDATE courseId` | no | PASS |
| `course_sessions` | `appointmentId` | yes (`appointments`) | `assertTenantAppointment` + patient/service | same trigger | yes — rejected | yes — rejected | no | PASS |
| `device_treatment_records` | `patientId` | yes | `assertTenantPatient` | `enforce_device_treatment_record_tenant_integrity` | yes — dangerous shape / foreign patient | yes — rejected | no | PASS |
| `device_treatment_records` | `providerId` | yes (`users`) | `assertTenantUser` | same trigger | yes — rejected | yes — rejected | no | PASS |
| `device_treatment_records` | `clinicalServiceId` | yes / system-canonical | `assertReadableClinicalService` | same | yes — rejected | yes — rejected | no | PASS |
| `device_treatment_records` | `branchId` | yes (`branches`) | `assertTenantBranch` | same | yes — rejected | yes — rejected | no | PASS |
| `device_treatment_records` | `encounterId` | yes (`encounters`) | `assertTenantEncounter` + patient/branch | same | yes — rejected | yes — rejected | no | PASS |
| `device_treatment_records` | `beautyAnnotationId` | yes | `assertTenantBeautyAnnotation` | same | yes — rejected | yes — rejected | no | PASS |
| `device_treatment_records` | `recordedBy` | yes (`users`) | set from actor | accountability trigger | yes — rejected | yes — rejected | yes (accountability) | PASS |
| `device_treatment_records` | `correctedBy` | yes (`users`) | set on correct path | accountability trigger | N/A at create (null); UPDATE covered | yes — rejected | yes when set | PASS |
| `device_treatment_records` | `deviceId` | **no** — opaque external VARCHAR(120) | `assertOpaqueExternalDeviceId` | no FK | N/A | N/A | N/A | N/A |

Dermatology photos use existing `MediaAsset` (not a Wave E child FK table) — see `ROUND_2_DERM_PHOTO_CONTEXT_MATRIX.md`.
