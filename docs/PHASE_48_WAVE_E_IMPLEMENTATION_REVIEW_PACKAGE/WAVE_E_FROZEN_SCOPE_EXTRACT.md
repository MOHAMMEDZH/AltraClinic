# Wave E Frozen Scope Extract

Implementation evidence for this wave lives in sibling files in this folder (`WAVE_E_SCOPE.md`, `IMPLEMENTATION_MATRIX.md`, `TEST_RESULTS.md`, etc.). This extract remains frozen-authority only — not an acceptance claim.

Source authority (read from repository at frozen Wave D base `438b8b3859b3a78548cfde81c8fc14135a51a5ef`):

- `docs/PHASE_48_FROZEN_IMPLEMENTATION_AND_QA_PLAN.md` — Wave E table
- `docs/PHASE_48_ARCHITECTURE_FREEZE.md` — ADR matrix + P1 register
- `docs/PHASE_48_TARGET_DOMAIN_ARCHITECTURE.md` — §§9, 10, 12–14
- `docs/PHASE_48_FROZEN_DOMAIN_CONTRACT_MATRIX.md` — TreatmentCourse / DeviceTreatmentRecord rows
- `docs/PHASE_48_ENTERPRISE_QA_ACCEPTANCE_ARCHITECTURE.md` — Course / Device / Derm packs
- `docs/PHASE_48_STAFF_COMMISSION_REVENUE_SHARE_ARCHITECTURE.md` — AR-21 shared; AR-22 = Wave F only

## Official Wave E name

**Aesthetic / Dermatology**

## Frozen Wave E objectives

From frozen plan exit criteria:

- Courses + device records + **no Dermatology EMR**
- Preserve beauty free-text history (non-destructive)
- Entry depends on Wave C consent/usage foundations
- QA packs: Course; Device; Derm; Pre/Post Care

## P0/P1 items assigned to Wave E

| ID | Title | Wave E? |
|----|-------|---------|
| P1-04 | Aesthetic treatment courses / multi-session booking | **YES** |
| P1-05 | Device/laser settings Source of Record | **YES** |
| P1-06 | Dermatology clinical depth | **YES** (via Encounter — no DermatologyRecord) |
| P1-09 | Pre/post-care instructions | **YES** (ClinicalForm kinds PRE_CARE / POST_CARE — single forms architecture) |

## AR items assigned to Wave E

| ADR | Title | Wave E? |
|-----|-------|---------|
| AR-13 | TreatmentCourse / CourseSession | **YES** |
| AR-14 | DeviceTreatmentRecord | **YES** |
| AR-15 | No DermatologyRecord EMR | **YES** |
| AR-21 | ServicePerformance + Participants | **YES** (continue/use Wave D SoR; no AR-22) |

## Explicitly NOT Wave E

| Item | Owner wave |
|------|------------|
| AR-22 / P1-14 commission accruals | F |
| Recall / waitlist / availability exceptions | G |
| Arabic/RTL / accessibility | H |
| Migration dual-read cutover program | I |
| Wave F/G/H/I domains | out of scope |

## Required entities / fields (frozen)

### TreatmentCourse (AR-13)

```
TreatmentCourse { patient, clinicalService, plannedSessions, intervalMin/Max, packagePriceVersionId?, status }
CourseSession { courseId, sequence, appointmentId?, status PLANNED|BOOKED|COMPLETED|SKIPPED|CANCELLED }
```

Rules: cross-specialty reusable; **no silent auto-book**.

### DeviceTreatmentRecord (AR-14)

```
deviceId / deviceType
clinicalServiceId
bodyArea?
parameterPayload (JSON)
parameterSchemaKey
patientId, providerId, branchId, recordedAt
beautyAnnotationId? / encounterId?
```

Schema registry validates per deviceType later — no giant unsafe medical enum.

### Dermatology (AR-15)

**No `DermatologyRecord` EMR.**
Use: Encounter + clinical notes/diagnoses + MediaAsset + ClinicalService (derm category) + forms.
BeautyRecord stays anatomy/injectable map for aesthetics.

### Pre/Post care (P1-09 / AR-09)

ClinicalForm kinds include: `PRE_CARE`, `POST_CARE` in the **single** ClinicalFormTemplate/Version/PatientFormInstance architecture.
Photo consent does not create a second SoR.

### Aesthetic usage

Reuse `InventoryUsageLedger` (Wave C). No second aesthetic consumption ledger. Injectable/aesthetic clinical detail remains typed extension of the same ledger event.

### Pricing units

`PER_COURSE` / `PER_PACKAGE` were fail-closed in Wave D pending TreatmentCourse SoR. Wave E activates TreatmentCourse SoR; course pricing links via `packagePriceVersionId` and allows course pricing units under frozen domain rules.

## Required migrations

- New Wave E migration only (do not edit frozen Wave A–D migrations)
- Clean + upgrade from frozen Wave D checkpoint
- Preserve beauty free-text history (no destructive remapping)

## Required audit / RLS / tenant protections

- Every new tenant-owned table: `tenantId`, RLS ENABLE+FORCE, NOBYPASSRLS proofs
- Child→parent tenant consistency at DB (triggers or equivalent) for CourseSession→Course, CourseSession→Appointment, DeviceTreatmentRecord FKs
- Audit on successful clinical mutations; performer ≠ authenticated recorder unless frozen says so
- Soft delete where contract says soft; DeviceTreatmentRecord append/correct+audit

## Required QA packs

- Course scheduling (sessions, intervals, package price)
- Device/laser (schema key validation)
- Derm workflows (Encounter+service+photo **without** DermatologyRecord)
- Pre/Post Care (forms kinds)

## Out-of-scope items (do not implement)

- StaffCommissionPlanVersion / CommissionAccrual (AR-22)
- RecallRule / PatientRecallInstance
- Waitlist auto-fill
- AvailabilityException
- DermatologyRecord table
- Parallel aesthetic inventory ledger
- Phase 49 / Step 30
