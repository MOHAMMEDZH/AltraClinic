# ROUND_1_DB_RLS_CLOSURE_MATRIX

## Accountability DB invariants (Round 1 migration)
| Ref | Trigger |
|-----|---------|
| TreatmentCourse.createdBy | enforce_treatment_course_accountability_tenant |
| DeviceTreatmentRecord.recordedBy | enforce_device_treatment_accountability_tenant |
| DeviceTreatmentRecord.correctedBy | same |

## Child-parent (existing Wave E + Round 1)
See CHILD_PARENT_TENANT_INVARIANT_MATRIX.md — parent-switch UPDATE tests in wave-e-rls (courseId, appointmentId, patientId, recordedBy, createdBy).

## RLS lifecycle (NOBYPASSRLS booking_app)
Per table treatment_courses, course_sessions, device_treatment_records: same-tenant SELECT/INSERT; cross-tenant SELECT empty; INSERT/UPDATE/DELETE denied — wave-e-rls suite.
