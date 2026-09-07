# WAVE E AUTHORITATIVE SCOPE

| Field | Value |
|-------|--------|
| Branch | `cursor/phase48-wave-e-aesthetic-dermatology` |
| Base HEAD | Frozen Wave D `438b8b3859b3a78548cfde81c8fc14135a51a5ef` (must remain until checkpoint) |
| Wave name | Aesthetic / Dermatology |
| Module | `apps/api/src/modules/aesthetic/` |
| HTTP prefix | `/aesthetic/*` |
| Phase 49 / Step 30 | NOT AUTHORIZED |
| Status language | Evidence for external review only — no ACCEPTED / FROZEN claims in this package |

See also: `WAVE_E_FROZEN_SCOPE_EXTRACT.md` (frozen authority extract).

---

## A. Frozen source documents

| File | Wave E responsibility |
|------|----------------------|
| `docs/PHASE_48_FROZEN_IMPLEMENTATION_AND_QA_PLAN.md` | Courses + device records + no Dermatology EMR; QA packs Course / Device / Derm / Pre-Post Care |
| `docs/PHASE_48_ARCHITECTURE_FREEZE.md` | P1-04/05/06/09; AR-13/14/15/21 |
| `docs/PHASE_48_TARGET_DOMAIN_ARCHITECTURE.md` | §§9, 10, 12–14 |
| `docs/PHASE_48_FROZEN_DOMAIN_CONTRACT_MATRIX.md` | TreatmentCourse / DeviceTreatmentRecord |
| `docs/PHASE_48_ENTERPRISE_QA_ACCEPTANCE_ARCHITECTURE.md` | Course / Device / Derm packs |
| `docs/PHASE_48_STAFF_COMMISSION_REVENUE_SHARE_ARCHITECTURE.md` | AR-21 shared; AR-22 = Wave F only |

---

## B. In-scope domains (implemented)

### 1. TreatmentCourse / CourseSession (AR-13 / P1-04)

| Item | Value |
|------|-------|
| Persistence | `treatment_courses`, `course_sessions` |
| Production entry | `/aesthetic/treatment-courses*` |
| RBAC | `api.treatment-course` |
| Rules | Cross-specialty reusable; planned sessions created atomically; **no silent auto-book** — appointment link is explicit |
| Pricing | Optional `packagePriceVersionId`; `PER_COURSE` / `PER_PACKAGE` allowed in pricing-unit matrix |

### 2. DeviceTreatmentRecord (AR-14 / P1-05)

| Item | Value |
|------|-------|
| Persistence | `device_treatment_records` |
| Production entry | `/aesthetic/device-treatments*` |
| RBAC | `api.device-treatment` |
| Rules | `parameterSchemaKey` registry stub; `providerId` (performer) ≠ auto-inferred from actor; `recordedBy` = authenticated recorder; correct+audit path |

### 3. Dermatology clinical depth (AR-15 / P1-06)

| Item | Value |
|------|-------|
| Persistence | **No `DermatologyRecord` table** — reuses `Encounter` |
| Production entry | `/aesthetic/dermatology/encounters*`, `/aesthetic/dermatology/no-dermatology-record` |
| RBAC | `api.dermatology-encounter` |

### 4. Pre/Post care (P1-09)

| Item | Value |
|------|-------|
| Persistence | Existing ClinicalForm kinds `PRE_CARE` / `POST_CARE` |
| Production entry | `/aesthetic/pre-post-care/*` |
| RBAC | `api.pre-post-care` |
| Rules | Asserts instance kind against unified forms architecture; no second care SoR |

### 5. Shared reuse (not reimplemented)

| SoR | Wave |
|-----|------|
| `InventoryUsageLedger` | C |
| `Encounter`, ClinicalForm PRE/POST | C / forms architecture |
| `ServicePerformance` (+ participants) | D / AR-21 continue |

---

## C. Explicitly out of scope

| Item | Owner |
|------|-------|
| AR-22 / P1-14 commission accruals | Wave F |
| Recall / waitlist / availability exceptions | Wave G |
| Arabic/RTL / accessibility | Wave H |
| Migration dual-read cutover program | Wave I |
| `DermatologyRecord` EMR table | Never (AR-15) |
| Parallel aesthetic inventory ledger | Never |

---

## D. Required protections (Wave E tables)

- `tenantId` on all new tenant-owned tables
- RLS ENABLE + FORCE; NOBYPASSRLS proofs via `wave-e-rls` suite
- Child→parent tenant integrity triggers for courses / sessions / device records
- Audit on successful mutations; performer vs recorder separation on device records
- Soft-delete columns present; device correction is audited in-place update (not silent rewrite)
