# Release 47 — Flexible Super Admin MVP
## Phase 47 Execution Plan Freeze

| Field | Value |
|-------|--------|
| **Document type** | Execution Plan Freeze (Step 04) |
| **Release** | **47** — Flexible Super Admin MVP |
| **Status** | **FROZEN pending approval** — no production implementation authorized |
| **Date** | 2026-07-21 |
| **Authority** | Authoritative implementation order, migration strategy, test gates, and release gates for Release 47 |
| **Inputs** | Playbook v4; Architecture Discovery; Catalog/Entitlement Discovery; `SUPER_ADMIN_MVP_SCOPE.md`; `SUPER_ADMIN_SECURITY_BOUNDARY_REVIEW.md` |
| **Evidence priority** | Verified repository runtime behavior overrides conflicting documentation |

**RFC 2119:** MUST / MUST NOT / SHOULD / SHOULD NOT / MAY apply to frozen planning decisions.

**Step numbering note:** This document freezes **Steps 05–29** as the implementation sequence. Step 02’s earlier “23-step” conceptual list is superseded for ownership of work packages; terminology and product scope from Step 02 remain authoritative. Decision Register ownership is remapped in §29.

### Current execution state (roadmap-aligned)

| Identity | Status |
|----------|--------|
| Flexible Steps **01–23** | **Accepted / Complete** |
| Flexible Step **20** — Feature Flags and Global Settings | **Accepted / Complete** — Model B hook containment + P01–P12; Case B one-pass green; see `FEATURE_FLAGS_AND_GLOBAL_SETTINGS.md` |
| Flexible Step **21** — Audit Center | **Accepted / Complete** — Case C one-pass 2026-08-09 exit 0; A08 D11 audit delta = 1; evidence = 0; see `AUDIT_CENTER.md` |
| Flexible Step **22** — Operations Console | **Accepted and complete** (2026-08-10). Durable idempotency D-A/D-B, INT health, F24-B N/A, provisioning retry UI, UI-CACHE-B; Case C one-pass green on frozen `booking_test` |
| Supplemental Capability U01 — Usage Metering and Limit Enforcement | **Implemented out of roadmap order**; additive; feature-flagged (defaults OFF); final validation passed; not a numbered Flexible step |
| Flexible Step **23** — Sales Representative Management | **Accepted and complete** (2026-08-11). Authoritative Case C attempt **6** on frozen `booking_test` (`exitCode=0`, all counters 0; Step 23 suite 128/128). Contract: `docs/SALES_REPRESENTATIVE_MANAGEMENT.md` |
| Flexible Step **24** — Leads and Sales Pipeline | **Accepted / Complete** — Case C Attempt 2 authoritative (`booking_test`, freeze `2026-08-11T10:29:23.970Z`). Contract: `docs/LEADS_AND_SALES_PIPELINE.md` |
| Flexible Step **25** — Trial Creation and Customer Conversion | **Accepted / Complete** — narrow matrix closure passed; Case C Attempt 3 authoritative (`booking_test`, freeze `2026-08-11T19:27:21.900Z`; Attempt 2 invalidated for I09 product fix). Contract: `docs/TRIAL_CREATION_AND_CUSTOMER_CONVERSION.md` |
| Flexible Step **26** — Sales Productivity and Commission Snapshot | **Accepted / Complete** — Case C Attempt 1 remains authoritative; narrow F02–F09 / F19 / F20 / H21 closure passed (contained Model B hooks; no Case C rerun). Contract: `docs/SALES_PRODUCTIVITY_AND_COMMISSION_SNAPSHOT.md` |
| Flexible Step **27** — Notifications and Templates | **Accepted / Complete** — Case C Attempt 3 authoritative (`booking_test`, freeze `2026-08-12T17:30:45.723Z`, SHA `bd7f35a`); Attempt 2 invalidated (C07 + Strategy B product fixes). Contract: `docs/NOTIFICATIONS_AND_TEMPLATES.md` |
| Flexible Step **28** — Security Hardening and Compliance Review | **In Progress / Acceptance Pending External Review** — Case C Attempt 3 authoritative (`booking_test`, SHA `6dafb44`); final narrow semantic linkage closure complete; awaiting independent re-review of regenerated 704-record attachments. Contract: `docs/SECURITY_HARDENING_AND_COMPLIANCE_REVIEW.md` |
| Flexible Step **29** | **Not Authorized** |

**Authority hierarchy:** (1) Flexible Playbook v4 numbered roadmap → (2) this execution plan → (3) step-specific architecture docs → (4) historical internal prompt numbering (non-authoritative on conflict).

U01 MUST NOT be treated as Flexible Step 18. U01 MUST be revalidated after Step 17 Provisioning is implemented (see `docs/USAGE_METERING_AND_LIMIT_ENFORCEMENT.md`).

---

## 1. Document Status and Authority

1. This document freezes Release 47 **implementation order**, **milestones**, **domain ownership**, **SoR transitions**, **migration/bridge stages**, **security product gates**, **test/CI gates**, **commit boundaries**, and **Definition of Done**.
2. It MUST NOT be treated as implementation authorization for Steps 05+. Each later step requires its own Cursor prompt and acceptance.
3. Steps 01–03 documents remain unchanged and authoritative for discovery, scope/terminology, and security boundaries.
4. Speculative paths are marked: *Implementation location to be confirmed during the relevant step.*

---

## 2. Executive Summary

Release 47 delivers a **dedicated Super Admin control plane** with platform identity, healthcare catalog, immutable Plan Versions, subscriptions, governed overrides, effective entitlements (bridged to Phase 28 licensing), lifecycle/ops/audit, and lightweight sales — **without** rebuilding Centers 41–46, Platform Core, Patient Portal, or billing processors.

**Execution spine:**

```text
Security foundation (05–09)
  → Safe read views (10–11)
  → Catalog → Plan Versions → Entitlements/Limits → Add-ons/Overrides → Subscriptions (12–16)
  → Provisioning + Effective Entitlement Runtime (17–18)
  → Lifecycle / flags / audit / ops (19–22)
  → Sales MVP (23–27)
  → Hardening + release (28–29)
```

**Non-negotiable:** Existing licensing remains authoritative until resolver cutover is verified; additive migrations only; no display-name authz; no fourth plan vocabulary; no universal `super_admin` bypass on **new** platform paths; PHI excluded from ordinary Super Admin workflows.

---

## 3. Authoritative Inputs

| Document | Role |
|----------|------|
| Playbook v4 | Product/architecture direction |
| `docs/Architecture_Discovery_Report.md` | Monorepo / apps / Centers baseline |
| `docs/SUPER_ADMIN_V4_STEP01_CATALOG_ENTITLEMENT_DISCOVERY.md` | Commercial/catalog/enforcement evidence |
| `docs/SUPER_ADMIN_MVP_SCOPE.md` | Scope, terminology, SoR, roles |
| `docs/SUPER_ADMIN_SECURITY_BOUNDARY_REVIEW.md` | Identity, RLS hybrid, threats, ST-01–40, D-16/D-21 |
| Repo | `apps/api`, `apps/clinic-dashboard`, `apps/patient-portal`, `packages/*`, Prisma, CI |

---

## 4. Release 47 Objectives

- Dedicated Super Admin application with platform authentication, MFA, granular RBAC
- Healthcare catalog + immutable Plan Versions + entitlements/limits + add-ons + overrides
- SaaS Tenant Subscription bound to published Plan Version
- Effective entitlement resolution with Phase 28 licensing bridge
- Governed tenant provisioning and lifecycle
- Ops/audit reuse; lightweight sales/trials
- Security gates S-01–S-08 and product gates G-01–G-09 closed before production

---

## 5. Non-Negotiable Constraints

1. Security foundation precedes protected commercial administration.  
2. Catalog → Plan Versions → Entitlements/Limits → Add-ons/Overrides → Subscriptions → Provisioning.  
3. Commercial SoR modeling precedes enforcement cutover.  
4. Existing licensing enforcement remains operational until resolver verified.  
5. Published Plan Versions are immutable.  
6. Feature Flags MUST NOT grant commercial access.  
7. Tenant configuration MUST NOT grant license-denied capability.  
8. Tenant APIs MUST NOT self-grant Plans, Versions, Add-ons, Overrides, Specialties, Modules, Features, or commercial Limits.  
9. No display-name-based authorization.  
10. No fourth independent Plan vocabulary.  
11. No universal `super_admin` bypass on **new** platform paths.  
12. Cross-tenant ops require explicit platform authorization and audit.  
13. PHI excluded from ordinary Super Admin workflows.  
14. Risky migrations MUST have rollback/compensation.  
15. Every step MUST preserve previously passing release behavior.  
16. No later domain MAY be pulled into an earlier step.  
17. Schema migrations MUST be additive until verified cutover.  
18. `ClinicSubscription` remains out of SaaS SoR.  

---

## 6. Current Baseline

| Area | Verified state | Evidence |
|------|----------------|----------|
| Apps | `api`, `clinic-dashboard`, `patient-portal`; no `super-admin` | Architecture Discovery |
| Workspaces | npm workspaces `apps/*`, `packages/*`; Node ≥20 | Root `package.json` |
| Platform-admin | `/platform/tenants*`; role-gated clinic JWT | `platform-admin` module |
| Licensing | `LicensingEngineService`; Phase 28 CI | Step 01; `.github/workflows/phase28-licensing-ci.yml` |
| Plans | Three vocabularies + FE matrix | Step 01 |
| Facility/specialty | JSON in `Tenant.features` | Step 01 |
| Auth | Bearer JWT; `aud` clinic/patient-portal; no platform aud | Step 03 |
| RLS | Session-var tenant RLS; hybrid platform metadata | Step 03; `prisma.service.ts` |
| Tests | Jest API; Vitest FE; Playwright dashboard e2e | Package scripts |
| CI | `clinic-dashboard-ci.yml`, `phase28-licensing-ci.yml` | `.github/workflows/` |

---

## 7. Target Architecture Summary

```text
[apps/super-admin] --platform JWT (aud=platform)--> [API platform routes]
                                                         |
                                                         v
                                              platform-admin (extend)
                                              commercial catalog domains (new)
                                              subscription normalization (extend)
                                              entitlement resolver + licensing bridge
                                                         |
                                                         v
                                              Tenant ERP (unchanged Centers)
                                              Phase 28 guards until cutover
```

- **Reuse:** Tenant, platform-admin lifecycle, licensing engine, module-registry, audit, notifications, observability, backup, RLS for tenant data  
- **Extend:** Auth (platform principal), RBAC, PlatformSubscription, privileged access enforcement  
- **New:** Super Admin app, catalog, Plan/Plan Version, Add-on, Override, sales MVP entities, explainable resolver  
- **Bridge:** Plan aliases, `Tenant.features`, static `LICENSED_*`, FE matrices  

---

## 8. Milestone Model

| Milestone | Steps | Exit criteria (summary) |
|-----------|-------|-------------------------|
| **A** Architecture & Security Baseline | 01–04 | Scope, terminology, SoR, security, this plan approved; no prod code |
| **B** Secure Super Admin Foundation | 05–09 | App runs; platform auth; reject tenant/patient tokens; MFA/sessions; granular RBAC; no universal bypass on new paths; shell usable |
| **C** Safe Read Control Plane | 10–11 | Dashboard + tenant directory; no PHI; authz + pagination; reuse SoR; no premature commercial writes |
| **D** Commercial Catalog & Contract | 12–16 | Catalog; immutable versions; entitlements/limits; add-ons/overrides; subscription→published version; legacy bridge live; no display-name authz |
| **E** Provisioning & Runtime | 17–18 | Compatible/idempotent provisioning; resolver + bridge; explainable; tenant-isolated cache; no JSON self-grant; Phase 28 tests pass |
| **F** Lifecycle, Ops, Evidence | 19–22 | Lifecycle; flags≠entitlements; audit UX; ops console reuse; step-up on dangerous ops |
| **G** Sales MVP | 23–27 | Lightweight sales; valid trials; least privilege; commission snapshots≠payroll; notifications reused |
| **H** Security & Release | 28–29 | No unresolved Critical/High; blocking tests pass; runbooks; least-privilege prod access; deferred scope documented |

---

## 9. Full Step Sequence

| Step | Name |
|------|------|
| 05 | Super Admin Application Scaffold |
| 06 | Platform Authentication |
| 07 | MFA and Session Security |
| 08 | RBAC and Platform Users |
| 09 | Super Admin Design System Shell |
| 10 | Dashboard MVP |
| 11 | Tenant Directory and Detail |
| 12 | Healthcare Catalog and Capability Model |
| 13 | Plans and Plan Versions Management |
| 14 | Plan Entitlements and Limits |
| 15 | Add-ons and Tenant Overrides |
| 16 | Subscription Management |
| 17 | Tenant Creation and Provisioning |
| 18 | Effective Entitlement Runtime and Licensing View |
| 19 | Tenant Lifecycle Actions |
| 20 | Feature Flags and Global Settings |
| 21 | Audit Center |
| 22 | Operations Console |
| 23 | Sales Representative Management |
| 24 | Leads and Sales Pipeline |
| 25 | Trial Creation and Customer Conversion |
| 26 | Sales Productivity and Commission Snapshot |
| 27 | Notifications and Templates |
| 28 | Security Hardening and Compliance Review |
| 29 | Release Readiness and Operational Handover |

### Step ownership corrections (v4)

| Concern | Primary | Supporting |
|---------|---------|------------|
| Platform token boundary | 06 | 05, 07, 08 |
| MFA assurance / sessions | 07 | 06, 08 |
| Universal `super_admin` migration | 08 | 06, 07, 28 |
| Healthcare capability catalog | 12 | 04, 14 |
| Immutable Plan Versions | 13 | 12, 14 |
| Plan entitlements & limits | 14 | 12, 13, 18 |
| Add-ons & Overrides | 15 | 07, 08, 14, 18 |
| Plan-change normalization | 16 | 13–15, 18 |
| Provisioning from effective config | 17 | 12–16, 18 |
| `tenant.features` override migration | 18 | 12–16 |
| Entitlement cache | 18 | 15–17, 20 |
| Privileged lifecycle enforcement | 19 | 07, 08, 21, 28 |
| Feature Flag vs Entitlement | 20 | 18 |
| Security regression | 28 | All prior |
| Full E2E / ops release | 29 | All prior |

**Exception:** Step 02 assigned some catalog decisions to “Step 10”; under this plan **catalog storage decisions D-05–D-09 are owned by Step 12** (Step 10 is Dashboard only).

---

## 10. Dependency Graph

```text
05 → 06 → 07 → 08 → 09
                      ↓
              10 ⇄ 11  (parallel after 09; both before 12 commercial writes)
                      ↓
                     12 → 13 → 14 → 15 → 16 → 17 → 18
                                                      ↓
                                    19 → 20 → 21 → 22
                                                      ↓
                                    23 → 24 → 25 → 26 → 27
                                                      ↓
                                                     28 → 29
```

**Safe parallel after 09:** Steps 10 and 11 (read-only).  
**Unsafe to parallelize:** 12∥13, 13∥14, 15∥16, 16∥18, 06∥ protected commercial APIs, 18 enforcement∥ unverified bridge.

---

## 11. Dependency Matrix

| Step | Depends On | Produces | Required By | Parallel OK | Constraints | Release Gate |
|------|------------|----------|-------------|-------------|-------------|--------------|
| 05 | 01–04 approved | App scaffold | 06–09 | No | — | G-02 |
| 06 | 05 | Platform auth boundary | 07–08, APIs | No | Before protected APIs | S-01 |
| 07 | 06 | MFA, sessions, step-up plumbing | 08, 15, 19 | No | — | S-03 |
| 08 | 07 | Platform RBAC, no new bypass | 09–29 | No | — | S-02 |
| 09 | 08 | Shell/nav | 10+ UI | No | — | G-02 |
| 10 | 09 | Dashboard | — | With 11 | Read-only | G-03 |
| 11 | 09 | Tenant directory/detail | 17, 19 | With 10 | Read-only | G-03 |
| 12 | 08–11 | Catalog + keys | 13–17 | No | Before plans | G-04 |
| 13 | 12 | Plans + versions | 14–16 | No | Immutable publish | S-07 |
| 14 | 13 | Entitlements/limits | 15–18 | No | — | G-04 |
| 15 | 14, 07–08 | Add-ons, overrides | 16–18 | No | SoD | G-04 |
| 16 | 15 | Subscription SoR | 17–18 | No | Unify plan-change | S-07 |
| 17 | 16 | Provisioning | 18–19 | No | Uses resolver/preview | G-05 |
| 18 | 17 | Resolver + bridge | 19–20, 28 | No | Shadow then cutover | G-05, S-04 |
| 19 | 18, 07–08 | Lifecycle enforcement | 21, 28 | Partial vs 20 | Priv access | S-06 |
| 20 | 18 | Flags≠entitlements | 28 | After 18 | — | — |
| 21 | 08, 19 | Audit UX | 28–29 | After 19 start | — | G-06 |
| 22 | 08, 19 | Ops console | 28–29 | With 21 if safe | — | G-06 |
| 23–27 | 16–18, 08 | Sales MVP | 28 | Sequential within G | No CRM creep | G-07 |
| 28 | All prior | Hardening | 29 | No | Close Critical/High | G-08, S-* |
| 29 | 28 | Release handover | Prod | No | — | G-09 |

---

## 12. Domain Ownership Matrix

| Domain | Current SoR | Future Owner | Treatment | Writers | Readers | RLS model | AuthZ | Audit | Step | Migration | Rollback |
|--------|-------------|--------------|-----------|---------|---------|-----------|-------|-------|------|-----------|----------|
| Platform Identity | Staff User+role | Platform Identity | Extend | Security Admin | Auth | Platform metadata | Platform principal | Yes | 06–08 | New principal/aud | Feature-flag auth |
| Platform Sessions | RefreshToken/session | Platform Sessions | Extend | Auth | Auth | Platform | Platform | Yes | 07 | Separate sessions | Revoke/fallback |
| Platform RBAC | permission-matrix + super_admin | Platform RBAC | Extend | Security Admin | Guards | Platform | Granular | Yes | 08 | Decompose roles | Keep legacy routes gated |
| Tenant | Prisma Tenant | Tenant | Reuse | Provisioning | All | Tenant RLS | Dual | Lifecycle | 17, 19 | Link catalog | Compensating archive |
| Facility Type | JSON clinicType | Catalog | New/Bridge | Catalog mgr | Compat/prov | Platform catalog | Catalog perms | Yes | 12 | Map 4 values | Dual-read JSON |
| Specialty Catalog | Free-text | Catalog | New | Catalog mgr | Compat | Platform catalog | Catalog perms | Yes | 12 | Map/review | Dual-read |
| Tenant specialties | JSON array | Tenant selection | Bridge | Provisioning | Entitlement | Tenant or hybrid | Entitlement | Yes | 12, 17 | Keys | Fallback free-text |
| Module Catalog | LicensedModuleId + registry | Catalog+registry | Reuse/Extend | Catalog | Guards | Platform | Catalog | Yes | 12 | Align keys | Static config |
| Feature Catalog | LicensedFeatureId | Catalog | Adapter | Catalog | Guards | Platform | Catalog | Yes | 12 | Seed from TS | Static |
| Limit Catalog | PlanLimits + VO | Catalog | Extend | Catalog | Enforcement | Platform | Catalog | Yes | 12, 14 | Unify | Static |
| Compatibility | Missing | Catalog | New | Catalog | Provisioning | Platform | Catalog | Yes | 12 | Greenfield | Disable rules flag |
| Plan | Enums/aliases | Commercial | New | Plans mgr | UI/bridge | Platform | Plans | Yes | 13 | Canonical ID | Alias map |
| Plan Version | Missing | Commercial | New | Plans mgr | Subscription | Platform | Publish SoD | Yes | 13 | Immutable | New version only |
| Plan Entitlements | LICENSED_* | Commercial | New | Plans mgr | Resolver | Platform | Plans | Yes | 14 | From static | Bridge |
| Add-on | Grant APIs/JSON | Commercial | New | Commercial | Resolver | Hybrid | Add-on perms | Yes | 15 | Greenfield | Expire/revoke |
| Tenant Override | moduleFlags/JSON | Override domain | New | Req+approver | Resolver | Tenant/hybrid | SoD | Yes | 15 | Replace ad hoc | Expire |
| Tenant Subscription | PlatformSubscription+features | SaaS Subscription | Extend/Normalize | Sub mgr | Licensing | Hybrid | Sub perms | Yes | 16 | Bind Plan Version | Compensating migrate |
| License | TenantLicense computed | Bridge | Bridge/Extend | Engine | Guards | N/A | Internal | License audit | 18 | Shadow→cutover | Legacy enforcement |
| Effective Entitlement | Partial engine | Resolver | New/Extend | Resolver | All | N/A | Server | Explain | 18 | Stages 3–4 | Stage 4 rollback |
| Feature Flag | Env + mixed JSON | Platform ops | Keep/Clarify | Ops/Security | Centers | Env/platform | Flag perms | Yes | 20 | Split keys | Env revert |
| Provisioning | Two-step handlers | Orchestration | Extend | Platform Admin | Lifecycle | Hybrid | Tenant ops | Yes | 17 | Idempotent | Compensation |
| Tenant Lifecycle | PlatformTenant status | platform-admin | Reuse/Extend | Platform Admin | Engine | Platform meta | Lifecycle | Yes | 19 | — | Resume |
| Audit | Platform+License audit | Audit | Reuse/Extend | System | Auditor | Mixed | audit.view | Immutable | 21 | New events | Never delete |
| Notifications | Existing center | Notifications | Reuse | System | Users | Tenant | Existing | Redacted | 27 | Templates | Disable templates |
| Observability | Rel 45 | Observability | Reuse | System | Ops | Platform | Ops | Redacted | 22 | Metrics | — |
| Backup | Backup-restore | Backup | Reuse | Ops | Ops | Tenant | Step-up | Yes | 22 | — | — |
| Jobs/Queues | BullMQ workers | Jobs | Reuse | System | Ops | Tenant explicit | Worker guard | Yes | 22 | — | — |
| Sales Rep / Lead / Opportunity / Trial / Ownership / Commission | Missing | Sales MVP | New | Sales roles | Sales UI | Platform | Sales perms | Yes | 23–26 | Greenfield | Soft-delete |

---

## 13. Source-of-Record Transition Matrix

| Artifact | Current | Transition | Future SoR | Bridge owner |
|----------|---------|------------|------------|--------------|
| Plan enums/aliases | Prisma + mappers | Central alias map → canonical Plan | Plan identity | 13 |
| PlatformSubscription | SaaS row | Extend with Plan Version FK (additive) | SaaS Subscription | 16 (D-02/D-03) |
| TenantLicense | Computed | Bridge representation | Resolver output + engine | 18 (D-04) |
| Tenant.features | JSON mixed | Non-commercial retain; commercial deny override | Override/subscription | 18 |
| subscriptionUiPlan | JSON | Map to version/tier grant | Plan Version / add-on | 16–18 |
| moduleFlags | JSON | Operational only; no commercial grant | Flags / entitled customize | 18, 20 |
| Grant history JSON | features | Prefer audit + add-on records | Audit/Add-on | 15, 21 |
| clinicType JSON | features | Dual-read → catalog id | Facility Type | 12 |
| specialties[] | Free-text | Map + manual review | Specialty keys | 12 |
| LICENSED_* TS | Static | Seed catalog; dual until cutover | Catalog | 12–14 |
| FE PLAN_CATALOG | Duplicate | Read from API; deprecate local matrix | API entitlements | 16–18 |
| Operator vs tenant plan-change | Dual paths | One governed path | Subscription service | 16 |

---

## 14. Platform Identity Migration Plan

### Current

- Clinic-audience JWT for `/platform/*`
- Role/permission gate (`super_admin` / `system_administrator`)
- No MFA assurance on access JWT
- Universal `super_admin` bypass (Step 03)

### Target

- Dedicated platform login; `aud=platform` (or equivalent); platform subject; no implicit tenant; MFA assurance; session ID; revocation; granular perms; reject tenant/patient tokens

### Stages

| # | Action | Step | Rollback |
|---|--------|------|----------|
| 1 | Platform principal model / claims extension | 06 | Disable claim issuance |
| 2 | Dedicated auth flow | 06 | Route-disable |
| 3 | Token validation boundary on platform routes | 06 | Guard feature flag |
| 4 | Session + MFA assurance | 07 | Fall back to challenge-only |
| 5 | Granular platform roles | 08 | Map roles → legacy |
| 6 | New Super Admin APIs platform-only | 08+ | Dual-accept transitional (time-boxed) |
| 7 | Preserve embedded clinic-dashboard admin temporarily | 08–11 | Keep old routes |
| 8 | Deprecate role-only platform access after parity | 08, 28 | Re-enable transitional |
| 9 | Remove universal bypass from **new** paths | 08 | — |
| 10 | Legacy route retirement | 29 or later | Separate approval |

Aligns with Step 03 **D-21: extend identity**.

---

## 15. RLS and Cross-Tenant Data Plan

**Baseline:** Step 03 D-16 hybrid.

| Domain class | Model |
|--------------|--------|
| Clinical/operational tenant data | Tenant-owned under RLS + `withTenantContext` |
| Platform metadata (platform_tenants, grants, catalogs, plans) | No tenant RLS; **narrow platform repositories**; app authz + audit; no default root Prisma in handlers |
| Tenant commercial rows (subscription/override if per-tenant) | Hybrid — decide in Steps 15–16; MUST include tenantId filters + tests |
| Unresolved details | Validate in domain steps + Step 28 |

**Freeze:** Cross-tenant read = explicit permission; write = target tenant + reason + audit; bypass explicit/narrow; tenant IDs in cache/audit; PHI barred; missing scoping = release-blocking.

---

## 16. Legacy Licensing Bridge Plan

| Stage | Name | Owner steps | Behavior |
|-------|------|-------------|----------|
| **0** | Baseline | Pre-18 / 04 | Engine authoritative; Phase 28 tests baseline; aliases inventoried; cache documented |
| **1** | Stable catalog + mapping | 12–14 | Capability keys + maps; **no** enforcement cutover |
| **2** | Plan Version + subscription normalize | 13–16 | Versions define grants; subscriptions bind; legacy mapped |
| **3** | Resolver shadow | 18 | Compute + compare; engine still enforces; safe mismatch metrics |
| **4** | Controlled cutover | 18, 28 | Selected checks → resolver; rollback flag; invalidation verified |
| **5** | Legacy read reduction | 18, 28–29 | Reduce JSON commercial grants; FE matrices read-only/remove later |

Release 47 MUST NOT assume full legacy deletion.

---

## 17. Plan Vocabulary Migration Plan

| Layer | Values |
|-------|--------|
| Prisma | `LITE \| PRO \| ENTERPRISE` |
| Platform | `starter \| growth \| enterprise` |
| Frontend | `starter \| professional \| business \| enterprise` |

**Freeze:** No fourth vocabulary; display names never authz keys; canonical ID chosen once (primary owner **Step 13**, decision D-01); centralized aliases; API compat until consumers migrate; unsupported aliases fail visibly; incremental removal of string plan comparisons; rollback restores prior mapping.

`business` = UI tier on `pro` — map explicitly in alias/version entitlements (Step 13–14).

---

## 18. Database and Migration Strategy

**Rule:** All R47 schema migrations MUST be **additive** until verified cutover. No destructive removal of legacy fields in R47 unless separately approved.

| Item | Consumers | Future | Bridge | Trigger | Rollback | Test gate | Retire |
|------|-----------|--------|--------|---------|----------|-----------|--------|
| Plan enums | PlatformTenant, PlatformSubscription | Canonical Plan + map | Alias table/service | 13 | Keep enum | Compatibility tests | Post-R47 |
| PlatformSubscription | Licensing, handlers | + planVersionId | Dual-read plan enum | 16 | Null FK ok | Sub tests | Enum later |
| TenantLicense | Guards | Resolver | Engine still builds | 18 | Shadow off | Phase 28 | Never delete concept |
| Tenant.features | Many | Split | Adapter | 18 | Keep JSON | Self-grant tests | Partial |
| subscriptionUiPlan | Engine | Version/tier | Map | 16–18 | Keep key | Licensing specs | Later |
| moduleFlags | Registry | Operational | Keep | 18, 20 | Keep | Registry specs | Keep ops |
| Grant history JSON | Audit util | Audit/Add-on | Dual-write optional | 15 | JSON retain | Grant specs | Later |
| clinicType | Settings | Catalog FK | Dual-read | 12 | JSON | Settings | Later |
| specialties | Settings | Keys | Map+review | 12 | Free-text | Catalog | Later |
| LICENSED_* | Guards | Catalog | Import seed | 12–14 | Static | Guard tests | Later |
| FE matrices | Dashboard | API | Dual | 16–18 | Local catalog | FE tests | Later |
| Dual plan-change | Handlers | One path | Adapter | 16 | Feature flag path | Integrity tests | Remove old path later |

Per-step: **05–11** prefer no schema or additive platform-user only; **12–16** additive commercial; **17–18** additive links + revision fields; **19–27** additive as needed; **28–29** no destructive.

---

## 19. Data Backfill Strategy

| Backfill | Discovery | Dry-run | Ambiguity | Manual threshold | Idempotent | Audit | Rollback | Metrics | Owner |
|----------|-----------|---------|-----------|------------------|------------|-------|----------|---------|-------|
| Plan → canonical | Inventory aliases | Yes | Unknown→lite+flag | All unknowns | Yes | Yes | Remap | % mapped | 13 |
| Modules/features → keys | Diff LICENSED_* | Yes | Collisions | Collisions | Yes | Yes | Remap | Coverage | 12 |
| Facility type JSON | Distinct clinicType | Yes | Null/invalid | Invalid | Yes | Yes | Keep JSON | % linked | 12 |
| Specialties free-text | Distinct strings | Yes | Fuzzy match | Low confidence | Yes | Yes | Keep text | Match rate | 12 |
| Subscription → Plan Version | Active subs | Yes | Missing version | Create draft published from matrix | Yes | Yes | Unlink FK | % bound | 16 |
| License → resolver grants | Shadow compare | Yes | Mismatch | All mismatches | Yes | Yes | Shadow only | Parity % | 18 |
| Inconsistent plan state | Operator vs features | Yes | Drift | All drift | Report | Yes | — | Drift count | 16 |
| subscriptionUiPlan drift | Compare ui vs backend | Yes | business/pro | All | Report | Yes | — | Drift | 16 |
| Features vs license conflict | Identity merge cases | Yes | Override true | All | Report | Yes | — | Conflict count | 18 |
| Unsupported aliases | Alias miss | Yes | — | All | Report | Yes | — | Count | 13 |

No SQL/scripts in this step.

---

## 20. Entitlement Cache Plan

| Aspect | Plan |
|--------|------|
| Owner | Step **18** (triggers 15–17, 19–20) |
| Technology | Prefer extend current pattern; distributed cache **if** repo Redis conventions support — *confirm during Step 18* |
| Key | MUST include `tenantId` + capability/revision context |
| Revisions | subscription, planVersion, add-on, override, featureFlag (as applicable) |
| TTL | Start from current 60s; tune with evidence |
| Invalidation | Assignment/migration/status; add-on/override lifecycle; suspend/resume; license change; flags/kill switch; catalog retirement affecting eval; Plan Version publish when relevant |
| Failure | Documented fail-closed or fail-safe policy in Step 18 (prefer fail-closed for commercial grant) |
| Observability | hit/miss, invalidation, latency, mismatch (shadow) |
| Tests | Tenant isolation; invalidation after sub change; no cross-tenant |

---

## 21. Authorization and Segregation-of-Duties Plan

| Concern | Owner |
|---------|-------|
| Platform permission categories (Step 02) | 08 |
| Remove bypass on new paths | 08 |
| Step-up plumbing | 07 |
| Publish ≠ create | 13 + 08 |
| Override request ≠ approve | 15 + 08 |
| Privileged grant enforcement | 19 |
| Audit attribution | 21 |
| Security regression | 28 |

---

## 22. Audit and Observability Plan

**Audit events (assign creation to domain steps):** plan publish/retire; subscription assign/migrate; add-on; override request/approve/expire; limit change; suspend/reactivate; privileged access; role escalation; security reset; cache invalidation (sensitive).

**Metrics (minimum):** auth success/fail; MFA; session revoke; authz deny; cross-tenant deny; publish; migrate; add-on/override lifecycle; resolver count/latency; cache hit/miss/invalidate; shadow mismatch; unknown key; compatibility fail; provisioning; compensation; privileged use; trial expiry/conversion; notification failure.

**Redaction:** no PHI, tokens, secrets, MFA secrets, unnecessary contract payloads.

---

## 23. Test Strategy

**Pyramid:** unit → domain → API integration → DB/RLS → authz matrix → migration/compat/cache → e2e → a11y → security regression → ops smoke → rollback → manual approval workflows.

**Verified tooling:**

| Suite | Command (verified) |
|-------|-------------------|
| API unit | `npm run test --workspace=booking-system-api` |
| API integration | `npm run test:integration --workspace=booking-system-api` |
| Dashboard | `npm run test:dashboard` / `test:e2e:dashboard` |
| Patient portal | `npm run test:patient-portal` |
| Phase 28 CI | `.github/workflows/phase28-licensing-ci.yml` |
| Permission matrix | `npm run validate:permission-matrix --workspace=booking-system-api` |
| Super-admin scripts | *Command to be confirmed from workspace scripts during Step 05* |

**Per-step:** minimum level in §§34–58; PHI-safe fixtures only; regression: Phase 28 licensing, RLS, tenant lifecycle, patient-portal unaffected.

### Mandatory cross-step scenarios (map to ST-01–40 + R47)

Include all Step 03 ST-01–40 plus: Phase 28 pass; lifecycle pass; RLS pass; portal unaffected; provisioning idempotent/recoverable; multi-specialty limit; facility compat ≠ commercial grant; sales peer isolation; trial expiry/conversion attribution; rollback restores prior behavior.

---

## 24. CI/CD Gate Plan

| Gate | Current | Future |
|------|---------|--------|
| Dashboard CI | Exists | Keep |
| Phase 28 licensing | Exists | **Required regression every commercial step** |
| API lint/typecheck/test | Via api scripts | Extend workflow *in Step 29 or when adding super-admin* |
| Super-admin build/test | Missing | Add after Step 05 |
| Portal build/test | Scripts exist | Non-regression in 28–29 |
| Prisma migrate status | Script exists | Validate on schema steps |
| Security regression | Partial | Package ST suite Step 28 |
| Dependency audit | Not verified | Step 29 |

Do not modify CI in Step 04.

---

## 25. Rollback and Compensation Strategy

| Type | When |
|------|------|
| File-only | Scaffold/docs/UI without schema |
| Feature-flag / route-disable | Auth boundary, resolver cutover |
| Additive schema retain + read fallback | Catalog/plans |
| Dual-read / write-path fallback | Bridge stages |
| Cache bypass | Resolver issues |
| Subscription compensating transition | Migration undo (new audited transition; **do not delete** published versions) |
| Provisioning compensation | No orphan credentials/partial active tenants |
| Deployment rollback | App release |
| Data repair runbook | Backfill errors |

**Freeze:** No destructive migration without tested rollback; never delete audit; never delete published Plan Versions to “undo”; kill switches MUST NOT grant access; resolver fallback to legacy until parity.

---

## 26. Security Release Gates

| Gate | Evidence | Primary steps |
|------|----------|---------------|
| **S-01** Platform Principal | Tenant/patient rejected; platform only on platform APIs; no implicit tenant | 06–08 |
| **S-02** Universal role removal (new paths) | Granular perms; no super_admin short-circuit on new APIs; audit/step-up not bypassable | 08 |
| **S-03** MFA & Step-Up | Encrypted secrets verified; recovery protected; fresh assurance; sensitive actions require step-up | 07, 28 |
| **S-04** Tenant self-grant prevention | No Plan/Version/Add-on/Override/Module/Feature/Specialty/Limit self-grant; JSON cannot override denial | 18, 28 |
| **S-05** RLS & cross-tenant | A≠B; platform narrow path; writes authorized+audited | Domain + 28 |
| **S-06** Privileged access | Time-bound; data path validates grant; actor+grant attributable; expiry | 19, 28 |
| **S-07** Plan/subscription integrity | Immutable published; no unpublished assign; one change path; cache invalidation; audit+preview | 13, 16, 18, 28 |
| **S-08** PHI boundary | No PHI dashboard/search/logs/notifications/fixtures/exports | All UI/API, 28–29 |

Critical/High gaps G-ID-01, G-AUTHZ-01, G-ENT-01, G-PRIV-01, G-RLS-01, G-MFA-01/02, G-PLAN-01, G-ROLE-01 → these gates.

---

## 27. Product Release Gates

| Gate | Entry | Exit | Tests | Docs | Approvals | Blockers |
|------|-------|------|-------|------|-----------|----------|
| **G-01** | Discovery done | 01–04 accepted | N/A | Scope+security+plan | Product+Arch+Sec | Unapproved plan |
| **G-02** | G-01 | 05–09 accepted | S-01–S-03 partial | Auth runbook draft | Sec | Token confusion |
| **G-03** | G-02 | 10–11 accepted | Authz+pagination; no PHI | — | Product | PHI leak |
| **G-04** | G-03 | 12–16 accepted | Compat; immutability; SoD | Catalog registry | Arch | Display-name authz |
| **G-05** | G-04 | 17–18 + parity | Phase 28; shadow/cutover; cache | Bridge notes | Sec+Arch | Parity fail |
| **G-06** | G-05 | 19–22 accepted | Lifecycle; step-up ops | Audit catalog | Ops | Missing audit |
| **G-07** | G-06 | 23–27 accepted | Sales least privilege | Sales metrics | Product | CRM creep |
| **G-08** | G-07 | 28; no Crit/High open | Full S-* + ST suite | Security review | Sec | Open Critical/High |
| **G-09** | G-08 | 29 handover | Smoke; rollback drill | Runbooks | Ops+Product | Incomplete handover |

---

## 28. Commit and Review Boundaries

Each step MUST: single intended domain; include tests; update docs; report files/commands/migration/rollback/risks; pass acceptance; review before next; **separate commit**.

**MUST NOT combine:** auth+catalog; RBAC+plans; Plan Versions+resolver; add-ons+sales; migration+unrelated UI; hardening+features.

**Split sub-prompts when:** >1 schema domain; >1 security boundary; migration+large UI; unrelated APIs; non-isolated rollback; oversized tests; separate risk domains.

---

## 29. Decision Resolution Plan

| ID | Decision | Status | Responsible | Evidence needed | Deadline | Blocker? | Fallback | Approver |
|----|----------|--------|-------------|-----------------|----------|----------|----------|----------|
| D-01 | Canonical Plan IDs | Open | **13** | Alias inventory + product names | Before first publish | Yes | Keep 3-layer map only | Arch+Product |
| D-02 | SaaS Subscription SoR | Open | **16** (plan in 04) | Prefer extend PlatformSubscription | Before 16 write | Yes | Dual-write temporary | Arch |
| D-03 | PlatformSubscription role | Open | **16** | Same as D-02 | 16 | Yes | Keep as billing row + version FK | Arch |
| D-04 | TenantLicense role | Open | **18** | Bridge representation | Before cutover | No early | Keep computed | Arch |
| D-05 | Facility Type storage | Open | **12** | Catalog table vs config | Before 12 schema | Yes | Dual-read JSON | Product+Arch |
| D-06 | Specialty storage | Open | **12** | New catalog (recommended) | 12 | Yes | Free-text+manual | Product+Arch |
| D-07 | Module-registry integration | Open | **12**, verify **18** | Adapter vs SSOT | 12 | Yes | Manifests remain runtime | Eng |
| D-08 | Compatibility storage | Open | **12** | Rules in catalog | 12 | Yes | Soft-validate only | Arch |
| D-09 | Capability key naming | Open | **12** (freeze rules in 04 intent) | camelCase legacy + stable prefix map | 12 | Yes | Map table | Arch |
| D-10 | tenant.features transition | Open | **18** | Consumer inventory | 18 | Yes | Adapter deny commercial override | Eng |
| D-11 | Plan alias map SSOT | Open | **13** | Single module | 13 | Yes | Keep mappers temporary | Eng |
| D-12 | Plan-change unify | Open | **16** | One service | 16 | Yes | Feature-flag old path | Eng |
| D-13 | Cache strategy | Open | **18** | Redis vs Map | 18 | No early | Keep Map+TTL | Eng |
| D-14 | Cache invalidation ownership | Open | **18** | Event list §20 | 18 | No early | Explicit calls | Eng |
| D-15 | Subscription migration | Open | **16** | Preview+compensate | 16 | Yes | Manual support | Arch |
| D-16 | RLS hybrid | **Partial (Step 03)** | Domain + **28** | Narrow repos | Continuous | Yes if violated | Block release | Sec |
| D-17 | Deploy topology | Open | **29** | Ops evidence | 29 | No early | Compose-like | Ops |
| D-18 | Monthly limit coverage | Open | **14**, verify **18** | Write-path audit | 18 | No | Soft limits flagged | Eng |
| D-19 | Sales ownership SoR | Open | **23–25** | New domain | 23 | Yes for sales | Defer sales | Product |
| D-20 | Commission snapshot | Open | **26** | Review-only formula | 26 | No | Defer 26 | Product |
| D-21 | Platform identity | **Partial (Step 03)** | **06–08** | Extend auth | Before protected APIs | Yes | Block commercial writes | Sec |
| D-22 | Dedicated app topology | **Resolved in scope** | **05** | `apps/super-admin` | 05 | Yes | Block UI | Product |

---

## 30. Risk Register

| ID | Description | Evidence | Prob | Impact | Sev | Mitigation | Owner | Blocker? | Trigger | Contingency |
|----|-------------|----------|------|--------|-----|------------|-------|----------|---------|-------------|
| R-01 | Scope size / schedule | Full MVP | H | H | H | Strict step boundaries | 04–29 | No | Slip | Defer G (sales) |
| R-02 | Platform identity migration | Step 03 | M | C | C | D-21 stages | 06–08 | Yes | Auth fail | Hold commercial APIs |
| R-03 | Universal role bypass | permission.guard | H | C | C | S-02 | 08, 28 | Yes | Bypass remains | Block G-08 |
| R-04 | Plan vocabulary drift | Step 01 | H | H | H | Central map | 13 | Yes | Fourth vocab | Reject change |
| R-05 | Duplicate SoR | Dual plan-change | M | H | H | Step 16 unify | 16 | Yes | Drift detected | Compensate + freeze UI |
| R-06 | features override license | GetIdentityFeatures | H | H | H | S-04 / Stage 5 | 18 | Yes | Conflict report | Fail-closed merge |
| R-07 | RLS bypass abuse | withPlatformBypass | M | H | H | Narrow repos | 11–19, 28 | Yes | Open bypass | Hotfix + audit |
| R-08 | Platform tables unprotected | No RLS | M | H | H | App authz+tests | 11, 28 | Yes | IDOR | Patch + gate |
| R-09 | Cache leakage/staleness | 60s Map | M | M | M | Keys+invalidate | 18 | Partial | Mismatch | Bypass cache |
| R-10 | Compat modeling errors | Missing rules | M | M | M | Catalog validation | 12, 17 | No | Bad provision | Override SoD |
| R-11 | Specialty free-text migrate | Step 01 | H | M | M | Manual review | 12 | No | Ambiguity | Keep text |
| R-12 | Facility JSON migrate | clinicType | M | M | M | Dual-read | 12 | No | — | JSON fallback |
| R-13 | License regression | Phase 28 | M | C | H | Always run CI | 14–18, 28 | Yes | Fail CI | Rollback cutover |
| R-14 | Provisioning partial fail | Two-step today | M | H | H | Idempotent+compensate | 17 | Yes | Orphan | Runbook |
| R-15 | PHI leakage | UI risk | L | C | H | S-08 | 10–11, 28 | Yes | Finding | Remove UI+incident |
| R-16 | Audit gaps | Future events | M | M | M | Event catalog | 21 | No | Missing | Backfill policy |
| R-17 | Sales scope expansion | Ambition | M | M | M | G-07 gate | 23–27 | No | CRM asks | Refuse |
| R-18 | Test runtime | Suites grow | M | M | L | Split steps | Each | No | Timeout | Parallel CI |
| R-19 | Deploy topology unknown | Step 01 | H | M | M | D-17 | 29 | No | — | Manual runbook |
| R-20 | Rollback complexity | Bridges | M | H | H | Compensating transitions | 16–18 | Yes | Failed migrate | Explicit reverse migrate |

---

## 31. Documentation Plan

| Step | Required docs |
|------|---------------|
| 05 | App README, workspace scripts |
| 06–08 | Auth boundary, session, permission matrix updates |
| 09–11 | IA/nav, PHI-safe UI notes |
| 12 | Capability key registry, catalog lifecycle |
| 13–14 | Plan Version lifecycle, entitlement precedence |
| 15 | Override SoD, add-on rules |
| 16 | Subscription migration runbook |
| 17 | Provisioning recovery |
| 18 | Resolver, cache invalidation, bridge stages |
| 19 | Privileged access enforcement |
| 20 | Flag vs entitlement |
| 21 | Audit event catalog |
| 22 | Ops alerts |
| 23–26 | Sales metrics, commission formula |
| 27 | Notification templates |
| 28–29 | Security review, deploy, rollback, limitations |

---

## 32. Operational Handover Plan

Step 29 delivers: deploy topology notes; least-privilege prod access; alert runbooks; bridge rollback; privileged access ops; trial expiry monitoring; known limitations; deferred backlog. Owner: Ops + Platform Admin + Security.

---

## 33. Global Definition of Done

- Conventions followed; changed files reported  
- Build, lint, typecheck, unit, integration, relevant e2e pass  
- RLS + authz + migration tests pass where applicable  
- Rollback tested or documented  
- No unresolved Critical/High security blocker  
- No PHI/secrets in logs/fixtures/analytics/notifications/FE config  
- Deny-by-default server authz; platform principal enforced  
- Tenant isolation verified; published Plan Versions immutable  
- No display-name authz; tenant self-grant prevented  
- Flags ≠ entitlements; entitlements explainable; cache tenant-isolated  
- Phase 28 licensing regression passes; Patient Portal unaffected  
- Audit for sensitive actions; runbooks updated  
- Deferred scope + limitations documented; least-privilege prod access  

---

# Detailed Step Plans (05–29)

---

## 34. Step 05 — Super Admin Application Scaffold

### Objective
Create dedicated Super Admin frontend workspace runnable independently, aligned with monorepo conventions (patient-portal/clinic-dashboard patterns).

### Prerequisites
G-01 approved (Steps 01–04).

### Repository Evidence Required Before Implementation
Root workspaces; `apps/patient-portal` Vite+React scripts; design-tokens/i18n packages; absence of `apps/super-admin`.

### In Scope
Scaffold app; workspace registration; basic router shell placeholder; env template without secrets; README; CI stub optional (prefer Step 29 for full CI).

### Explicit Non-Goals
Auth, RBAC, commercial APIs, PHI UI, platform-admin changes.

### Expected Domain Changes
Frontend app only. *Path: likely `apps/super-admin` — confirm during step.*

### Expected Data Changes
None.

### Expected API Changes
None.

### Expected UI Changes
Empty shell / health page only.

### Authentication and Authorization
None yet (public health only).

### RLS and Tenant Isolation
N/A.

### Audit and Observability
N/A.

### Legacy Compatibility
Do not remove clinic-dashboard embedded admin.

### Tests
Smoke: build + vitest placeholder. Portal/dashboard regression not required yet.

### Migration Strategy
No schema.

### Rollback or Compensation
File-only remove app + workspace entry.

### Security Gates
None complete (S-01 starts at 06).

### Acceptance Evidence
App builds; listed in workspaces; no secrets in repo.

### Blocks
06–09.

### Blocked By
01–04.

### Expected Commit Boundary
Single commit: scaffold only.

---

## 35. Step 06 — Platform Authentication

### Objective
Implement distinct platform principal authentication and token validation boundary (D-21).

### Prerequisites
Step 05.

### Repository Evidence Required
`JwtTokenService`, `JwtClaimsVO`, `JwtAuthGuard`, `auth.controller`, platform-admin guards.

### In Scope
Platform login flow; platform audience/principal claims; platform route guard rejecting clinic/patient tokens; Super Admin login UI wiring.

### Explicit Non-Goals
Full MFA assurance (07); granular roles (08); commercial APIs.

### Expected Domain Changes
Auth module extension; platform guards. *Locations to confirm.*

### Expected Data Changes
Additive only if platform-user linkage needed; else reuse User with principal class — confirm.

### Expected API Changes
Platform auth endpoints conceptually under platform boundary.

### Expected UI Changes
Login page in Super Admin.

### Authentication and Authorization
Platform principal required for platform routes.

### RLS
N/A beyond not using tenant JWT for platform.

### Audit
Login success/failure.

### Legacy Compatibility
Keep clinic JWT for embedded admin temporarily.

### Tests
ST-01–04; unit for claims; API reject tenant/patient.

### Migration
Additive claims; dual-accept transitional only if time-boxed.

### Rollback
Feature-flag platform guard; fall back to prior routes.

### Security Gates
S-01 (entry).

### Acceptance Evidence
S-01 scenarios pass for auth boundary.

### Blocks
07+.

### Blocked By
05.

### Expected Commit Boundary
Auth boundary only; no RBAC matrix rewrite.

---

## 36. Step 07 — MFA and Session Security

### Objective
Platform MFA required; session revoke; step-up assurance plumbing; verify secret encryption (G-MFA-02).

### Prerequisites
06.

### Repository Evidence
MFA handlers, backup codes, session revoke, refresh rotation.

### In Scope
Platform MFA enroll/verify; encrypted secrets verification/fix; assurance claim or server session flag; revoke one/all; idle/absolute policies as approved.

### Non-Goals
Role model (08); override SoD UI.

### Data
Additive session/assurance fields if needed.

### API/UI
MFA setup/challenge in Super Admin.

### AuthZ
Platform principal + MFA for sensitive later.

### Tests
ST-36–37; encryption verification test; revocation.

### Migration
Additive.

### Rollback
Feature-flag step-up enforcement (keep MFA enroll).

### Security Gates
S-03 progress.

### Acceptance Evidence
Secrets encrypted; recovery hashed; revoke works; assurance available for later gates.

### Blocks
08, 15, 19.

### Blocked By
06.

### Commit Boundary
MFA/sessions only.

---

## 37. Step 08 — RBAC and Platform Users

### Objective
Granular platform roles/permissions; platform user admin; **no universal bypass on new platform paths** (S-02).

### Prerequisites
07.

### Repository Evidence
`permission-matrix.json`, `PermissionGuard` bypass, `PlatformAdminPolicy`.

### In Scope
Platform permission categories from Step 02; role assignment; remove short-circuit on **new** platform APIs; map legacy `super_admin` temporarily for old routes only.

### Non-Goals
Catalog; sales roles full UI (partial stubs OK).

### Data
Additive platform role bindings if needed.

### AuthZ
SoD: create≠publish; request≠approve (enforce when those APIs exist).

### Tests
Authz matrix; ST-02 related; no bypass on new paths.

### Rollback
Re-enable transitional role map for old routes only.

### Security Gates
S-02.

### Acceptance Evidence
New platform APIs deny without granular permission even if legacy role present without mapping.

### Blocks
09–29 platform features.

### Blocked By
07.

### Commit Boundary
RBAC only — split if matrix + UI large.

---

## 38. Step 09 — Super Admin Design System Shell

### Objective
Accessible shell, nav, i18n, design tokens; tenant context visibility pattern for later pages.

### Prerequisites
08.

### Evidence
`@booking/design-tokens`, `@booking/i18n`, patient-portal shell patterns.

### In Scope
Layout, nav placeholders, theme, a11y baseline.

### Non-Goals
Real commercial pages.

### Tests
a11y smoke; build.

### Rollback
File-only.

### Security Gates
PHI-safe empty shell (S-08 start).

### Blocks
10+.

### Blocked By
08.

### Commit Boundary
UI shell only.

---

## 39. Step 10 — Dashboard MVP

### Objective
Safe operational/commercial summary metrics; **no PHI**.

### Prerequisites
09.

### In Scope
Dashboard widgets from platform metadata only.

### Non-Goals
Patient search; clinical charts; writes.

### RLS
Platform narrow repos for aggregates.

### Tests
ST-40 partial; authz; pagination if lists.

### Rollback
Route-disable.

### Gates
G-03, S-08 contribution.

### Blocks
None hard (11 parallel).

### Blocked By
09.

### Commit Boundary
Dashboard only.

---

## 40. Step 11 — Tenant Directory and Detail

### Objective
List/search tenants; detail with subscription/license **read** views from existing SoR; no PHI contacts beyond admin.

### Prerequisites
09.

### Evidence
`ListPlatformTenantsHandler`, PlatformTenant, licensing overview APIs.

### In Scope
Directory, detail, pagination, filters; reuse platform-admin reads.

### Non-Goals
Provisioning writes; plan publish.

### RLS
Platform metadata narrow path; S-05 contribution.

### Tests
ST-05–06 read; IDOR; no PHI.

### Rollback
Route-disable.

### Gates
G-03.

### Blocks
17, 19 (consume UI).

### Blocked By
09.

### Commit Boundary
Tenant read UI + thin API adapters only.

---

## 41. Step 12 — Healthcare Catalog and Capability Model

### Objective
Facility types, specialties, modules, features, limits, compatibility rules, stable capability keys (D-05–D-09).

### Prerequisites
08; prefer 10–11 complete.

### Evidence
`LICENSED_*`, module-registry, clinicProfile JSON.

### In Scope
Catalog SoR; key registry; seed from static config; dual-read JSON facility/specialty; **no** enforcement cutover.

### Non-Goals
Plan Versions; resolver cutover; FE matrix removal.

### Data
Additive catalog tables/config; backfill dry-run reports.

### AuthZ
catalog.* permissions.

### Tests
Key uniqueness; mapping coverage; deny unknown keys (unit).

### Migration
Additive; Stage 1 bridge.

### Rollback
Dual-read fallback to JSON/static.

### Gates
G-04 entry.

### Blocks
13–17.

### Blocked By
08.

### Commit Boundary
Split if facility+specialty+module are large — catalog core first.

---

## 42. Step 13 — Plans and Plan Versions Management

### Objective
Plan identity; Draft→In Review→Published→Retired; **immutable published**; D-01 canonical IDs; central alias map (D-11).

### Prerequisites
12.

### In Scope
Plan CRUD (non-runtime); version create/review/publish/retire; step-up on publish; SoD.

### Non-Goals
Entitlement line items (14); subscription assign (16).

### Data
Additive Plan/PlanVersion; no fourth vocabulary.

### Tests
ST-24–25; immutability; alias map.

### Rollback
Retire version; do not delete published.

### Gates
S-07 start.

### Blocks
14–16.

### Blocked By
12.

### Commit Boundary
Plans/versions only.

---

## 43. Step 14 — Plan Entitlements and Limits

### Objective
Attach module/feature/specialty grants and typed limits to Plan Versions; seed from `LICENSED_*` / `PlanLimits`.

### Prerequisites
13.

### In Scope
Entitlement/limit modeling on versions; enforcement modes metadata; D-18 discovery of monthly limit write paths.

### Non-Goals
Add-ons; runtime cutover.

### Tests
Parity reports vs static config; Phase 28 still green.

### Migration
Stage 1–2 bridge.

### Rollback
Versions retain; dual-read static.

### Blocks
15–18.

### Blocked By
13.

### Commit Boundary
Entitlements/limits only — split soft vs hard limit work if needed.

---

## 44. Step 15 — Add-ons and Tenant Overrides

### Objective
Reusable Add-ons; governed Overrides with SoD, expiry, step-up; invalidate cache hooks.

### Prerequisites
14, 07–08.

### In Scope
Add-on lifecycle; override request/approve; high-impact dual control; no settings self-grant.

### Non-Goals
Full subscription migration UI (16).

### Tests
ST-12–14, 19–20, 28, 30.

### Migration
Additive; grant history dual optional.

### Rollback
Expire/revoke; retain audit.

### Blocks
16–18.

### Blocked By
14, 07–08.

### Commit Boundary
Split Add-ons vs Overrides if both large.

---

## 45. Step 16 — Subscription Management

### Objective
Normalize SaaS Tenant Subscription to **published Plan Version**; unify operator/tenant plan-change (D-12); preview; audit; cache invalidation; D-02/D-03.

### Prerequisites
15.

### Evidence
`ChangePlatformTenantPlanHandler` vs `ChangeTenantSubscriptionPlanHandler`.

### In Scope
One governed change path; migration between versions; compatibility check; impact preview; bind `ClinicSubscription` remains untouched.

### Non-Goals
Payment processing; resolver cutover.

### Tests
ST-13, 26–27; drift repair; Phase 28.

### Migration
Additive planVersionId; Stage 2.

### Rollback
Compensating subscription transition; feature-flag old path temporarily.

### Gates
S-07.

### Blocks
17–18.

### Blocked By
15.

### Commit Boundary
Subscription domain only — no sales.

---

## 46. Step 17 — Tenant Creation and Provisioning

### Objective
Orchestrate Tenant + PlatformTenant + Subscription + catalog selection; compatibility validation; idempotent; recoverable partial failure.

### Prerequisites
16; catalog 12.

### Evidence
`CreateTenantHandler`, `ProvisionPlatformTenantHandler`.

### In Scope
Provisioning workflow; invite tenant admin; use entitlement validation (may call shadow resolver).

### Non-Goals
Full resolver enforcement cutover.

### Tests
Idempotency; compensation; no orphan users; ST-related provisioning.

### Migration
Orchestration; additive links.

### Rollback
Compensation runbook; suspend incomplete.

### Blocks
18–19.

### Blocked By
16.

### Commit Boundary
Provisioning orchestration only.

---

## 47. Step 18 — Effective Entitlement Runtime and Licensing View

### Objective
Resolver with explain API; Stages 3–5 bridge; fix commercial override from `tenant.features` (G-ENT-01); cache plan; Super Admin licensing view.

### Prerequisites
17; 12–16 modeled.

### Evidence
`LicensingEngineService`, `GetIdentityFeaturesHandler`, cache TTL.

### In Scope
Shadow mode → controlled cutover; fail-closed unknown keys; deny JSON commercial override on authoritative path; FE matrix deprecation path.

### Non-Goals
Delete legacy engine; sales.

### Tests
Phase 28; ST-15–23; shadow mismatch metrics; cache isolation; S-04.

### Migration
Stages 3–5; rollback feature to legacy enforcement.

### Rollback
Disable cutover flag; dual-read.

### Gates
G-05, S-04, S-07 completion.

### Blocks
19–20, 28.

### Blocked By
17.

### Commit Boundary
**Split required:** (18a) shadow resolver + explain; (18b) identity features fail-closed; (18c) cutover selected checks.

---

## 48. Step 19 — Tenant Lifecycle Actions

### Status
**Accepted / Complete** — correction gate + uninterrupted Part 18 one-pass regression green (2026-08-02; exit 0; failures/retries/dbRestarts/productEditsDuringSequence = 0). Evidence hygiene closure (2026-08-03): prohibited local one-pass/console artifacts removed (count 0); EER wording clarified — PROVISIONING tenants remain inaccessible; managed pending never falls back to Legacy; Step 19 preserves Step 17 provisioning access boundary. No executable behavior changed during hygiene. Full one-pass not rerun (artifact/documentation-only). Steps 20–29 **Not Authorized**.

### Objective
Activate/suspend/reactivate/archive-request/deletion-request with step-up, impact preview, dual-control approval, session revocation, EER invalidation; **wire privileged access into data paths** (G-PRIV-01) as residual if not completed in the same increment.

### Prerequisites
18, 07–08.

### Evidence
Lifecycle handlers; PrivilegedAccessGrant.

### In Scope
Lifecycle UX/API hardening; privileged scope enforcement; attribution actor+grant.

### Tests
ST-27–30; suspend denies; S-06.

### Rollback
Route-disable new enforcement behind flag if break-glass needed.

### Blocks
21, 28.

### Blocked By
18, 07–08.

### Commit Boundary
Split lifecycle vs privileged wiring if large.

---

## 49. Step 20 — Feature Flags and Global Settings

### Status
**Accepted / Complete** — test-hook production containment (Model B: `NODE_ENV === 'test'` hard guard). P01–P12 + F01–F20 green; Case B one-pass 2026-08-04 (`exitCode: 0`, failures/retries/dbRestarts/productEdits = 0); prohibited evidence = 0. Boundary: `docs/FEATURE_FLAGS_AND_GLOBAL_SETTINGS.md`. Steps 21–29 unauthorized.

### Objective
Separate operational flags from entitlements; kill switch can deny; flags cannot grant; env `*_CENTER_ENABLED` / containment flags remain operational env SoR; safe global settings/references without secret disclosure; resolver precedence documented and tested.

### Prerequisites
18.

### In Scope
Platform flag admin UI; documentation; resolver integration for deny.

### Tests
ST-22–23.

### Rollback
Env revert.

### Blocks
28.

### Blocked By
18.

### Commit Boundary
Flags only.

---

## 50. Step 21 — Audit Center

**Accepted / Complete** — Case C uninterrupted one-pass green (2026-08-09; exit 0; failures/retries/dbRestarts/commandReruns/productEdits/databaseSwitches = 0). Host recovery cleared `booking_test` zombies (77 → 0). Frozen DB `booking_test` unchanged for the sequence. A08 D11 exact durable success audit delta = 1. Catalog 68 / 136 / 68 / 13. Evidence hygiene = 0. Steps 22–29 unauthorized.

### Objective
Query/export immutable audit for platform commercial/security events; permission-gated; no PHI.

### Prerequisites
08; events from prior steps.

### Evidence
Platform admin audit; LicenseAuditEvent; Step 20 history; real domain mutation → Audit Center correlation via request/operation `correlationId` (never `actor.jti`). A08-D11.1–D11.10 focused green on peer recovery DB.

### In Scope
Audit UX; filters; export; redaction; real-domain proof; exhaustive Passport matrix; query-plan evidence; A03–A15 Model A durability; A08-D11 concurrency cardinality; CORR01–CORR15.

### Tests
ST-32–33; S-08; A01–A18 (real domain + coverage); A01-D/A02-D; A03–A15 durability; A08-D11.1–D11.10; CORR01–CORR15; I01–I12; Q01–Q20; E01–E20; C01–C20; F01–F24; H01–H30 per route; P01–P16; N+1 bounds; Step 17 C17 diagnostics.

### Rollback
Route-disable UI (events remain). Domain audit writes preserved.

### Blocks
28–29.

### Blocked By
19 (preferred for lifecycle events); 20 complete — **satisfied**.

### Commit Boundary
Audit UX / query / export / proof only — no Step 22.

### C17 note
Timeout 120→300 kept (**Outcome A**): focused suite walls 99–124s; prior one-pass timed out at 120 under sequential load; assertions unchanged.

### A03–A15 / correlation note
All applicable A03–A15 success paths classified **Model A** (`recordInTransaction` / same-tx history). Required best-effort success audit paths = 0. Correlation via `resolveOperationCorrelationId` + CorrelationMiddleware ALS; `actor.jti` rejected as operation correlation.

### A08 D11 / Case C closure note (2026-08-08 → 2026-08-09)
- Idempotency: in-transaction unique claim before `replaceAddOns` mutation; loser replays; durable success audit delta exactly 1 for exact duplicates.
- Validators: unique per-run DB names; no shared-name `DROP FORCE`; 10m overall deadline.
- Host recovery: Docker Desktop / `postgres-test` recreate; stale backends 77 → 0; orphan Jest/one-pass processes = 0.
- Runner: freeze one `INTEGRATION_DATABASE_URL` before command 1 (no mid-sequence DB switch); TCP + Prisma `SELECT 1` readiness; Docker CLI failure ≠ DB down; `--forceExit` on security/audit/lifecycle/provisioning Jest runners; long suites (provisioning/lifecycle/audit-center) bounded at 90m; failure-injection suite testTimeout 300s under sequential load.
- Case C one-pass: **Passed** — start `2026-08-09T01:19:53Z`, end `2026-08-09T03:05:43Z`, duration ~105.8m, exit 0, counters all 0, frozen DB `booking_test`.
- Evidence hygiene: `br-step21-*` and raw one-pass logs removed; remaining prohibited = 0.
- Do not start Step 22.
---

## 51. Step 22 — Operations Console

**Accepted and complete (2026-08-10)** after disk recovery + narrow final correction gate Case C.

### Disk / host
- Root cause: host full (`No space left on device`, Cursor `SQLITE_FULL`) interrupted migration wiring for `PlatformOperationsIdempotencyRecord`.
- Cleanup: disposable Cursor/repo TEMP/cache only; preserved `booking_test`, volumes, migrations, schema, source, docs.
- Free space before final Case C: ≥ 12 GB.

### Schema
- Model in `schema.prisma`; migration `20260809180000_phase47_step22_operations_idempotency`.
- Live classification **S-D** (table + finished migration history).

### Corrections closed
1. Durable ops idempotency (D-A provisioning + D-B cache invalidate with pending claim before effect); process Map demoted to cache.
2. Integration health truthfulness (config-only ≠ HEALTHY).
3. F24-B NOT APPLICABLE (no Step 22 rollback compensator); hook containment separate (HOOK01–HOOK04).
4. Provisioning retry Super Admin UI; cache **UI-CACHE-B** API-only.

### Final Case C
- Frozen DB: `booking_test` @ localhost:5433 (`2026-08-09T23:49:44.503Z`)
- Start/end: `2026-08-09T23:49:43.061Z` → `2026-08-10T01:04:52.223Z` (4509162 ms)
- Counters: failures=0 retries=0 dbRestarts=0 commandReruns=0 productEdits=0 databaseSwitches=0 exitCode=0
- Hygiene: prohibited Step 22 artifacts = 0

### Objective
Jobs, queues, backups, integrations health — **reuse** existing Centers; step-up for dangerous ops.

### Prerequisites
08, 19, 21 (Audit Center for durable action evidence).

### Evidence
Observability, backup-restore, queue modules, provisioning retry, integrations ops, EER cache; see `OPERATIONS_CONSOLE.md`.

### In Scope
Ops dashboard adapters/APIs/UI; controlled retries via proven services only; entitlement/cache health indicators; runbooks/tests.

### Non-Goals
Second monitoring/queue/scheduler/backup engine; subscription/override expire workers (absent — DISABLED job SoR); restore workflow; shell/SQL; Step 23+; billing; later sales scope.

### Tests
O01–O16; IDEM01–IDEM16; INT01–INT10; C01–C16; F01–F24 (F24 N/A); HOOK01–HOOK04; H01–H40; UIA01–UIA18; clean/upgrade validators; Case C one-pass.

### Rollback
Route-disable / `OPERATIONS_CONSOLE_ENABLED=false`.

### Blocks
28–29.

### Blocked By
08, 21.

### Commit Boundary
Ops adapters only — no engine rewrite. Step 23 unauthorized.

---

## 52. Step 23 — Sales Representative Management

### Status
**Accepted and complete** (2026-08-11). Contract: [`docs/SALES_REPRESENTATIVE_MANAGEMENT.md`](./SALES_REPRESENTATIVE_MANAGEMENT.md).

### Objective
Sales rep records linked 1:1 to Platform users; least privilege; D-19 commercial ownership start; suspension revokes sessions.

### Prerequisites
08, 16–18 (commercial configs valid); Steps 17–22 accepted.

### Non-Goals
Full CRM; payroll; Leads/Opportunities/Pipeline (Step 24); Trials (Step 25).

### Tests
Peer isolation ST-33; matrices A/S/M/C/F/H; ORD01–ORD05; EMAIL01–EMAIL08; QUERY01; suspension old-token gate.

### Final Case C
Attempt **6** on frozen `booking_test` (freeze `2026-08-11T07:30:56.215Z`); duration ~2730s; `failures=0 retries=0 dbRestarts=0 commandReruns=0 productEdits=0 databaseSwitches=0 exitCode=0`. Attempts 1–5 historical/invalidated. List: `createdAt DESC, id DESC`; email SEARCH-A (`contains`/ILIKE); roles batched. Hygiene = 0.

### Rollback
File/feature flag; preserve accounts/audits; never restore revoked sessions.

### Blocks
24–26.

### Commit Boundary
Sales reps only. Step 24 remains unauthorized.

---

## 53. Step 24 — Leads and Sales Pipeline

### Objective
Leads aggregate, stage progression, ownership, advisory Plan-fit; no marketing automation; no Trials.

### Status
**Accepted / Complete.** Narrow C11–C24 / F13–F30 / H19–H50 / UI01–UI55 / P01–P12 / query-index closure passed. Contract: `docs/LEADS_AND_SALES_PIPELINE.md`.

### Prerequisites
23.

### Tests
V/R/PF/WON + C01–C24 + F01–F30 + H01–H50 + P01–P12 + query/index + UI01–UI55; clean/upgrade validators.

### Final Case C
Attempt **1** INVALIDATED (product UI + Cache-Control during closure). Attempt **2** authoritative: freeze `2026-08-11T10:29:23.970Z`; duration ~2744s; `failures=0 retries=0 dbRestarts=0 commandReruns=0 productEdits=0 databaseSwitches=0 exitCode=0`. Step 24 DB **174/174**. Hygiene = 0.

### Rollback
Feature flag / additive schema only.

### Blocks
25.

### Commit Boundary
Leads/pipeline only. Steps 25–29 remain Not Authorized.

---

## 54. Step 25 — Trial Creation and Customer Conversion

### Objective
Governed trials → paid subscription; attribution preserved; uses Step 16 subscription path.

### Status
**Accepted / Complete.** Narrow matrix evidence closure passed. Case C Attempt 3 authoritative on frozen `booking_test` (freeze `2026-08-11T19:27:21.900Z`; ~50.4 min; all counters 0). Attempt 2 invalidated (I09 durable conflict enforcement product fix). Contract: `docs/TRIAL_CREATION_AND_CUSTOMER_CONVERSION.md`. Steps 26–29 Not Authorized.

### Prerequisites
24, 16.

### Evidence
Trial governance aggregate + provisioning/lifecycle/EER handoff; expiry job; conversion + entitlement comparison; matrices E/X/PV/RTE/U25/A/I/C/F/H/P/UI including explicit A11–A26, I09–I16, C06–C24, F09–F30, H25–H50, P01–P12, RTE01–RTE08.

### Tests
Step 25 DB **272/272**; UI **62/62**; clean/upgrade validators; Case C one-pass.

### Final Case C
Attempt **1** INVALIDATED (ops/sales-rep validators forbade Step 25 tables). Attempt **2** INVALIDATED (I09 product fix during narrow closure). Attempt **3**: freeze `2026-08-11T19:27:21.900Z`; duration ~3027s; `failures=0 retries=0 dbRestarts=0 commandReruns=0 productEdits=0 databaseSwitches=0 exitCode=0`. Hygiene = 0.

### Rollback
Disable routes/UI; pause expiry job; compensating cancel trial. No destructive DB reset.

### Blocks
26.

### Commit Boundary
Trials/conversion only. Steps 26–29 remain Not Authorized.

---

## 55. Step 26 — Sales Productivity and Commission Snapshot

### Status
**Accepted / Complete.** Case C Attempt 1 remains authoritative on frozen `booking_test` (freeze `2026-08-11T21:07:48.684Z`; ~53.2 min; all counters 0). Narrow F02–F09 / F19 / F20 / H21 closure passed with independent Model B selectors; no happy-path product behavior change; no Case C rerun. Contract: `docs/SALES_PRODUCTIVITY_AND_COMMISSION_SNAPSHOT.md`. Steps 27–29 Not Authorized. Commission snapshots are review records, not payroll; paid status is administrative metadata only.

### Prerequisites
25.

### Non-Goals
Advanced commission engines; payroll; payment ledgers; Step 27 notifications.

### Evidence
Metric dictionary M01–M20; period T01–T12; Plan/Add-on PA01–PA08; visibility V01–V16; reconciliation REC01–REC12; snapshot CS01–CS16; export EX01–EX12; audit/idempotency/concurrency/failure/HTTP/privacy/UI matrices; Case C one-pass.

### Tests
Step 26 DB **267/267**; UI **60/60**; clean/upgrade validators; Case C one-pass.

### Final Case C
Attempt **1**: freeze `2026-08-11T21:07:48.684Z`; duration ~3195s; `failures=0 retries=0 dbRestarts=0 commandReruns=0 productEdits=0 databaseSwitches=0 exitCode=0`. Hygiene = 0.

### Rollback
Disable snapshot routes/job; no destructive DB reset.

### Blocks
27.

### Commit Boundary
Snapshots/productivity reporting only. Steps 27–29 remain Not Authorized.

---

## 56. Step 27 — Notifications and Templates

### Status
**Accepted / Complete.** Case C Attempt 3 authoritative on frozen `booking_test` (freeze `2026-08-12T17:30:45.723Z`; SHA `bd7f35a`; ~53.6 min; all counters 0). Attempt 2 invalidated (C07 send-time Trial revalidation + Strategy B ambiguous delivery). Contract: `docs/NOTIFICATIONS_AND_TEMPLATES.md`. Steps 28–29 Not Authorized.

### Objective
Reuse notification infrastructure for platform/sales/commercial events; redaction; no PHI; advance Add-on/Override warnings; effective-limit alerts via EER/U01.

### Prerequisites
Steps 01–26 + U01; notification center / Phase 41d engine.

### Tests
N01–N24, TW01–TW16, L01–L16, I/R/T/A/F/C/H/P/UI matrices; Case C one-pass; narrow evidence closure matrices.

### Evidence
Step 27 DB **321/321**; UI **60/60**; clean/upgrade validators; `realExternalDeliveriesDuringTests=0`; prohibited evidence = 0; Catalog `68/136/68/13`; C07 stale-warning fix + Strategy B ambiguous PASS; Case C Attempt 3 PASS.

### Final Case C
Attempt **1** INVALIDATED (sentinel `notifications_tenantId_fkey` residue).
Attempt **2** INVALIDATED (final product correction: C07 send-time Trial revalidation + Strategy B durable `ambiguous`; prior freeze `2026-08-12T06:41:22.728Z` historical only). Re-run required.

### Rollback
Disable adapters/scheduler/UI; preserve intents/attempts/prefs/audit.

### Blocks
28.

### Commit Boundary
Notifications only. Steps 28–29 remain Not Authorized.

---

## 57. Step 28 — Security Hardening and Compliance Review

### Objective
Close Critical/High gaps; full S-01–S-08; security regression suite; CORS/realtime review (G-CORS-01); MFA encryption verification if open.

### Prerequisites
All feature steps intended for R47 MVP.

### In Scope
Fixes for residual gaps; ST-01–40; Phase 28; RLS; portal non-regression; no feature expansion.

### Non-Goals
New sales/catalog features.

### Tests
Full security regression; mandatory scenarios.

### Rollback
Per-issue.

### Gates
G-08.

### Blocks
29.

### Commit Boundary
Security-only commits; split by gap ID.

---

## 58. Step 29 — Release Readiness and Operational Handover

### Objective
CI for super-admin; deploy notes; rollback drills; limitations; deferred backlog; G-09.

### Prerequisites
28 green.

### In Scope
CI/CD updates; runbooks; access review; smoke; D-17 topology documentation.

### Non-Goals
New product scope.

### Tests
Ops smoke; rollback verification ST-36 equivalent.

### Rollback
Deployment rollback.

### Gates
G-09.

### Blocks
Production.

### Blocked By
28.

### Commit Boundary
Ops/CI/docs; no feature code.

---

## 59. Acceptance Criteria Evidence

| Criterion | Result |
|-----------|--------|
| No production code/schema/deps/scaffold | **Passed** |
| `PHASE_47_EXECUTION_PLAN.md` complete | **Passed** |
| Steps 01–03 unchanged | **Passed** |
| Authoritative order declared; 05–29 documented with template fields | **Passed** |
| Catalog→Versions→Entitlements→Add-ons→Subs→Prov→Resolver order | **Passed** |
| Security before commercial writes | **Passed** |
| Domain/SoR/identity/RLS/bridge/vocab/features/plan-change documented | **Passed** |
| Additive migrations; backfill; cache plan | **Passed** |
| Security Critical/High → gates S-01–S-08 | **Passed** |
| Phase 28, RLS, lifecycle, portal non-regression | **Passed** |
| Cross-step scenarios; CI; rollback; commits; no unsafe parallel | **Passed** |
| Decision Register assigned; Risk Register; G-01–G-09; DoD | **Passed** |
| No Step 05 implemented; next = Step 05 | **Passed** |

---

## 60. Recommended Next Step

**Step 05 — Super Admin Application Scaffold**

Do **not** implement Step 05 until this execution plan is approved.

---

## Document Control

| Item | Value |
|------|--------|
| Created | 2026-07-21 |
| Prior file | None (new) |
| Rollback | Revert this file only |

*End of Phase 47 Execution Plan Freeze — no production implementation.*
