# Wave E Change Summary

| Field | Value |
|-------|--------|
| Branch | `cursor/phase48-wave-e-aesthetic-dermatology` |
| Base HEAD | `438b8b3859b3a78548cfde81c8fc14135a51a5ef` (Wave D frozen; uncommitted Wave E work on top) |
| Scope | Aesthetic / Dermatology — P1-04/05/06/09, AR-13/14/15; AR-21 reused; AR-22 not implemented |

## What changed

1. **New aesthetic module** under `apps/api/src/modules/aesthetic/` with HTTP controller at `/aesthetic/*`, services for treatment courses, device treatment records, dermatology-via-Encounter, and pre/post-care form asserts.
2. **New migration** `20260820120000_phase48_wave_e_aesthetic_dermatology` — tables `treatment_courses`, `course_sessions`, `device_treatment_records`; enums; RLS ENABLE+FORCE; child/parent tenant integrity triggers. Non-destructive; does not remapped beauty free-text history.
3. **Prisma / RLS / triggers sync** — schema models + `rls-policies.sql` + `triggers.sql` updated for the three Wave E tables.
4. **Permissions** — `api.treatment-course`, `api.device-treatment`, `api.dermatology-encounter`, `api.pre-post-care` added to all three permission matrices; route validator script added.
5. **Pricing-unit applicability** — `PER_COURSE` / `PER_PACKAGE` no longer fail-closed; dental/aesthetic domain matrix retained.
6. **Validators + tests** — clean/upgrade/permission validators; unit + postgres integration suites (`wave-e-*`).

## What did not change (by design)

- No `DermatologyRecord` model/table.
- No parallel aesthetic inventory ledger (reuses `InventoryUsageLedger`).
- No AR-22 commission / revenue-share entities.
- ServicePerformance remains Wave D SoR (continued use, not re-authored).
- Beauty free-text / anatomy history preserved (no destructive beauty remap in Wave E migration).
- Generated `packages/module-registry` and `packages/dashboard-export` `.js`/`.d.ts` artifacts are not Wave E deliverables.
- Git HEAD remains Wave D base until checkpoint commit.

## Why

Frozen Wave E exit criteria require courses + device parameter SoR + dermatology depth without a separate derm EMR, with tenant/RLS/audit protections and QA packs, while activating course pricing units that Wave D left fail-closed pending TreatmentCourse SoR.
