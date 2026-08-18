# CLINICAL_FORM_REFERENCE_VALIDATION (Round 5 B2)

Canonical helpers: `apps/api/src/modules/clinical-forms/services/clinical-form-reference.validation.ts`
Called from `PatientFormInstanceService.createDraft` / `sign` and `ClinicalServiceFormRequirementService.upsert`.

Approved clinical service exception: tenant-owned **or** `tenantId IS NULL` **and** `provenance = SYSTEM_CANONICAL`. Arbitrary / other-tenant / non-canonical platform rows are rejected.

## Create draft

| Reference | Owning entity | Same-tenant | Cross-tenant | Nonexistent | Relationship |
|-----------|---------------|-------------|--------------|-------------|--------------|
| `patientId` | `Patient` | required; success | reject (`Patient not found`) | reject | must exist, `deletedAt` null |
| `appointmentId` (optional) | `Appointment` | success when same patient | reject | reject | appointment.patientId must equal form patient; if appointment has a service and `clinicalServiceId` is supplied, they must match |
| `clinicalServiceId` (optional) | `CanonicalClinicalServiceDefinition` | tenant-owned success | reject | reject | `SYSTEM_CANONICAL` platform service allowed |

Tests in `wave-c-consent.postgres.integration.spec.ts` use real fixture rows (no random UUID placeholders for success paths).

## Signatory semantics (approved existing domain)

There is **no** guardian/dependent relationship model in this module.

Allowed methods: `STAFF_WITNESSED` (default) and `PATIENT_SELF`.

| Case | Behavior |
|------|----------|
| `STAFF_WITNESSED` without `signerPatientId` | success; snapshot `signerPatientId` null |
| `PATIENT_SELF` without `signerPatientId` | reject |
| `signerPatientId` = form patient | success (self-sign) |
| nonexistent `signerPatientId` | reject (`Patient not found`) |
| cross-tenant `signerPatientId` | reject (`Patient not found`) |
| other same-tenant patient | reject (`self-sign only`) |

Fail-closed: arbitrary signer UUIDs cannot be frozen into SIGNED history.

## Clinical service form requirements

| Service ID | Result |
|------------|--------|
| Tenant-owned canonical service | success |
| Approved `SYSTEM_CANONICAL` (tenantId null) | success |
| Tenant B service from Tenant A | reject |
| Random/nonexistent UUID | reject |
| `formKind` not in `CLINICAL_FORM_KINDS` | reject |
