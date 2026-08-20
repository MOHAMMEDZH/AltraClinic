# Child / Parent Tenant Invariant Matrix (Wave E — Round 2)

DB triggers (Wave D Round 2 pattern) applied in:

- `20260820120000_phase48_wave_e_aesthetic_dermatology`
- accountability: `20260820140000_phase48_wave_e_round1_remediation`

Mirrored in `apps/api/prisma/triggers.sql`. **No Round 2 migration** (app/test-only closure for relation proof).

Relation-by-relation test matrix: `ROUND_2_DB_RELATION_TEST_MATRIX.md` (authoritative for R2-B5 PASS claims).

| Child / parent table | Child tenant column | Parent reference | Parent tenant source | DB protection | Mixed-tenant / dangerous shape | Evidence | Result |
|----------------------|--------------------|------------------|---------------------|---------------|--------------------------------|----------|--------|
| `treatment_courses` | `tenantId` | `patientId` | `patients.tenantId` | `enforce_treatment_course_tenant_integrity` | mixed-parent INSERT + parent-switch UPDATE | wave-e-rls | PASS |
| `treatment_courses` | `tenantId` | `clinicalServiceId` | service definition tenant / system canonical | Same trigger | mixed INSERT + parent-switch | wave-e-rls | PASS |
| `treatment_courses` | `tenantId` | `packagePriceVersionId` (optional) | `clinical_service_price_versions.tenantId` | Same trigger | mixed INSERT + parent-switch | wave-e-rls | PASS |
| `treatment_courses` | `tenantId` | `createdBy` | `users.tenantId` | `enforce_treatment_course_accountability_tenant` | mixed INSERT + parent-switch | wave-e-rls | PASS |
| `course_sessions` | `tenantId` | `courseId` | `treatment_courses.tenantId` | `enforce_course_session_tenant_integrity` | dangerous shape + parent-switch | wave-e-rls | PASS |
| `course_sessions` | `tenantId` | `appointmentId` (optional) | `appointments.tenantId` | Same trigger | mixed INSERT + parent-switch | wave-e-rls | PASS |
| `device_treatment_records` | `tenantId` | `patientId` | `patients.tenantId` | `enforce_device_treatment_record_tenant_integrity` | dangerous shape + parent-switch | wave-e-rls | PASS |
| `device_treatment_records` | `tenantId` | `providerId` | `users.tenantId` | Same trigger | mixed INSERT + parent-switch | wave-e-rls | PASS |
| `device_treatment_records` | `tenantId` | `clinicalServiceId` | service tenant / system canonical | Same trigger | mixed INSERT + parent-switch | wave-e-rls | PASS |
| `device_treatment_records` | `tenantId` | `branchId` (optional) | `branches.tenantId` | Same trigger | mixed INSERT + parent-switch | wave-e-rls | PASS |
| `device_treatment_records` | `tenantId` | `encounterId` (optional) | `encounters.tenantId` | Same trigger | mixed INSERT + parent-switch | wave-e-rls | PASS |
| `device_treatment_records` | `tenantId` | `beautyAnnotationId` (optional) | `beauty_annotations.tenantId` | Same trigger | mixed INSERT + parent-switch | wave-e-rls | PASS |
| `device_treatment_records` | `tenantId` | `recordedBy` | `users.tenantId` | accountability trigger | mixed INSERT + parent-switch | wave-e-rls | PASS |
| `device_treatment_records` | `tenantId` | `correctedBy` (optional) | `users.tenantId` | accountability trigger | parent-switch when set | wave-e-rls | PASS |
| `device_treatment_records` | — | `deviceId` | **opaque** — not a parent FK | none | N/A | schema + assertOpaque | N/A |

## Notes

- Triggers fire on INSERT and UPDATE.
- App-layer checks run inside `withPlatformBypass` transactions; RLS suites prove shapes under `booking_app` with bypass OFF.
- No DermatologyRecord child table (AR-15).
- Do not claim PASS by analogy — each row above has a named rls test (see Round 2 DB matrix).
