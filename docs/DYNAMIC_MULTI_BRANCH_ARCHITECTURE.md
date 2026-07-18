# Phase 36 — Dynamic Multi-Branch Enterprise Architecture

**Phase:** 36 (**Architecture APPROVED** · **Remediation CLOSED** · **36a CLOSED** · **36b CLOSED** · **36c CLOSED** — Phase 36 permanently closed)  
**Status:** **ARCHITECTURE ONLY** — no production code, tests, APIs, schema, or runtime changes in this phase  
**Prerequisite:** Phase 35 — Dynamic White Label (**permanently closed**, 2026-07-15)  
**Authoring panel:** CTO · Principal Enterprise SaaS · Healthcare ERP · Platform · Backend · Frontend · Security · DevOps  
**SSOT for:** Phase 36 implementation (36a, 36b, 36c), future Marketplace branch packs, franchise templates, Plugin SDK branch policy extensions, super-admin and patient-portal consumers

---

## 1. Executive Summary

Phase 36 defines the **Dynamic Multi-Branch Enterprise** architecture — the eighth registry consumer after navigation, routing, dashboard, search, reporting, analytics, and white label. It migrates branch **discoverability, configuration projection, and active-branch context** from scattered settings CRUD, ad hoc `branchId` query parameters, and partial dashboard selectors into a **registry-driven, layered Effective Branch View** — **without** changing licensing enforcement, RBAC, existing business APIs, or database schema in this architecture phase.

Multi-Branch follows the proven enterprise pattern from Phases 30–35:

```
Module Registry
  ↓
EffectiveModuleView (branch contributions)
  ↓
Effective Configuration (tenant defaults → branch overrides)
  ↓
STATIC_BRANCH_CATALOG filter (parity baseline)
  ↓
DynamicBranchProvider
  ↓
Existing Runtime (settings, scheduling, inventory, billing, reporting, analytics, white label)
```

### Purpose

Provide a permanent architecture for enterprise healthcare organizations operating **multiple branches under one tenant** — with inheritance, overrides, isolation, cross-branch operations, consolidated reporting, and future franchise expansion — without redesigning Phases 28–35.

### Scope

| In scope (architecture) | Out of scope (this phase) |
|-------------------------|---------------------------|
| Enterprise hierarchy model (Platform → Tenant → Organization → Branch → Department → User) | React components, providers, hooks (36b) |
| `EffectiveBranchView` read model design | Prisma schema migrations |
| `DynamicBranchProvider` responsibilities | Branch switching UI implementation |
| Canonical branch vocabulary in `@booking/module-registry` | Scheduling / inventory / reporting runtime rewrites |
| `STATIC_BRANCH_CATALOG` parity baseline spec | Playwright acceptance (36c) |
| Inheritance, overrides, fail-closed merge rules | API endpoint redesign |
| Security, performance, marketplace models | RLS implementation code |
| Migration roadmap 36a / 36b / 36c | Phase 37+ features |

### Business value

- **Enterprise operations:** Hospital groups, dental chains, and multi-site clinics manage branch identity, hours, financial rules, and inventory routing from one tenant.
- **Licensing coherence:** Branch limits and enterprise features remain in Phase 28 `LicensingEngineService`; registry publishes **what branch surfaces exist** and **how configuration inherits**.
- **Operational safety:** Fail-closed branch isolation; no cross-branch data leakage via client projection; independent rollback flag.
- **Franchise readiness:** Namespaced branch templates and policy packs via marketplace without schema redesign.

### Current state (evidence — source audit 2026-07-15)

| Layer | State | Source |
|-------|-------|--------|
| Branch storage | Basic CRUD model | Prisma `Branch` — name, address, city, phone, `isActive`, optional `regionId` |
| Organization profile | Logical layer on tenant | `Tenant.features.clinicProfile` — not a separate entity |
| User branch assignment | Primary branch on user | `User.branchId` |
| Multi-branch access | Partial | `UserBranchAccess`, `BranchAccessMode` (`SINGLE` \| `MULTI` \| `GLOBAL`) |
| Regional grouping | Implemented | `Region`, `UserRegionAccess` |
| Departments | Partial | `Department.branchId?` optional scope |
| Settings UI | Branch list CRUD | Settings → Branches |
| Dashboard branch selector | Partial | `dashboard-branch-scope.ts` — owner/GM/accountant only |
| Analytics branch filter | Query param | `branchId` on analytics APIs + UI filters |
| Reporting branch filter | Execution layer | Report run filters — not registry-driven |
| White label branch layer | Reserved | Phase 35 §7 — branch overrides architecture reserved |
| Registry `branch` contributions | **24** surfaces across 7 modules | Generated via `buildBranchContributionsForModule()` |
| Dynamic branch provider | **IMPLEMENTED (36b)** | `DynamicBranchProvider` + `useBranch()` / `useOptionalBranch()` |
| Static branch catalog | **Parity baseline** | `STATIC_BRANCH_CATALOG` — **not runtime authority** |

**Gap vs enterprise multi-branch:** Branch metadata is **storage-centric and fragmented**. No unified EffectiveBranchView, no registry-driven branch policy catalog, no provider for active-branch context, no canonical inheritance merge, and no cross-consumer branch configuration projection.

---

## 2. Architecture Goals

| Goal | Success criterion |
|------|-------------------|
| Registry-driven branch configuration | Branch surfaces, policy hooks, and scope metadata derive from EffectiveModuleView |
| Zero enforcement change (36 arch) | `LicensingEngineService`, branch quota checks, RBAC guards unchanged in architecture phase |
| Catalog parity | Every builtin branch configuration surface declared once in manifests + static catalog |
| Layered inheritance | Platform → tenant → organization profile → branch → department (future) — narrow-only overrides |
| Fail-closed isolation | Unknown branch, unauthorized branch, or invalid override → reject or fall back to authorized primary branch — never widen |
| Independent rollback | `VITE_USE_STATIC_BRANCH_ONLY=true` restores pre-Phase-36 behavior instantly |
| Cross-consumer consistency | Dashboard, analytics, reporting, scheduling, inventory, billing, white label read **one** branch context projection |
| Franchise-ready | Branch templates, policy packs, and scheduling/financial/inventory packs via `branch` extension contributions |

---

## 3. Design Principles

1. **Server remains authoritative** — Branch access, quotas, and data scoping enforced at API edge; client provider projects UX context only.
2. **Catalog-as-baseline** — `STATIC_BRANCH_CATALOG` is rollback truth and parity reference (same as Phases 30–35).
3. **Configuration migration only (36b)** — Move discoverability and resolved branch configuration to provider; existing modules consume context — no business logic rewrite.
4. **No second systems** — Multi-branch must not become a parallel licensing engine, RBAC matrix, or settings store.
5. **Stable IDs** — `branchSurfaceId`, `policyPackId`, `templateId`, and `extensionId` are permanent.
6. **Separation of metadata vs values** — Registry publishes **what branch config surfaces exist**; settings/branch APIs publish **values**; provider merges.
7. **Fail closed** — Integrity validation blocks duplicate surface IDs, cross-tenant branch references, and unauthorized cross-branch scopes at bootstrap/build time.
8. **Branch is not a LicensedModuleId** — Branch extensions attach to owning modules (`settings`, `scheduling`, `inventory`, etc.) like white label attaches to `settings`.

---

## 4. Registry Integration

### 4.1 Consumer boundary

```
ModuleRegistryProvider (existing)
  └── EffectiveModuleView[]
        └── extensions[] where kind === 'branch'
              └── payload: BranchContributionView (client projection)
```

**Reads:** `useModuleRegistry().modules` for branch surface discoverability and module ownership.  
**Also reads (36b):** tenant + branch settings from existing settings/bootstrap APIs — **never mutates**.  
**Never reads:** raw manifests, `LicensingEngineService`, permission matrix JSON, or cross-tenant branch lists.

### 4.2 Multi-Branch is not a LicensedModuleId

Per Phase 29 pattern (white label precedent): Branch extensions are owned by **existing modules** — primarily `settings`, plus `scheduling`, `inventory`, `billing`, `reporting`, `analytics`, `workflow` where branch-scoped configuration applies.

Licensing uses existing features and quotas:

| Gate | Source (frozen Phase 28) | Registry use |
|------|--------------------------|--------------|
| Branch count limit | Plan quota + `LicensingEngineService` | Surfaces hidden when quota exceeded; no client bypass |
| Enterprise multi-branch | Enterprise plan + branch quota | Cross-branch reporting/analytics surfaces discoverable |
| Module licensed | EffectiveModuleView | Hide branch surfaces for unlicensed modules |
| RBAC | Permission matrix | `resourceId` + `adminAction` on each contribution |

### 4.3 New extension kind: `branch`

| Field | Purpose |
|-------|---------|
| `extensionId` | `{moduleId}/branch/{localId}` |
| `surfaceId` | Stable catalog key, e.g. `settings-branch-identity` |
| `categoryId` | Config category (identity, address, clinical, …) |
| `branchScoped` | Whether values resolve per active branch |
| `crossBranchAllowed` | Whether UI may aggregate across branches (reporting/analytics) |
| `inheritanceMode` | `tenant-default` \| `branch-override` \| `branch-only` |
| `adminResourceId` | RBAC resource, e.g. `api.settings` |
| `adminAction` | `view` \| `update` \| `manage` |
| `settingsPath` | Deep link into settings or module admin |
| `requiredFeature` | Optional `LicensedFeatureId` |

**Built-in contribution count:** **24** surfaces across **8** categories (finalized in 36a parity validation).

### 4.4 Integration with frozen phases

| Phase | Relationship |
|-------|--------------|
| 28 Licensing | Unchanged — branch quotas and plan gates |
| 29 Registry | Extends extension kind catalog with `branch`; EffectiveModuleView projection |
| 30 Routing | Branch admin routes discoverable via branch contributions on `settings` |
| 31 Dashboard | Widget metadata may declare `branchScoped: true` — provider supplies active branch |
| 32 Search | Entity metadata may include branch filter hints — unchanged execution |
| 33 Reporting | `branchScoped`, cross-branch report templates — catalog metadata only |
| 34 Analytics | `branchScoped`, `branchCompare` — catalog metadata only |
| 35 White Label | Branch layer in inheritance chain — provider coordination (§10) |

---

## 5. Enterprise Hierarchy Model

### 5.1 Canonical hierarchy

```
Platform
  ↓
Tenant                    (commercial + legal boundary; Phase 28 license scope)
  ↓
Organization              (logical enterprise profile — today: Tenant + clinicProfile)
  ↓
Region                    (optional geographic grouping — existing Region model)
  ↓
Branch                    (operating site / clinic location)
  ↓
Department                (future-primary org unit within branch — existing model, optional branchId)
  ↓
User                      (primary branch + access grants)
```

### 5.2 Entity definitions

| Entity | Authority | Scope | Notes |
|--------|-----------|-------|-------|
| **Platform** | Booking System | Global | Default policies, design tokens, catalog generation |
| **Tenant** | `Tenant` row | Subscription boundary | `Tenant.features`, timezone, locale, licensing |
| **Organization** | Logical profile | One per tenant (today) | `Tenant.name` + `features.clinicProfile`; future: `Organization` entity for franchise groups **without breaking tenantId as license key** |
| **Region** | `Region` row | Tenant-scoped | Groups branches; `UserRegionAccess` for regional managers |
| **Branch** | `Branch` row | Tenant-scoped | Operating unit; `Branch.features` JSON proposed in 36a |
| **Department** | `Department` row | Tenant or branch | Phase 37+ primary consumer — see §23 Future Department Layer; **excluded from Phase 36 implementation** |
| **User** | `User` row | Tenant-scoped | `branchId` primary; `UserBranchAccess`; `BranchAccessMode` |

### 5.3 Franchise model (future — no schema required now)

Franchise operators are modeled as **tenants with organization templates** sourced from marketplace **branch template packs**. A master franchise tenant publishes read-only template manifests; child tenants install templates as initial branch defaults. **License boundary remains tenant** — franchise is a deployment pattern, not a license bypass.

### 5.4 Inheritance direction (narrow-only)

```
Platform defaults
  → Tenant defaults (organization-wide policy)
    → Organization profile overrides (display/legal identity)
      → Region policy hints (optional aggregation rules)
        → Branch overrides (site-specific)
          → Department overrides (future)
            → User context (primary branch + selected branch — not configuration storage)
```

**Rule:** Lower layers may override upper layers only where `inheritanceMode` allows. **Never widen** licensing, RBAC, or branch access beyond server grants.

---

## 6. EffectiveBranchView Design

### 6.1 Definition

`EffectiveBranchView` is the **resolved, read-only branch configuration and context** for a specific **identity context** (tenant + user + active branch + locale). It is not stored as source of truth — it is computed from registry contributions, tenant settings, branch records, and access grants.

```typescript
interface EffectiveBranchView {
  // ── Identity context ──
  tenantId: string;
  organizationProfileId: string | null;   // logical; tenantId until Organization entity exists
  regionId: string | null;                // active region filter if applicable
  branchId: string | null;                // active branch context (selected or resolved)
  userId: string;
  locale: string;

  // ── Access projection ──
  branchAccessMode: 'single' | 'multi' | 'global';
  accessibleBranchIds: string[];          // server-computed from UserBranchAccess + role
  primaryBranchId: string | null;         // User.branchId
  canSelectBranch: boolean;               // UX gate (mirrors dashboard-branch-scope rules)
  canViewCrossBranch: boolean;            // enterprise roles + licensing
  canManageBranches: boolean;             // RBAC + licensing

  // ── Branch catalog ──
  branches: BranchSummarySnapshot[];      // visible branches for selector
  activeBranch: BranchDetailSnapshot | null;

  // ── Resolved configuration (merged) ──
  configuration: BranchConfigurationSnapshot;

  // ── Cross-consumer flags ──
  capabilities: BranchCapabilityFlags;    // aggregate from branch extensions

  // ── Metadata ──
  source: BranchResolutionSource;
  catalogGeneration: number | null;
  settingsVersion: string | null;         // hash of tenant + active branch config
  resolvedAt: string;
}

type BranchResolutionSource =
  | 'registry'           // registry + settings merge
  | 'static'             // rollback flag
  | 'static-fallback'    // registry error
  | 'restricted';        // fail-closed single-branch minimum
```

### 6.2 BranchConfigurationSnapshot (categories)

```typescript
interface BranchConfigurationSnapshot {
  identity: BranchIdentityConfig;
  address: BranchAddressConfig;
  clinical: BranchClinicalConfig;
  financial: BranchFinancialConfig;
  inventory: BranchInventoryConfig;
  reporting: BranchReportingConfig;
  analytics: BranchAnalyticsConfig;
  whiteLabel: BranchWhiteLabelConfig;     // projection layer for Phase 35 coordination
}
```

Each sub-object contains **resolved values** after inheritance merge plus **`overriddenFields: string[]`** for admin UI indicators.

### 6.3 Merge rules

| Rule | Behavior |
|------|----------|
| **M1 Narrow-only** | Branch override cannot enable features tenant lacks |
| **M2 Fail-closed field** | Invalid override field skipped; previous layer retained |
| **M3 Access gate** | If `branchId` not in `accessibleBranchIds`, reject selection; use `primaryBranchId` |
| **M4 Inactive branch** | `isActive=false` branches excluded from selector; existing data read-only per API policy |
| **M5 Quota** | Branch count surfaces hidden when at quota; create blocked server-side |
| **M6 Conflict** | Same field set at branch and tenant — branch wins if `inheritanceMode=branch-override` |
| **M7 Cross-branch** | Aggregation only when `crossBranchAllowed` on contribution **and** user has cross-branch capability |
| **M8 White label** | Branch white-label fields merge into Phase 35 layer 5 — never bypass `customBranding` / `whiteLabel` features |

### 6.4 Conflict resolution

1. Validate override against JSON schema for category.  
2. If validation fails → skip override, emit diagnostic (dev/test only).  
3. If RBAC denies surface → exclude from `accessibleSurfaces`, not from read-only projection where API already exposes data.  
4. If two marketplace packs conflict on same token/key → higher `precedence` wins; unsigned pack rejected.

---

## 7. Branch Configuration Model

### 7.1 Identity

| Field | Tenant default | Branch override | Inheritance |
|-------|----------------|-----------------|-------------|
| Legal / display name | `Tenant.name`, `clinicProfile.displayName` | `Branch.name`, `Branch.nameAr` | branch-override |
| Branch code | — | `Branch.code` (proposed) | branch-only |
| External license ID | `clinicProfile.licenseNumber?` | branch license ref | branch-override |
| Tax identifiers | `clinicProfile.taxId?` | branch tax ref | branch-override |
| Status | — | `Branch.isActive` | branch-only |

**Registry surfaces (proposed):** `settings-branch-identity`, `settings-branch-list`, `settings-branch-create`.

### 7.2 Address

| Field | Tenant default | Branch override |
|-------|----------------|-----------------|
| Country | `clinicProfile.country?` | branch country |
| City | — | `Branch.city` |
| Street address | — | `Branch.address` |
| Timezone | `Tenant.timezone` | branch timezone (proposed) |
| GPS coordinates | — | branch lat/lng (proposed) |
| Phone / email | `clinicProfile.supportPhone?` | `Branch.phone`, branch email |

**Registry surfaces:** `settings-branch-address`, `settings-branch-contact`.

### 7.3 Clinical

| Field | Tenant default | Branch override |
|-------|----------------|-----------------|
| Working hours | tenant clinical defaults | `BranchOperatingHours` per branch |
| Appointment defaults | scheduling tenant prefs | branch duration, buffer, online booking |
| Queue settings | tenant queue policy | branch queue priority, display |
| Resource pools | tenant resource templates | branch scheduling resources |
| Holidays | tenant calendar | branch holiday overrides |

**Registry surfaces:** `scheduling-branch-hours`, `scheduling-branch-defaults`, `queue-branch-settings`.

### 7.4 Financial

| Field | Tenant default | Branch override |
|-------|----------------|-----------------|
| Currency | `clinicProfile.defaultCurrency` | branch currency (if multi-currency licensed) |
| Tax rules | tenant tax profile | branch tax rate overrides |
| Invoice numbering | `TenantBillingSequence` | branch sequence prefix (proposed) |
| Fiscal year start | tenant fiscal settings | branch fiscal override |

**Registry surfaces:** `billing-branch-sequences`, `billing-branch-tax`, `settings-branch-financial`.

### 7.5 Inventory

| Field | Tenant default | Branch override |
|-------|----------------|-----------------|
| Warehouses | tenant default warehouse | branch warehouse mapping |
| Stock routing | tenant routing rules | branch receive/transfer routes |
| Transfer policies | tenant inter-branch policy | branch transfer approval |

**Registry surfaces:** `inventory-branch-warehouses`, `inventory-branch-transfers`.

### 7.6 Reporting

| Field | Tenant default | Branch override |
|-------|----------------|-----------------|
| Default branch filter | all / primary | active branch |
| Cross-branch reports | enterprise gated | consolidation templates |
| Branch-scoped templates | metadata `branchScoped: true` | filter defaults |

**Registry surfaces:** `reporting-branch-filter`, `reporting-cross-branch`.

### 7.7 Analytics

| Field | Tenant default | Branch override |
|-------|----------------|-----------------|
| Default branch filter | user primary | selected branch |
| Cross-branch dashboards | enterprise | `branchCompare` mode |
| Branch performance widgets | `branchScoped: true` | active branch context |

**Registry surfaces:** `analytics-branch-context`, `analytics-cross-branch` (aligns with Phase 34 §24).

### 7.8 White Label (Phase 35 interaction)

| Field | Tenant (Phase 35) | Branch override (Phase 36) |
|-------|-------------------|----------------------------|
| Logo | `Tenant.features.branding.logoStorageKey` | branch logo optional |
| Primary color | tenant primary | branch accent optional |
| Display name in shell | organization profile | `Branch.name` in branch context |
| Email sender name | tenant | branch name when branch-scoped comms |
| PDF header | tenant | branch address block |

**Coordination:** `DynamicBranchProvider` publishes `BranchWhiteLabelConfig` slice; `DynamicWhiteLabelProvider` consumes it as **inheritance layer 5** (Phase 35 §7.2). Providers **do not** duplicate merge logic — white label provider reads branch slice from branch snapshot or shared merge service (36b design choice: shared `branch-white-label-projection.ts` helper, single merge authority in white label resolver).

**Which values inherit vs override:**

| Always inherit from tenant | May override at branch |
|----------------------------|------------------------|
| Custom domain | Logo, accent color |
| Enterprise theme packs | Branch display name |
| Platform locked tokens | Branch address in PDF footer |
| Licensing-gated surfaces | Branch-specific email sender (enterprise) |

---

## 8. DynamicBranchProvider Architecture

### 8.1 Responsibilities (design only — no implementation)

| Responsibility | Detail |
|----------------|--------|
| Bootstrap | After `ModuleRegistryProvider` ready, build branch snapshot |
| Active branch resolution | See §19 Active Branch Authority — session preference → primary → fallback |
| Branch list projection | Filter branches by access + active status |
| Configuration merge | Tenant + branch JSON → `BranchConfigurationSnapshot` |
| Capability flags | Aggregate `branch` extension payloads |
| Cache | Identity-scoped snapshot read/write |
| Refresh | On branch switch — see §20 Branch Switching Transaction; coordinated refresh §21 |
| Rollback | `VITE_USE_STATIC_BRANCH_ONLY` → `STATIC_BRANCH_CATALOG` + legacy selectors |
| Coordination | Notify white label / analytics / dashboard consumers via snapshot version bump |

### 8.2 Public API (proposed)

```typescript
interface DynamicBranchContextValue {
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  snapshot: EffectiveBranchView | null;
  activeBranchId: string | null;
  setActiveBranchId: (branchId: string | null) => Promise<void>;
  refresh: () => Promise<void>;
  capabilities: BranchCapabilityFlags;
}

function useBranch(): DynamicBranchContextValue;
function useOptionalBranch(): DynamicBranchContextValue | null;
```

### 8.3 Mounting strategy

Mirror Phase 35:

| Mode | Mount point |
|------|-------------|
| Registry mode | `RegistryRouteHost` — below `ModuleRegistryProvider`, alongside `DynamicWhiteLabelProvider` |
| Guest / static | `AppProviders` — optional no-op provider with static catalog |

**Ordering:** `ModuleRegistryProvider` → `DynamicBranchProvider` → `DynamicWhiteLabelProvider` → other dynamic providers. Branch context must be available before white label merge.

### 8.4 Static rollback

| Flag | Behavior |
|------|----------|
| `VITE_USE_STATIC_BRANCH_ONLY=true` | Skip registry branch extensions; use `STATIC_BRANCH_CATALOG` + `dashboard-branch-scope.ts` + existing settings CRUD paths |

**Playwright rollback port (proposed):** **5179** — follows 5173 registry, 5174–5178 phase rollbacks.

---

## 9. Configuration Resolution Flow

```
EffectiveModuleView[]
  └── filter extensions where kind === 'branch'
        └── apply STATIC_BRANCH_CATALOG parity filter
              └── join tenant settings read model
                    └── join branch records (accessible only)
                          └── apply inheritance merge (§6.3)
                                └── build EffectiveBranchView
                                      └── DynamicBranchProvider context
                                            └── Existing runtime consumers
```

### 9.1 BranchSnapshot (intermediate)

```typescript
interface BranchSnapshot {
  view: EffectiveBranchView;
  registryMode: boolean;
  staticCatalogHash: string;
  entitlementVersion: string | null;
}
```

Built by `branch-snapshot-builder.ts` (36b) — architecture names only.

### 9.2 Server-side mirror (future — not Phase 36 arch scope)

API handlers continue accepting `branchId` query params. Optional future **`BranchResolverService`** mirrors client merge for PDF/report headers — specified here as contract only; **no implementation in 36 arch**.

---

## 10. Cache Strategy

> **Versioning detail:** See §22 Branch Snapshot Versioning for `branchConfigurationVersion`, `branchSnapshotVersion`, `catalogGeneration`, `settingsGeneration`, and `cacheVersion` participation in keys and invalidation.

### 10.1 Storage

| Store | Key pattern | Contents |
|-------|-------------|----------|
| Session | `booking.branch.snapshot` | Serialized `BranchSnapshot` |
| Session (selection) | `booking.branch.activeBranchId` | Last selected branch UUID |
| Memory | Provider ref | Current snapshot + inflight refresh guard |

### 10.2 Cache key identity

```
tenantId + userId + rolesHash + activeBranchId + catalogGeneration + entitlementVersion + settingsVersion
```

Aligned with module registry cache pattern (Phase 29b).

### 10.3 Invalidation triggers

| Event | Action |
|-------|--------|
| Login | Rebuild; restore `activeBranchId` if still accessible |
| Logout | Clear branch cache keys |
| Branch switch | Rebuild snapshot; bump `settingsVersion` projection |
| Tenant switch | Clear all branch caches |
| Role switch | Clear (rolesHash change) |
| Registry refresh | Rebuild if catalogGeneration changes |
| Settings save (branch/tenant) | `refresh()` — invalidate settingsVersion |
| Branch CRUD | `refresh()` — branch list changed |

### 10.4 Fail-closed cache behavior

| Condition | Behavior |
|-----------|----------|
| Cache hit, branch no longer accessible | Discard cache; rebuild |
| Corrupt cache JSON | Clear; rebuild |
| Registry unavailable | Static catalog fallback; primary branch only |
| No accessible branches | `restricted` source; empty selector; API calls use server enforcement |

---

## 11. Security Model

### 11.1 Branch isolation

| Layer | Enforcement |
|-------|-------------|
| API | Authoritative — handlers validate `branchId` against user's grants |
| Registry bootstrap | Server computes `userAccessible` on branch-related extensions |
| Provider | UX only — never widens access |
| Cache | Scoped to authenticated identity |

### 11.2 Permission model (existing — frozen)

| Mechanism | Purpose |
|-----------|---------|
| `User.branchId` | Primary branch assignment |
| `UserBranchAccess` | Explicit multi-branch grants |
| `BranchAccessMode` | SINGLE / MULTI / GLOBAL |
| `UserRegionAccess` | Regional aggregation |
| `branch_manager` role | Branch-scoped operations |
| `api.settings` | Branch CRUD permissions |

### 11.3 Cross-branch permissions

| Capability | Typical roles | License |
|------------|---------------|---------|
| View own branch | All clinical staff | Any |
| Select branch (selector) | owner, general_manager, accountant | business+ |
| Cross-branch reporting | owner, GM, accountant | enterprise |
| Cross-branch analytics | owner, GM, accountant | enterprise |
| Manage branch config | owner, GM | enterprise + RBAC |
| Global branch access | owner | enterprise |

**Fail-closed:** Client requesting cross-branch view without capability → provider sets `canViewCrossBranch=false`; APIs return 403.

### 11.4 Auditing

Branch configuration changes audit via existing `AuditEntry` pipeline — architecture requires audit events for:

- Branch created / updated / archived  
- Active branch switched (session)  
- Cross-branch report/export executed  

Implementation in 36b+ — event names specified here only.

---

## 12. Performance Strategy

### 12.1 Bootstrap

- Branch snapshot builds **after** module registry bootstrap (depends on EffectiveModuleView).  
- Branch list size typically &lt; 100 — full list in snapshot acceptable.  
- No second registry HTTP call — reuse cached EffectiveModuleView modules array.

### 12.2 Branch switching

- Target: &lt; 100ms client-side snapshot rebuild (merge only).  
- Persist selection to sessionStorage synchronously.  
- Debounce rapid selector changes (300ms).  
- Do not re-fetch registry bootstrap on branch switch.

### 12.3 Lazy loading

- Branch **configuration admin pages** remain lazy routes (Phase 30 pattern).  
- Provider snapshot is eager once registry ready — small payload.

### 12.4 Preload

- On login shell ready, prefetch branch list via existing settings/branches API if not in bootstrap.  
- Preload active branch operating hours only when scheduling module navigated.

---

## 13. Marketplace Model

### 13.1 Pack types

| Pack type | Contributes | Example |
|-----------|-------------|---------|
| **Branch template** | Default branch config for new sites | `acme.template.dental-clinic` |
| **Branch policy** | Override rules, approval chains | inter-branch transfer policy |
| **Scheduling pack** | Hours templates, resource bundles | orthodontic chair bundle |
| **Financial pack** | Tax/invoice presets | GCC VAT branch pack |
| **Inventory pack** | Warehouse layout, par levels | pharmacy cold-chain template |

### 13.2 Manifest integration

Marketplace manifests declare additional `branch` extension contributions with:

- `providerKey` — namespaced publisher  
- `integrityRequired: true`  
- `templateId` / `policyPackId`  
- `applicableModuleIds[]`

### 13.3 Install flow (design)

```
Marketplace install
  → validate signature
    → merge into tenant module store (future)
      → branch templates appear in "Create branch from template"
        → instantiated as Branch row + Branch.features defaults
```

No runtime in Phase 36 architecture.

---

## 14. Static Catalog & Validation

### 14.1 STATIC_BRANCH_CATALOG

Location (36a): `apps/clinic-dashboard/src/features/dynamic-branch/lib/static-branch-catalog.ts`  
Authority guard: `packages/module-registry/src/branch/static-branch-catalog-authority.ts`

| Property | Value |
|----------|-------|
| `STATIC_BRANCH_CATALOG_IS_RUNTIME_AUTHORITY` | **`false`** (exported const — never runtime authority) |
| Purpose | **Parity baseline only** — same contract as Reporting, Analytics, and White Label |
| Runtime authority (Phase 36b+) | **`EffectiveBranchView`** computed by `DynamicBranchProvider` — not the static catalog |
| Entry count | **24** builtin surfaces |
| Generation | Mapped from `CANONICAL_BRANCH_SURFACES` — never handwritten |

**Rules (mirror Phases 33–35):**

1. `STATIC_BRANCH_CATALOG` exists **only** for parity tests, rollback reference, and Phase 36b provider pipeline allowlist.
2. UI, APIs, and existing branch CRUD **must not** read the static catalog at runtime in Phase 36a.
3. Discoverability in registry mode derives from `EffectiveModuleView` branch extensions after 36b — not direct catalog imports.
4. `isStaticBranchCatalogRuntimeAuthority()` always returns `false`.

### 14.2 Validation (36a)

| Validator | Purpose |
|-----------|---------|
| `validateCanonicalBranchVocabulary()` | Category IDs, surface IDs, uniqueness, capability + ownership contracts |
| `validateBranchCapabilityContract()` | Aggregate capability vocabulary supports 36b derivation |
| `validateBranchSurfaceOwnershipContract()` | Every surface declares owning module, featureId, category, inheritance, crossBranch |
| `validateBuiltinBranchIntegrity()` | Manifest ↔ canonical parity; global uniqueness |
| `validateStaticBranchCatalogParity()` | Static catalog ↔ canonical field-by-field |
| `validateBranchLayerParity()` | End-to-end: vocabulary → manifest → static catalog |

### 14.3 Fail-closed startup

Duplicate `surfaceId`, orphan contribution, or missing canonical entry → **build/test failure** in 36a (not silent runtime widen).

---

## 15. Cross-Consumer Integration Summary

| Consumer | Phase 36 integration |
|----------|---------------------|
| **Settings** | Branch admin surfaces from registry; CRUD APIs unchanged |
| **Dashboard** | `useBranch()` replaces ad hoc branch scope helpers |
| **Analytics** | `activeBranchId` from provider; filter defaults from snapshot |
| **Reporting** | Cross-branch flags from capabilities |
| **Scheduling** | Branch hours from `configuration.clinical` |
| **Inventory** | Warehouse routing from `configuration.inventory` |
| **Billing** | Sequences/tax from `configuration.financial` |
| **White Label** | Branch layer fed into EffectiveWhiteLabelView |
| **Workflow** | Branch condition evaluation uses active branch context |

**No consumer reimplements merge or access checks.**

---

## 16. Migration Roadmap

### Phase 36a — Foundation — **CLOSED** (2026-07-15)

**Goal:** Canonical vocabulary, manifest generation, static catalog, fail-closed validation — **zero runtime changes**.

| Deliverable | Location | Status |
|-------------|----------|--------|
| `packages/module-registry/src/branch/*` | Canonical categories, surfaces, builders | **IMPLEMENTED** |
| `buildBranchContributionsForModule()` | Extension builder | **IMPLEMENTED** |
| `STATIC_BRANCH_CATALOG` | clinic-dashboard — not consumed at runtime | **IMPLEMENTED** |
| Bootstrap validation | `validateBuiltinBranchIntegrity()` | **IMPLEMENTED** |
| Parity tests | module-registry + clinic-dashboard foundation specs | **IMPLEMENTED** |

**Exit criteria:** Parity tests green; **no UI/API/schema changes** — **PASS**.

### Phase 36b — Provider & Integration — **CLOSED** (2026-07-15; final remediation closed same day)

**Goal:** Registry-driven branch context and configuration projection; static rollback; BranchContextRefreshContract.

| Deliverable | Location | Status |
|-------------|----------|--------|
| `DynamicBranchProvider` + hooks | `features/dynamic-branch/context/` | **IMPLEMENTED** |
| Resolver, merge, snapshot builder, cache | `features/dynamic-branch/lib/` | **IMPLEMENTED** |
| `BranchContextRefreshContract` runtime | `branch-context-refresh-contract.ts` + `branch-context-bus.ts` | **IMPLEMENTED** (final remediation) |
| Consumer migration via `useBranch()` / `useOptionalBranch()` | Dashboard, Search, Reporting, Analytics, WL, Routing, Nav | **IMPLEMENTED** (final remediation) |
| Snapshot version sync + fail-closed rollback | §20–§22 runtime | **IMPLEMENTED** (final remediation) |
| `clearBranchCache()` in registry cache clear | `clear-registry-caches.ts` | **IMPLEMENTED** |
| Wire provider in `AppProviders` + `RegistryRouteHost` | Order: Registry → Branch → WhiteLabel | **IMPLEMENTED** |
| Coordinate with `DynamicWhiteLabelProvider` | `branchId` + `branch-white-label-projection.ts` | **IMPLEMENTED** |
| Dashboard config source prefers provider | `useDashboardBranches` + DashboardPage | **IMPLEMENTED** |
| `VITE_USE_STATIC_BRANCH_ONLY` | `static-branch-flags.ts` | **IMPLEMENTED** |

**Exit criteria:** Unit tests green; configuration source migration only; existing API behavior unchanged — **PASS**.

### Phase 36c — Runtime Acceptance & Production Closure — **CLOSED** (2026-07-15)

**Goal:** Playwright acceptance; documentation closure.

| Deliverable | Location | Status |
|-------------|----------|--------|
| `e2e/dynamic-branch.spec.ts` | **43** scenarios | **IMPLEMENTED** — **43/43 Playwright passed** |
| `e2e/helpers/dynamic-branch.ts` | Helpers + runtime probe readers | **IMPLEMENTED** |
| Rollback port **5179** | `playwright.config.ts` (`VITE_USE_STATIC_BRANCH_ONLY=true`) | **VERIFIED** |
| SSOT documentation closure | docs/ | **UPDATED** |
| Phase 28–35 regression | prior dynamic suites unaffected by scope | **Frozen** |

**Exit criteria:** Playwright green; Phase 36 permanently closed — **PASS**.

---

## 17. Architecture Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Branch JSON schema drift | High | Medium | Canonical DTOs in 36a; schema validation |
| Cross-branch data leakage | Medium | Critical | API enforcement unchanged; provider fail-closed |
| White label double-merge | Medium | Medium | Single merge authority; branch slice handoff |
| Performance on branch switch | Low | Medium | Merge-only rebuild; no registry refetch |
| Franchise model scope creep | Medium | High | Tenant remains license boundary; templates only |
| RLS not implemented | High | High | Document API enforcement requirement; RLS Phase 37+ |
| Organization entity ambiguity | Medium | Low | Logical profile now; entity optional later |
| Marketplace unsigned packs | Low | High | `integrityRequired`; fail-closed install |

---

## 18. Technical Debt

| Item | Severity | Phase |
|------|----------|-------|
| `Branch.features` JSON informal | High | 36a — document canonical DTO |
| No branch code / timezone on Branch row | Medium | 36a vocabulary; optional migration in 36b |
| Dashboard branch selector partial | High | 36b provider |
| Analytics branchId ad hoc | Medium | 36b consume provider |
| No registry branch extensions | High | 36a — **closed** |
| Organization not a first-class entity | Low | Phase 37+ if franchise demands |
| Department overrides unused | Low | Phase 37+ |
| Server BranchResolver absent | Medium | Post-36b API mirror |
| RLS at database layer | High | Phase 37+ enterprise hardening |

**No consumer reimplements merge or access checks.**

> **Branch switch coordination:** See §20 Branch Switching Transaction and §21 Cross-Consumer Refresh Contract.

---

## 19. Active Branch Authority

This section defines the **authoritative source** of `activeBranch` (the branch context used by all dynamic consumers) and exactly **when** it may change.

### 19.1 Authority layers

| Layer | Authority | Scope | Role |
|-------|-----------|-------|------|
| **Server access grants** | `User.branchId`, `UserBranchAccess`, `BranchAccessMode`, RBAC | Security boundary | **Authoritative for data access** — APIs reject unauthorized `branchId` |
| **Session selection** | `sessionStorage` key `booking.branch.activeBranchId` | Client UX persistence | **Authoritative for client active branch** across page reloads within tenant session |
| **Computed projection** | `EffectiveBranchView.branchId` / `activeBranch` | Provider read model | **Derived** — never widens server grants; mirrors validated session selection |
| **Bootstrap hints** | Registry bootstrap may include accessible branch list | Discovery only | **Not authoritative** for selection — provider validates against grants |

**Rule:** Client `activeBranch` is owned by **`DynamicBranchProvider`**. No other provider, hook, or component may write session selection directly. Consumers **read** branch context via `useBranch()` or coordinated snapshot handoff (§21).

### 19.2 Branch selection ownership

| Actor | May change active branch? | Condition |
|-------|---------------------------|-----------|
| User (branch selector) | Yes | `canSelectBranch === true` and target ∈ `accessibleBranchIds` |
| System (login resolver) | Yes | See §19.3 — deterministic fallback chain |
| System (tenant switch) | Yes | Clears prior selection; re-resolves for new tenant |
| System (unavailable recovery) | Yes | When stored selection no longer accessible |
| DynamicWhiteLabelProvider | **No** | Reads branch slice only |
| Dashboard / Analytics / Reporting providers | **No** | React to branch change via refresh contract (§21) |
| API responses | **No** | APIs scope data; they do not set client active branch |

### 19.3 Resolution order (initial active branch)

On login or tenant entry, `DynamicBranchProvider` resolves `activeBranchId` in **strict order** (fail-closed at each step):

```
1. sessionStorage `booking.branch.activeBranchId`
     IF present AND ∈ accessibleBranchIds AND branch isActive
2. User.branchId (primary branch)
     IF present AND ∈ accessibleBranchIds AND branch isActive
3. Single accessible branch
     IF accessibleBranchIds.length === 1
4. null (tenant-wide / cross-branch mode)
     IF canViewCrossBranch AND branchAccessMode === 'global'
5. restricted fallback
     IF none above — activeBranchId = null; source = 'restricted'; APIs enforce per-request branch
```

**Never** select an inaccessible or inactive branch. **Never** infer branch from URL alone without validation.

### 19.4 When active branch changes

| Event | Active branch behavior | Session key |
|-------|------------------------|-------------|
| **User selects branch** | Set to validated `branchId` (or `null` for “all branches” when permitted) | Write `booking.branch.activeBranchId` |
| **Login** | Re-resolve §19.3; restore session value if still valid | Read/write session |
| **Logout** | Clear — no active branch | Remove `booking.branch.activeBranchId` + branch snapshot |
| **Tenant switch** | Clear; re-resolve for new tenant after new login/bootstrap | Clear all branch session keys |
| **Role switch** | Re-validate current selection against new `accessibleBranchIds`; fallback if invalid | Update if fallback applied |
| **Registry refresh** | **Do not change** selection solely because registry refreshed; re-validate accessibility only | Unchanged unless recovery §19.6 |
| **Branch CRUD (archived/inactive)** | If active branch archived → unavailable recovery §19.6 | Update on fallback |
| **Settings save (branch config)** | **Do not change** selection | Unchanged |
| **Page refresh (F5)** | Restore from session §19.3 step 1 | Read session |
| **Registry unavailable fallback** | Hold last valid selection if still accessible; else primary → single → restricted | Recovery only |

### 19.5 Login behavior

1. `ModuleRegistryProvider` completes bootstrap (unchanged Phase 29 flow).  
2. `DynamicBranchProvider` loads accessible branch list from bootstrap + settings read model.  
3. Resolve active branch §19.3.  
4. Persist validated selection to `booking.branch.activeBranchId`.  
5. Build initial `EffectiveBranchView` with `branchSnapshotVersion` (§22).  
6. Emit **`branch.context.ready`** (§21) to downstream providers — no provider reads branch context before this event.

### 19.6 Logout behavior

1. Clear `booking.branch.activeBranchId`, `booking.branch.snapshot`, and branch cache version keys (§22).  
2. Reset provider state to empty — `activeBranchId = null`, `snapshot = null`.  
3. Downstream providers clear branch-sensitive projections on **`branch.context.cleared`** (§21).  
4. **Do not** clear module registry cache (tenant-agnostic logout clears identity caches via existing `clearModuleRegistryCaches()`).

### 19.7 Tenant switch behavior

1. Clear **all** branch session keys and branch snapshot cache.  
2. Clear coordinated dynamic provider branch projections (§21 order).  
3. After new tenant login + registry bootstrap, run §19.5 login behavior for new tenant.  
4. **Never** carry forward `activeBranchId` across tenants — UUID collision safety and isolation.

### 19.8 Registry refresh behavior

| Registry refresh trigger | Active branch | Action |
|--------------------------|---------------|--------|
| Manual `registry.refresh()` | Unchanged | Re-validate selection ∈ `accessibleBranchIds`; rebuild branch snapshot if `catalogGeneration` changed |
| Entitlement change | Unchanged unless branch access revoked | If revoked → §19.6 unavailable recovery |
| Catalog generation bump | Unchanged | Rebuild `EffectiveBranchView`; bump `branchSnapshotVersion` |
| Registry HTTP failure | Unchanged if prior snapshot valid | Static fallback; hold last valid `activeBranchId` if still accessible |

**Registry refresh does not imply branch switch.** Full registry HTTP refetch on branch switch is **not required** (§20) unless `catalogGeneration` or `entitlementVersion` is stale.

### 19.9 Unavailable branch recovery

When stored or active `branchId` is **not** in `accessibleBranchIds` or branch `isActive === false`:

```
1. Clear invalid session selection
2. Apply resolution order §19.3 from step 2 (skip step 1)
3. If resolved → persist new selection; emit branch.context.changed
4. If restricted → activeBranchId = null; emit branch.context.restricted
5. Log audit event branch.active.recovered (36b implementation)
```

**Fail-closed:** Never silently keep an unauthorized branch as active context.

### 19.10 Fallback branch selection summary

| Priority | Fallback | Used when |
|----------|----------|-----------|
| 1 | Session selection | Valid + accessible + active |
| 2 | Primary (`User.branchId`) | Valid + accessible + active |
| 3 | Sole accessible branch | Exactly one grant |
| 4 | `null` (global/cross-branch) | `canViewCrossBranch` + global mode |
| 5 | `null` (restricted) | No valid branch — APIs enforce per request |

---

## 20. Branch Switching Transaction

This section defines the **complete branch switching workflow** — a single atomic client transaction owned by `DynamicBranchProvider.setActiveBranchId()`.

### 20.1 Transaction diagram

```
User selects branch
        ↓
Validate access                    [DynamicBranchProvider — owner]
        ↓
Persist selection                  [sessionStorage booking.branch.activeBranchId]
        ↓
Invalidate branch cache            [branch snapshot + version keys §22]
        ↓
Refresh registry projections       [re-read cached EffectiveModuleView — HTTP refetch ONLY if stale §19.8]
        ↓
Rebuild EffectiveBranchView        [DynamicBranchProvider]
        ↓
Refresh DynamicWhiteLabelProvider  [branch inheritance layer 5]
        ↓
Refresh DynamicNavigationProvider  [branch-scoped nav visibility]
        ↓
Refresh DynamicRouteProvider       [branch admin route gates]
        ↓
Refresh DynamicDashboardProvider   [branch-scoped widgets / default filters]
        ↓
Refresh DynamicSearchProvider      [branch filter hints]
        ↓
Refresh DynamicReportingProvider   [branch filter defaults]
        ↓
Refresh DynamicAnalyticsProvider   [activeBranchId filter defaults]
        ↓
Update UI                          [React context propagation — shell re-render]
        ↓
Complete                           [emit branch.context.changed + branchSnapshotVersion bump]
```

### 20.2 Step ownership

| Step | Owner | Input | Output |
|------|-------|-------|--------|
| Validate access | `DynamicBranchProvider` | Target `branchId`, `accessibleBranchIds`, `canSelectBranch` | Pass or throw `BranchAccessDeniedError` (UX) |
| Persist selection | `DynamicBranchProvider` | Validated `branchId` | Session write |
| Invalidate branch cache | `DynamicBranchProvider` | Old snapshot keys | Cleared branch cache; preserved registry cache |
| Refresh registry projections | `ModuleRegistryProvider` | Cached modules; conditional `refresh()` if stale | Fresh `EffectiveModuleView[]` reference |
| Rebuild EffectiveBranchView | `DynamicBranchProvider` | Registry modules + branch records + merge rules | New `BranchSnapshot` |
| Refresh downstream providers | Each provider's `onBranchContextChanged()` | New `branchSnapshotVersion`, `activeBranchId` | Updated provider snapshots |
| Update UI | React tree | Context updates | Consistent branch context site-wide |

### 20.3 Failure behavior

| Failure point | Behavior | User-visible result |
|---------------|----------|---------------------|
| Access validation fails | **Abort transaction** — no session write, no cache clear | Selector reverts; error toast optional |
| Session persist fails | **Abort** — keep prior active branch | Prior context unchanged |
| Branch cache clear fails | **Abort** — do not proceed to rebuild | Prior snapshot retained |
| Registry projection stale + HTTP fails | **Degraded complete** — rebuild from cached EffectiveModuleView + static branch catalog | Banner optional; branch switch still applied if access valid |
| EffectiveBranchView rebuild fails | **Rollback transaction** (§20.4) | Prior active branch restored |
| Downstream provider refresh fails | **Fail-closed partial** — see §21.4 | Branch switch rolled back if any **critical** provider fails (Branch, WhiteLabel, Registry); non-critical logged |

**Critical providers (must succeed):** `DynamicBranchProvider`, `DynamicWhiteLabelProvider`, `ModuleRegistryProvider`.  
**Non-critical (degraded OK):** Search, Reporting, Analytics catalog refresh — may serve stale catalog until next navigation with fail-closed filters (no cross-branch widen).

### 20.4 Rollback behavior

If rebuild or critical provider refresh fails after session persist:

```
1. Restore previous booking.branch.activeBranchId from transaction snapshot
2. Restore previous BranchSnapshot from transaction memory copy
3. Restore previous branchSnapshotVersion
4. Emit branch.context.rollback
5. Re-run downstream refresh with restored context
6. Surface error — do not leave UI on new branch with old provider state
```

Transaction keeps **in-memory copy** of pre-switch `activeBranchId` + `BranchSnapshot` until `Complete`.

### 20.5 Cache invalidation (within transaction)

| Cache | Invalidated? | When |
|-------|--------------|------|
| `booking.branch.snapshot` | **Yes** | Before rebuild |
| `booking.branch.activeBranchId` | **Written** | After validate, before rebuild |
| `branchSnapshotVersion` / `cacheVersion` | **Bumped** | On Complete |
| `booking.moduleRegistry.bootstrap` | **No** | Unless registry stale (§19.8) |
| White label snapshot cache | **Yes** | Via coordinated refresh (§21) |
| Dashboard/reporting/analytics snapshot caches | **Yes** | Via coordinated refresh |
| React Query / API caches | **Selective** | Branch-scoped query keys invalidated by consumers on `branch.context.changed` |

### 20.6 Fail-closed rules

1. **No partial branch context** — UI must not show branch B selector state with branch A provider snapshots.  
2. **No silent widen** — switching to `null` (all branches) requires explicit user action + `canViewCrossBranch`.  
3. **Inactive branch** — reject selection; do not persist.  
4. **Concurrent switches** — debounce 300ms; latest wins; prior in-flight transaction aborted if superseded.  
5. **API calls during transaction** — in-flight requests tagged with **pre-switch** branchId complete normally; post-Complete requests use new branchId.

### 20.7 Performance note

Normal branch switch: **merge-only rebuild** — no registry HTTP bootstrap refetch. Registry step re-reads **in-memory** `EffectiveModuleView` from `ModuleRegistryProvider`. HTTP refetch occurs only when `catalogGeneration` or `entitlementVersion` mismatch detected (§19.8).

---

## 21. Cross-Consumer Refresh Contract

This section defines the **single authoritative refresh contract** ensuring every Dynamic Provider observes the **same branch context** after login, branch switch, tenant switch, logout, and registry refresh.

### 21.1 Contract name

**`BranchContextRefreshContract`** — orchestrated by `DynamicBranchProvider`; observed by all dynamic consumers.

### 21.2 Trigger sources

| Trigger | Initiator | Contract event |
|---------|-----------|----------------|
| Login complete | `DynamicBranchProvider` | `branch.context.ready` |
| User branch switch | `DynamicBranchProvider` | `branch.context.changed` |
| Tenant switch | Identity layer → Branch provider | `branch.context.cleared` → `branch.context.ready` |
| Logout | Identity layer → Branch provider | `branch.context.cleared` |
| Registry refresh (access revoked) | `DynamicBranchProvider` | `branch.context.changed` or `branch.context.restricted` |
| Unavailable branch recovery | `DynamicBranchProvider` | `branch.context.changed` |
| Transaction rollback | `DynamicBranchProvider` | `branch.context.rollback` |
| Settings save (branch config) | `DynamicBranchProvider.refresh()` | `branch.config.changed` (same `activeBranchId`) |

### 21.3 Provider dependency graph

```
ModuleRegistryProvider                    [foundation — no branch dependency]
        ↓
DynamicBranchProvider                     [branch context authority — §19]
        ↓
DynamicWhiteLabelProvider                 [depends on branch slice — layer 5]
        ↓
DynamicNavigationProvider                 [branch-scoped nav metadata]
DynamicRouteProvider                      [branch admin surfaces]
        ↓
DynamicDashboardProvider                  [branch-scoped widgets]
DynamicSearchProvider                     [branch filter hints]
DynamicReportingProvider                  [branch filter defaults]
DynamicAnalyticsProvider                  [branch filter defaults]
```

**Parallel tier rule:** Navigation and Route may refresh **in parallel** after WhiteLabel completes. Dashboard, Search, Reporting, Analytics may refresh **in parallel** after Navigation+Route complete.

### 21.4 Refresh order (strict)

| Order | Provider | Must complete before | On failure |
|-------|----------|----------------------|------------|
| 0 | `ModuleRegistryProvider` | Branch provider (if stale) | Static fallback; branch switch aborted if no modules |
| 1 | `DynamicBranchProvider` | All others | **Abort entire transaction** |
| 2 | `DynamicWhiteLabelProvider` | Navigation, Route, Dashboard, Search, Reporting, Analytics | **Rollback** branch switch |
| 3 | `DynamicNavigationProvider` + `DynamicRouteProvider` | Dashboard tier | Degraded — stale nav until refresh; branch context still valid |
| 4 | `DynamicDashboardProvider` | — | Degraded |
| 4 | `DynamicSearchProvider` | — | Degraded |
| 4 | `DynamicReportingProvider` | — | Degraded |
| 4 | `DynamicAnalyticsProvider` | — | Degraded |

### 21.5 Synchronization

| Mechanism | Detail |
|-----------|--------|
| **Snapshot version gate** | Downstream providers reject stale refresh if `branchSnapshotVersion` < current (§22) |
| **Single-flight mutex** | `DynamicBranchProvider` holds refresh lock during transaction §20 |
| **Context payload** | `{ activeBranchId, branchSnapshotVersion, tenantId, accessibleBranchIds, configuration slice }` |
| **Read-only handoff** | Providers must not mutate branch selection or session keys |
| **Completion barrier** | `branch.context.changed` emitted only after order 1–2 succeed; order 3–4 best-effort before UI Complete |

### 21.6 Partial refresh prevention

| Anti-pattern | Prevention |
|--------------|------------|
| Analytics updates branch filter but dashboard still on old branch | All providers subscribe to same `branchSnapshotVersion`; shell blocks cross-module nav until version stable (optional loading gate 36b) |
| White label shows tenant colors while branch selected | WhiteLabel refresh **must** complete (order 2) before Complete |
| Search uses new branchId but reporting uses old | All order-4 providers receive identical `BranchContextPayload` |
| Provider reads `sessionStorage` directly | **Forbidden** — only `DynamicBranchProvider` reads/writes selection |

### 21.7 Failure behavior summary

- **Critical path failure (orders 1–2):** Full transaction rollback §20.4.  
- **Non-critical failure (orders 3–4):** Branch switch completes; failed providers mark `degraded: true`; retry on next navigation or manual refresh.  
- **Never** expose cross-branch data wider than `accessibleBranchIds` due to partial refresh.

---

## 22. Branch Snapshot Versioning

This section defines version identifiers participating in cache keys, invalidation, refresh, and rollback.

### 22.1 Version fields

| Field | Type | Source | Mutates when |
|-------|------|--------|--------------|
| **`catalogGeneration`** | `number` | Module registry bootstrap snapshot | Platform manifest publish; marketplace install |
| **`entitlementVersion`** | `string` | Phase 28 license fingerprint | Plan change, grace, suspension, feature change |
| **`settingsGeneration`** | `string` (hash) | Tenant settings JSON revision | Tenant settings PATCH |
| **`branchConfigurationVersion`** | `string` (hash) | Per-branch `Branch.features` + branch row fields | Branch CRUD or branch settings PATCH |
| **`branchSnapshotVersion`** | `string` (composite) | Computed by branch snapshot builder | Any rebuild of `EffectiveBranchView` |
| **`cacheVersion`** | `number` (monotonic) | Client increment on each successful snapshot commit | Every successful branch snapshot write |

### 22.2 `branchSnapshotVersion` composition

```
branchSnapshotVersion = hash(
  tenantId,
  userId,
  rolesHash,
  activeBranchId,
  catalogGeneration,
  entitlementVersion,
  settingsGeneration,
  branchConfigurationVersion(activeBranchId),
  staticCatalogHash
)
```

Providers compare `branchSnapshotVersion` to detect stale projections without deep equality on full snapshot.

### 22.3 Cache key participation

| Store | Key includes |
|-------|--------------|
| `booking.branch.snapshot` | Full `branchSnapshotVersion` |
| Provider internal caches (dashboard, analytics, …) | `branchSnapshotVersion` + provider-specific suffix |
| Session `booking.branch.activeBranchId` | `tenantId` + `userId` prefix validation on read |
| Registry cache | **Excludes** `activeBranchId` — registry is branch-agnostic |
| White label cache | `branchSnapshotVersion` + white-label-specific hash |

### 22.4 Invalidation matrix

| Event | catalogGeneration | settingsGeneration | branchConfigurationVersion | branchSnapshotVersion | cacheVersion |
|-------|-------------------|--------------------|-----------------------------|----------------------|--------------|
| Branch switch | — | — | — | **Rebuild** | **+1** |
| Branch settings save | — | — | **Bump** | **Rebuild** | **+1** |
| Tenant settings save | — | **Bump** | — | **Rebuild** | **+1** |
| Registry refresh | **Maybe bump** | — | — | **Rebuild if catalog changed** | **+1** |
| Login | Read from bootstrap | Read | Read per branch | **Rebuild** | **+1** |
| Logout | — | — | — | **Clear** | **Reset** |
| Rollback flag | Static catalog hash | Static | Static | Static path | **+1** |

### 22.5 Refresh interaction

1. Transaction starts → capture current `branchSnapshotVersion` as `fromVersion`.  
2. Rebuild snapshot → compute new `branchSnapshotVersion` as `toVersion`.  
3. Downstream providers refresh only if `toVersion !== fromVersion` OR `branch.context.changed` event.  
4. On rollback → restore `fromVersion` and prior snapshot blob.

### 22.6 Rollback interaction

When `VITE_USE_STATIC_BRANCH_ONLY=true`:

- `catalogGeneration` → `null` (static catalog hash used instead)  
- `branchSnapshotVersion` → derived from static catalog + legacy `dashboard-branch-scope` inputs  
- `cacheVersion` still monotonic for provider coordination  
- Session `activeBranchId` behavior unchanged (§19)

---

## 23. Future Department Layer

This section clarifies the **Department** hierarchy level and why it is **intentionally excluded from Phase 36 implementation** (36a/36b/36c).

### 23.1 Canonical hierarchy (complete)

```
Platform
  ↓
Tenant
  ↓
Organization              (logical enterprise profile)
  ↓
Region                    (optional geographic grouping)
  ↓
Branch                    (operating site — Phase 36 scope)
  ↓
Department                (org unit within branch — Phase 37+ scope)
  ↓
User
```

### 23.2 Department entity (existing)

| Property | Detail |
|----------|--------|
| Storage | Prisma `Department` — `tenantId`, optional `branchId` |
| Scope | Tenant-wide department (`branchId=null`) or branch-scoped |
| Usage today | Minimal runtime consumption; no provider |
| Phase 36 | **Architecture reserved only** — no manifest contributions, no provider, no Playwright |

### 23.3 Inheritance (future)

```
Platform → Tenant → Organization → Region → Branch → Department → User context
```

| Layer | May override (future) | Example |
|-------|----------------------|---------|
| Branch | Tenant/org defaults | Site hours, warehouse |
| Department | Branch defaults (narrow-only) | Department-specific queue, resource pool |
| User | Selection context only | Active department filter — not config storage |

**Rule (future):** Department overrides **cannot** widen branch or tenant licensing; same narrow-only merge as Phase 36 branch rules (§6.3).

### 23.4 Isolation (future)

| Concern | Model |
|---------|-------|
| Data scoping | API handlers add `departmentId` filter where applicable |
| RBAC | Department-scoped roles (Phase 37+) — new resource keys, not Phase 36 |
| Provider | `DynamicDepartmentProvider` (Phase 37 proposal) — **not Phase 36** |
| Registry | New extension kind `department` or nested under `branch` contributions (Phase 37 decision) |

### 23.5 Future provider strategy (Phase 37+)

```
DynamicBranchProvider (Phase 36)
  ↓
DynamicDepartmentProvider (Phase 37 — proposed)
  ↓
Existing module consumers
```

Department provider would:

- Read `activeDepartmentId` from session (same authority pattern as §19)  
- Depend on `DynamicBranchProvider` for branch context  
- Feed scheduling, queue, and clinical modules  
- **Not** duplicate branch merge logic

### 23.6 Why Department is excluded from Phase 36

| Reason | Detail |
|--------|--------|
| **Scope boundary** | Phase 36 delivers branch context foundation — department adds second selection axis |
| **Existing model immaturity** | `Department` exists in schema but lacks settings DTO, API surface, and UI |
| **Consumer readiness** | Phases 30–35 consumers need branch context first; department filters are module-specific |
| **Risk reduction** | Dual selection (branch + department) before branch authority (§19) is stable would violate fail-closed guarantees |
| **Implementation cost** | Department requires RBAC extensions, API scoping, and Playwright matrix multiplication |
| **Architecture readiness** | Phase 36 must close branch SSOT before layering department |

**Phase 36 deliverables explicitly exclude:** department selection UI, `DynamicDepartmentProvider`, department manifest contributions, department cache keys, and department Playwright scenarios.

### 23.7 Phase 36 hooks for future Department

| Hook | Purpose |
|------|---------|
| `EffectiveBranchView` metadata | Reserve optional `departmentId: null` field (36a type — no runtime use) |
| Inheritance docs §5.4 | Department layer documented in chain |
| Extension kind `branch` | May later declare `departmentScoped: boolean` metadata (36a vocabulary optional field) |
| Refresh contract §21 | Extensible with `department.context.*` events in Phase 37 |

---

## 24. Architecture Remediation Record (2026-07-15)

**Type:** Final architecture remediation — **CLOSED**  
**Prerequisite:** Phase 36 initial architecture approval  

| Observation | Severity | Resolution | SSOT |
|-------------|----------|------------|------|
| **H1** Active branch authority undefined | High | Authoritative source, selection ownership, lifecycle events, fallback chain | §19 |
| **H2** Branch switching transaction unspecified | High | Complete transaction, ownership, failure/rollback, cache rules | §20 |
| **H3** Cross-consumer refresh contract missing | High | Trigger sources, dependency graph, strict order, partial refresh prevention | §21 |
| **M1** Snapshot versioning incomplete | Medium | Five version fields + cache/invalidation/rollback matrix | §22 |
| **M2** Department layer ambiguous | Medium | Full hierarchy, inheritance, isolation, exclusion rationale | §23 |

| Item | Status |
|------|--------|
| Implementation code | **36a CLOSED** — 36b pending |
| Architecture readiness (post-remediation) | **99%** |
| Phases 28–35 | **Frozen** |

**Acceptance gate verdict:** **PASS** — Phase 36 architecture remediation closed. **36b authorized** upon 36a closure. No runtime changes.

---

## 25. Architecture Readiness

| Dimension | Readiness |
|-----------|-----------|
| Phase 30–35 pattern alignment | **99%** |
| Enterprise hierarchy clarity | **98%** |
| EffectiveBranchView spec | **98%** |
| Provider responsibilities | **99%** |
| Active branch authority (§19) | **99%** |
| Branch switching transaction (§20) | **99%** |
| Cross-consumer refresh contract (§21) | **99%** |
| Snapshot versioning (§22) | **98%** |
| Future department layer (§23) | **97%** |
| Security / isolation model | **97%** |
| Marketplace extensibility | **93%** |
| Phase 35 white label coordination | **98%** |
| Implementation roadmap | **99%** |

**Overall architecture readiness: 99%** (post-remediation 2026-07-15)

---

## 26. Approval & Authorization

**Decision:** Phase 36 Dynamic Multi-Branch Enterprise architecture **APPROVED**. Architecture remediation **CLOSED** (2026-07-15).

| Gate | Status |
|------|--------|
| Phase 36a implementation | **CLOSED** (2026-07-15) |
| Phase 36b | **CLOSED** (2026-07-15) |
| Phase 36c | **CLOSED** (2026-07-15) |
| Phase 36 | **Permanently closed** |
| Phases 28–35 | **Frozen** |

**Acceptance gate verdict:** **PASS** — Phase 36a + 36b + 36c closed. Phase **36 permanently closed**.

---

## 31. Phase 36b Implementation Record (2026-07-15)

**Status:** **36b CLOSED** — provider & integration + final remediation; **36c NOT started**  
**Type:** Configuration-source migration only — no UI redesign, no API/schema changes, no execution changes  
**Runtime impact:** Branch configuration discoverability now flows through `DynamicBranchProvider`; existing CRUD/scheduling/inventory/reporting/analytics/white-label **execution** unchanged

### 31.1 Deliverables

| Part | Deliverable | Status |
|------|-------------|--------|
| 1 | `DynamicBranchProvider` + `useBranch()` / `useOptionalBranch()` | ✅ |
| 2 | `branch-resolver.ts` — contributions, catalog join, ownership, capabilities | ✅ |
| 3 | `branch-snapshot-builder.ts` — registry / static / restricted | ✅ |
| 4 | `branch-cache.ts` — identity-scoped; clears on login/logout/tenant/refresh | ✅ |
| 5 | `VITE_USE_STATIC_BRANCH_ONLY` rollback flag | ✅ |
| 6 | Active branch authority (session + fallback + unavailable recovery) | ✅ |
| 7 | Capability projection (5 aggregate flags from snapshot only) | ✅ |
| 8 | White label coordination (`branchId` + projection helper) | ✅ |
| 9 | Runtime snapshot validation (fail-closed) | ✅ |
| 10 | `BranchContextRefreshContract` single-flight orchestration (§20–§21) | ✅ final remediation |
| 11 | Consumer migration (config source) — all dynamic branch consumers | ✅ final remediation |
| 12 | `branchSnapshotVersion` sync + stale rejection + atomic rollback (§22) | ✅ final remediation |
| 13 | Provider integration unit tests (order, rollback, version, fail-closed) | ✅ final remediation |

### 31.2 Verified test results (2026-07-15 — post final remediation)

| Suite | Result |
|-------|--------|
| `@booking/module-registry` vitest | **80/80 passed** |
| `clinic-dashboard` dynamic-branch + dynamic-white-label vitest | **60/60 passed** |

### 31.3 Explicitly not done (36c scope)

- Playwright acceptance / port **5179**
- Branch selector UI / production closure
- Cross-branch scheduling/inventory/reporting/analytics **execution** changes
- Backend APIs, Prisma, schema

**Acceptance gate verdict:** **PASS** — Phase 36b permanently closed (including final remediation). **36c authorized**.

---

## 32. Phase 36b Final Remediation Record (2026-07-15)

**Status:** **CLOSED** — observations H1, H2, M1, M2, M3 resolved; superseded by **36c CLOSED**

| Observation | Resolution |
|-------------|------------|
| **H1** BranchContextRefreshContract runtime | `runBranchContextRefresh()` — persist → invalidate → rebuild → WL (critical) → nav/route tier → catalog tier → publish; single-flight |
| **H2** Complete consumer migration | Dashboard, Search, Reporting, Analytics, White Label, Routing, Navigation obtain branch config from `useBranch()` / `useOptionalBranch()`; cache keys include `branchSnapshotVersion` |
| **M1** Snapshot synchronization | `publishBranchContext` + superseded-version gate; all consumers observe published `branchSnapshotVersion` |
| **M2** Fail-closed recovery | Critical WL failure restores session, prior snapshot/cache, republishes rollback, re-refreshes consumers |
| **M3** Integration unit tests | `branch-context-refresh-contract.spec.ts` — order, rollback, stale rejection, single-flight, consumer consistency |

**Acceptance gate verdict:** **PASS** — Phase 36b fully complete for 36c pure runtime verification (completed).

---

## 33. Phase 36c Implementation Record (2026-07-15)

**Status:** **36c CLOSED** — runtime acceptance & production closure; **Phase 36 permanently closed**  
**Type:** Playwright acceptance only — no architecture redesign; defects found during acceptance fixed without scope expansion  
**Runtime impact:** BranchRuntimeProbe (`window.__BOOKING_BRANCH_RUNTIME__`) + thin action bridge for acceptance; rollback server port **5179**

### 33.1 Deliverables

| Part | Deliverable | Status |
|------|-------------|--------|
| 1 | `e2e/dynamic-branch.spec.ts` — **43** scenarios | ✅ |
| 2 | `e2e/helpers/dynamic-branch.ts` | ✅ |
| 3 | Playwright webServer port **5179** (`VITE_USE_STATIC_BRANCH_ONLY=true`) | ✅ |
| 4 | Runtime probe sync for consumer version assertions | ✅ |
| 5 | SSOT progress updates (4 docs) | ✅ |

### 33.2 Verified test results (2026-07-15)

| Suite | Result |
|-------|--------|
| Playwright `e2e/dynamic-branch.spec.ts` | **43/43 passed** |
| `@booking/module-registry` vitest | **80/80 passed** |
| `clinic-dashboard` dynamic-branch + dynamic-white-label vitest | **60/60 passed** |

### 33.3 Acceptance defects fixed (runtime-only)

| Defect | Fix |
|--------|-----|
| Consumer versions null after ready publish | `useRegisterBranchConsumer` observes published context via subscribe + seed |
| Probe not updated on consumer register | `registerBranchConsumer` / publish / clear sync `__BOOKING_BRANCH_RUNTIME__` |

### 33.4 Explicitly not done (Phase 37+)

- Branch selector UI redesign
- Department hierarchy runtime
- RLS / server BranchResolver mirror
- Franchise Organization entity
- Scheduling/inventory/reporting/analytics **execution** redesign

**Acceptance gate verdict:** **PASS** — Phase 36 Dynamic Multi-Branch permanently closed.

---

## 27. Phase 36a Implementation Record (2026-07-15)

**Status:** **36a CLOSED** — foundation only (historical record); superseded progress: **36b CLOSED**  
**Type:** Implementation — canonical vocabulary, manifest generation, fail-closed validation, static parity catalog  
**Runtime impact (at 36a close):** **None** — no providers, hooks, APIs, schema, or UI behavior changes

### 27.1 Deliverables

| Part | Deliverable | Location | Status |
|------|-------------|----------|--------|
| 1 | Canonical branch vocabulary (8 categories, 24 surfaces) | `packages/module-registry/src/branch/` | ✅ |
| 2 | `BranchContribution` type + `branch` extension kind | `packages/module-registry/src/types.ts` | ✅ |
| 3 | `moduleBranch()` + `buildBranchContributionsForModule()` | `branch/build-branch-contributions.ts` | ✅ |
| 4 | Manifest expansion (7 modules) | `builtin/builtin-manifests.ts` | ✅ |
| 5 | Fail-closed integrity validation | `validate-*-branch-*.ts` | ✅ |
| 6 | `STATIC_BRANCH_CATALOG` (parity only) | `apps/clinic-dashboard/.../static-branch-catalog.ts` | ✅ |
| 7 | `STATIC_BRANCH_CATALOG_IS_RUNTIME_AUTHORITY = false` | `branch/static-branch-catalog-authority.ts` | ✅ |

### 27.2 Canonical inventory (final)

| Category | Surfaces | Owning modules |
|----------|----------|----------------|
| Identity | 3 | `settings` |
| Address | 2 | `settings` |
| Clinical | 3 | `scheduling`, `queue` |
| Financial | 3 | `billing`, `settings` |
| Inventory | 2 | `inventory` |
| Reporting | 2 | `reporting` |
| Analytics | 2 | `analytics` |
| White Label | 7 | `settings` |
| **Total** | **24** | **7 modules** |

### 27.3 Verified test results (2026-07-15)

| Suite | Result |
|-------|--------|
| `@booking/module-registry` vitest | **80/80 passed** |
| `clinic-dashboard` branch foundation vitest | **6/6 passed** |

### 27.4 Explicitly not done (36b/36c scope)

- `DynamicBranchProvider`, `useBranch()`, `useOptionalBranch()`
- Branch switching, active branch persistence, cross-provider refresh
- Runtime cache, rollback flag wiring, Playwright acceptance
- Backend APIs, Prisma, database schema

**Acceptance gate verdict:** **PASS** — Phase 36a foundation permanently closed. **36b authorized**. No runtime verification required for foundation-only deliverable.

---

## 28. Branch Capability Contract (Phase 36a H1)

**Status:** Architecture + validation only — **no runtime capability calculation in 36a**  
**Implementation:** `packages/module-registry/src/branch/branch-capability-contract.ts`  
**Runtime consumer:** `DynamicBranchProvider` (Phase 36b) projects `BranchCapabilityFlags` from snapshot — UI must not recompute in registry mode.

### 28.1 Aggregate capabilities

| Capability | Purpose |
|------------|---------|
| `canAccessBranch` | User has at least one accessible active branch context |
| `canSwitchBranch` | User may change active branch via selector |
| `canViewCrossBranch` | User may aggregate across branches (reporting/analytics) |
| `canManageBranchSettings` | User may update branch configuration surfaces |
| `canUseBranchBranding` | User may configure branch white-label overrides |

### 28.2 Derivation source

| Mode | Authority | Behavior |
|------|-----------|----------|
| **Registry mode (36b+)** | `EffectiveBranchView.capabilities` | Derived from branch snapshot + `EffectiveModuleView` branch extensions + server grants |
| **Static fallback** | `STATIC_BRANCH_CATALOG` + legacy helpers | Used only when `VITE_USE_STATIC_BRANCH_ONLY=true` (36b) — catalog metadata informs visibility, not values |

**Rule:** All five capabilities derive from **snapshot signals only** in registry mode. `forbiddenClientDuplication: true` on every contract entry.

### 28.3 Fail-closed behavior

| Condition | Result |
|-----------|--------|
| Unknown branch / unauthorized branch | `canAccessBranch = false`; `canSwitchBranch = false` |
| Single-branch user | `canSwitchBranch = false` unless `branchAccessMode` allows |
| Cross-branch surfaces inaccessible | `canViewCrossBranch = false` |
| RBAC denies admin surfaces | `canManageBranchSettings = false` |
| Branding feature not licensed | `canUseBranchBranding = false` |
| Snapshot build failure | **All capabilities default `false`** — never widen |

### 28.4 Restricted snapshot behavior

When `source === 'restricted'` (§19): capabilities collapse to minimum — `canAccessBranch` may be true for primary branch only; `canSwitchBranch`, `canViewCrossBranch`, and cross-branch aggregation **false**.

### 28.5 Validation

`validateBranchCapabilityContract()` runs at bootstrap — fails if vocabulary cannot support 36b derivation (missing cross-branch surfaces, manage surfaces, branding category, etc.).

---

## 29. Branch Surface Ownership Contract (Phase 36a H2)

**Status:** Documented + validated — every canonical surface declares complete ownership metadata  
**Implementation:** `packages/module-registry/src/branch/validate-branch-surface-ownership.ts`

### 29.1 Required metadata per surface

| Field | Source | Required |
|-------|--------|----------|
| **Owning module** | `moduleId` | Yes |
| **featureId** | `requiredFeature` or explicit `null` (module-licensed only) | Yes |
| **Configuration category** | `configurationCategory` | Yes |
| **Inheritance scope** | `inheritanceMode` + `branchScoped` | Yes |
| **Cross-branch support** | `crossBranchAllowed` | Yes |

### 29.2 featureId semantics

| Value | Meaning |
|-------|---------|
| `null` / omitted | Surface gated by module license + RBAC only (identity, address, clinical, etc.) |
| `reports` | Reporting module feature gate |
| `analytics` | Analytics module feature gate |
| `customBranding` / `whiteLabel` | Phase 35 branding feature gates |

### 29.3 Bootstrap enforcement

`validateBranchSurfaceOwnershipContract()` fails if any of 24 surfaces lacks complete ownership metadata or drifts from canonical vocabulary. Wired into `validateCanonicalBranchVocabulary()` → bootstrap fail-closed.

---

## 30. Phase 36a Final Remediation Record (2026-07-15)

**Type:** Foundation refinement — **CLOSED**  
**Scope:** Documentation + validation only — **no runtime changes**

| Observation | Severity | Resolution | SSOT / Code |
|-------------|----------|------------|-------------|
| **H1** Branch capability contract undefined | High | Five aggregate capabilities, derivation, fail-closed, restricted/static modes | §28; `branch-capability-contract.ts` |
| **H2** Surface ownership contract incomplete | High | Required metadata per surface; bootstrap validation | §29; `validate-branch-surface-ownership.ts` |
| **M1** Static catalog authority undocumented | Medium | Mirror Reporting/Analytics/White Label; `IS_RUNTIME_AUTHORITY = false` | §14.1; `static-branch-catalog-authority.ts` |
| **M2** Surface uniqueness gaps | Medium | Global uniqueness: surfaceId, extensionId, localId (per module), settingsPath, deepLink, provider ownership | `validate-canonical-branch-vocabulary.ts`, `validate-branch-integrity.ts` |
| **M3** Cross-package drift detection weak | Medium | Field-by-field parity: vocabulary → manifest → static catalog | `validate-static-branch-catalog-parity.ts`, `validate-branch-layer-parity.ts` |

| Item | Status |
|------|--------|
| Runtime provider | **36b CLOSED** — `DynamicBranchProvider` implemented |
| `@booking/module-registry` vitest | **80/80 passed** |
| `clinic-dashboard` branch + white-label vitest | **60/60 passed** (post-36b final remediation) |
| Phases 28–35 | **Frozen** |

**Acceptance gate verdict:** **PASS** — Phase 36a permanently closed; Phase **36b CLOSED**. **36c authorized**.

---

*Phase 36 — Dynamic Multi-Branch Enterprise. Architecture + 36a + 36b + 36c closed 2026-07-15. Phase 36 permanently closed.*
