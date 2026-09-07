# Wave E Migration Validation (Round 3)

## Round 3 migration status

**NO ROUND 3 MIGRATION REQUIRED** — Round 3 remediations are application/test/validation only (PA-04 course pricing path, zero-day interval chronology, PRE/POST platform pack visibility).

Round 2 likewise required no migration. Wave E + Round 1 migrations still apply and remain the schema/RLS/trigger baseline.

## Migration identity (still in force)

| Migration | Path | Role |
|-----------|------|------|
| Wave E base | `20260820120000_phase48_wave_e_aesthetic_dermatology` | tables, RLS, child-parent tenant triggers |
| Round 1 | `20260820140000_phase48_wave_e_round1_remediation` | accountability triggers (createdBy/recordedBy/correctedBy) |
| Round 2 | — | **none** |
| Round 3 | — | **none** |

Policy: does not edit frozen Wave A–D migrations.

## Contents (factual — Wave E + Round 1)

- Enums: `TreatmentCourseStatus`, `CourseSessionStatus`
- Tables: `treatment_courses`, `course_sessions`, `device_treatment_records` (soft-delete; opaque `deviceId` VARCHAR(120))
- Triggers: tenant integrity + Round 1 accountability
- RLS: ENABLE + FORCE + tenant CRUD on all three tables
- Non-destructive: no `DermatologyRecord` table

## Clean validator (Round 3 capture)

Command: `node scripts/validate-phase48-wave-e-clean.mjs`
Capture: `_clean_r3.txt`

- Full chain including Wave E + Round 1
- `OK table` ×3, `OK RLS` ×3
- Marker: `PHASE48_WAVE_E_CLEAN_VALIDATOR_PASSED`

**Result: PASS**

## Upgrade validator (Round 3 capture)

Command: `node scripts/validate-phase48-wave-e-upgrade.mjs`
Capture: `_upgrade_r3.txt`

- Through Wave D Round 2, then Wave E + Round 1
- Marker: `PHASE48_WAVE_E_UPGRADE_VALIDATOR_PASSED`

**Result: PASS**

## Catalog sync (working tree)

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/rls-policies.sql`
- `apps/api/prisma/triggers.sql`
