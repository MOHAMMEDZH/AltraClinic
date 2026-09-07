# Child / Parent Tenant Invariant Matrix (Wave D Round 3)

Round 3 adds explicit QA proof for remaining B4 gaps. Round 2 DB triggers unchanged.

| Child table | Child tenant column | Parent reference | Parent tenant source | DB protection | RLS behavior | Mixed-tenant INSERT test (session tenant B) | Parent-switch UPDATE test | Result |
|-------------|--------------------|------------------|---------------------|---------------|--------------|---------------------------------------------|---------------------------|--------|
| treatment_plan_item_appointments | tenantId | planItemId | treatment_plan_items.tenantId | Trigger `enforce_treatment_plan_item_appointment_tenant_integrity` | tenantId must equal session tenant | `mixed-tenant parent INSERT...` | `parent-switch UPDATE is rejected...` (planItemId → itemB) | PASS |
| treatment_plan_item_appointments | tenantId | appointmentId | appointments.tenantId | Same trigger | Same | same | `R3 parent-switch UPDATE rejected for link appointmentId` | PASS |
| dental_lab_case_attachments | tenantId | labCaseId | dental_lab_cases.tenantId | Trigger `enforce_dental_lab_case_attachment_tenant_integrity` | Same | **`R3-T1...`** (labCaseId=caseA, mediaAssetId=mediaB) | `R3 parent-switch UPDATE rejected for attachment labCaseId...` | PASS |
| dental_lab_case_attachments | tenantId | mediaAssetId | media_assets.tenantId | Same trigger | Same | Round 2 mixed-tenant INSERT | `parent-switch UPDATE is rejected...` (mediaAssetId → mediaB) | PASS |
| service_performance_participants | tenantId | performanceId | service_performances.tenantId | Trigger `enforce_service_performance_participant_tenant_integrity` | Same + wrong-child INSERT RLS | **`R3-T2...`** + **`R3-T4...`** (wrong child tenantId) | `R3 parent-switch UPDATE rejected for attachment labCaseId and participant performanceId` | PASS |
| service_performance_participants | tenantId | userId | users.tenantId | Same trigger | Same | Round 2 mixed-tenant INSERT | `parent-switch UPDATE is rejected...` (userId → actorB) | PASS |
| service_performance_corrections | tenantId | performanceId | service_performances.tenantId | Trigger `enforce_service_performance_correction_tenant_integrity` | Same + wrong-child INSERT RLS | **`R3-T3...`** + **`R3-T5...`** (wrong child tenantId) | **N/A** — RLS `tenant_update USING (false)` append-only; see immutability test | DOCUMENTED |
| service_performance_corrections | tenantId | actorId | users.tenantId | Same trigger | Same | Round 2 mixed-tenant INSERT | **N/A** — append-only via RLS | DOCUMENTED |

Parent tables (`dental_lab_cases`, `service_performances`) retain tenant-scoped RLS; child-trigger coverage addresses mixed-tenant parent-id shape on child rows at INSERT (and UPDATE where RLS permits mutation).

All Round 3 tests: `apps/api/src/modules/dental/tests/wave-d-rls.postgres.integration.spec.ts` under `booking_app` / NOBYPASSRLS.
