# CLINICAL_FORM_DTO_VALIDATION (Round 5 H4)

DTOs: `apps/api/src/modules/clinical-forms/api/clinical-forms.dto.ts`
Controller write routes use class-validator classes (not inline TypeScript body shapes).

| DTO | Route | Key rules |
|-----|-------|-----------|
| `CreateClinicalFormTemplateDto` | POST `/clinical-forms/templates` | kind enum, non-empty `stableKey` / `nameEn` |
| `CreateClinicalFormVersionDto` | POST `/clinical-forms/templates/:templateId/versions` | non-empty `contentEn` / `contentAr` |
| `CreatePatientFormInstanceDto` | POST `/clinical-forms/instances` | UUID `patientId`, `versionId`; optional UUID appointment/service |
| `SignPatientFormInstanceDto` | POST `/clinical-forms/instances/:id/sign` | optional UUID `signerPatientId`; optional method enum |
| `VoidPatientFormInstanceDto` | POST `/clinical-forms/instances/:id/void` | required non-empty `reason` |
| `UpsertClinicalServiceFormRequirementDto` | PUT `/clinical-forms/requirements` | UUID `clinicalServiceId`; `formKind` enum |

## HTTP (`wave-c-clinical-forms-http`)

Mutation services are stubbed so a 400 proves ValidationPipe ran **before** the service.

| Request | Status | Service called |
|---------|--------|----------------|
| create: malformed `patientId` (`not-a-uuid`) | **400** | no |
| create: malformed `versionId` | **400** | no |
| create: malformed `appointmentId` | **400** | no |
| create: malformed `clinicalServiceId` | **400** | no |
| sign: malformed `signerPatientId` | **400** | no |
| sign: invalid method enum | **400** | no |
| void: missing reason | **400** | no |
| void: empty reason | **400** | no |
| requirements: malformed `clinicalServiceId` | **400** | no |
| requirements: invalid `formKind` | **400** | no |

No malformed write in this suite returned 500.
