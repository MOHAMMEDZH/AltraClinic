# Wave D Checkpoint File Classification

Date: 2026-08-20
Branch: `cursor/phase48-wave-d-dental-integration`
Pre-commit HEAD: `7f11a4bc6b7064c2b63e807cba65eed225546131`

## Modified tracked — intended YES

| path | Git state | category | intended? | rationale |
|------|-----------|----------|-----------|-----------|
| apps/api/config/permission-matrix.json | modified | permission/config | YES | Wave D API permissions (dental-lab, treatment-plan-links, service-performance) |
| docs/permission-matrix.json | modified | permission/config | YES | docs mirror of permission matrix |
| packages/permissions/permission-matrix.json | modified | permission/config | YES | package matrix authority |
| apps/api/prisma/schema.prisma | modified | database/migration | YES | Wave D models (lab cases, links, service performance, OPERATORY) |
| apps/api/prisma/rls-policies.sql | modified | database/migration | YES | six Wave D table RLS |
| apps/api/prisma/triggers.sql | modified | database/migration | YES | Round 2 child-parent tenant integrity triggers |
| apps/api/src/app.module.ts | modified | production backend | YES | registers ServicePerformanceModule |
| apps/api/src/modules/clinical-catalog/application/clinical-price-version.service.ts | modified | production backend | YES | P1-02 pricing-unit applicability |
| apps/api/src/modules/dental/application/dto/dental-material.dto.ts | modified | production backend | YES | dental consume optional IDs |
| apps/api/src/modules/dental/application/handlers/dental-material.handlers.ts | modified | production backend | YES | dental consume path |
| apps/api/src/modules/dental/controllers/dental.controller.ts | modified | production backend | YES | Wave D dental wiring |
| apps/api/src/modules/dental/dental.module.ts | modified | production backend | YES | Wave D services/controllers |
| apps/api/src/modules/scheduling/application/dto/appointment.dto.ts | modified | production backend | YES | OPERATORY / displaySubtype |
| apps/api/src/modules/scheduling/application/handlers/scheduling-resources.handlers.ts | modified | production backend | YES | OPERATORY resource create |
| apps/api/src/modules/scheduling/application/services/booking-commercial-resolver.service.ts | modified | production backend | YES | B5 pricing unit fail-closed |
| apps/api/src/modules/scheduling/controllers/schedule-settings.controller.ts | modified | production backend | YES | OPERATORY settings/API |
| apps/api/src/modules/scheduling/scheduling.module.ts | modified | production backend | YES | Wave D scheduling wiring |

## Modified tracked — intended NO

| path | Git state | category | intended? | rationale |
|------|-----------|----------|-----------|-----------|
| apps/api/prisma/seeds/permission-seeds.js | modified (CRLF-only) | generated artifact | NO | tracked compile output; content identical to HEAD ignoring CR; restored to HEAD before stage |
| apps/api/prisma/seeds/permission-seeds.d.ts | modified (CRLF-only) | generated artifact | NO | same as above; restored to HEAD |

## Untracked — intended YES

| path | category | intended? | rationale |
|------|----------|-----------|-----------|
| apps/api/prisma/migrations/20260819010000_phase48_wave_d_dental_integration/ | database/migration | YES | Wave D base migration |
| apps/api/prisma/migrations/20260819163000_phase48_wave_d_round1_reference_integrity/ | database/migration | YES | Round 1 FK integrity |
| apps/api/prisma/migrations/20260819220000_phase48_wave_d_round2_child_tenant_integrity/ | database/migration | YES | Round 2 child-parent triggers |
| apps/api/scripts/validate-phase48-wave-d-clean.mjs | test | YES | clean migration validator |
| apps/api/scripts/validate-phase48-wave-d-upgrade.mjs | test | YES | upgrade migration validator |
| apps/api/scripts/validate-phase48-wave-d-permission-routes.mjs | test | YES | permission route validator |
| apps/api/src/modules/clinical-catalog/domain/pricing-unit-applicability.ts | production backend | YES | P1-02 domain rules |
| apps/api/src/modules/clinical-catalog/tests/pricing-unit-applicability.unit.spec.ts | test | YES | unit coverage |
| apps/api/src/modules/clinical-catalog/tests/wave-d-pricing-production-path.postgres.integration.spec.ts | test | YES | B5 production-path |
| apps/api/src/modules/dental/api/dental-lab-cases.controller.ts | production backend | YES | P1-07 HTTP |
| apps/api/src/modules/dental/api/treatment-plan-links.controller.ts | production backend | YES | P0-05 HTTP |
| apps/api/src/modules/dental/api/wave-d.dto.ts | production backend | YES | Wave D DTOs |
| apps/api/src/modules/dental/infrastructure/audit-trail-wave-d-audit-log.ts | production backend | YES | Wave D audit adapter |
| apps/api/src/modules/dental/ports/wave-d-audit-log.port.ts | production backend | YES | audit port |
| apps/api/src/modules/dental/services/dental-lab-case.service.ts | production backend | YES | P1-07 |
| apps/api/src/modules/dental/services/treatment-plan-appointment-link.service.ts | production backend | YES | P0-05 |
| apps/api/src/modules/dental/services/wave-d-reference.validation.ts | production backend | YES | Round 1/2 reference integrity |
| apps/api/src/modules/dental/tests/wave-d-*.spec.ts (6 files) | test | YES | Wave D unit/postgres/RLS |
| apps/api/src/modules/scheduling/application/dto/create-scheduling-resource.dto.ts | production backend | YES | OPERATORY create DTO |
| apps/api/src/modules/service-performance/** (6 files) | production backend | YES | AR-21 start |
| docs/PHASE_48_WAVE_D_IMPLEMENTATION_REVIEW_PACKAGE/** | architecture/evidence docs | YES | accepted Wave D evidence package |

## Untracked — intended NO

| path pattern | category | intended? | rationale |
|--------------|----------|-----------|-----------|
| packages/module-registry/src/**/*.js | generated artifact | NO | pre-existing compile outputs; not Wave D |
| packages/module-registry/src/**/*.d.ts | generated artifact | NO | same |
| packages/dashboard-export/src/**/*.js | generated artifact | NO | same |
| packages/dashboard-export/src/**/*.d.ts | generated artifact | NO | same |

Count of excluded generated package artifacts at classification time: **288** paths under `packages/module-registry` + `packages/dashboard-export`.

## Outside worktree (not staged)

| path | category | intended? | rationale |
|------|----------|-----------|-----------|
| %USERPROFILE%\Downloads\promt\* | review-only artifact | NO | external review copy; outside repo |
| %USERPROFILE%\Downloads\promt.zip | review-only artifact | NO | archive; outside repo |

## Checkpoint classification docs (created for this commit)

These files are intended YES as architecture/evidence docs once written:

- WAVE_D_CHECKPOINT_FILE_CLASSIFICATION.md (this file)
- WAVE_D_CHECKPOINT_EXCLUSIONS.md
- WAVE_D_CHECKPOINT_STAGE_AUDIT.md
- WAVE_D_CHECKPOINT_FINAL_GATES.md
- WAVE_D_CHECKPOINT_PRECOMMIT_SNAPSHOT.md

`WAVE_D_CHECKPOINT_STAGED_DIFF.patch` = review-only, **NOT** committed (default).
