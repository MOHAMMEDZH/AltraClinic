# Media Owner Reference Validation (Round 8)

Canonical: `assertMediaOwnerReference()` in `apps/api/src/modules/media/services/media-owner-reference.validation.ts`.

## Invoice owner (Round 7 + Round 8)

Lookup: `id = ownerId`, `tenantId = active tenant`, **`deletedAt = null`**.

Then `invoice.patientId` must match supplied `patientId` when both are present.

| Case | Result | MediaAsset |
|------|--------|------------|
| active same-tenant invoice + matching patientId | success | persisted |
| same-tenant mismatched patientId | 400 | none |
| cross-tenant invoice | 404 | none |
| nonexistent invoice | 404 | none |
| **soft-deleted same-tenant invoice** | **404** | **none** |

## Other owner types (unchanged)

patient / encounter / appointment / beauty_service / dental_chart tenant + patient consistency as Round 7.

Unknown ownerType → 400.

## Tests

`wave-c-media-owner.postgres.integration.spec.ts` (includes soft-deleted invoice) + `wave-c-media-patient.postgres.integration.spec.ts`.
