# ROUND_1_PRODUCTION_PATH_MATRIX

| Path | Proof | Mocked? |
|------|-------|---------|
| TreatmentCourse create HTTP | wave-e-production-path.postgres.integration.spec.ts | **NO** — real services + DB |
| CourseSession link + intervals | wave-e-round1 + aesthetic | real services |
| Device create/correct | wave-e-round1 + aesthetic | real services |
| Dermatology Encounter + photo | attachDermatologyPhoto + round1 | real services |
| PRE/POST PatientFormInstance | PrePostCareService.createInstance | real services |
| Aesthetic inventory | No dedicated Wave E consume endpoint; reuse InventoryUsageLedger by frozen interpretation (asserted) | N/A |
| Course-aware PER_COURSE booking | CreateAppointmentHandler + treatmentCourseId | real handler path |

wave-e-http may still mock for DTO/RBAC isolation; acceptance proof is production-path + round1 suites.
