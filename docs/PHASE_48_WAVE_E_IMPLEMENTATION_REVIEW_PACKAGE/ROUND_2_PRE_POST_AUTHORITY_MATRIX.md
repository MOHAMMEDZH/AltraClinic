# ROUND_2_PRE_POST_AUTHORITY_MATRIX

Invariant: patient PRE/POST workflow **must not** create/publish `ClinicalFormTemplate` or `ClinicalFormVersion`. Instance binds an existing **PUBLISHED** version.

Production: `PrePostCareService.createInstance` (`pre-post-care.service.ts`).

| Case | Expected | Evidence | Result |
|------|----------|----------|--------|
| R2-B4-T1 PUBLISHED PRE_CARE → instance | success | `wave-e-round2` | PASS |
| R2-B4-T2 PUBLISHED POST_CARE → instance | success | same | PASS |
| R2-B4-T3 no published PRE_CARE | reject | same | PASS |
| R2-B4-T4 DRAFT-only version | reject (`must be PUBLISHED`) | same | PASS |
| R2-B4-T5 cross-tenant version | reject | same | PASS |
| R2-B4-T6 wrong form kind | reject | same | PASS |
| R2-B4-T7 exact `versionId` persisted | instance.versionId matches seeded | co-located T1/T7/T8/T9 | PASS |
| R2-B4-T8 zero new templates | template count unchanged | same | PASS |
| R2-B4-T9 zero new versions | version count unchanged | same | PASS |
| R2-B4-T10 audit failure | no partial instance | same | PASS |

HTTP: R2-B6-E production-path — PRE + POST bind seeded versions; counts unchanged; other-tenant published only → reject.
