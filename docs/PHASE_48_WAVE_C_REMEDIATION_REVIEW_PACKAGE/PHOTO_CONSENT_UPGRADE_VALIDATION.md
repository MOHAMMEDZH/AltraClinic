# PHOTO_CONSENT_UPGRADE_VALIDATION (Round 4; Round 5 re-ran upgrade PASS)

## Timeline (true upgrade)

**PRE-MIGRATION** (Wave C migration parked; prior chain deployed)

Legacy `media_assets` rows inserted **without** `requiresPhotoConsent` (column does not exist yet):

- `DENTAL_IMAGE`
- `BEAUTY_BEFORE_AFTER`
- `PATIENT_ATTACHMENT`
- `INVOICE_ATTACHMENT` (approved non-protected control)

Validator asserts the column is absent before restore.

**RUN ACTUAL MIGRATION**

`npx prisma migrate deploy` applies `20260816010000_phase48_wave_c_clinical_safety` **once**.

**POST-MIGRATION**

- Protected legacy rows: `requiresPhotoConsent = true`
- `INVOICE_ATTACHMENT`: `requiresPhotoConsent = false`

**No manual replay** of the backfill `UPDATE` after migrate.

Logged: `OK Wave C migration-time photo-consent backfill (no manual replay)`
Result: `PHASE48_WAVE_C_UPGRADE_VALIDATOR_PASSED`

## Write path (new media)

- `MediaCategoryVO.requiresPhotoConsent()` derives from category.
- `MediaAsset.create` sets the flag from category.
- Consent pack still proves `beauty_before_after` → true and `invoice_attachment` → false.
- Upload handler persists via the media repository using that entity.

## Migration SQL (unchanged semantics)

```sql
UPDATE "media_assets"
SET "requiresPhotoConsent" = true
WHERE "category" IN ('DENTAL_IMAGE', 'BEAUTY_BEFORE_AFTER', 'PATIENT_ATTACHMENT')
  AND "requiresPhotoConsent" = false;
```
