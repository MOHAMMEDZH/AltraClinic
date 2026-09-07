# Phase 48 — Enterprise QA & Testing
## Architecture Discovery (Stage 48A)

| Field | Value |
|-------|--------|
| **Master Roadmap** | Healthcare ERP Master Roadmap v6 |
| **Phase** | 48 — Enterprise QA & Testing |
| **Stage** | Architecture Discovery **only** |
| **Status** | Discovery content complete; **P0/P1 normalization complete**; formal Architecture Discovery acceptance pending external review |
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

1. **No unified clinical service/procedure catalog** linked to booking + pricing + clinical completion (hardcoded scheduling types + free-text `serviceType` + separate `ServicePrice.serviceCode`). **P0-01**
2. **No appointment historical price snapshot**; invoice-from-appointment uses `unitPrice: 0` (`create-invoice-from-appointment.handler.ts`). **P0-02**
3. **Pricing units** (PER_TOOTH, PER_AREA, PER_COURSE, …) absent; tooth costs live as treatment-plan `estimatedCost` only. **P1**
4. **Double-book protection is application read-then-write**, not DB exclusion/concurrency suite for scheduling. **P0-03**
5. **Service-specific provider eligibility SoR is MISSING** (generic User/roles/schedules exist and are reusable). **P0-04**
6. **General clinical forms / versioned consents** missing (embedded plan/beauty consents only). **P0-06**; treatment-specific + clinical-photo consent = **P0-09 through the same architecture**
7. **Injectable treatment batch/lot/expiry linkage is MISSING** (inventory lot/expiry infrastructure EXISTS). **P0-08**
8. **Operational recall** is journey-registry aspirational — no operational recall SoR/UI. **P1** (not P0; invalid P0+DEFER removed)
9. **Operatory/chair** not first-class resource types. **P1**
10. **Dermatology** not a separate EMR beyond beauty annotations. **P1**
11. **QA blind spots** on scheduling create concurrency and service-catalog integrity. **P0 validation**

---

## 5. Target architecture proposal (discovery only — DO NOT IMPLEMENT)

Smallest conceptual set to close P0/P1 (prefer IMPROVE existing SoRs):

| Concept | Target exists? | Reusable infrastructure / equivalent | New model required? | Priority |
|---------|----------------|--------------------------------------|---------------------|----------|
| ClinicalService / Procedure | NO | Hardcoded scheduling types + dental/beauty procedure codes | YES (or promote typed catalog) | P0 |
| ServiceCategory | PARTIAL | Healthcare catalog categories (platform) / UI groupings | YES for clinic clinical taxonomy | P0/P1 |
| ServiceVariant / BodyArea | PARTIAL | Beauty annotations / plan session JSON | YES for first-class variants | P1 |
| DentalApplicability | PARTIAL | `TreatmentPlanItem.toothNumbers` | IMPROVE | P1 |
| TenantServiceConfiguration | PARTIAL | `ServicePrice` + active flag | IMPROVE (link to canonical service) | P0 |
| TenantServicePrice / history | PARTIAL | `ServicePrice` flat unitPrice | YES for history + effective dates | P0 |
| PricingUnit | NO | — | YES if P1 commercial | P1 |
| AppointmentServiceSnapshot | NO | — | YES (historical integrity) | P0 |
| ServiceResourceRequirement | PARTIAL | soft resourceId on appointment | IMPROVE | P0/P1 |
| ProviderServiceEligibility | **NO** (service-specific SoR) | YES — User/provider identity + roles + provider/staff schedules | YES — IMPLEMENT using reusable provider infrastructure | P0 |
| TreatmentCourse / CourseSession | PARTIAL | beauty sessionSequence / dental phases | IMPROVE | P1 |
| ClinicalPhoto | PARTIAL | MediaAsset categories | REUSE/IMPROVE | P0 coverage via consent |
| InjectionRecord / ProductBatchUsage | treatment linkage NO | Inventory lot/expiry + BeautyProcedureMaterial EXIST | YES linkage (IMPROVE + IMPLEMENT) | P0 |
| DeviceTreatmentRecord | MISSING | Beauty annotation parameters JSON | IMPLEMENT | P1 |
| ConsentTemplate/Version | MISSING | embedded plan consent fields | IMPLEMENT (single consent architecture) | P0 |
| Treatment/photo consent coverage | MISSING | same ConsentTemplate/Version | NO duplicate domain — P0-09 via P0-06 | P0 |
| PrePostCareInstruction | MISSING | — | IMPLEMENT | P1 |
| RecallRule | NO operational SoR | journey registry + appointment reminders + notifications plane | IMPLEMENT / IMPROVE+IMPLEMENT | **P1** |

---

## 5A. Normalized P0/P1 registers (canonical)

### P0 (mandatory; defer language forbidden)

```text
P0-01 Clinical service/procedure catalog
P0-02 Appointment service/price historical snapshot
P0-03 Scheduling concurrency / hard double-book protection
P0-04 Service-specific provider eligibility
P0-05 Treatment-plan ↔ appointment staging integrity
P0-06 Versioned clinical consent/forms baseline
P0-07 Price history / non-destructive audit trail
P0-08 Injectable treatment batch/lot/expiry traceability
P0-09 Treatment-specific and clinical-photo consent coverage via P0-06
```

### P1 (includes operational recall)

```text
P1-01 Branch-specific service enablement/pricing
P1-02 Pricing units / dental applicability
P1-03 Chair / operatory first-class resource
P1-04 Aesthetic treatment courses / multi-session booking
P1-05 Device / laser settings Source of Record
P1-06 Dermatology clinical depth
P1-07 Dental laboratory case workflow
P1-08 Arabic catalog search + RTL booking quality
P1-09 Pre/post-care instructions
P1-10 Waitlist auto-fill
P1-11 Holiday/leave availability
P1-12 Accessibility + tablet reception
P1-13 Operational Recall SoR / professional recall workflow
```

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
| 20 | Sufficient for formal Architecture Discovery acceptance review (P0/P1 normalized) | YES |

## 7. Governance for next stage

```text
ready for Phase 48 Architecture Review = pending external formal Architecture Discovery acceptance after P0/P1 normalization
implementation authorized = NO
Phase 49+ authorized = NO
commit/push of discovery = deferred to external acceptance
```

```text
Phase 47 = Accepted / Complete

Phase 48:
Architecture Discovery content = complete
P0/P1 normalization = complete
formal Architecture Discovery acceptance = pending external review

Architecture Review = not yet authorized by Cursor
Architecture Freeze = not authorized
Implementation = not authorized

Phase 49–51 = not authorized
```

Architecture Review should decide sequencing of normalized P0/P1 items — without renumbering the Master Roadmap.
