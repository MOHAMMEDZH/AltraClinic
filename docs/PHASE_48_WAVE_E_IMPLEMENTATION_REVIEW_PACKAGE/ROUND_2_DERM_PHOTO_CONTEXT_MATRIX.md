# ROUND_2_DERM_PHOTO_CONTEXT_MATRIX

Invariant: `attachDermatologyPhoto` requires a **dermatology-valid** Encounter (category/context via clinical service marker), same-tenant MediaAsset, no DermatologyRecord table.

Production: `DermatologyEncounterService.attachDermatologyPhoto` / `openDermatologyEncounter`.

| Case | Expected | Evidence | Result |
|------|----------|----------|--------|
| R2-DERM-T1 valid derm encounter + photo | success; MediaAsset owned by encounter | `wave-e-round2` | PASS |
| R2-DERM-T2 non-dermatology encounter + photo | reject (`BadRequestException`) | same | PASS |
| R2-DERM-T3 cross-tenant MediaAsset | reject | same | PASS |
| R2-DERM-T4 appointment patient mismatch on open | reject | same | PASS |

HTTP: R2-B6-D production-path covers open+photo, non-derm attach reject, cross-tenant MediaAsset reject.

No dermatology-specific media table; reuses `MediaAsset` with `ownerType=encounter`.
