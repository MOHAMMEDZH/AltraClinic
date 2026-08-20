# ROUND_3_PRE_POST_PLATFORM_PACK_MATRIX

Invariant: PRE/POST instance create binds an existing **PUBLISHED** version visible as `template.tenantId == current tenant` **OR** `template.tenantId == null` (platform pack). Auto-resolve precedence: **tenant-owned PUBLISHED wins** over platform pack. Patient path **must not** mutate templates/versions (including platform packs).

Production: `PrePostCareService.createInstance` (`pre-post-care.service.ts`). Round 2 R2-B4 authority (no template/version create) remains in force.

| Case | Expected | Evidence | Result |
|------|----------|----------|--------|
| R3-B3-T1 tenant-owned PUBLISHED PRE_CARE | success; binds tenant version | `wave-e-round3` | PASS |
| R3-B3-T2 tenant-owned PUBLISHED POST_CARE | success | same | PASS |
| R3-B3-T3 / T5 / T9 / T10 / T11 platform-pack PRE_CARE | success; exact version; template/version counts + platform status/version unchanged | same | PASS |
| R3-B3-T4 platform-pack PUBLISHED POST_CARE | success | same | PASS |
| R3-B3-T6 another-tenant PRE/POST version | reject (not visible) | same | PASS |
| R3-B3-T7 platform-pack DRAFT | reject | same | PASS |
| R3-B3-T8 wrong kind | reject | same | PASS |
| R3-B3-T12 tenant-owned + platform-pack both exist | tenant precedence on auto-resolve | same | PASS |
| Explicit platform `versionId` when tenant form also exists | binds explicit platform version (visibility OR null) | `wave-e-round3` extra | PASS |
| No published tenant or platform PRE_CARE | reject | same | PASS |

HTTP production-path:

| Case | Expected | Evidence | Result |
|------|----------|----------|--------|
| R3-B3-T13 PRE_CARE platform pack | durable `PatientFormInstance` | `wave-e-production-path` | PASS |
| R3-B3-T14 POST_CARE platform pack | durable `PatientFormInstance` | same | PASS |
