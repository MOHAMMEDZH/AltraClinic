# Phase 48 — Enterprise QA & Testing
## Architecture Discovery (Stage 48A)

| Field | Value |
|-------|--------|
| **Master Roadmap** | Healthcare ERP Master Roadmap v6 |
| **Phase** | 48 — Enterprise QA & Testing |
| **Stage** | Architecture Discovery **only** |
| **Status** | Discovery complete; awaiting external Architecture Review |
| **Branch** | `cursor/phase48-enterprise-qa-architecture-discovery` |
| **Baseline** | Step 29 checkpoint `ae6307dfda8207e06db842318323d391c8fc8f18` |
| **Step 29 executable freeze** | `ea076b044b0fd601193e56cfbc0a74d45960c688` (preserved; not reopened) |
| **Phases 49–51** | **NOT AUTHORIZED** |
| **Implementation** | **NOT AUTHORIZED** |

**Companion artifacts:**

- `docs/PHASE_48_GLOBAL_COMPETITIVE_CAPABILITY_MATRIX.md`
- `docs/PHASE_48_DENTAL_AESTHETIC_BOOKING_GAP_MATRIX.md`
- `docs/PHASE_48_QA_TEST_ARCHITECTURE_INVENTORY.md`

---

## 1. Purpose

Discover, with repository evidence, whether AltraClinic already supports a globally competitive dental + aesthetic/dermatology + enterprise booking experience, and classify capabilities:

```text
EXCELLENT | COMPLETE | PARTIAL | MISSING | OUT_OF_SCOPE
```

Rule: **EXISTS ≠ GLOBALLY COMPETITIVE**. Primitive, free-text, non-audited, non-localized, or historically unsafe implementations are PARTIAL.

---

## 2. Baseline integrity

```text
accepted Step 29 checkpoint ancestor = YES
tracked working tree clean at discovery start = YES
product/runtime/schema/lockfile mutations during discovery = 0
full Step 29 runner rerun = NO
Step 28 Case C rerun = NO
```

Release 47 (Steps 01–29 + U01) remains **Accepted / Complete**. Discovery enhancements are Phase 48 scope proposals only.

---

## 3. Repository topology (verified)

### Applications

| App | Path | Role |
|-----|------|------|
| Clinic ERP UI | `apps/clinic-dashboard` | Reception, clinical, billing, scheduling |
| Patient portal | `apps/patient-portal` | Self-booking, appointments, profile |
| Super Admin | `apps/super-admin` | Platform catalog, plans, entitlements, ops |
| API | `apps/api` | Domain SoRs |

### Domain Sources of Record (summary)

| Domain | SoR | Key paths |
|--------|-----|-----------|
| Patients | `patients` / Patients module | `apps/api/src/modules/patients` |
| Appointments | `appointments` / Scheduling | `apps/api/src/modules/scheduling` |
| Providers | `User` + weekly schedules | `ProviderWeeklySchedule`, `StaffWeeklySchedule` |
| Branches | `branches` | Settings + dynamic-branch |
| Rooms/equipment | `scheduling_resources` (`ROOM`/`EQUIPMENT`) | No dedicated chair/operatory type |
| Platform specialty/facility | `HealthcareCatalogItem` | Super Admin catalog — **not** clinic procedure catalog |
| Clinic scheduling “services” | Hardcoded `SCHEDULING_SERVICE_TYPES` | `apps/api/src/modules/scheduling/domain/service-types.ts` |
| Clinic price list | `service_prices` | Billing financial API |
| Dental clinical | `dental_*`, treatment plans | `apps/api/src/modules/dental` |
| Aesthetic clinical | `beauty_*` | `apps/api/src/modules/beauty` |
| Media/photos | `media_assets` | `apps/api/src/modules/media` |
| Billing | invoices/payments/cash | `apps/api/src/modules/billing` |
| Notifications | notification plane + `AppointmentReminderLog` | `apps/api/src/modules/notifications` |
| Audit (platform) | Audit center / `audit_entries` | Step 21/28 |
| Localization | UI message modules + `Tenant.locale` | `apps/clinic-dashboard/src/i18n`, `packages/i18n` |

---

## 4. Executive findings

### Strengths (reuse)

- Strong clinic **patients**, **scheduling calendars**, **portal booking**, **waitlist**, **no-show**, **reminders**
- Strong **dental** odontogram/perio/treatment plans/ortho/implants/imaging workspaces
- Strong **beauty** body-map / before-after / materials module
- Strong **billing** (invoices, POS, cashbox, service price list)
- Strong **RBAC**, **i18n ar-SY/en**, **media pipeline**, **Release 47 platform QA runners**

### Material gaps for global-competitive dental + aesthetic + booking

1. **No unified clinical service/procedure catalog** linked to booking + pricing + clinical completion (hardcoded scheduling types + free-text `serviceType` + separate `ServicePrice.serviceCode`).
2. **No appointment historical price snapshot**; invoice-from-appointment uses `unitPrice: 0` (`create-invoice-from-appointment.handler.ts`).
3. **Pricing units** (PER_TOOTH, PER_AREA, PER_COURSE, …) absent; tooth costs live as treatment-plan `estimatedCost` only.
4. **Double-book protection is application read-then-write**, not DB exclusion/concurrency suite for scheduling.
5. **Recall** is journey-registry aspirational — no operational recall SoR/UI.
6. **General clinical forms / versioned consents** missing (embedded plan/beauty consents only).
7. **Aesthetic injectable batch/lot/expiry / injection plotting / laser settings** not first-class vs Pabau-class patterns.
8. **Operatory/chair** not first-class resource types.
9. **Dermatology** not a separate EMR beyond beauty annotations.
10. **QA blind spots** on scheduling create concurrency and service-catalog integrity.

---

## 5. Target architecture proposal (discovery only — DO NOT IMPLEMENT)

Smallest conceptual set to close P0/P1 (prefer IMPROVE existing SoRs):

| Concept | Exists? | Equivalent | New model required? |
|---------|---------|------------|---------------------|
| ClinicalService / Procedure | NO / PARTIAL | Hardcoded scheduling types + dental/beauty procedures | YES (or promote typed catalog) |
| ServiceCategory | PARTIAL | Healthcare catalog categories (platform) / UI groupings | YES for clinic clinical taxonomy |
| ServiceVariant / BodyArea | PARTIAL | Beauty annotations / plan session JSON | YES for first-class variants |
| DentalApplicability | PARTIAL | `TreatmentPlanItem.toothNumbers` | IMPROVE |
| TenantServiceConfiguration | PARTIAL | `ServicePrice` + active flag | IMPROVE (link to canonical service) |
| TenantServicePrice / history | PARTIAL | `ServicePrice` flat unitPrice | YES for history + effective dates |
| PricingUnit | NO | — | YES if P0 commercial |
| AppointmentServiceSnapshot | NO | — | YES (historical integrity) |
| ServiceResourceRequirement | PARTIAL | soft resourceId on appointment | IMPROVE |
| ProviderServiceEligibility | PARTIAL | role filters only | IMPROVE |
| TreatmentCourse / CourseSession | PARTIAL | beauty sessionSequence / dental phases | IMPROVE |
| ClinicalPhoto | PARTIAL | MediaAsset categories | REUSE/IMPROVE |
| InjectionRecord / ProductBatchUsage | PARTIAL | BeautyProcedureMaterial | IMPROVE |
| DeviceTreatmentRecord | MISSING | — | IMPLEMENT (P1 aesthetic laser) |
| ConsentTemplate/Version | MISSING | embedded fields | IMPLEMENT (P0 forms) |
| PrePostCareInstruction | MISSING | — | IMPLEMENT (P1) |
| RecallRule | MISSING | journey registry only | IMPLEMENT (P0/P1 recall) |

---

## 6. Acceptance checklist (discovery)

| # | Criterion | Met |
|---|-----------|-----|
| 1 | Architecture mapped with paths | YES |
| 2 | Sources of Record + duplication risks explicit | YES |
| 3 | Dental audited beyond source list | YES |
| 4 | Aesthetic/derm audited beyond marketing labels | YES |
| 5 | Booking audited at provider/location/resource/concurrency | YES |
| 6 | Tenant pricing audited | YES |
| 7 | Arabic/English audited | YES |
| 8 | Global benchmarks from official sources | YES |
| 9 | QA architecture inventoried | YES |
| 10–12 | Status + P0/P1 + reuse dispositions | YES |
| 13–16 | No implementation / schema / Step 30 / renumber | YES |
| 17–19 | No unsupported world-class claims; scores cited; risks explicit | YES |
| 20 | Sufficient for Architecture Review | YES |

## 7. Governance for next stage

```text
ready for Phase 48 Architecture Review = YES
implementation authorized = NO
Phase 49+ authorized = NO
commit/push of discovery = deferred to external acceptance
```

Architecture Review should decide which P0/P1 items enter Phase 48 Enterprise QA closure vs Phase 50 UX vs later releases — without renumbering the Master Roadmap.
