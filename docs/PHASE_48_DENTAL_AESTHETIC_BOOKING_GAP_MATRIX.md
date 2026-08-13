# Phase 48 — Dental / Aesthetic / Booking Gap Matrix

| Field | Value |
|-------|--------|
| **Phase** | 48 — Enterprise QA & Testing |
| **Stage** | Architecture Discovery only |
| **Baseline** | `ae6307dfda8207e06db842318323d391c8fc8f18` |
| **Implementation** | NOT AUTHORIZED |

---

## A. Dental services coverage audit (Part 4)

**Canonical clinic procedure catalog:** MISSING (booking uses hardcoded types in `apps/api/src/modules/scheduling/domain/service-types.ts`). Dental clinical procedures appear as:

- `TreatmentPlanItem.code` / `description` (free clinical plan codes)
- `DentalToothCondition.conditionCode`
- `DentalProcedureMaterial.procedureCode` (inventory mapping)
- Ortho/implant specialized records

| Category | Canonical services | Clinical workflow | Booking | Pricing | Tests | Gaps | Status | Priority |
|----------|--------------------|-------------------|---------|---------|-------|------|--------|----------|
| Examination & diagnostics | No catalog entries | Encounter + dental notes | Generic `consultation`/`imaging` | Plan estimates / ServicePrice codes ad-hoc | Limited dental unit | Need exam subtypes | PARTIAL | P0 |
| Preventive | No catalog | Notes + recall aspirational (P1) | `cleaning` type only | Ad-hoc | Thin | Fluoride/sealants catalog (P0 service identity); operational recall = P1 | PARTIAL | P0 |
| Restorative | Plan items + tooth conditions | Odontogram + plans | Generic `procedure` | `estimatedCost` | Thin | Surface-specific booking/price units | PARTIAL | P0 |
| Cosmetic dentistry | No dedicated catalog | Plan/notes | Generic | Ad-hoc | Thin | Source req: معالجات تجميلية | PARTIAL | P1 |
| Endodontics | Condition codes / plan codes | Multi-phase plans | Generic | Plan cost | Thin | Multi-visit booking link | PARTIAL | P0 |
| Periodontics | `PeriodontalExam` | Perio charting SoR | Generic | Ad-hoc | Thin | Scaling/SRP catalog | PARTIAL | P1 |
| Oral surgery | Extraction conditions | Notes + plans | Emergency flag | Ad-hoc | Thin | Surgical pathways | PARTIAL | P1 |
| Implantology | `ImplantRecord` | Staged statuses | Generic | Plan/implant notes | Thin | Imaging/plan linkage IMPROVE | COMPLETE–PARTIAL | P1 |
| Prosthodontics | Plan codes | Plans | Generic | Plan cost | Thin | Lab case SoR MISSING | PARTIAL | P1 |
| Orthodontics | `OrthodonticCase` | Appliance JSON clinicalData | Recurrence possible | Ad-hoc | Thin | Course scheduling IMPROVE | COMPLETE–PARTIAL | P1 |
| Pediatric | `OdontogramMode` ADULT/PEDIATRIC | Pediatric odontogram mode | Generic | Ad-hoc | Thin | Behavior notes limited | PARTIAL | P1 |
| Dental emergencies | `isEmergency` + `emergency` type | Status workflow | Supported | Ad-hoc | Thin | Dedicated emergency slots PARTIAL | PARTIAL | P0 |

### Source requirement labels (normalize; do not seed)

| Source AR | Source EN | Normalized candidate | Flag |
|-----------|-----------|----------------------|------|
| معالجات تجميلية | Cosmetic Dentistry | Aesthetic Dentistry / طب الأسنان التجميلي | — |
| معالجات تقويمية | Orthodontic Treatments | Orthodontics / تقويم الأسنان | — |
| معالجات لبية | Endodontic / Root Canal | Endodontics / علاج الجذور واللبية | — |
| معالجات أطفال | Pediatric Dentistry | Pediatric Dentistry / طب أسنان الأطفال | — |
| زرع الأسنان | Dental Implants | Implantology / زراعة الأسنان | — |
| بوتوكس لثوي | Gingival Botox | Therapeutic botulinum in dentistry | **NEEDS_CLINICAL_TERMINOLOGY_REVIEW** |
| قص اللثة بالليزر | Laser Gingivectomy | Laser Gingival Procedures / إجراءات اللثة بالليزر | NEEDS_CLINICAL_TERMINOLOGY_REVIEW for marketing aliases |

---

## B. Dental clinical workflow competitive audit (Part 5)

| Step | Status | Evidence | Quality note |
|------|--------|----------|--------------|
| Patient | COMPLETE | Patients module | — |
| Appointment | COMPLETE | `Appointment` | Free-text service |
| Dental service/procedure | PARTIAL | Plan item codes; not catalog | — |
| Dentist/provider | COMPLETE | `providerId` | Eligibility weak |
| Clinical encounter | COMPLETE | `Encounter` relation | — |
| Odontogram | COMPLETE | `DentalRecord.odontogramState`, FDI tooth IDs | Strong |
| Diagnosis/condition | COMPLETE | `DentalToothCondition` | — |
| Treatment plan | COMPLETE | `TreatmentPlan` statuses DRAFT→COMPLETED | Strong |
| Planned procedures | COMPLETE | `TreatmentPlanItem` | — |
| Appointment stages | PARTIAL | Phases have visitNumber; appointment FK weak | P0 |
| Completed procedures | COMPLETE | Item statuses + completedAt | — |
| Clinical notes | COMPLETE | `DentalClinicalNote` types | Templates/macros MISSING |
| Imaging | PARTIAL | Media linkage patterns | Audit trail PARTIAL |
| Prescription | PARTIAL | Platform Rx if present; dental linkage thin | Verify in review |
| Consent | PARTIAL | Plan `consentSignedAt/Method` | No versioned templates |
| Lab work/referral | PARTIAL | Note type `referral`; lab case SoR MISSING | P1 |
| Follow-up/recall | MISSING ops | Journey registry only | P1 |

**Specific investigations**

| Topic | Status | Evidence |
|-------|--------|----------|
| Tooth numbering | COMPLETE | FDI `toothId` |
| Surfaces | COMPLETE | `surface` on conditions |
| Existing vs planned vs completed | COMPLETE | Conditions log + plan item status |
| Plan acceptance | COMPLETE | APPROVED / consent fields |
| Plan–appointment linkage | PARTIAL | No first-class appointmentId on items |
| Sequence/staging | COMPLETE | `dependsOnItemId`, phases |
| Perio charting | COMPLETE | `PeriodontalExam.chartData` |
| Progress notes | COMPLETE | noteType progress |
| Note templates/macros | MISSING | — |
| Imaging audit trail | PARTIAL | Media module |
| Provider handoff | PARTIAL | Reassign via update appointment |
| Historical integrity | PARTIAL | Soft delete appointments; price/history gaps |

**Dental summary**

```text
EXCELLENT = odontogram/perio/treatment-plan core models
COMPLETE = dental record, tooth conditions, ortho/implant cases, multi-phase plans
PARTIAL = booking catalog linkage, plan-appointment staging, imaging/consent depth, pediatric specialization, lab
MISSING = operational recall SoR (P1), versioned consent library (P0), dental lab case SoR, professional service taxonomy seed
P0 gaps = clinical service catalog; plan↔appointment; historical price; booking concurrency; emergency/preventive bookability with correct service identity; versioned consent
P1 gaps = operational recall; lab; prosthodontic workflows; cosmetic/ortho course UX; Arabic procedure taxonomy; note macros
```

---

## C. Aesthetic / dermatology coverage (Part 6)

| Area | Status | Evidence | Gaps |
|------|--------|----------|------|
| Dermatology consultation/Dx | MISSING–PARTIAL | No derm EMR; beauty only | Lesion charting, acne protocols |
| Laser (hair/frac/tattoo/pigment) | PARTIAL | Annotation `treatment` free-text + parameters JSON | Device SoR, area variants catalog |
| Injectables (toxin/filler) | PARTIAL | `BeautyAnnotation` zones + coords; materials map | Batch/lot on treatment, face plot UX maturity |
| Skin care / peels | PARTIAL | Free-text treatments | Protocol + pre/post care |
| HIFU / energy | PARTIAL | parameters JSON optional | Device settings schema |
| Body contouring courses | PARTIAL | No CourseSession SoR | Multi-session tracking |
| Threads/PRP/microneedling | PARTIAL | Free-text allowed | Governance labels |
| Marketing vs clinical separation | MISSING | Names conflated in free-text | Mandatory architecture gap |

**Mandatory separation rule (target):** marketing display name ≠ canonical procedure ≠ variant ≠ body area ≠ device/product ≠ protocol ≠ price.

---

## D. Aesthetic clinical safety / record audit (Part 7)

| Capability | Status | Evidence |
|------------|--------|----------|
| Structured consultation | PARTIAL | Encounters + notes |
| Medical history / allergies / meds | PARTIAL | Patient fields (general); aesthetic-specific screens MISSING |
| Contraindication screening | MISSING | — |
| Pregnancy screening | MISSING | — |
| Consent versioning | MISSING | — |
| Treatment-specific consent | MISSING | — |
| Photography consent | MISSING | — |
| Before/after photos | PARTIAL | Media categories / beauty workflows |
| Secure photo storage | PARTIAL–COMPLETE | Media module + tenant isolation |
| Photo comparison | PARTIAL | UI patterns if present; not proven global-class |
| Anatomical / face mapping | PARTIAL–COMPLETE | `BeautyRecord.bodyMapState`, annotation coordinates |
| Injection plotting | PARTIAL | coordinates JSON |
| Product / manufacturer | PARTIAL | Inventory items; not forced on annotation |
| Batch/lot / expiry on treatment | MISSING on annotation | Inventory has lot/expiry separately (`list-inventory-batches`) |
| Quantity/dose | PARTIAL | parameters JSON (`volumeCc`) |
| Injection site | PARTIAL | `zone` |
| Device / settings / laser intensity | PARTIAL | parameters JSON unstructured |
| Skin type / patch test / tolerance | MISSING | — |
| Course session number / interval | PARTIAL | No first-class course rules |
| Pre/post-care instructions | MISSING | — |
| Automated follow-up | PARTIAL | Notifications plane; not treatment-linked |
| Adverse event / complication | MISSING–PARTIAL | Free notes only |
| Prescriptions | PARTIAL | General Rx if enabled |
| Outcome/progress docs | PARTIAL | Notes + annotations |

**Aesthetic summary**

```text
EXCELLENT = (none at global bar)
COMPLETE = beauty record aggregate + annotation log foundation
PARTIAL = injectables mapping, media, materials, free-text procedures
MISSING = derm EMR, consent library, batch-on-treatment, patch test, contraindications, courses, pre/post care SoR
P0 gaps = versioned consent/forms (P0-06); treatment-specific + clinical-photo consent via same architecture (P0-09); treatment identity vs marketing free-text; injectable batch/lot/expiry on treatment (P0-08)
P1 gaps = device/laser settings; courses; derm depth; automated aftercare; operational recall
```

---

## E. Enterprise booking audit (Part 8)

### Availability

| Factor | Status | Evidence |
|--------|--------|----------|
| Provider | COMPLETE | `providerId` + weekly schedules |
| Specialty | PARTIAL | Platform specialties; soft booking use |
| Tenant/branch | COMPLETE | `tenantId`, `branchId`, `BranchOperatingHours` |
| Room | PARTIAL | `SchedulingResource` ROOM |
| Chair/operatory | MISSING type | Comment mentions chairs; enum ROOM/EQUIPMENT only |
| Equipment/device | PARTIAL | EQUIPMENT type |
| Service duration | PARTIAL | Defaults + templates |
| Provider-specific duration | MISSING | — |
| Prep/cleanup buffers | MISSING | — |
| Working hours / breaks | PARTIAL | Branch hours; break exceptions thin |
| Holidays / leave | PARTIAL–MISSING | Not first-class vs weekly model |
| Service availability rules | MISSING | — |

### Conflict prevention

| Factor | Status | Evidence |
|--------|--------|----------|
| Provider double-book | PARTIAL | `findByProviderAndSlot` in create/update handlers |
| Resource conflict | PARTIAL | Resource overlap checks |
| DB exclusion / transaction | MISSING | App read-then-write |
| Race / idempotent create | PARTIAL | Idempotency elsewhere on platform; scheduling weak |
| Timezone | PARTIAL | `scheduling-timezone.util.spec.ts` |
| Cancel releases slot | COMPLETE | Status CANCELLED + soft delete patterns |
| Reschedule conflicts | PARTIAL | Update handler conflict checks |

### Appointment lifecycle (actual)

```text
PENDING → CONFIRMED → CHECKED_IN → IN_PROGRESS → COMPLETED
         ↘ CANCELLED / NO_SHOW
Waitlist: OPEN → SCHEDULED / CANCELLED
```

No separate REQUESTED/WAITLISTED appointment status; waitlist is sibling entity. Reschedule = update slot (no dedicated RESCHEDULED status).

### Patient experience

| Capability | Status | Evidence |
|------------|--------|----------|
| Online/self booking | COMPLETE–PARTIAL | `portal-scheduling.controller.ts` |
| Service/location/provider select | PARTIAL | Limited by hardcoded types |
| Preferred language | PARTIAL | Tenant/UI locale |
| Earliest slot | PARTIAL | Availability handlers |
| Cancel/reschedule | PARTIAL–COMPLETE | Portal + clinic APIs |
| Forms/consent pre-visit | MISSING | — |
| Reminders | COMPLETE | `AppointmentReminderLog` |
| Post-instructions / follow-up book | MISSING–PARTIAL | — |
| Waitlist | COMPLETE basic | `AppointmentWaitlist` |
| Accessibility | PARTIAL | — |
| Arabic RTL / English LTR | PARTIAL–COMPLETE | Clinic i18n; portal depth TBD |
| Mobile responsive | PARTIAL | Web |

### Advanced scheduling

| Capability | Status |
|------------|--------|
| Recurring | PARTIAL (`recurrenceSeriesId`) |
| Course/series aesthetic | MISSING SoR |
| Multi-visit dental plan booking | PARTIAL |
| Emergency slots | PARTIAL (`isEmergency`) |
| Reserved slots | MISSING |
| Waitlist auto-fill | PARTIAL (manual-ish) |
| Recall campaigns | MISSING ops |
| Resource-aware | PARTIAL |
| Multi-location provider | PARTIAL–COMPLETE |
| Cross-branch permissions | PARTIAL |

### Reception / provider UX

| Capability | Status |
|------------|--------|
| Calendar views | COMPLETE (clinic dashboard) |
| Operatory view | PARTIAL (resource, not chair-native) |
| Drag/reschedule | PARTIAL if UI supports updates |
| Patient context | COMPLETE patterns |
| Forms/consent alerts | MISSING |
| Treatment-plan opportunities | PARTIAL |
| No-show history | PARTIAL (status) |
| Appointment notes | COMPLETE |
| Audit trail | PARTIAL |
| Tablet keyboard workflow | PARTIAL |

**Booking summary**

```text
EXCELLENT = (none)
COMPLETE = core appointment CRUD, statuses, branch hours, waitlist entity, reminders, portal entrypoint
PARTIAL = conflicts, resources, recurrence, emergency, multi-visit, RTL depth
MISSING = chair type, buffers, operational recall SoR (P1), forms gate (P0), course packages, DB-level concurrency
P0 = double-book races; service identity; price snapshot; plan-linked booking; service-specific provider eligibility
P1 = operatory; courses; operational recall; auto-waitlist; holiday/leave
```

```text
provider double-book protection = PARTIAL (application-level)
resource/operatory protection = PARTIAL (ROOM/EQUIPMENT; no CHAIR)
multi-location = COMPLETE (branch-scoped)
online booking = COMPLETE foundation / PARTIAL vs global bar
waitlist = COMPLETE basic / PARTIAL automation
recall = MISSING operational (P1 — not P0)
multi-session/course booking = MISSING SoR
multi-visit dental treatment booking = PARTIAL
historical price snapshot = MISSING
```

---

## F. Booking + service + price integrity chain (Part 9)

| Link | Status | Risk |
|------|--------|------|
| Canonical Service | MISSING | Free-text drift |
| Tenant Service Configuration | PARTIAL | Price row doubles as config |
| Tenant/Branch Price | PARTIAL / MISSING branch | Cross-clinic code collision |
| Booking Rule | PARTIAL | Duration defaults only |
| Provider/Resource Eligibility | MISSING / PARTIAL | Ineligible booking possible |
| Appointment | COMPLETE entity | Weak service FK |
| Historical Price Snapshot | MISSING | Zero invoice unitPrice |
| Clinical Treatment | PARTIAL link | Plan vs appointment disconnect |
| Audit | PARTIAL | — |

Fragile patterns observed: free-text appointment type; master price without snapshot; deleted/renamed serviceCode orphan risk; Arabic/English duplicate codes; race double-book.

---

## G. Bilingual Arabic / English (Part 10)

| Area | Status | Evidence |
|------|--------|----------|
| stableKey / nameAr / nameEn | PARTIAL | `ServicePrice`; HealthcareCatalog translations; scheduling types EN ids only |
| Descriptions AR/EN | MISSING clinical | — |
| Search aliases | PARTIAL | Platform catalog aliases |
| Localized consents / pre-post | MISSING | — |
| RTL / LTR layout | PARTIAL–COMPLETE | `getDirection('ar-SY')` → rtl tests |
| Mixed content | PARTIAL | — |
| Search AR/EN services | PARTIAL | No clinical catalog |
| Date/number/currency formatting | PARTIAL | Currency on prices; locale formatting uneven |
| Patient communications | PARTIAL | Notification templates bilingual capability in registry |
| Forms/consent | MISSING library | — |
| Service catalog UX | PARTIAL | — |

**Quality rule:** label-only translation without catalog/search/forms = PARTIAL.

```text
data localization = PARTIAL
RTL = PARTIAL–COMPLETE (UI chrome)
LTR = COMPLETE
Arabic search = PARTIAL
English search = PARTIAL–COMPLETE
patient communications = PARTIAL
forms/consent = MISSING
service catalog = PARTIAL
remaining P0/P1 = bilingual clinical catalog + RTL booking E2E + consent content AR/EN
```

---

## H. Service requirement normalization appendix (Part 17)

Do **not** seed. Candidate bilingual categories:

| EN | AR |
|----|----|
| Dental | الأسنان |
| Aesthetic Dentistry | طب الأسنان التجميلي |
| Orthodontics | تقويم الأسنان |
| Endodontics | علاج الجذور واللبية |
| Pediatric Dentistry | طب أسنان الأطفال |
| Implantology | زراعة الأسنان |
| Periodontics | علاج اللثة |
| Laser Gingival Procedures | إجراءات اللثة بالليزر |
| Dermatology | الجلدية |
| Laser Treatments | العلاجات بالليزر |
| Injectables | الحقن التجميلي |
| Fillers | الفيلر |
| Botulinum Toxin | البوتولينوم توكسين |
| Skin Care & Peels | العناية بالبشرة والتقشير |
| HIFU | الهايفو |
| Body Contouring & Slimming | نحت وتنحيف الجسم |
| Multi-session Courses | كورسات علاجية متعددة الجلسات |

**Variant expansion principle:** category → canonical procedure → body-area/tooth applicability → device/product → session/course → tenant price. Ambiguous marketing labels: **NEEDS_CLINICAL_TERMINOLOGY_REVIEW**.

---

## I. P0 / P1 registers (Parts 14–15) — normalized

**Taxonomy rules:** `P0 + DEFER = INVALID`. Coverage `MISSING` means the *target capability* has no adequate SoR even if reusable infrastructure exists.

### P0 (mandatory; no defer)

| ID | Capability | Coverage | Evidence | Risk | Disposition | Next-stage |
|----|------------|----------|----------|------|-------------|------------|
| P0-01 | Clinical service/procedure catalog | MISSING | `service-types.ts` only | Free-text drift | IMPLEMENT | Architecture Review: catalog SoR |
| P0-02 | Appointment service/price historical snapshot | MISSING | `create-invoice-from-appointment.handler.ts` unitPrice 0 | Revenue/history corruption | IMPLEMENT | Snapshot on book/complete |
| P0-03 | Scheduling concurrency / hard double-book protection | PARTIAL | create-appointment conflict read-then-write | Double-book | IMPROVE | DB/tx + postgres race tests |
| P0-04 | Service-specific provider eligibility | MISSING | No eligibility SoR (generic User/roles/schedules exist and are reusable) | Unsafe booking | IMPLEMENT using existing provider infrastructure | Eligibility SoR + booking enforcement |
| P0-05 | Treatment-plan ↔ appointment staging integrity | PARTIAL | TreatmentPhase vs Appointment | Clinical disconnect | IMPROVE | Link items to appointments |
| P0-06 | Versioned clinical consent/forms baseline | MISSING | Plan consent timestamps only | Legal/clinical | IMPLEMENT | Single consent architecture |
| P0-07 | Price history / non-destructive audit trail | MISSING | ServicePrice upsert overwrite | Silent mutation | IMPROVE/IMPLEMENT | PriceVersion |
| P0-08 | Injectable treatment batch/lot/expiry traceability | MISSING (treatment-level linkage) | Inventory lot/expiry exists; not linked on BeautyAnnotation/treatment usage | Patient safety / product recall / adverse-event investigation | IMPROVE inventory/material infra + IMPLEMENT treatment-usage linkage | ProductBatchUsage on treatment |
| P0-09 | Treatment-specific + clinical-photo consent coverage | MISSING | No consent library | Privacy / aesthetic safety | IMPLEMENT **through P0-06** (not a second consent domain) | Consent templates covering treatment + photography |

### P1 (launch-quality / competitive; sequenced after P0 unless Architecture Review relocates)

| ID | Capability | Coverage | Disposition |
|----|------------|----------|-------------|
| P1-01 | Branch-specific service enablement/pricing | MISSING | IMPLEMENT |
| P1-02 | Pricing units / dental applicability | MISSING | IMPLEMENT |
| P1-03 | Chair / operatory first-class resource | MISSING | IMPROVE enum/resource |
| P1-04 | Aesthetic treatment courses / multi-session booking | MISSING | IMPLEMENT |
| P1-05 | Device / laser settings Source of Record | PARTIAL JSON | IMPROVE |
| P1-06 | Dermatology clinical depth | MISSING | IMPLEMENT (Architecture Review may DEFER to P2 with rationale) |
| P1-07 | Dental laboratory case workflow | MISSING | IMPLEMENT |
| P1-08 | Arabic catalog search + RTL booking quality | PARTIAL | IMPROVE |
| P1-09 | Pre/post-care instructions | MISSING | IMPLEMENT |
| P1-10 | Waitlist auto-fill | PARTIAL | IMPROVE |
| P1-11 | Holiday/leave availability | PARTIAL | IMPROVE |
| P1-12 | Accessibility + tablet reception | PARTIAL | IMPROVE |
| P1-13 | Operational Recall SoR / professional recall workflow | MISSING | IMPLEMENT (reuse journey registry + reminders + notifications plane); DEFER only if Architecture Review explicitly moves to P2 with rationale |

**Operational recall rationale (not P0):** important continuity/competitive capability, but not equivalent in immediate safety/integrity severity to double-booking, historical price corruption, consent versioning, or injectable treatment traceability. Invalid prior `P0 + DEFER` combination removed.

### P2/P3 deferred (do not implement during P0/P1 closure by accident)

- Promo pricing tiers, Google Reserve-class channels, AI charting, voice notes, visual regression suite, advanced analytics, vaginal-laser jurisdiction features unless clinical/legal review, browser matrix expansion.
