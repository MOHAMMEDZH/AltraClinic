# MEDIA_PATIENT_TENANT_VALIDATION (Round 5 H5)

Canonical path: `UploadMediaHandler.execute` (not controller-only).

Before `MediaAsset.create` / `repo.save`:

1. If category `requiresPatientLink()` and `patientId` missing → reject.
2. If `patientId` present → `patient.findFirst({ id, tenantId: active tenant, deletedAt: null })`. Missing/cross-tenant → `NotFoundException` (`patientId does not belong to the current tenant`).
3. If `clinical.encounterId` present → encounter must belong to active tenant; if patient also present, encounter.patientId must match.

## Tests (`wave-c-media-patient`)

Repository `save` is captured. Denied requests must not persist.

| Case | Result | Rows saved |
|------|--------|------------|
| Protected category + Tenant A patient (Tenant A context) | success | MediaAsset created; `requiresPhotoConsent=true` |
| Protected category + Tenant B patient | reject `NotFoundException` | **0** |
| Protected category + unknown patient UUID | reject `NotFoundException` | **0** |
| Non-protected `invoice_attachment` without patient | success | created; `requiresPhotoConsent=false` |

## Photo-consent regression

`wave-c-consent` C-CONSENT-13/14/15/20 still pass: PHOTO_CONSENT gate, signed consent allows protected media, missing/wrong patient/tenant denies, voided history + category flag unchanged.
