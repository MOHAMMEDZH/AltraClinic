# Phase 48 — Global Competitive Capability Matrix

| Field | Value |
|-------|--------|
| **Phase** | 48 — Enterprise QA & Testing |
| **Stage** | Architecture Discovery only |
| **Baseline** | `ae6307dfda8207e06db842318323d391c8fc8f18` |
| **Rule** | EXISTS ≠ GLOBALLY COMPETITIVE |

Companion: `docs/PHASE_48_ENTERPRISE_QA_ARCHITECTURE_DISCOVERY.md`, `docs/PHASE_48_DENTAL_AESTHETIC_BOOKING_GAP_MATRIX.md`, `docs/PHASE_48_QA_TEST_ARCHITECTURE_INVENTORY.md`.

---

## Status legend

| Status | Meaning |
|--------|---------|
| EXCELLENT | Globally competitive quality demonstrated in repo |
| COMPLETE | Fit for professional clinic use with acceptable quality bar |
| PARTIAL | Exists but primitive, unsafe, fragmented, non-localized, or incomplete |
| MISSING | No reusable Source of Record / workflow |
| OUT_OF_SCOPE | Explicitly outside Phase 48 / commercial launch product scope |

Launch priority: **P0** / **P1** / **P2** / **P3**.

Disposition: **REUSE** / **IMPROVE** / **IMPLEMENT** / **DEFER**.

---

## 1. Applications & topology

| Surface | Path | Status | Notes |
|---------|------|--------|-------|
| Clinic ERP UI | `apps/clinic-dashboard` | COMPLETE | Primary staff UX |
| Patient portal | `apps/patient-portal` + `apps/api/src/modules/patient-portal` | COMPLETE (booking PARTIAL vs global bar) | Self-scheduling controller: `portal-scheduling.controller.ts` |
| Super Admin | `apps/super-admin` | COMPLETE for platform | Catalog = facility/specialty/module — not clinic procedures |
| API domains | `apps/api/src/modules/*` | COMPLETE topology | See SoR map below |
| Mobile native apps | — | MISSING | Web responsive only; PWA not proven as first-class |
| Dedicated derm EMR UI | — | MISSING | Beauty module covers aesthetics annotations |

---

## 2. Source of Record map

| Domain | SoR | Evidence | Status | Limitations |
|--------|-----|----------|--------|-------------|
| Patients | `Patient` + Patients module | `apps/api/src/modules/patients`, schema `patients` | COMPLETE | — |
| Appointments | `Appointment` | `apps/api/prisma/schema.prisma` `Appointment`; `apps/api/src/modules/scheduling` | COMPLETE core / PARTIAL integrity | Free-text `serviceType`; app-level conflict only |
| Waitlist | `AppointmentWaitlist` | schema + scheduling handlers | COMPLETE basic | Auto-fill vs NexHealth-class PARTIAL |
| Resources | `SchedulingResource` (`ROOM`/`EQUIPMENT`) | schema enum `SchedulingResourceType` | PARTIAL | No CHAIR/OPERATORY type |
| Providers | `User` + weekly schedules | `ProviderWeeklySchedule` / staff schedules | PARTIAL | Thin specialty/eligibility model |
| Branches | `Branch` + `BranchOperatingHours` | schema + settings | COMPLETE | — |
| Platform catalog | `HealthcareCatalogItem` + translations/aliases | Super Admin healthcare catalog | COMPLETE for entitlements | **Not** billable clinical procedures |
| Scheduling services | Hardcoded list | `apps/api/src/modules/scheduling/domain/service-types.ts` | PARTIAL | 7 generic types only |
| Clinic prices | `ServicePrice` | schema + `billing-financial.service.ts` | PARTIAL | Flat `unitPrice`; no history/units/branch |
| Dental clinical | `DentalRecord`, tooth conditions, perio, plans, ortho, implants | `apps/api/src/modules/dental` | COMPLETE–PARTIAL | Strong charting; weak catalog linkage |
| Aesthetic clinical | `BeautyRecord`, `BeautyAnnotation` | `apps/api/src/modules/beauty` | PARTIAL | Map + free-text treatment; weak batch/laser |
| Media | `MediaAsset` | `apps/api/src/modules/media` | COMPLETE | Privacy/comparison workflows PARTIAL |
| Billing | Invoices/payments/POS | `apps/api/src/modules/billing` | COMPLETE | Appointment→invoice price = 0 |
| Notifications | Notification plane + `AppointmentReminderLog` | notifications module + scheduling | COMPLETE reminders / PARTIAL recall | Recall journey registry only |
| Audit | Platform audit center | Step 21/28 modules | COMPLETE platform | Clinic price/service catalog audit PARTIAL |
| Localization | UI i18n + `Tenant.locale` | `apps/clinic-dashboard/src/i18n`, `packages/i18n` | COMPLETE UI labels / PARTIAL data search | Service catalog bilingual incomplete |
| Forms/consent library | — | Embedded plan consent fields; beauty notes | MISSING library | Versioned templates absent |
| Recall operational | — | `packages/module-registry` journey packs only | MISSING | Docs aspirational (`INFORMATION_ARCHITECTURE.md`) |
| Inventory batches | Inventory lot/expiry | inventory module | COMPLETE inventory | Not linked as injectable treatment usage SoR |

---

## 3. Service catalog capability checklist (Part 2)

| # | Capability | Status | Priority | Disposition | Evidence |
|---|------------|--------|----------|-------------|----------|
| 1 | Stable machine key | PARTIAL | P0 | IMPLEMENT/IMPROVE | Scheduling IDs hardcoded; `ServicePrice.serviceCode` tenant-local, not clinical SoR |
| 2 | Arabic + English names | PARTIAL | P0 | IMPROVE | `ServicePrice.nameEn/nameAr`; scheduling types lack bilingual catalog |
| 3 | Arabic + English descriptions | MISSING | P1 | IMPLEMENT | No description fields on clinical services |
| 4 | Category/subcategory | PARTIAL | P1 | IMPLEMENT | Platform catalog categories ≠ clinic procedures |
| 5 | Link to specialty | PARTIAL | P1 | IMPROVE | Platform specialties exist; appointments don't require specialty-service link |
| 6 | Link to module/workflow | PARTIAL | P1 | IMPROVE | Module registry exists; booking types not module-bound |
| 7 | Duration | PARTIAL | P0 | IMPROVE | Defaults in `SCHEDULING_SERVICE_TYPES`; templates have `durationMin` |
| 8 | Provider qualification | MISSING | P0 | IMPLEMENT | No `ProviderServiceEligibility` |
| 9 | Chair/room/device requirement | PARTIAL | P0 | IMPROVE | Optional `resourceId`; type ROOM/EQUIPMENT only |
| 10 | Variants without duplication | MISSING | P1 | IMPLEMENT | — |
| 11 | Body-area variants | PARTIAL | P1 | IMPROVE | Beauty `zone` free-text |
| 12 | Tooth/surface/quadrant/arch | PARTIAL | P0 | IMPROVE | `DentalToothCondition` + plan `toothNumbers`; not booking catalog |
| 13 | Multi-session courses | PARTIAL | P1 | IMPROVE | Recurrence series; beauty session JSON — no course SoR |
| 14 | Multi-visit stages | PARTIAL | P0 | IMPROVE | `TreatmentPhase` / items; weak booking linkage |
| 15 | Enable per clinic | PARTIAL | P0 | IMPROVE | `ServicePrice.isActive` only |
| 16 | Enable per branch | MISSING | P1 | IMPLEMENT | No branch service config |
| 17 | Search AR/EN | PARTIAL | P1 | IMPROVE | Price list names; no clinical catalog search |
| 18 | Historical appointment preserves service identity | PARTIAL | P0 | IMPLEMENT | `serviceType` string snapshot only; no FK to catalog |
| 19 | Stable keys protected | MISSING | P1 | IMPLEMENT | Hardcoded IDs mutable only by code change; tenant codes free |
| 20 | Service configuration audited | PARTIAL | P0 | IMPROVE | Platform audit strong; clinic price upsert audit unclear |

**Clinic A ≠ Clinic B price without duplicating canonical service:** conceptually **desired**; today `ServicePrice` is tenant-scoped by `serviceCode` **without** shared clinical catalog — tenants may invent divergent codes (PARTIAL / risk of bilingual duplicates).

---

## 4. Tenant pricing checklist (Part 3)

| Capability | Status | Priority | Evidence |
|------------|--------|----------|----------|
| Tenant-specific price | PARTIAL | P0 | `ServicePrice` unique `(tenantId, serviceCode)` |
| Branch-specific price | MISSING | P1 | No branchId on `ServicePrice` |
| Currency | COMPLETE | — | `ServicePrice.currency` default SYP |
| Base / promo price | MISSING | P2 | Single `unitPrice` |
| Package/course price | MISSING | P1 | — |
| Effective-from/to | MISSING | P0 | — |
| Active/inactive | COMPLETE | — | `isActive` |
| Price on consultation | MISSING | P2 | — |
| Price history | MISSING | P0 | Upsert overwrites |
| Historical appointment price snapshot | MISSING | P0 | `Appointment` has no price; invoice-from-appt `unitPrice: 0` |
| Price change audit | PARTIAL | P0 | Financial upsert; no dedicated price version table |
| Authorization for pricing | PARTIAL | P0 | Billing permissions exist; catalog separation weak |
| Service definition ≠ commercial price | PARTIAL | P0 | Intentionally split but definition SoR missing |
| Tax | PARTIAL | P2 | `taxPercent` on `ServicePrice` |
| Pricing units (PER_TOOTH, …) | MISSING | P1 | Dental costs via `TreatmentPlanItem.estimatedCost` |

**Historical mutation risk:** Changing `ServicePrice.unitPrice` does **not** rewrite appointment rows (no price on appointment), but also does **not** preserve what should have been charged — invoices may be recreated with wrong/zero amounts. **Severity: High.**

---

## 5. Quality attributes matrix (Part 13)

| Attribute | Evidence | Tests | Gaps | Severity | Phase 48 validation strategy |
|-----------|----------|-------|------|----------|------------------------------|
| Functional correctness | Broad domain modules | Jest unit/integration + dashboard E2E | Catalog/pricing chain untested end-to-end | High | Scenario suites for book→treat→invoice |
| Clinical safety | Dental/beauty models | Module unit tests (limited) | Contraindication/consent/version gaps | Critical | Safety checklist tests; no exploit PoCs |
| Data integrity | Prisma FKs, soft deletes | DB suites for platform | Scheduling race; price history | Critical | Concurrency + snapshot tests |
| Tenant isolation | RLS scripts, tenantId indexes | Platform DB security CI | Branch isolation edge cases | Critical | Keep Step 28 isolation; add branch cases |
| Authorization | `packages/permissions` | Permission matrix validate | Service-name-as-auth risk if introduced | High | Matrix expand for pricing/catalog |
| Auditability | Audit center | Step 21 runners | Clinic service/price audit | High | Audit assertions on upserts |
| Privacy | Media + portal guards | Portal policy tests | Clinical photo consent/compare | High | Photo access + consent linkage tests |
| Security | Step 28 hardening | Secrets scan, dep audit, rate limit | Continue Phase 49 hardening | Med (Phase 49) | Inventory only in Phase 48 |
| Performance | Notification load script | `test:load:notifications` | No scheduling load suite | Med | Targeted booking load later |
| Scalability | Multi-branch schema | Limited | Resource scheduling scale | Med | DEFER load beyond smoke |
| Concurrency | App-level conflict checks | Scheduling unit overlap tests | No postgres exclusion / parallel create suite | Critical | P0 concurrency tests |
| Reliability | Final onepass runners | Steps 19–29 | Clinic path less than platform | High | Deterministic clinic onepass design |
| Availability | Ops console | Step 22 | OUT_OF_SCOPE ops SLOs | Low | DEFER |
| Recoverability | Backup docs (ops) | Limited automated restore tests | Backup/restore suite thin | Med | Inventory + P2 |
| Observability | Ops/security evidence | Step 28/29 | Clinic booking metrics | Med | P2 |
| Localization | ar-SY/en UI | `locale-default.test.ts` | Catalog/search/comms depth | High | AR search + RTL booking E2E |
| Accessibility | Partial UI | Sparse a11y tests | Systematic a11y missing | Med | P1/P2 a11y smoke |
| Mobile/tablet | Responsive web | E2E desktop-heavy | Tablet reception UX unproven | Med | P1 tablet booking flows |
| Browser compatibility | Modern SPA | CI builds | Matrix undocumented | Low | P3 |
| API stability | Nest modules | Contract sparse | Catalog API absent | Med | Freeze contracts in review |
| Migration safety | Prisma migrate validators | Many platform migration scripts | Clinic catalog migration TBD | High | When implementing: clean+upgrade |
| Backward compatibility | Soft deletes, snapshots (insurance) | Platform | Appointment serviceType drift | High | Snapshot strategy |
| Historical reproducibility | Invoice lines exist | Billing tests | Appointment price absent | Critical | Snapshot model + tests |
| Test determinism | `--runInBand`, onepass | Step 29 | Flaky clinic E2E risk | High | Inventory flaky list |
| Operational supportability | Step 29 handover | Docs | Clinic runbooks for catalog | Med | Docs in later polish |

---

## 6. Competitive scorecard (0–5) — Part 18

| Dimension | Score | Evidence (must cite) |
|-----------|------:|----------------------|
| Dental clinical coverage | 4 | Odontogram, perio, plans, ortho, implants in schema + dental module |
| Dental booking | 3 | Appointments + emergency + templates; generic `serviceType`, weak plan linkage |
| Aesthetic clinical coverage | 2 | Beauty body map + annotations; free-text treatment; batch/laser gaps |
| Aesthetic booking | 2 | Same scheduling stack; no course/package SoR |
| Service catalog flexibility | 1 | Hardcoded `SCHEDULING_SERVICE_TYPES` (7) |
| Tenant pricing flexibility | 2 | `ServicePrice` tenant unitPrice; no history/units/branch |
| Arabic UX | 3 | `ar-SY` messages + RTL direction tests |
| English UX | 4 | Primary message modules complete |
| Patient self-service | 3 | Patient portal scheduling module |
| Reception workflow | 3 | Clinic dashboard calendars/templates/waitlist |
| Provider workflow | 3 | Clinical workspaces + schedule |
| Multi-location support | 4 | `branchId` on appointments/resources/hours |
| Resource scheduling | 2 | ROOM/EQUIPMENT only; soft conflicts |
| Clinical documentation | 3 | Dental notes + beauty notes; forms library missing |
| Consent/forms | 1 | Plan consent fields; no template versions |
| Photo/imaging workflow | 3 | Media assets + dental imaging paths; aesthetic compare PARTIAL |
| Treatment plans | 4 | Phases, items, statuses, approval, insurance snapshot |
| Follow-up/recall | 1 | Journey registry only; no operational recall SoR |
| Notifications | 3 | Reminders + notification templates; recall type aspirational |
| Security | 4 | Step 28 matrix + RLS + RBAC |
| Audit | 3 | Strong platform audit; clinic commercial audit thinner |
| Performance readiness | 2 | Limited load evidence outside notifications |
| Enterprise QA maturity | 4 | Steps 19–29 runners + multi CI; clinic booking concurrency gap |

No score of 5: no domain meets full global-competitive bar with historical pricing + catalog + concurrency + forms + recall together.

---

## 7. External benchmark patterns (Part 11)

```text
official benchmark research available = YES
```

Sources consulted (official product pages only; **do not copy UX/wording/implementation**):

| System | Patterns observed (high level) | Official refs |
|--------|--------------------------------|---------------|
| Dentrix Ascend | Integrated charting/imaging, multi-location schedule, online booking, reminders | dentrixascend.com solutions / booking pages |
| CareStack | Multi-location scheduling, charting+perio, online self-scheduling, portal forms | carestack.com feature pages |
| NexHealth | Online booking, automated waitlist fill, 1-click recall engagement, anti-double-book messaging | nexhealth.com waitlist/scheduling |
| Pabau | Digital consent/intake, treatment-specific forms, before/after + aesthetic clinical workflow patterns | pabau.com patient intake |

**Repo strengths vs patterns:** multi-branch appointments, dental charting/plans, portal booking, waitlist entity, reminders, beauty map.

**Material gaps vs patterns:** operatory-centric schedule, recall automation SoR, versioned consent library, appointment-type forms, injectable batch charting, hard concurrency guarantees, unified procedure catalog tied to price snapshots.

**Do not claim product equivalence** to any vendor.

---

## 8. Gap prioritization summary

### P0 (must enter Enterprise QA closure design)

- Canonical clinical service catalog linked to booking
- Appointment/service/price historical snapshot
- Provider (+ resource) booking concurrency integrity
- Provider eligibility for services
- Treatment-plan ↔ appointment staging integrity
- Versioned consent / clinical forms baseline
- Price change audit + non-destructive history
- Operational recall SoR (or explicit DEFER with risk acceptance)

### P1

- Branch pricing / service enablement
- Pricing units / dental applicability on catalog
- Aesthetic batch/lot/expiry on treatment record
- Laser/device settings SoR
- Course/package multi-session booking
- Chair/operatory resource type
- Arabic catalog search + RTL booking polish
- Dermatology clinical depth beyond beauty
- Accessibility + tablet reception flows

### P2 / P3

- Promo pricing, Reserve-with-Google-class channels, voice notes, AI diagnostics, visual regression, browser matrix, advanced analytics

---

## 9. Risk register (Part 19) — condensed

| Risk | Severity | Evidence | Workflow | Next-stage treatment |
|------|----------|----------|----------|----------------------|
| Duplicate service SoRs | High | Hardcoded types + `ServicePrice.serviceCode` + plan `code` | Booking/billing/clinical | Single clinical catalog SoR |
| Free-text service drift | High | `Appointment.serviceType` VarChar | Scheduling | FK/snapshot to catalog |
| Bilingual duplicate records | Med | Tenant-invented codes | Catalog/search | Stable keys + translations |
| Unsafe price mutation | High | `ServicePrice` upsert overwrite | Billing | PriceVersion history |
| Lost historical price | Critical | Invoice-from-appt `unitPrice: 0` | Completed care | AppointmentServiceSnapshot |
| Double booking | Critical | Read-then-write conflict only | Scheduling | Transaction/exclusion + tests |
| Resource conflict | High | App-level resource overlap | Rooms/equipment | Same as above + CHAIR type |
| Stale availability | Med | Weekly hours model | Portal booking | Exception/holiday model IMPROVE |
| Course inconsistency | High | No CourseSession SoR | Aesthetic packages | Course model IMPROVE/IMPLEMENT |
| Treatment-plan disconnect | High | Plan items vs free appointment | Dental multi-visit | Link appointments to plan items |
| Tooth/surface loss | Med | JSON + condition log | Clinical | Preserve + catalog applicability |
| Photo privacy misuse | High | Media without photo-consent library | Aesthetic | Consent + ACL tests |
| Injectable batch gaps | High | Inventory batches ≠ beauty annotation usage | Injectables | ProductBatchUsage link |
| Laser parameter gaps | Med | Optional JSON parameters | Laser | DeviceTreatmentRecord |
| Consent versioning gaps | Critical | Embedded timestamps only | All invasive care | ConsentTemplate/Version |
| Contraindication screening | High | No structured screen SoR | Aesthetic/dental | Forms + gates |
| Cross-tenant leakage | Critical if regress | RLS + tenantId | All | Keep Step 28 gates |
| Branch isolation errors | High | Optional branchId | Multi-location | Branch permission tests |
| Weak authorization | Med | Permissions strong overall | Pricing | Explicit price perms audit |
| RTL UX inaccessible | Med | Labels translated; catalog weak | Arabic patients | RTL E2E on booking |
| Mobile/tablet weak | Med | Web only | Reception | Tablet scenarios |
| QA blind spots | High | Few scheduling concurrency tests | Enterprise QA | Phase 48 test architecture |
| Flaky/non-deterministic QA | Med | Long runners historically | Release | Deterministic onepass patterns |

---

## 10. Proposed target concepts (Part 16)

See discovery doc §5. Summary: **new models likely required** for ClinicalService catalog, PriceVersion/history, AppointmentServiceSnapshot, ConsentTemplate/Version, RecallRule; **improve** beauty annotations, treatment plans, SchedulingResource types, ServicePrice linkage; **reuse** Patient, Appointment, Media, Billing invoice lines, Dental charting, notifications plane.
