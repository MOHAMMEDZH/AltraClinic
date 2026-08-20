# Wave E Implementation Matrix (Round 3)

Status values: IMPLEMENTED | EVIDENCE RECORDED | PENDING | OUT OF SCOPE.

Map frozen P1 / AR items → production files. Status is evidence language only — not acceptance. Max conclusion: **READY FOR EXTERNAL REVIEW**.

| ID | Frozen requirement | Invariant | Production entry | Primary files | DB / RLS | RBAC | Audit | Tests | Status |
|----|-------------------|-----------|------------------|---------------|----------|------|-------|-------|--------|
| P1-04 | Aesthetic treatment courses / multi-session booking | Course + N sessions; signed chronology + calendar-day intervals (incl. min=0 same-day); no silent auto-book | `POST/GET /aesthetic/treatment-courses*`, session link/transition | `treatment-course.service.ts`, controller/DTO, `wave-e-reference.validation.ts`, schema `TreatmentCourse`/`CourseSession` | FKs + soft delete; RLS; tenant + accountability triggers | `api.treatment-course` | `treatment_course.*`, `course_session.*` | unit; aesthetic; http; rls; round1–3; production-path | IMPLEMENTED + EVIDENCE RECORDED |
| P1-05 | Device/laser settings SoR | Schema-key binding; opaque `deviceId` VARCHAR(120); correct+audit | `/aesthetic/device-treatments*` | `device-treatment-record.service.ts`, `wave-e.dto.ts` | RLS + tenant/accountability triggers; `deviceId` not FK | `api.device-treatment` | `device_treatment.create`, `.correct` | unit; aesthetic; http (R2-B3); rls; production-path (R2-B6-C) | IMPLEMENTED + EVIDENCE RECORDED |
| P1-06 | Dermatology clinical depth | **No DermatologyRecord**; Encounter SoR; photo needs derm-valid encounter | `/aesthetic/dermatology/encounters*`, photos | `dermatology-encounter.service.ts` | Reuses encounters RLS; MediaAsset tenant | `api.dermatology-encounter` | `dermatology.encounter.open`, photo attach | round1; round2 (R2-DERM); production-path (R2-B6-D) | IMPLEMENTED + EVIDENCE RECORDED |
| P1-09 | Pre/post-care instructions | PRE_CARE / POST_CARE; tenant OR platform-pack null; tenant override precedence; bind PUBLISHED only; no template/version create | `/aesthetic/pre-post-care/*` | `pre-post-care.service.ts` | Existing forms tables | `api.pre-post-care` | `pre_post_care.assert`, create audit | round1; round2 (R2-B4); round3 (R3-B3); production-path T13/T14 | IMPLEMENTED + EVIDENCE RECORDED |
| AR-13 | TreatmentCourse / CourseSession | Status transitions; explicit appointment link | same as P1-04 | `COURSE_TRANSITIONS` / `SESSION_TRANSITIONS` | migration enums + tables | same | same | `wave-e-transitions.unit.spec.ts` | IMPLEMENTED + EVIDENCE RECORDED |
| AR-14 | DeviceTreatmentRecord | parameterPayload + parameterSchemaKey; provider ≠ inferred recorder | same as P1-05 | same | same | same | same | aesthetic performer≠recorder | IMPLEMENTED + EVIDENCE RECORDED |
| AR-15 | No DermatologyRecord EMR | Never create derm EMR table | assert endpoint + service guard | `assertNoDermatologyRecordModel`, rls | no table in migration | n/a | n/a | aesthetic + rls + http | IMPLEMENTED + EVIDENCE RECORDED |
| AR-21 | ServicePerformance + Participants | Continue Wave D SoR; no AR-22 | existing Wave D paths | Wave D module (unchanged by Wave E) | Wave D | Wave D | Wave D | Wave D suites | REUSED — OUT OF WAVE E CODE CHANGE |
| Pricing units | PER_COURSE / PER_PACKAGE exact package PV + PA-04 current | Patient/service equality; lock → reconcile → interval; no generic PV substitute | booking commercial resolver | `booking-commercial-resolver.service.ts`, `pricing-unit-applicability.ts` | Wave D enums | existing | existing | pricing-unit unit; wave-d-pricing-production-path R2-B1 + R3-B1 | IMPLEMENTED + EVIDENCE RECORDED |
| Usage ledger | No second aesthetic ledger | Reuse InventoryUsageLedger | existing Wave C paths | aesthetic integration assertion only | Wave C | Wave C | Wave C | aesthetic “no aesthetic_usage table” | REUSED |
| AR-22 | Commission accruals | — | — | — | — | — | — | — | OUT OF SCOPE (Wave F) |

## Round 3 evidence cross-refs

`ROUND_3_REMEDIATION_MATRIX.md`, `ROUND_3_PA04_COURSE_PRICING_MATRIX.md`, `ROUND_3_ZERO_DAY_INTERVAL_MATRIX.md`, `ROUND_3_PRE_POST_PLATFORM_PACK_MATRIX.md`, `TEST_RESULTS.md`.

Round 1 / Round 2 matrices remain historical CLOSED evidence (see `KNOWN_LIMITATIONS.md`).

## Supporting wiring

| Concern | Files |
|---------|-------|
| Nest module registration | `aesthetic.module.ts`, `app.module.ts` |
| Audit adapter | `ports/wave-e-audit-log.port.ts`, `infrastructure/audit-trail-wave-e-audit-log.ts` |
| Permission matrices (3-way) | `apps/api/config/permission-matrix.json`, `docs/permission-matrix.json`, `packages/permissions/permission-matrix.json` |
| RLS / triggers | `rls-policies.sql`, `triggers.sql` |
| Validators | `validate-phase48-wave-e-clean.mjs`, `validate-phase48-wave-e-upgrade.mjs`, `validate-phase48-wave-e-permission-routes.mjs` |
| Migrations | Wave E `20260820120000_…` + Round 1 `20260820140000_…` — **no Round 2 or Round 3 migration** (app-only) |
