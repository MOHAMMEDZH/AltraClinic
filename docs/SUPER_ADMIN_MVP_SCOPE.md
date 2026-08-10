# Release 47 — Flexible Super Admin MVP
## Scope and Terminology Freeze

| Field | Value |
|-------|--------|
| **Document type** | Scope and Terminology Freeze (Step 02) |
| **Release** | **47** — Flexible Super Admin MVP |
| **Authoritative playbook** | Healthcare ERP SaaS — Flexible Super Admin Implementation Playbook v4 |
| **Status** | **FROZEN pending approval** — no production implementation authorized until approved |
| **Date** | 2026-07-21 |
| **Authority** | This document is the **authoritative** Release 47 scope and terminology source once approved |
| **Baseline inputs** | [`docs/Architecture_Discovery_Report.md`](./Architecture_Discovery_Report.md), [`docs/SUPER_ADMIN_V4_STEP01_CATALOG_ENTITLEMENT_DISCOVERY.md`](./SUPER_ADMIN_V4_STEP01_CATALOG_ENTITLEMENT_DISCOVERY.md) |
| **Evidence priority** | Verified repository runtime behavior overrides conflicting documentation |

**RFC 2119:** MUST / MUST NOT / SHOULD / SHOULD NOT / MAY are used as normative language for frozen decisions.

---

## 1. Document Status and Authority

1. This document freezes Release 47 **product boundary**, **included and deferred scope**, **canonical terminology**, **Source of Record ownership**, **legacy compatibility**, **roles**, **permission categories**, **security/privacy boundaries**, and **implementation step gating**.
2. It MUST NOT be treated as an implementation authorization. Scaffolding, schema, APIs, UI, and entitlement code begin only after Step 03 (Security Boundary Review) and Step 04 (Execution Plan) are approved.
3. Discovery documents remain evidence. Where they conflict with runtime repository evidence, runtime wins and the conflict is recorded here.
4. The large multi-product **Platform Core** playbook is **explicitly excluded** from Release 47.
5. Patient Portal product work remains **explicitly deferred**.
6. Existing Centers 41–46, Phase 28 licensing, `platform-admin`, tenant isolation, RLS, permission patterns, audit, notifications, observability, and backup capabilities MUST be reused where applicable — not rebuilt.

---

## 2. Executive Summary

Release 47 delivers an **internal SaaS control-plane** for the existing Healthcare ERP: a dedicated Super Admin application plus catalog, immutable plan versions, subscriptions, governed overrides, effective entitlements, platform identity/RBAC, operations evidence, and lightweight sales/trials.

**Current verified state (discovery):**

| Area | State | Evidence |
|------|--------|----------|
| Dedicated Super Admin app | **Missing** | `Architecture_Discovery_Report.md` |
| `platform-admin` APIs | **Existing** | `apps/api/src/modules/platform-admin/` |
| Phase 28 licensing engine | **Existing** | `LicensingEngineService`, Phase 28 CI |
| Plan versions / add-ons / compatibility catalog | **Missing** | Step 01 supplement |
| Three plan vocabularies | **Existing collision** | Prisma / platform / UI |
| Facility type / specialty | **Partial JSON** | `tenant.features.clinicProfile` |
| Super-admin UX | **Embedded** in clinic-dashboard | `SubscriptionAdminPage.tsx` |

**Frozen stance:** Reuse and extend existing Sources of Record; introduce new domains only where discovery proves absence; migrate through an explicit licensing bridge; never authorize by plan display names; never treat Feature Flags as commercial entitlements; never conflate SaaS Tenant Subscription with `ClinicSubscription`.

---

## 3. Release 47 Product Boundary

### 3.1 What Release 47 IS

An **internal SaaS control-plane application** for managing:

- the existing Healthcare ERP business and tenants
- healthcare catalog (facility types, specialties, modules, features, limits, compatibility)
- plans, immutable plan versions, subscriptions, entitlements
- platform users, roles, MFA, sessions
- operations, audit, trials
- lightweight sales workflows

### 3.2 What Release 47 is NOT

Release 47 MUST NOT be:

| Exclusion | Reason |
|-----------|--------|
| A second Healthcare ERP | Control plane only |
| A generic multi-product Platform Core | Explicitly out of playbook scope |
| A replacement for Centers 41–46 | Reuse Centers |
| A replacement for `platform-admin` | Extend / facade |
| A public marketplace | Deferred |
| A payment processor | Deferred / later billing program |
| An invoicing system | Deferred |
| A tax engine | Deferred |
| A revenue-recognition system | Deferred |
| A full CRM | Lightweight sales MVP only |
| A payroll or advanced commission engine | Reviewable commission snapshots only |
| A Patient Portal release | Explicitly deferred |

---

## 4. Included MVP Scope

Each capability remains subject to later step acceptance criteria and repository evidence. Inclusion here freezes **intent**, not implementation detail.

### 4.1 Platform Foundation

- Dedicated Super Admin application
- Separate platform authentication boundary
- MFA
- Session management
- Granular RBAC
- Platform user administration
- Design-system shell and navigation

### 4.2 Tenant Management

- Tenant directory and detail
- Tenant creation and provisioning
- Activation, suspension, reactivation
- Governed archival and deletion requests
- Views of subscription, license, catalog selection, and effective entitlements

### 4.3 Healthcare Catalog

- Facility types
- Medical specialties
- Modules, features, limits
- Compatibility rules
- Stable capability keys
- Lifecycle status and non-destructive retirement

### 4.4 Commercial Control

- Plans and **immutable** Plan Versions
- Plan entitlements and limits
- Add-ons
- Governed Tenant Overrides
- Subscriptions tied to a **published** Plan Version
- Controlled subscription migration
- Trial defaults and trial conversion

### 4.5 Runtime Entitlements

- Centralized effective-entitlement resolution
- Server-side capability and limit checks
- Source explainability
- Legacy licensing bridge
- Feature Flag vs Entitlement separation
- Cache isolation and invalidation (implementation later)

### 4.6 Platform Operations and Evidence

- Dashboard
- Audit center
- Operations console
- Feature flags and global settings
- Health, jobs, queues, backups, integration status (via existing infrastructure)
- Notifications using existing notification capabilities

### 4.7 Lightweight Sales MVP

- Sales representatives
- Leads, opportunities, pipeline
- Demos and trials
- Customer assignment
- Sales productivity
- Reviewable monthly commission snapshots

---

## 5. Explicitly Deferred Scope

| Deferred item | Classification |
|---------------|----------------|
| Automated payment gateway | Dependent on later billing program |
| Invoices | Dependent on later billing program |
| Tax calculation | Dependent on later billing program |
| Revenue recognition | Dependent on later billing program |
| Full SaaS billing ledger | Dependent on later billing program |
| Self-service public checkout | Future commercial work |
| Public marketplace | Explicitly out of product scope (R47) |
| Multi-product product catalog | Explicitly out (Platform Core excluded) |
| Generalized external developer platform | Explicitly out of product scope |
| Advanced CRM | Future commercial work |
| Campaign / marketing automation | Future commercial work |
| Advanced commission rules | Future commercial work |
| Payroll | Explicitly out of product scope |
| AI sales forecasting | Future commercial work |
| Patient Portal changes | Explicitly deferred |
| Replacement of observability / backup / audit / notification / licensing engines | Explicitly out — reuse/extend only |
| Direct clinical chart access from Super Admin | Explicitly out of product scope |
| Unrestricted impersonation | Explicitly out of product scope |
| Standing PHI access | Explicitly out of product scope |
| Full customer-support CRM | Future platform work |
| Marketplace add-on sales portal | Future commercial work |
| Usage-based billing settlement | Dependent on later billing program |

---

## 6. Canonical Terminology

For each term: definition, exclusions, SoR ownership, legacy representation, future treatment, runtime relevance, and example key (conceptual only — MUST NOT be introduced in production code in this step).

### 6.1 Facility Type

| Aspect | Freeze |
|--------|--------|
| **Definition** | Type of healthcare organization (e.g. dental clinic, cosmetic clinic, general clinic, multi-specialty clinic, laboratory, radiology center, hospital). |
| **Is not** | Plan; Module; Specialty; commercial grant. |
| **SoR (future)** | Healthcare Catalog (Facility Type) |
| **Legacy** | `tenant.features.clinicProfile.clinicType` (`medical\|dental\|beauty\|multi`) — settings DTO / JSON only; **no** server-side licensing linkage. Evidence: Step 01 §5; `update-tenant-settings.dto.ts`. |
| **Treatment** | Promote to catalog entity (or controlled configuration — Decision Register). Legacy field is transitional. |
| **Runtime** | MAY participate in compatibility validation. MUST NOT be sole authorization source. MUST NOT automatically grant modules. |
| **Example key** | `facility_type.dental_clinic` (conceptual) |

### 6.2 Specialty

| Aspect | Freeze |
|--------|--------|
| **Definition** | Allowed clinical discipline or scope (e.g. dentistry, dermatology, pediatrics, cardiology). |
| **Is not** | Facility Type; Module; Department; practitioner role alone. |
| **SoR (future)** | Healthcare Catalog (Specialty) + tenant-selected specialties as tenant commercial/config selection |
| **Legacy** | Free-text `clinicProfile.specialties[]` + i18n labels. Evidence: Step 01 §6. |
| **Treatment** | New catalog domain; free-text is **not** authoritative commercial entitlement. |
| **Runtime** | Future checks MUST use stable specialty keys. Practitioner specialty and tenant-allowed specialty MAY be separate concepts. |
| **Example key** | `specialty.dentistry` (conceptual) |

### 6.3 Module

| Aspect | Freeze |
|--------|--------|
| **Definition** | Major ERP product capability (e.g. appointments, general EMR, dental EMR, inventory, accounting). |
| **Is not** | Permission; Specialty; environment Feature Flag. |
| **SoR (future)** | Healthcare Catalog (Module), aligned with module-registry |
| **Legacy** | `LicensedModuleId` + `@booking/module-registry` manifests + TS `LICENSED_MODULES`. Evidence: Step 01 §7. |
| **Treatment** | Reuse/adapt module-registry and licensed module ids. |
| **Runtime** | Access MUST eventually be granted only through Effective Entitlement resolution. |
| **Example key** | `module.dental` / future `module.dental_emr` (naming Decision Register) |

### 6.4 Feature

| Aspect | Freeze |
|--------|--------|
| **Definition** | Finer-grained capability within or across modules (e.g. advanced reports, API access, online booking, AI assistance). |
| **Is not** | User Permission; Feature Flag. |
| **SoR (future)** | Healthcare Catalog (Feature) |
| **Legacy** | `LicensedFeatureId` + `PlanFeatures` + FE `FEATURE_MATRIX`. Evidence: Step 01 §7. |
| **Treatment** | Adapter from static config → catalog; commercially granted via Plan Version / Add-on / Override. |
| **Runtime** | MUST be server-enforced where security or commercial behavior depends on it. |
| **Example key** | `feature.advanced_reports` (conceptual) |

### 6.5 Limit

| Aspect | Freeze |
|--------|--------|
| **Definition** | Typed quantitative entitlement (e.g. max users, doctors, branches, specialties, storage, SMS, API requests). |
| **Is not** | Display-only UI number unless server-enforced. |
| **SoR (future)** | Catalog Limit definitions + Effective Entitlement computed values |
| **Legacy** | `PlanLimits` / `EntitlementPlanVO` / AI & integration quotas (fragmented). Evidence: Step 01 §8. |
| **Enforcement modes** | **Hard** · **Soft** · **Advisory** · **Display-only** |
| **Treatment** | Extend and consolidate under effective entitlement; preserve current behavior until migration verified. |
| **Runtime** | Limit keys MUST NOT depend on UI labels. A displayed number is **not** enforced unless a server-side enforcement point exists. |
| **Example key** | `limit.max_users` (conceptual; code today uses `maxUsers`) |

### 6.6 Plan

| Aspect | Freeze |
|--------|--------|
| **Definition** | Commercial package identity and market-facing concept (parent of Plan Versions). |
| **Is not** | Contractual state; mutable live assignment object; runtime authorization key. |
| **SoR (future)** | Commercial Catalog (Plan identity) |
| **Legacy** | Prisma `EntitlementPlan`, platform `starter\|growth\|enterprise`, UI tiers. Evidence: Step 01 §4.1. |
| **Treatment** | New Plan identity domain + compatibility map from legacy names. Display names (e.g. “Dental Starter”) MAY exist for marketing but MUST NOT drive hard-coded runtime branches. |
| **Runtime** | Plan display names MUST NOT be used in authorization. |

### 6.7 Plan Version

| Aspect | Freeze |
|--------|--------|
| **Definition** | Immutable published snapshot of price/currency references, trial defaults, facility compatibility, specialty/module/feature grants, limits, and entitlement policies. |
| **Is not** | Plan identity; live editable commercial SSOT after publish. |
| **SoR (future)** | Commercial Catalog (Plan Version) — **new domain** |
| **Legacy** | None as first-class entity; matrices live in TS config. Evidence: Step 01. |
| **Lifecycle** | Draft → In Review → **Published** → Retired for New Sales |
| **Rules** | Published versions are **immutable**. Commercial changes create a **new** version. Existing subscriptions stay on assigned version until **explicit** migration. Retirement blocks new assignment only. Migration MUST be explicit, auditable, and previewable. |

### 6.8 Add-on

| Aspect | Freeze |
|--------|--------|
| **Definition** | Purchasable extension to a subscription granting module, feature, specialty allowance, quantity, or time-bound access. |
| **Is not** | Tenant Override. |
| **SoR (future)** | Commercial Catalog (Add-on) — **new domain** |
| **Legacy** | Partial grant history / entitlement grant APIs in JSON — not a reusable catalog. Evidence: Step 01. |
| **Rules** | Reusable across tenants; lifecycle and effective-date rules required; MUST NOT rescue invalid/suspended subscription unless policy explicitly allows. |

### 6.9 Subscription (SaaS Tenant Subscription)

| Aspect | Freeze |
|--------|--------|
| **Definition** | Links a Tenant to one specific **published** Plan Version for a time period and lifecycle status. Conceptual properties: tenant, plan version, status, trial/paid, start/end, grace, renewal metadata, active add-ons, migration history. |
| **Is not** | `ClinicSubscription` (patient packages); License; billing ledger; payment processor. |
| **SoR (future)** | SaaS Tenant Subscription domain (ownership Decision Register: extend `PlatformSubscription` vs normalize) |
| **Legacy** | `PlatformSubscription` + `PlatformTenant.plan` + `Tenant.features.subscriptionUiPlan`. Evidence: Step 01 §4. |
| **Lifecycle (conceptual)** | Draft · Trialing · Active · Suspended · Expired · Cancelled |
| **R47** | Subscription does **not** process payments. |

**MUST:** SaaS Tenant Subscription MUST NOT own or replace `ClinicSubscription`.

### 6.10 Tenant Override

| Aspect | Freeze |
|--------|--------|
| **Definition** | Governed exception for one tenant: allow/deny capability, change limit, alter compatibility, time-bound. |
| **Is not** | Add-on; unrestricted edit to `tenant.features`. |
| **SoR (future)** | Tenant Override domain — **new domain** |
| **Legacy** | `moduleFlags`, `subscriptionUiPlan`, ad hoc `Tenant.features` writes. Evidence: Step 01. |
| **Governance** | reason, requester, approver, contract/ticket ref, start/end, risk classification, audit, step-up, approval for high-impact changes. |
| **Rules** | High-impact overrides require SoD. Expired overrides MUST NOT remain effective. |

### 6.11 Effective Entitlement

| Aspect | Freeze |
|--------|--------|
| **Definition** | Final authoritative **server-side** decision for a tenant capability or limit. |
| **Is not** | UI matrix; Feature Flag; user Permission alone. |
| **SoR (future)** | Effective Entitlement Resolver (computed; optionally cached) — **new domain / extension of licensing** |
| **Legacy** | `LicensingEngineService` + scattered guards / identity merge. Evidence: Step 01 §10. |
| **Evaluation order (frozen)** | (1) tenant + lifecycle (2) subscription status (3) current license state (4) assigned published Plan Version (5) active Add-ons (6) approved active Tenant Overrides (documented precedence) (7) operational Feature Flags / kill switches (8) return decision/limit with explanation, source, validity, enforcement mode |
| **Future operations (conceptual)** | `canUse`, `canUseSpecialty`, `getLimit`, `explainEntitlement`, `validateProvisioningSelection` |
| **Rules** | MUST become the single authoritative runtime path. Existing paths remain until verified migration. Tenant JSON MUST NOT grant commercial access denied by effective license decision. Decisions MUST be reproducible and explainable. |

### 6.12 Feature Flag

| Aspect | Freeze |
|--------|--------|
| **Definition** | Operational control for rollout, experimentation, emergency disablement, kill switches, environment availability. |
| **Is not** | Entitlement; commercial Source of Record. |
| **SoR (future)** | Platform operations / settings |
| **Legacy** | `*_CENTER_ENABLED` env vars; mixed use of `Tenant.features`. Evidence: Step 01 §11; `.env.example`. |
| **Rules** | MUST NOT grant access the customer did not purchase. MAY deny/delay access even when Entitlement exists. `*_CENTER_ENABLED` are operational unless proven otherwise. |

### 6.13 License

| Aspect | Freeze |
|--------|--------|
| **Definition** | Current runtime-compatible representation used by the existing licensing engine (`TenantLicense` computed object). |
| **Is not** | Subscription; Plan Version. |
| **SoR (current)** | Computed by `LicensingEngineService`; lifecycle tables `TenantLicenseLifecycleState`, `LicenseAuditEvent`. Evidence: Step 01 §4. |
| **Treatment** | Enforcement representation / compatibility layer during migration; Phase 28 behavior preserved via bridge. |
| **Rules** | Existing licensing engine remains operational. Payloads and tests MUST remain compatible until migration complete. |

### 6.14 Permission

| Aspect | Freeze |
|--------|--------|
| **Definition** | Authorizes a platform or tenant **user** action. |
| **Is not** | Commercial entitlement. |
| **SoR** | Permission matrix / future platform permission catalog |
| **Legacy** | `apps/api/config/permission-matrix.json`; role `super_admin`. Evidence: Step 01 §14. |
| **Rule** | User permission MUST NOT bypass missing tenant entitlement. Tenant entitlement MUST NOT bypass missing user permission. When both relevant, access requires **both**. Sensitive platform actions require permission **and** fresh authentication assurance where applicable. |

---

## 7. Separation Rules

| Rule ID | MUST / MUST NOT |
|---------|-----------------|
| SR-01 | Facility Type MUST NOT be treated as a Plan. |
| SR-02 | Specialty MUST NOT be treated as a Module or Facility Type. |
| SR-03 | Module MUST NOT be treated as a Permission or Feature Flag. |
| SR-04 | Feature MUST NOT be treated as a Feature Flag or Permission. |
| SR-05 | Entitlement MUST NOT be treated as a Feature Flag. |
| SR-06 | Plan MUST NOT be treated as Plan Version. |
| SR-07 | Subscription MUST NOT be treated as License. |
| SR-08 | Add-on MUST NOT be treated as Tenant Override. |
| SR-09 | `ClinicSubscription` MUST NOT be the SaaS Tenant Subscription SoR. |
| SR-10 | Plan display names MUST NOT authorize runtime access. |
| SR-11 | UI hiding MUST NOT be a security boundary. |
| SR-12 | A fourth independent plan vocabulary MUST NOT be introduced. |
| SR-13 | Universal `super_admin` bypass MUST NOT remain the long-term SoD model. |

---

## 8. Source of Record Matrix

| Domain | Current Representation | Current SoR | Future R47 Owner | Treatment | Allowed Writers (target) | Primary Readers | Migration Requirement | Notes / Blockers |
|--------|------------------------|-------------|------------------|-----------|--------------------------|-----------------|------------------------|------------------|
| Tenant | `Tenant` | Prisma Tenant | Tenant / platform-admin | Reuse | Tenant + platform provisioning | All ERP modules | Link to catalog selection | Two-step create today |
| Facility Type | `clinicProfile.clinicType` JSON | Tenant.features | Healthcare Catalog | New / Bridge | Catalog managers | Compatibility, provisioning | Map legacy 4 values | Decision D-05 |
| Specialty Catalog | Free-text + i18n | None (partial) | Healthcare Catalog | New Domain | Catalog managers | Compatibility, entitlements | Introduce keys | Decision D-06 |
| Tenant-selected Specialties | `clinicProfile.specialties[]` | Tenant.features | Tenant commercial selection | Bridge | Provisioning / catalog assignment | Entitlement, UI | Map to stable keys | — |
| Module Catalog | `LicensedModuleId` + manifests | module-registry + TS | Healthcare Catalog + registry | Reuse / Extend | Catalog managers (via approved publish) | Guards, registry | Align keys | Decision D-07 |
| Feature Catalog | `LicensedFeatureId` / `PlanFeatures` | TS config | Healthcare Catalog | Adapter | Catalog managers | Guards, explain API | Seed from config | — |
| Limit Catalog | `PlanLimits` + VO + AI/integration | Fragmented configs | Healthcare Catalog | Extend | Catalog managers | Enforcement | Unify modes | Partial enforcement coverage (D-18) |
| Compatibility Rules | None | — | Healthcare Catalog | New Domain | Catalog managers | Provisioning validation | Greenfield | Decision D-08 |
| Plan | Enums + aliases | Mixed | Commercial Catalog | New Domain | Plans managers | UI, bridge | Compatibility map | Decision D-01 |
| Plan Version | None | — | Commercial Catalog | New Domain | Plans managers (publish SoD) | Subscriptions | Greenfield | — |
| Add-on | Grant APIs / JSON history | Partial | Commercial Catalog | New Domain | Commercial managers | Entitlement | Greenfield | — |
| Tenant Subscription (SaaS) | `PlatformSubscription` + plan fields | Prisma + features | SaaS Subscription | Extend / Normalize | Subscription managers | Licensing, Super Admin | Decision D-02, D-03 | Not ClinicSubscription |
| Tenant Override | moduleFlags / JSON | Tenant.features | Override domain | New Domain | Requester + approver | Entitlement | Replace ad hoc JSON | — |
| License | `TenantLicense` computed | LicensingEngineService | Licensing bridge | Bridge / Extend | Engine only | Guards, UI | Preserve Phase 28 | Decision D-04 |
| Effective Entitlement | Partial (engine) | LicensingEngineService | Entitlement Resolver | New / Extend | Resolver | All enforcement | Single path | — |
| Feature Flag | Env + mixed JSON | Env / Tenant.features | Platform ops | Keep / Clarify | Ops / Security | Centers, kill switches | Split commercial keys | — |
| Platform User | `User` + roles (tenant-coupled today) | Identity | Platform Identity | Extend / New boundary | Security Admin | Auth, RBAC | Decision D-platform-id | Step 03 |
| Platform Role | `super_admin` + matrix | permission-matrix | Platform RBAC | Extend | Security Admin | Guards | Replace universal bypass | Step 08 |
| Audit Event | Platform + License audit | Existing audit ports | Audit (reuse) | Reuse / Extend | System | Auditor | Cover commercial actions | — |
| Sales Lead | None | — | Sales MVP | New Domain | Sales roles | Sales UI | Greenfield | Decision D-19 |
| Sales Opportunity | None | — | Sales MVP | New Domain | Sales roles | Sales UI | Greenfield | — |
| Trial | Platform trial fields + grant trial API | PlatformTenant / handlers | Subscription + Sales | Extend | Sales / Plans | Entitlement | Unify lifecycle | — |
| Sales Ownership | None | — | Sales MVP | New Domain | Sales Manager | Reports | Greenfield | Decision D-19 |
| Commission Snapshot | None | — | Sales MVP | New Domain | Sales Manager (review) | Auditor | Greenfield | Decision D-20 |

---

## 9. Reuse / Extend / Adapter / Bridge / New Domain Matrix

### 9.1 MUST Reuse or Extend

| Capability | Evidence | Treatment |
|------------|----------|-----------|
| `platform-admin` lifecycle & privileged access | `apps/api/src/modules/platform-admin/` | Reuse / Extend |
| Tenant model | `schema.prisma` `Tenant` | Reuse |
| RLS / tenant isolation | Architecture discovery + existing infra | Reuse |
| Licensing engine (Phase 28) | `LicensingEngineService`, CI | Extend via bridge |
| Permission-matrix pattern | `permission-matrix.json` | Extend |
| Audit infrastructure | Platform + license audit | Reuse / Extend |
| Notification infrastructure | Centers / notifications | Reuse |
| Observability | Release 45 | Reuse |
| Backup adapters | Backup-restore center | Reuse |
| Module-registry conventions | `packages/module-registry` | Reuse / Adapt |
| Subscription / license tests | `subscription/tests/*`, Phase 28 CI | Must remain passing |

### 9.2 New Domain or Controlled Extension

| Area | Treatment |
|------|-----------|
| Healthcare catalog | New Domain |
| Plan identity + immutable Plan Versions | New Domain |
| Plan entitlements / limits as data | New Domain |
| Add-ons | New Domain |
| Tenant Overrides (governed) | New Domain |
| SaaS Tenant Subscription normalization | Extend or New — Decision D-02 |
| Effective Entitlement Resolver | New / Extend licensing |
| Platform identity boundary | Requires Step 03 |
| Dedicated Super Admin application | New app (scaffold later) |

### 9.3 MUST NOT Become Authoritative Model

| Anti-pattern | Reason |
|--------------|--------|
| Plan display names | Runtime authorization forbidden |
| Duplicated FE subscription matrices | Drift risk (`subscription-config.ts`) |
| Unrestricted `Tenant.features` JSON writes | Integrity risk |
| `ClinicSubscription` | Wrong bounded context |
| Env Feature Flags as commercial grants | Wrong control type |
| Universal `super_admin` bypass | SoD failure |
| Scattered string-based plan checks | Bridge / eliminate |

---

## 10. Legacy Compatibility and Migration Constraints

### 10.1 Bridge stance (frozen)

```
Existing Plan / Subscription / Tenant.features / License State
  → Compatibility Mapping Layer
  → Stable Capability Keys
  → Effective Entitlement Resolver
  → Existing Runtime Enforcement Migration
```

The bridge MUST:

- preserve Phase 28 behavior
- preserve existing API contracts until migrated
- preserve existing tests
- allow old tenants to continue operating
- support gradual migration
- provide explainable mapping
- prevent cross-tenant leakage
- avoid dual-write ambiguity where possible
- define one authoritative writer per migrated value
- support rollback during transition

### 10.2 `Tenant.features` (frozen)

- Classified as **legacy / transitional**.
- MAY continue to store **non-commercial** tenant configuration where appropriate.
- MUST NOT become the authoritative commercial entitlement SoR.
- Existing consumers MUST be inventoried before migration.
- Raw JSON MUST NOT override denied license booleans on the future authoritative path.
- Direct manual edits MUST NOT be copied into Super Admin design.
- Migration requires compatibility adapter + regression tests.

**Known integrity risk (recorded, not fixed):**  
`GetIdentityFeaturesHandler` spreads raw `tenant.features` over license-derived booleans. Evidence: Step 01 §11; `apps/api/src/modules/identity/application/handlers/get-identity-features.handler.ts`.

### 10.3 Plan-change inconsistency (recorded, not fixed)

| Path | Behavior | Evidence |
|------|----------|----------|
| Operator | `ChangePlatformTenantPlanHandler` updates `PlatformTenant.plan`; does **not** sync `PlatformSubscription` / `subscriptionUiPlan` | Step 01 §9, §10 |
| Tenant-initiated | `ChangeTenantSubscriptionPlanHandler` updates platform + subscription row + `subscriptionUiPlan` + cache | Same |

**Freeze:** Release 47 MUST eventually provide **one** governed subscription-change workflow that updates all authoritative state, invalidates caches, audits, previews entitlement impact, supports compensation/rollback, avoids display-name mutation, and preserves legacy compatibility during transition.

---

## 11. Plan Vocabulary Freeze

### 11.1 Verified current vocabularies

| Layer | Values | Evidence |
|-------|--------|----------|
| Prisma | `LITE \| PRO \| ENTERPRISE` | `schema.prisma` `enum EntitlementPlan` |
| Platform domain | `starter \| growth \| enterprise` | `entitlement-plan.ts` |
| Frontend / UI | `starter \| professional \| business \| enterprise` | `plan-name.mapper.ts`, clinic-dashboard `subscription-config.ts` |
| Backend subscription limits | `lite \| pro \| enterprise` | `plan-limits.config.ts` |

Note: `business` is a **UI tier** on backend `pro` with distinct limits (`getLimitsForUiPlan`). Evidence: Step 01 §4.1.

### 11.2 Frozen rules

1. Release 47 MUST NOT create a **fourth independent** plan vocabulary.
2. A canonical internal plan identity MUST be defined later via approved stable identifiers (Decision D-01).
3. Legacy names REQUIRE an explicit **centralized** compatibility map.
4. New runtime code MUST NOT compare display names.
5. Existing values MUST NOT be removed until consumers and migrations are verified.
6. Final production IDs are **not** chosen in this step unless repository evidence already supports them (it does not for a single canonical set).

Unresolved naming → Step 04 / Step 13 (Decision Register).

---

## 12. Subscription and License Boundary

| Concept | Ownership | Notes |
|---------|-----------|-------|
| SaaS Tenant Subscription | Future commercial control plane (extend `PlatformSubscription` pending D-02/D-03) | Links tenant ↔ published Plan Version |
| `PlatformSubscription` | Existing SaaS billing row | Reuse until normalized |
| `PlatformTenant.plan` | Platform control-plane plan enum | Bridge to Plan Version assignment |
| `ClinicSubscription` | Patient clinic packages | **Keep Unchanged** — out of SaaS SoR |
| License (`TenantLicense`) | Licensing engine output | Compatibility / enforcement layer |
| Payment processing | Out of R47 | Schema hooks may exist; no payment processor |

---

## 13. Feature Flags vs Entitlements

| Control | Grants purchased access? | May deny entitled access? | Example |
|---------|--------------------------|---------------------------|---------|
| Entitlement | Yes (contractual) | N/A | Plan Version module grant |
| Feature Flag | **No** | **Yes** | `PATIENT_PORTAL_CENTER_ENABLED` |
| Permission | No (user authz) | N/A | `api.platform_admin` |

`*_CENTER_ENABLED` values are **operational** controls unless repository evidence proves a different role (none found). Feature Flags MUST never become a second commercial SoR.

---

## 14. Effective Entitlement Boundary

- Target: **single** authoritative server-side decision path (evaluation order §6.11).
- Until bridge complete: existing Phase 28 enforcement remains in place.
- Cache keys MUST include tenant identity and relevant versioning context (strategy Decision D-14/D-15).
- Cross-tenant entitlement leakage is a **release-blocking** defect.

---

## 15. Runtime Authorization Rule

A tenant user may perform a capability only when **all** relevant checks pass:

1. Platform or tenant identity is valid  
2. User permission allows the action  
3. Tenant lifecycle permits the action  
4. Subscription state permits the action  
5. Effective entitlement grants the capability  
6. Applicable limit is not exceeded  
7. Operational Feature Flags allow availability  
8. No emergency kill switch denies the action  

Additional freezes:

- UI hiding is **not** a security boundary.
- Server-side checks are **mandatory**.
- Background jobs and integrations MUST eventually use the same entitlement path.
- Access requires **both** user authorization and tenant commercial entitlement when both are relevant.

---

## 16. Healthcare Compatibility Rules

Compatibility is **data-driven policy**, not plan-name branching.

Examples (illustrative):

- dental EMR requires dentistry specialty  
- laboratory module requires compatible facility type  
- radiology requires compatible facility or approved override  
- selected specialty count MUST NOT exceed `limit.max_specialties` (when defined)

Frozen distinctions:

| Statement | Status |
|-----------|--------|
| Compatibility ≠ entitlement grant | Frozen |
| Facility Type alone does not grant Modules | Frozen |
| Compatible ≠ commercially available | Frozen |
| Entitled ≠ operationally enabled (Feature Flags) | Frozen |
| No plan display-name conditions | Frozen |

---

## 17. Platform Roles

Intended role set (not implemented in this step). Existing `super_admin` is a **legacy universal role** to be decomposed under SoD.

| Role | Primary authority | Prohibited | Data scope | Step-up | SoD |
|------|-------------------|------------|------------|---------|-----|
| **Platform Owner** | Ultimate governance, break-glass with dual control | Standing PHI; unsupervised production data dumps | All platform metadata | Yes for break-glass | Dual control for destructive ops |
| **Platform Administrator** | Tenant lifecycle, provisioning, ops coordination | Publish plans; approve own overrides; PHI browse | All tenants (metadata) | Yes for suspend/archive | Cannot approve own override |
| **Security Administrator** | Platform users, MFA, sessions, roles, kill switches | Commercial plan publish; sales commissions | Platform identity | Yes for role escalation | Cannot grant self unrestricted roles |
| **Plans & Subscription Manager** | Catalog commercial objects, plan versions, subscriptions, migrations | Security role changes; unrestricted overrides without approval | Commercial + tenant commercial views | Yes for publish/migrate | Creator ≠ publisher |
| **Sales Manager** | Pipeline, assignments, commission snapshot review | Platform security; plan publish | Sales + assigned customers | For commission finalize | Reviews vs creates |
| **Sales Representative** | Leads, demos, governed trials, own pipeline | Tenant suspend; override approve; plan publish | Assigned leads/customers | For trial create if policy requires | No self-approve overrides |
| **Operations Engineer** | Jobs, queues, backups, integration health | Commercial entitlement grants; PHI | Ops telemetry | Yes for restore / dangerous retries | Dual control for restore |
| **Auditor** | Read-only audit/evidence export | Mutating commercial or security state | Audit evidence (minimized) | For export if required | Read-only |

---

## 18. Permission Categories

Canonical **categories** (not necessarily final repository constants). Step 08 maps to verified permission infrastructure.

### Catalog
`facility-type.view|manage` · `specialty.view|manage` · `module.view|manage` · `feature.view|manage` · `limit.view|manage` · `compatibility-rule.view|manage`

### Plans
`plan.view|create|edit` · `plan-version.create|review|publish|retire`

### Commercial Control
`addon.view|manage` · `subscription.view|assign|migrate` · `override.view|request|approve` · `entitlement.view|explain`

### Tenant Operations
`tenant.view|create|activate|suspend|resume|archive-request|delete-request`

### Security and Administration
`platform-user.view|manage` · `role.view|manage` · `session.revoke` · `audit.view|export` · `feature-flag.view|manage` · `operations.view|execute`

### Sales
`sales-representative.manage` · `sales-lead.view|manage|assign` · `sales-trial.create` · `sales-customer.view` · `sales-report.view` · `commission-snapshot.review`

**Frozen SoD rules:**

- No universal permission MAY bypass audit, approval, tenant isolation, or step-up.
- Override **request** and **approve** MUST be separable.
- Plan **create/edit** and Plan Version **publish** MUST be separable.

---

## 19. Security and Privacy Boundaries

### 19.1 Identity Boundary

- Platform identity is **separate** from tenant identity.
- Tenant credentials MUST NOT authenticate platform APIs.
- Platform sessions carry **no** implicit tenant entitlement.
- Platform users receive **no** default PHI access.
- Cross-tenant access is limited to approved platform metadata and operations.
- Privileged tenant access MUST use the existing governed privileged-access model where available (`PrivilegedAccessGrant`).
- Unrestricted impersonation is **prohibited**.

### 19.2 PHI Boundary

- Super Admin MUST NOT browse clinical charts.
- No PHI in global search, dashboard metrics, or (unless explicitly approved and minimized) audit payloads.
- No PHI in logs, analytics, notifications, test fixtures, or demo data.
- Tenant contacts in Super Admin limited to administrative/contractual contacts.
- Clinical data access requires separate approved support / privileged-access workflow.

---

## 20. Step-Up and Approval Matrix

| Action | Permission | Step-up | Reason | Approval | Dual control | Audit |
|--------|------------|---------|--------|----------|--------------|-------|
| Publish plan version | plan-version.publish | Yes | Yes | Reviewer ≠ creator | Recommended | Required |
| Retire plan version | plan-version.retire | Yes | Yes | Yes | Optional | Required |
| Migrate subscription | subscription.migrate | Yes | Yes | Yes | Recommended | Required |
| Grant high-impact add-on | addon.manage | Yes | Yes | Yes if policy | Optional | Required |
| Create tenant override | override.request | Yes if high-impact | Yes | No (request only) | — | Required |
| Approve tenant override | override.approve | Yes | Yes | Approver ≠ requester | Required for high-impact | Required |
| Increase sensitive limits | override / catalog | Yes | Yes | Yes | Recommended | Required |
| Suspend tenant | tenant.suspend | Yes | Yes | Optional | Optional | Required |
| Archive request | tenant.archive-request | Yes | Yes | Yes | Recommended | Required |
| Deletion request | tenant.delete-request | Yes | Yes | Yes | Required | Required |
| Restore backup | operations.execute | Yes | Yes | Yes | Required | Required |
| Retry dangerous jobs | operations.execute | Yes | Yes | Optional | Optional | Required |
| Emergency kill switch | feature-flag.manage | Yes | Yes | Optional | Recommended | Required |
| Privileged tenant access | existing privileged-access | Yes | Yes | Existing approve flow | Existing | Required |
| Platform user role escalation | role.manage | Yes | Yes | Yes | Recommended | Required |
| Security reset | platform-user.manage | Yes | Yes | Yes | Recommended | Required |

Normal permission-only actions (no step-up by default): catalog view, entitlement explain, audit view (non-export), sales lead CRUD within policy.

---

## 21. Required MVP User Journeys

1. Platform administrator securely logs into dedicated Super Admin.  
2. Security administrator manages platform users, MFA, sessions, and roles.  
3. Plans manager creates a catalog entry.  
4. Plans manager creates a Plan and Draft Plan Version.  
5. Authorized reviewer publishes the Plan Version.  
6. Platform administrator creates a tenant.  
7. Facility Type and Specialties are selected.  
8. Compatibility is validated.  
9. A published Plan Version is assigned.  
10. Add-ons are selected.  
11. A Subscription is created.  
12. Effective Entitlements are calculated.  
13. Tenant provisioning is completed.  
14. Tenant administrator is invited.  
15. Tenant is activated.  
16. Platform staff views explained effective entitlements.  
17. Authorized manager creates a time-bound override.  
18. Separate approver approves a high-impact override.  
19. Subscription is migrated to a new Plan Version.  
20. Tenant is suspended and runtime access is denied.  
21. Tenant is reactivated.  
22. Sales representative creates a Lead.  
23. Sales representative creates a governed Trial.  
24. Trial is converted to a paid Subscription.  
25. Auditor views immutable evidence.  
26. Operations engineer reviews jobs, queues, backups, and integration status.  

*(Not implemented in this step.)*

---

## 22. Out-of-Scope User Journeys

- Customer self-service plan checkout  
- Credit-card payment  
- Invoice generation / tax / revenue recognition  
- Customer-facing marketplace  
- Automated payroll / complex commission settlement  
- Marketing campaign automation  
- Patient clinical record browsing by platform staff  
- Generalized multi-product catalog  
- External developer portal / API monetization  
- Usage-based billing settlement  

---

## 23. Dependencies and Step Gating

Frozen implementation sequence:

| # | Step |
|---|------|
| 1 | Scope and terminology freeze **(this document)** |
| 2 | Security boundary review |
| 3 | Execution plan freeze |
| 4 | Super Admin scaffold |
| 5 | Platform authentication |
| 6 | MFA and session security |
| 7 | RBAC and platform users |
| 8 | Design-system shell |
| 9 | Dashboard and tenant read views |
| 10 | Healthcare catalog |
| 11 | Plans and Plan Versions |
| 12 | Plan Entitlements and Limits |
| 13 | Add-ons and Tenant Overrides |
| 14 | Subscription Management |
| 15 | Tenant Provisioning |
| 16 | Effective Entitlement Runtime |
| 17 | Tenant Lifecycle |
| 18 | Feature Flags and Settings |
| 19 | Audit and Operations |
| 20 | Sales and Trials |
| 21 | Notifications |
| 22 | Security Hardening |
| 23 | Release Readiness |

**Gating rules:**

- Catalog MUST precede Plan Versions.  
- Plan Versions MUST precede Subscriptions.  
- Subscriptions MUST reference a published Plan Version.  
- Provisioning MUST use effective entitlements, not display names.  
- Feature Flags MUST NOT be treated as purchased access.  
- Runtime migration MUST NOT break existing licensing enforcement.  
- No later domain MAY be pulled into an earlier implementation step.  

---

## 24. Decision Register

| ID | Decision | Status | Evidence | Owner | Required By | Blocking? | Notes |
|----|----------|--------|----------|-------|-------------|-----------|-------|
| D-01 | Canonical internal Plan identifiers | Deferred | Three vocabularies (Step 01 §4.1) | Architecture | Step 04 / 13 | Blocking for publish | No fourth vocabulary |
| D-02 | Ownership of SaaS Tenant Subscription SoR | Deferred | `PlatformSubscription` exists | Architecture | Step 04 / 14 | Blocking | Extend vs normalize |
| D-03 | Role of `PlatformSubscription` | Deferred | schema + handlers | Architecture | Step 04 | Blocking | Related to D-02 |
| D-04 | Role of computed `TenantLicense` | Deferred | LicensingEngineService | Architecture | Step 16 | Non-blocking early | Bridge layer |
| D-05 | Facility types: catalog table vs controlled config | Deferred | JSON clinicType only | Product + Arch | Step 10 | Blocking for catalog | |
| D-06 | Specialties: new catalog vs reuse dept/practitioner | Deferred | Free-text + Department | Product + Arch | Step 10 | Blocking for catalog | |
| D-07 | Module-registry integration approach | Deferred | `@booking/module-registry` | Engineering | Step 10 / 16 | Blocking | Adapter vs SSOT |
| D-08 | Compatibility-rule storage approach | Deferred | Missing | Architecture | Step 10 | Blocking | |
| D-09 | Stable capability key naming rules | Deferred | camelCase vs conceptual dots | Architecture | Step 04 / 10 | Blocking | |
| D-10 | `tenant.features` transition plan | Deferred | Multiple consumers | Engineering | Step 16 | Blocking | Integrity risk |
| D-11 | Central plan alias map SSOT | Deferred | Multiple mappers | Engineering | Step 13 / 16 | Blocking | |
| D-12 | Unify operator vs tenant plan-change | Deferred | Handler inconsistency | Engineering | Step 14 | Blocking | |
| D-13 | Entitlement cache strategy | Deferred | 60s in-memory today | Engineering | Step 16 | Non-blocking early | |
| D-14 | Cache invalidation ownership | Deferred | Listener + handlers | Engineering | Step 16 | Non-blocking early | |
| D-15 | Subscription migration strategy | Deferred | Missing | Architecture | Step 14 | Blocking | |
| D-16 | RLS for platform cross-tenant reads | Requires Step 03 | Not verified | Security | Step 03 | Blocking | |
| D-17 | Production deployment topology | Requires later | Not verified | Ops | Step 04 / readiness | Non-blocking early | |
| D-18 | Monthly limit enforcement coverage | Requires later discovery | Partial verification Step 01 | Engineering | Step 12 / 16 | Non-blocking | |
| D-19 | Sales ownership SoR | Deferred | Missing | Product | Step 20 | Blocking for sales | |
| D-20 | Commission snapshot ownership | Deferred | Missing | Product | Step 20 | Non-blocking early | |
| D-21 | Platform identity boundary reuse vs new | Requires Step 03 | Auth is tenant JWT today | Security | Step 03 / 5 | Blocking | |
| D-22 | Dedicated app vs long-term clinic-dashboard embed | Deferred | App missing; UI embed exists | Product | Step 04 | Blocking for scaffold | Dedicated app is in included MVP |

Status legend: **Resolved** · **Deferred** · **Blocked** · **Requires Step 03** · **Requires Step 04** · **Requires later implementation discovery**

---

## 25. Risks

| Risk | Evidence | Severity |
|------|----------|----------|
| Plan vocabulary drift | Three namespaces + FE duplicate matrix | High |
| Identity features JSON override | `GetIdentityFeaturesHandler` | High |
| Incomplete operator plan change | Handler pair inconsistency | Medium |
| Universal `super_admin` | permission-matrix | Medium |
| Terminology collision (`dental`, `subscription`) | Step 01 Terminology Matrix | Medium |
| Confusing `ClinicSubscription` with SaaS | schema dual models | Medium |
| Deploy-required plan matrix changes | Static TS config | High for v4 goals |
| Cache staleness after bypass writes | 60s TTL | Low–Medium |

---

## 26. Blockers

| Blocker | Blocks | Resolution path |
|---------|--------|-----------------|
| Unapproved scope/terminology (this doc) | All implementation | Approve Step 02 |
| Platform identity / RLS unknowns | Auth, scaffold | Step 03 Security Boundary Review |
| Canonical plan IDs + SoR ownership | Plans / subscriptions | Step 04 Execution Plan |
| Catalog storage decisions (D-05–D-08) | Healthcare catalog | Step 04 + Step 10 |
| Licensing integrity risks unaddressed in design | Runtime migration | Step 04 + Step 16 |

No production implementation MAY begin until this freeze is approved and Step 03 completes for security blockers.

---

## 27. Deferred Backlog

See §5. Additional deferred technical debt:

- Eliminate FE `PLAN_CATALOG` / `FEATURE_MATRIX` duplication after API explainability exists  
- Decompose `super_admin` into granular platform roles  
- Inventory every `Tenant.features` consumer before JSON retirement  
- Full appointment/report monthly-limit write-path audit  

---

## 28. Acceptance Criteria Evidence

| Criterion | Result |
|-----------|--------|
| No production code changed | **Passed** |
| No app/package scaffolded | **Passed** |
| No migration/schema/dependency change | **Passed** |
| `docs/SUPER_ADMIN_MVP_SCOPE.md` exists and complete | **Passed** |
| Declares R47 scope/terminology authority | **Passed** |
| Platform Core playbook excluded | **Passed** |
| Included vs deferred separated | **Passed** |
| Facility Type ≠ Plan | **Passed** |
| Specialty ≠ Module | **Passed** |
| Module ≠ Feature/Permission | **Passed** |
| Entitlement ≠ Feature Flag | **Passed** |
| Plan ≠ Plan Version | **Passed** |
| Subscription ≠ License | **Passed** |
| Add-on ≠ Tenant Override | **Passed** |
| `ClinicSubscription` excluded from SaaS SoR | **Passed** |
| Published Plan Versions immutable | **Passed** |
| Display names barred from authz | **Passed** |
| Legacy plan vocabularies documented | **Passed** |
| No fourth plan vocabulary | **Passed** |
| `Tenant.features` transitional, not commercial SoR | **Passed** |
| Licensing engine preserved behind bridge | **Passed** |
| `GetIdentityFeaturesHandler` risk recorded | **Passed** |
| Operator plan-change inconsistency recorded | **Passed** |
| SoR + reuse matrices included | **Passed** |
| Platform roles + permission categories frozen | **Passed** |
| Step-up/approval + PHI boundaries defined | **Passed** |
| MVP and out-of-scope journeys defined | **Passed** |
| Dependencies/order frozen | **Passed** |
| Decision register present | **Passed** |
| Current-state claims cite discovery/repo | **Passed** |
| Recommends Step 03; does not implement it | **Passed** |

---

## 29. Next Step

**Step 03 — Security Boundary Review**

Focus: platform vs tenant identity, RLS for platform reads, privileged-access reuse, PHI boundaries, step-up/SoD feasibility against existing auth, and security blockers in the Decision Register (D-16, D-21).

Do **not** implement Step 03 in this freeze.

---

## Document Control

| Item | Value |
|------|--------|
| Created | 2026-07-21 |
| Prior file | None (new) |
| Inputs | Architecture Discovery Report; v4 Step 01 Catalog/Entitlement Discovery; playbook v4 direction |
| Rollback | Revert/remove this file only; do not revert discovery reports |

*End of Release 47 Scope and Terminology Freeze.*
