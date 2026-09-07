# Clinical Form Version Concurrency (Round 6 B1)

## Strategy

**A. Database constraint + transaction locking** (preferred approach from remediation prompt)

1. **Partial unique index** — at most one `PUBLISHED` row per `templateId`:
   - Index: `clinical_form_versions_one_published_per_template ON ("templateId") WHERE status = 'PUBLISHED'`
   - Pre-migration DO block rejects upgrade if duplicate PUBLISHED rows exist.

2. **Transaction serialization** — `lockTemplateForMutation()` in `ClinicalFormVersionService`:
   - `pg_advisory_xact_lock(hashtext('phase48:clinical_form_template:' || templateId))`
   - `SELECT ... FROM clinical_form_templates WHERE id = $1 FOR UPDATE`
   - Tenant/platform checks: platform templates (`tenantId IS NULL`) are tenant read-only; cross-tenant template access returns 404.

3. **Publish retry** — up to 3 attempts on partial-unique conflict (`P2002` targeting `one_published`).

4. **createDraft** — same lock; reads max version inside transaction; `P2002` on version uniqueness → `ConflictException` with retry guidance.

## Files

| Layer | File |
|-------|------|
| Service | `apps/api/src/modules/clinical-forms/services/clinical-form-version.service.ts` |
| Migration | `apps/api/prisma/migrations/20260816010000_phase48_wave_c_clinical_safety/migration.sql` |
| Test | `apps/api/src/modules/clinical-forms/tests/wave-c-clinical-form-version-concurrency.postgres.integration.spec.ts` |

## Concurrent publish test

- Template with DRAFT v2 and v3.
- `Promise.all([publish(v2), publish(v3)])`.
- **Result:** `count(PUBLISHED) === 1`; at least one `SUPERSEDED`.

## Concurrent createDraft test

- Two parallel `createDraft` calls on same template.
- **Result:** distinct version numbers (e.g. 1 and 2); no duplicate-version 500 leak.

## Final row states (publish race)

| Version | Expected status |
|---------|-----------------|
| Winner (v2 or v3) | `PUBLISHED` |
| Loser prior published (if any) | `SUPERSEDED` |
| Other draft | `DRAFT` or `SUPERSEDED` per supersede pass |

## RLS / tenant

- Lock scope is per-template, not global.
- Tenant mismatch on template → `NotFoundException` (no cross-tenant mutation).

## Result

**PASS** — real PostgreSQL concurrency tests green.
