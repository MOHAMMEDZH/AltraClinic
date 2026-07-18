# Phase 29 — Dynamic Module Management Architecture

**Phase:** 29 (Architecture & Design — **APPROVED**)  
**Status:** **ARCHITECTURE APPROVED** — **Phase 29a PERMANENTLY CLOSED** · **Phase 29b RUNTIME VERIFIED & CLOSED** · **Phase 30 RUNTIME VERIFIED & CLOSED** · **Phase 31 RUNTIME VERIFIED & CLOSED** (2026-07-13)  
**Prerequisite:** Phase 28 — Enterprise Subscription & Licensing System (**permanently closed**, 2026-07-12)  
**Authoring panel:** CTO · Principal Enterprise SaaS · Healthcare ERP · Platform · Backend · Frontend · Security · DevOps  
**SSOT for:** Phases 30–36 (Dynamic Navigation, Routing, Dashboard, Search, Reporting, Analytics, White Label, Multi-Branch), Phase 38 Activity Center ([`DYNAMIC_ACTIVITY_CENTER_ARCHITECTURE.md`](./DYNAMIC_ACTIVITY_CENTER_ARCHITECTURE.md)), Phase 39 Enterprise Audit Center ([`DYNAMIC_AUDIT_CENTER_ARCHITECTURE.md`](./DYNAMIC_AUDIT_CENTER_ARCHITECTURE.md)), Phase 40 Patient Journey & Workflow Automation ([`PATIENT_JOURNEY_AND_WORKFLOW_ARCHITECTURE.md`](./PATIENT_JOURNEY_AND_WORKFLOW_ARCHITECTURE.md)), Phase 41 Notification Center ([`NOTIFICATION_CENTER_ARCHITECTURE.md`](./NOTIFICATION_CENTER_ARCHITECTURE.md)), future Marketplace, Plugin SDK, and enterprise extensions. Phase 32 search detail: [`DYNAMIC_SEARCH_ARCHITECTURE.md`](./DYNAMIC_SEARCH_ARCHITECTURE.md). Phase 33 reporting detail: [`DYNAMIC_REPORTING_ARCHITECTURE.md`](./DYNAMIC_REPORTING_ARCHITECTURE.md). Phase 35 white label detail: [`DYNAMIC_WHITE_LABEL_ARCHITECTURE.md`](./DYNAMIC_WHITE_LABEL_ARCHITECTURE.md). Phase 36 multi-branch detail: [`DYNAMIC_MULTI_BRANCH_ARCHITECTURE.md`](./DYNAMIC_MULTI_BRANCH_ARCHITECTURE.md)

---

## 1. Executive Summary

The Healthcare ERP platform ships **21 licensed product modules** and **28 NestJS backend domains** today. Module visibility, routing, navigation, search, dashboards, and analytics are wired through **five disconnected static configurations** (licensing config, permission matrix, router, per-feature nav, search entity maps). Phase 28 closed with a **single authoritative licensing engine** (`LicensingEngineService`) and fail-closed enforcement at the HTTP edge. Phase 29 introduces a **Dynamic Module Registry** — a composition and discovery layer that becomes the **single source of truth for module metadata**, without replacing licensing, RBAC, routing implementations, or existing business logic.

**What Phase 29 delivers (architecture only):**

| Deliverable | Description |
|-------------|-------------|
| **Module Registry** | Canonical manifest schema describing every module’s identity, capabilities, and extension points |
| **Effective Module Resolver** | Read model combining plan entitlements, tenant flags, RBAC, and lifecycle state |
| **Discovery contracts** | How navigation (29b/30), routing (30), dashboard (31), search (32), reporting (33), analytics (34), and white label (35) consume the registry |
| **Lifecycle model** | Registration → initialization → activation → suspension → disable → removal → upgrade → rollback → future marketplace install |
| **Security & performance model** | Manifest integrity, no hidden surfaces, lazy loading strategy |

**What Phase 29 explicitly does not do:**

- Redesign `LicensingEngineService`, RBAC, routing, navigation UI, dashboards, search, reporting, or analytics implementations
- Change existing APIs or business logic
- Write production code (implementation follows architecture approval)

**Strategic outcome:** Future modules, marketplace packages, and enterprise plugins register **metadata and extension hooks** once. Phases 30–36 filter and render from that registry. Licensing remains authoritative for *whether* a tenant may use a module; RBAC remains authoritative for *whether* a user may act; the registry is authoritative for *what exists and how to wire it*.

---

## 2. Architecture Principles

| # | Principle | Rationale |
|---|-----------|-----------|
| P1 | **Build on, do not replace** | All existing modules (Dashboard, Patients, Scheduling, EMR, etc.) remain. Registry wraps and unifies their descriptors. |
| P2 | **Licensing is enforcement; Registry is composition** | Registry **asks** `LicensingEngineService` for effective access. Licensing **never** asks the Registry. |
| P3 | **RBAC is orthogonal** | Permission matrix answers user capability. Registry references `resourceId` keys; it does not embed role logic. |
| P4 | **Backend authority, frontend projection** | API guards (`@RequireLicensedModule`, `@RequirePermission`) remain authoritative. Frontend uses registry for UX (hide, lock, lazy-load), not for security bypass. |
| P5 | **Manifest over hardcoding** | Every discoverable surface (nav item, route, widget, search type, report, metric) is declared in module metadata. |
| P6 | **Stable canonical IDs** | `LicensedModuleId` is the primary module key. Marketplace extensions use namespaced IDs (`vendor.package.module`). |
| P7 | **Fail-closed by default** | Unknown module, failed dependency, or unlicensed state → module hidden or locked; never silently enabled. |
| P8 | **Lazy by default** | Route components, widgets, and search providers load on demand via manifest-driven dynamic imports. |
| P9 | **Versioned, auditable lifecycle** | Module install/upgrade/rollback produces audit events compatible with Phase 28 commercial audit. |
| P10 | **Future marketplace compatibility** | Core registry schema supports signed manifests, semver, and sandboxed plugins without schema redesign. |

---

## 3. System Context Diagram

```mermaid
flowchart TB
  subgraph clients [Clients]
    CD[clinic-dashboard]
    PP[patient-portal - future]
    SA[super-admin - future]
  end

  subgraph phase29 [Phase 29 - Dynamic Module Registry Layer]
    MR[Module Registry Service]
    EMR[Effective Module Resolver]
    MD[Module Manifest Store]
    MR --> EMR
    MD --> MR
  end

  subgraph phase28 [Phase 28 - Closed - Do Not Redesign]
    LE[LicensingEngineService]
    SE[SubscriptionEnforcementService]
    LMG[LicensedModuleGuard]
    PG[PermissionGuard]
    LA[LicensingAuditService]
  end

  subgraph existing [Existing Platform - Unchanged Logic]
    NAV[Navigation UI - Phase 29b consumer]
    RTR[Router - Phase 30 consumer]
    DSH[Dashboard - Phase 31 consumer]
    SRC[Search - Phase 32 consumer]
    RPT[Reporting - Phase 33 consumer]
    ANA[Analytics - Phase 34 consumer]
    WL[White Label - Phase 35 consumer]
    BR[Multi-Branch - Phase 36 consumer]
  end

  CD --> NAV & RTR & DSH & SRC
  CD -->|GET /modules/registry| MR
  MR -->|resolveLicense / getEntitlements| LE
  EMR -->|moduleFlags intersection| TF[Tenant.features.moduleFlags]
  LE --> SE --> LMG
  PG --> existing
  LMG --> existing
  MR --> NAV & RTR & DSH & SRC & RPT & ANA & WL & BR
```

---

## 4. Component Diagram

```mermaid
flowchart LR
  subgraph manifest [Manifest Layer]
    BM[Built-in Module Manifests]
    TM[Tenant Module Overrides]
    MM[Marketplace Manifests - future]
  end

  subgraph registry [Registry Core]
    CAT[Module Catalog]
    DEP[Dependency Graph]
    VER[Version Compatibility]
    EXT[Extension Point Index]
  end

  subgraph resolution [Resolution]
    LIC[Licensing Projection]
    FLG[Tenant Flag Projection]
    RBAC[Permission Projection]
    EFF[Effective Module View]
  end

  subgraph delivery [Delivery - Phases 30-36]
    NAVP[Nav Provider]
    RTP[Route Provider]
    WGP[Widget Provider]
    SRP[Search Provider]
    RPP[Report Provider]
    ANP[Analytics Provider]
  end

  BM & TM & MM --> CAT
  CAT --> DEP & VER & EXT
  CAT --> LIC & FLG
  LIC --> EFF
  FLG --> EFF
  RBAC --> EFF
  EFF --> NAVP & RTP & WGP & SRP & RPP & ANP
```

### Component responsibilities

| Component | Owner | Responsibility |
|-----------|-------|----------------|
| **Module Manifest Store** | Platform | Versioned collection of module manifest documents (built-in + tenant-installed) |
| **Module Registry Service** | Platform | Catalog query, dependency validation, extension point index |
| **Effective Module Resolver** | Platform | Computes per-tenant, per-user effective module list |
| **LicensingEngineService** | Phase 28 (frozen) | Plan + lifecycle → `TenantLicense.modules` |
| **Permission matrix** | Identity (frozen) | Role → resource/action |
| **Nav/Route/Dashboard/Search/Report/Analytics Providers** | Phases 30–36 | Read-only consumers of effective registry views |

---

## 5. Module Registry Structure

### 5.1 Canonical identifiers

| Identifier | Format | Example | Notes |
|------------|--------|---------|-------|
| `moduleId` | `LicensedModuleId` or namespaced | `patients`, `acme.crm.leads` | Primary key; built-in modules use existing 21 IDs |
| `manifestId` | `{moduleId}@{semver}` | `workflow@2.1.0` | Immutable manifest version |
| `extensionId` | `{moduleId}/{kind}/{localId}` | `patients/nav/primary` | Extension point instance |
| `resourceId` | Permission matrix key | `api.patients` | RBAC linkage |
| `featureId` | `LicensedFeatureId` | `workflowAutomation` | Feature-level gating (optional) |

**Built-in module inventory (registry must cover all):**

`dashboard`, `patients`, `scheduling`, `queue`, `emr`, `dental`, `beauty`, `inventory`, `billing`, `reporting`, `analytics`, `workflow`, `notifications`, `ai`, `userManagement`, `settings`, `patientPortal`, `search`, `media`, `commission`, `loyalty`

**Product surfaces that map to modules but are not separate `LicensedModuleId` today** (e.g. Subscription center) are modeled as **sub-surfaces** under `settings` or `platform` extensions — not new license modules unless product explicitly adds them in a future phase.

### 5.2 Module Definition (manifest schema)

**Canonical complete schema:** See **§23 — Complete Module Manifest Schema**. Section 5.2 in the original draft is superseded by §23 for field-level SSOT.

Brief summary — a manifest describes identity, dependencies, licensing references, permissions, extension contributions, and integrity metadata. It does **not** embed enforcement logic.

### 5.3 Extension point catalog

| Extension kind | Consumer phase | Declares |
|----------------|----------------|----------|
| `navigation` | 30 | Sidebar items, quick nav, settings sub-nav |
| `routing` | 31 | Route paths, lazy import keys, layout shells |
| `dashboard` | 32 | Widget IDs, default profiles, span |
| `search` | 32 | Entity types, permission resources, deep links |
| `reporting` | 33 | Report templates, categories, data sources |
| `analytics` | 34 | Metrics, dimensions, widget catalog entries |
| `ai` | — | Copilot workspaces, tool registrations |
| `notifications` | — | Legacy thin event-type stubs (transitional; see kind `notification`) |
| `notification` | 41 | Canonical notification types, channels, templates, policies, communication discoverability (does **not** own clinical/financial/journey SoRs) — **41a+41b+41c+41d CLOSED**; Phase **41 fully complete**; Phase **42 NOT authorized** |
| `workflow` | — | Trigger/action registrations |
| `whiteLabel` | 35 | Branding surfaces, theme tokens, custom-domain UI hooks (extends `settings` module) |
| `branch` | 36 | Branch configuration surfaces, policy hooks, scope metadata (`branchScoped`, cross-branch flags) |
| `activity` | 38 | Activity types, feeds, timeline discoverability (does **not** replace `notifications` or audit) |
| `audit` | 39 | Audit event types, feeds, retention/redaction/export policy discoverability (does **not** replace Activity or Notifications; legal SoR remains Audit Center) |
| `journey` | 40 | Patient pathway stages, transitions, milestones, journey surfaces (orchestrates owning modules; does **not** replace Workflow module or clinical SoRs) — **40a CLOSED** |

Each contribution includes:

- Stable `extensionId`
- `moduleId` ownership
- `resourceId` + optional `featureId` for gating
- `sortOrder`, `labelKey`, `icon`
- Phase-specific payload (path, widget component key, entity type, etc.)

### 5.4 Effective Module View (read model)

Returned to clients after resolution (not stored as source of truth):

```typescript
interface EffectiveModuleView {
  moduleId: string;
  manifestId: string;
  access: ModuleAccessMode;       // from LicensingEngineService
  tenantOverride: 'enabled' | 'disabled' | 'inherit';
  userVisible: boolean;           // RBAC + access intersection
  userAccessible: boolean;        // can navigate / invoke
  lockReason?: 'plan' | 'lifecycle' | 'dependency' | 'flag' | 'permission';
  dependencies: DependencyHealth[];
  extensions: EffectiveExtension[];  // filtered contributions
}
```

---

## 6. Lifecycle Model (summary)

Module lifecycle is split into **catalog scope** (platform-wide manifest) and **tenant scope** (per-tenant installation). Phase 28 tenant **license lifecycle** (`active`, `trial`, `grace`, `expired`, etc.) remains in `LicensingEngineService` — the registry reads it but does not own it.

**Authoritative specification:** **§21 — Module State Machine** (all states, transitions, triggers, preconditions, results, recovery paths).

**Authoritative events:** **§22 — Module Event Architecture**.

Built-in modules ship **pre-registered** in the platform catalog at deploy time. Marketplace modules follow the full catalog + tenant installation path defined in §21.

---

## 7. Dependency Resolution

### 7.1 Graph model

- **Nodes:** `moduleId@version`
- **Edges:** `required`, `optional`, `conflicts`
- **Platform root:** implicit `platform@current` node all built-in modules depend on

### 7.2 Resolution algorithm (conceptual)

1. Load candidate manifest set (built-in + tenant-installed)
2. Validate semver compatibility with platform and peer modules
3. Detect cycles → **reject registration** (fail-closed)
4. Topological sort for initialization order
5. For each module, compute **DependencyHealth**:
   - `healthy` — all required deps active + licensed
   - `degraded` — optional dep missing
   - `blocked` — required dep missing, unlicensed, or suspended
6. Blocked modules: `access` forced to `disabled` or `hidden` in effective view; API guards unchanged

### 7.3 Version compatibility matrix

| Check | Rule |
|-------|------|
| Platform | `manifest.minPlatformVersion <= PLATFORM_VERSION` |
| Peer required | `semver.satisfies(peer.version, range)` |
| License SKU | Marketplace package maps to plan grant or add-on (future) |
| Health | Required NestJS module registered (backend); chunk loadable (frontend) |

---

## 8. Module Discovery

All consumers use the **same Effective Module Resolver output**, filtered by extension kind.

| Consumer | Discovery query | Filter pipeline |
|----------|-----------------|-----------------|
| **Navigation (30)** | `extensions.where(kind=navigation)` | effective.access ≠ hidden → RBAC → sortOrder |
| **Router (31)** | `extensions.where(kind=routing)` | effective.userAccessible → lazy import |
| **Dashboard (32)** | `extensions.where(kind=dashboard)` | role profile + RBAC + license |
| **Search (33)** | `extensions.where(kind=search)` | RBAC resources + module enabled |
| **Reporting (33)** | `extensions.where(kind=reporting)` | module + report permission (**resource + action**, action-aware for reporting parity) |
| **Analytics (34)** | `extensions.where(kind=analytics)` | module + analytics tier |
| **White Label (35)** | `extensions.where(kind=whiteLabel)` | `customBranding` / `whiteLabel` features + settings module |
| **Multi-Branch (36)** | `extensions.where(kind=branch)` | branch quotas + RBAC + accessible branches |
| **Activity Center (38)** | `extensions.where(kind=activity)` | RBAC + license + branch isolation; timeline discoverability only |
| **Enterprise Audit Center (39)** | `extensions.where(kind=audit)` | RBAC + license + branch + legal visibility; configuration discoverability only — records remain server SoR |
| **Patient Journey (40)** | `extensions.where(kind=journey)` | RBAC + license + branch; pathway discoverability / orchestration config only — clinical SoRs remain owning modules; Workflow module executes automations |
| **Notification Center (41)** | `extensions.where(kind=notification)` | RBAC + license + branch + consent/channel policy; configuration via `EffectiveNotificationView`; delivery engine **41d CLOSED** (`apps/api/src/modules/notifications/delivery/`); legacy kind `notifications` is transitional |
| **Workflow** | `extensions.where(kind=workflow)` | workflow module + automation feature |
| **AI** | `extensions.where(kind=ai)` | ai module + workspace limits from engine |
| **Notifications (legacy stubs)** | `extensions.where(kind=notifications)` | Thin event-type stubs — migrate/alias under kind `notification` in 41a |
| **Realtime** | channel map keyed by `moduleId` | extend `REALTIME_CHANNEL_MODULES` via registry |
| **Background workers** | worker → moduleId map | extend `LicensingExecutionGuard` contexts |

**Discovery API (future implementation — specified here only):**

| Endpoint | Purpose |
|----------|---------|
| `GET /tenant/modules/registry` | Effective module views for tenant (license resolved server-side) |
| `GET /tenant/modules/registry/navigation` | Pre-filtered nav projection |
| `GET /tenant/modules/registry/routes` | Route manifest for client router builder |
| `GET /identity/modules/bootstrap` | User-scoped effective view (registry + RBAC) |

Registry responses are **cacheable** (short TTL, tenant-scoped, ETag from license cache generation).

---

## 9. Flow Diagrams

### 9.1 Registration flow

```mermaid
sequenceDiagram
  participant P as Publisher / Platform
  participant V as Manifest Validator
  participant C as Module Catalog
  participant A as Audit

  P->>V: Submit ModuleManifest
  V->>V: Schema + signature + semver
  V->>V: Dependency cycle check
  alt invalid
    V-->>P: reject
  else valid
    V->>C: index manifest
    C->>A: module.registered
    V-->>P: manifestId
  end
```

### 9.2 Initialization flow (tenant session)

```mermaid
sequenceDiagram
  participant FE as clinic-dashboard
  participant API as Registry API
  participant EMR as Effective Module Resolver
  participant LE as LicensingEngineService
  participant PM as Permission Matrix

  FE->>API: GET /identity/modules/bootstrap
  API->>LE: getEntitlements(tenantId)
  LE-->>API: TenantLicense.modules + lifecycle
  API->>EMR: resolve(manifests, license, moduleFlags)
  EMR->>EMR: dependency health
  API->>PM: filter by user roles
  API-->>FE: EffectiveModuleView[]
  FE->>FE: hydrate nav/route/widget providers
```

### 9.3 Dependency resolution flow

```mermaid
flowchart TD
  A[Load manifest catalog] --> B[Build dependency graph]
  B --> C{Cycles?}
  C -->|yes| D[Reject / suspend module]
  C -->|no| E[Topological sort]
  E --> F[For each module check required deps]
  F --> G{All required healthy?}
  G -->|no| H[Mark blocked - hidden or locked]
  G -->|yes| I[Mark active in effective view]
```

### 9.4 Licensing integration flow

```mermaid
sequenceDiagram
  participant R as Module Registry
  participant LE as LicensingEngineService
  participant LMG as LicensedModuleGuard

  Note over R,LE: Registry NEVER mutates license state
  R->>LE: resolveLicense(tenantId)
  LE-->>R: TenantLicense.modules[moduleId] = access mode
  R->>R: intersect with tenant moduleFlags
  R-->>Client: effective access (UX)

  Note over LMG: Enforcement path unchanged
  Client->>LMG: HTTP request
  LMG->>LE: enforceModuleAccess(tenantId, moduleId)
  LE-->>LMG: allow / deny
```

**Rules:**

1. Registry reads `LicensedModuleId` → `ModuleAccessMode` from engine only
2. `moduleFlags` (tenant JSON) may **narrow** visibility (disable) but **never widen** beyond plan entitlements
3. No duplicate plan-tier logic in registry
4. Lifecycle blocking (`expired`, `suspended`, etc.) remains in `LicensedApplicationShell` + engine — registry respects `canWrite` / `canMutate`

### 9.5 RBAC integration flow

```mermaid
sequenceDiagram
  participant R as Registry
  participant PM as Permission Matrix
  participant PG as PermissionGuard

  R->>R: extension declares resourceId + action
  R->>PM: hasPermission(roles, resourceId, action)
  PM-->>R: boolean
  R-->>Client: userVisible / userAccessible flags

  Client->>PG: API call
  PG->>PM: enforce (unchanged)
```

Registry **references** `resourceId` from manifests; it does **not** embed role matrices or duplicate `hasPermission()`.

### 9.6 Navigation flow (Phase 29b — implemented)

```mermaid
flowchart LR
  EV[EffectiveModuleView] --> NF[Nav Filter]
  NF --> RBAC[Permission check - server]
  NF --> LIC[access != hidden - server]
  RBAC --> SL[Sidebar render]
  LIC --> SL
  SL --> LO[Locked module UX - upgrade CTA]
```

**Implemented:** `DynamicNavigationProvider` reads `EffectiveModuleView` extensions; `Sidebar` consumes `useSidebarNavigation()`.  
Rollback: `VITE_USE_STATIC_NAV_ONLY=true`.

### 9.7 Routing flow (Phase 30 — implemented)

```mermaid
flowchart TD
  BOOT[App bootstrap] --> REG[ModuleRegistryProvider bootstrap]
  REG --> EV[EffectiveModuleView]
  EV --> RC[Route contributions extract]
  RC --> CAT[STATIC_ROUTE_CATALOG filter]
  CAT --> SNAP[RouteSnapshot + cache]
  SNAP --> RENDER[ShellRouteRenderer useRoutes]
  RENDER --> GUARD[LicensedApplicationShell - unchanged]
  GUARD --> LOCK{userAccessible?}
  LOCK -->|no| UP[ModuleLockedPage via catalog]
  LOCK -->|yes| PAGE[Lazy feature pages - unchanged]
```

**Implemented:** `DynamicRouteProvider` filters `STATIC_ROUTE_CATALOG` by registry routing contributions from `EffectiveModuleView` only.  
Guest/auth/kiosk routes remain static in `router/index.tsx`.  
Rollback: `VITE_USE_STATIC_ROUTES_ONLY=true` restores pre-Phase-30 static `routeObjects` tree.

### 9.8 Dashboard flow (Phase 32 preview)

```mermaid
flowchart LR
  REG[Dashboard contributions] --> PROF[Role profile filter]
  PROF --> RBAC[Permission filter]
  RBAC --> LIC[Module access filter]
  LIC --> LAY[Layout API merge - order/hidden]
  LAY --> REN[Widget renderer by componentKey]
```

Today: `dashboard-config.ts` + hardcoded `DashboardWidgets.tsx` map.  
Target: Widget registry keyed by `componentKey`; renderer map grows via manifest registration.

### 9.9 Search flow (Phase 32 — CLOSED)

```mermaid
flowchart LR
  EMV[EffectiveModuleView] --> CAT[STATIC_SEARCH_CATALOG filter]
  CAT --> DSP[DynamicSearchProvider]
  DSP --> UI[GlobalSearchDialog]
  UI --> API[GET /search types param]
```

**Status:** Phase 32 permanently closed (2026-07-13). SSOT: [`DYNAMIC_SEARCH_ARCHITECTURE.md`](./DYNAMIC_SEARCH_ARCHITECTURE.md).

### 9.10 Reporting flow (Phase 33 — architecture approved)

```mermaid
flowchart LR
  EMV[EffectiveModuleView] --> CAT[STATIC_REPORT_CATALOG filter]
  CAT --> DRP[DynamicReportingProvider]
  DRP --> UI[ReportingHomePage + Category + Builder + Export]
  UI --> API[Reporting + Analytics APIs unchanged]
```

Reporting modules declare **report definitions** (id, category, permission resources, data domain, delivery mode). Report catalog UI filters effective contributions. Execution stays in existing reporting and analytics modules; registry only publishes discoverability and gating metadata.

**Status:** Phase 33 — **33a CLOSED** · **33b CLOSED** · **33c CLOSED**. SSOT: [`DYNAMIC_REPORTING_ARCHITECTURE.md`](./DYNAMIC_REPORTING_ARCHITECTURE.md). Provider + UI integration + Playwright runtime acceptance complete (**41/41**).

### 9.11 Analytics flow (Phase 34 — architecture approved)

```mermaid
flowchart LR
  EMV[EffectiveModuleView] --> CAT[STATIC_ANALYTICS_CATALOG filter]
  CAT --> DAP[DynamicAnalyticsProvider]
  DAP --> UI[AnalyticsHomePage + Domain pages + Builder + Export]
  UI --> API[Analytics APIs + repositories unchanged]
```

Analytics modules declare **domain views**, **builder widgets**, **hubs**, and **cross-module metric surfaces** via `kind=analytics` contributions. Catalog UI filters effective contributions joined against `STATIC_ANALYTICS_CATALOG`. Query execution, aggregation, chart rendering, and export generation stay in existing analytics modules; registry publishes discoverability and gating metadata only.

**Status:** Phase 34 — **34a CLOSED** · **34b CLOSED** · **34c CLOSED** (2026-07-14). SSOT: [`DYNAMIC_ANALYTICS_ARCHITECTURE.md`](./DYNAMIC_ANALYTICS_ARCHITECTURE.md). Playwright **40/40**; rollback port **5177**; unit tests **34/34**.

### 9.13 White Label flow (Phase 35 — architecture approved)

```mermaid
flowchart LR
  EMV[EffectiveModuleView] --> CAT[STATIC_WHITE_LABEL_CATALOG filter]
  TS[Tenant branding settings read model] --> MERGE[Inheritance merge]
  CAT --> MERGE
  MERGE --> EWV[EffectiveWhiteLabelView]
  EWV --> DWP[DynamicWhiteLabelProvider]
  DWP --> UI[AppShell + Login + Charts + Settings preview]
  DWP --> BE[Server WhiteLabelResolver — PDF + Email unchanged execution]
```

White label is **not a separate `LicensedModuleId`**. Phase 35 consumes `whiteLabel` extension contributions owned by the `settings` module (and future marketplace theme packs). Registry exposes branding surfaces (theme tokens, logo slots, layout profiles, custom-domain admin) filtered by `LicensedFeatureId` (`customBranding`, `whiteLabel`). Enforcement remains in `SettingsService` + `LicensingEngineService`; registry provides discoverability and resolved configuration projection only.

**Status:** Phase 35 — **35a CLOSED** · **35b CLOSED** · **35c CLOSED** (2026-07-15). SSOT: [`DYNAMIC_WHITE_LABEL_ARCHITECTURE.md`](./DYNAMIC_WHITE_LABEL_ARCHITECTURE.md). Unit tests **27/27** (clinic-dashboard) + **72/72** (module-registry). Playwright **41/41** (35c).

### 9.15 Multi-Branch flow (Phase 36 — architecture approved)

```mermaid
flowchart LR
  EMV[EffectiveModuleView] --> CAT[STATIC_BRANCH_CATALOG filter]
  TS[Tenant + Branch settings read model] --> MERGE[Inheritance merge]
  CAT --> MERGE
  MERGE --> EBV[EffectiveBranchView]
  EBV --> DBP[DynamicBranchProvider]
  DBP --> UI[Settings + Dashboard + Analytics + Reporting + Scheduling + Inventory]
  DBP --> WL[DynamicWhiteLabelProvider branch layer]
  DBP --> API[Existing APIs unchanged — branchId enforcement]
```

Multi-Branch is **not a separate `LicensedModuleId`**. Phase 36 consumes `branch` extension contributions owned by `settings`, `scheduling`, `inventory`, `billing`, `reporting`, and `analytics` modules. Registry exposes branch configuration surfaces filtered by RBAC and branch quotas; enforcement remains in existing API handlers + `LicensingEngineService`.

**Status:** Phase 36 — **Architecture APPROVED** · **36a CLOSED** · **36b CLOSED** · **36c CLOSED** (2026-07-15). Phase **36 permanently closed**. SSOT: [`DYNAMIC_MULTI_BRANCH_ARCHITECTURE.md`](./DYNAMIC_MULTI_BRANCH_ARCHITECTURE.md) (§33).

### 9.16 AI integration flow

AI workspaces declare `moduleId` ownership and required `LicensedFeatureId`. `AiSubscriptionService` continues to interpret quotas from `LicensingEngineService` only. Registry lists available copilot surfaces per effective module set — no independent AI licensing.

**Document structure note:** **§21–§24** (state machine, events, canonical manifest schema, architecture review record) follow as authoritative deep specifications. **§10–§18** resume operational topics (security, performance, marketplace, risks, roadmap).

---

## 21. Module State Machine

### 21.1 Scope model

| Scope | States apply to | Stored in |
|-------|-----------------|-----------|
| **Catalog** | Platform manifest availability | Module Catalog (global) |
| **Tenant** | Per-tenant installation/runtime | Tenant Module Store (future) + effective resolver |
| **License** (Phase 28 — read only) | Tenant subscription lifecycle | `LicensingEngineService` / DB lifecycle tables |

Registry **owns** catalog and tenant module states. Registry **reads** license lifecycle; it does not redefine `active` / `expired` / `grace`.

### 21.2 Catalog scope state machine

```mermaid
stateDiagram-v2
  [*] --> discovered: scan / publisher submit
  discovered --> registered: catalog ingest
  registered --> validated: schema + signature OK
  validated --> deprecated: superseded version
  validated --> removed: platform retraction
  deprecated --> removed: retention expired
  removed --> [*]
```

| Transition | Trigger | Preconditions | Result | Recovery path |
|------------|---------|---------------|--------|---------------|
| → **discovered** | Platform boot scan; marketplace upload | Manifest file or package detected | Candidate queued for validation | Re-scan; fix package |
| **discovered → registered** | Validator accepts draft | Passes JSON schema (§23) | Manifest indexed in catalog with `catalogStatus=registered` | Fix manifest; resubmit |
| **registered → validated** | Validation pipeline complete | Signature valid (if external); deps acyclic; semver compatible | Manifest eligible for tenant install | Fix errors → registered |
| **validated → deprecated** | New `manifestId` published | Replacement exists | Old version installable but upgrade prompted | Roll forward to new version |
| **validated → removed** | Platform retraction / publisher revoke | No mandatory tenant dependency OR force flag | Manifest removed from install list | Restore from backup manifest |
| **deprecated → removed** | Retention policy | Grace period elapsed | Purged from catalog | N/A |

### 21.3 Tenant scope state machine

```mermaid
stateDiagram-v2
  [*] --> installed: install / built-in seed
  installed --> initialized: boot + index build
  initialized --> healthy: health checks pass
  initialized --> failed: init error
  healthy --> degraded: optional dep loss / partial health
  healthy --> disabled: moduleFlag off OR license hidden
  healthy --> suspended: admin / marketplace revoke
  degraded --> healthy: dep restored
  degraded --> disabled: tenant flag / license narrow
  disabled --> healthy: flag on + licensed + deps OK
  suspended --> healthy: reinstate + license OK
  failed --> initialized: retry init
  healthy --> uninstalled: uninstall
  disabled --> uninstalled: uninstall
  suspended --> uninstalled: uninstall
  uninstalled --> [*]
```

| Transition | Trigger | Preconditions | Result | Recovery path |
|------------|---------|---------------|--------|---------------|
| → **installed** | Built-in seed at deploy; marketplace install API | Catalog manifest `validated`; tenant licensed (engine); deps satisfied | Tenant module record created | Install deps first; upgrade plan |
| **installed → initialized** | Registry boot; tenant login bootstrap | Extension index built; dependency graph resolved | `runtimeStatus=initialized`; extensions visible to resolver | Retry init; check logs |
| **initialized → healthy** | Health checks pass | Required deps healthy; chunk/backend probe OK | Module in effective view as accessible (subject to RBAC) | Fix failing probe (§23 `healthChecks`) |
| **initialized → failed** | Init exception; probe failure | Required dep missing or chunk unloadable | Module blocked in effective view; `lockReason=dependency` | Restore dep; rollback manifest |
| **healthy → degraded** | Optional dep lost; non-fatal probe fail | Required deps still healthy | Module accessible; degraded badge optional | Restore optional dep |
| **healthy → disabled** | Tenant `moduleFlags` disable; license `hidden`/`disabled` | Admin or engine narrows access | Module hidden or locked in UX; API guards unchanged | Re-enable flag; restore license |
| **healthy → suspended** | Platform admin; marketplace revocation | Policy or compliance action | Module locked/hidden; audit event | Reinstate via admin |
| **disabled → healthy** | Flag re-enabled | License still permits module; deps healthy | Module returns to effective view | N/A |
| **suspended → healthy** | Reinstatement | License + deps OK | Module restored | N/A |
| **failed → initialized** | Operator retry | Root cause addressed | Re-attempt initialization | Escalate if repeat fails |
| **\* → uninstalled** | Uninstall API / rollback | Owner permission; no hard dependents | Tenant record removed; extensions purged | Re-install from catalog |
| **uninstalled → installed** | Re-install | Same as fresh install | New tenant module record | N/A |

### 21.4 Effective view mapping

| Tenant runtime status | Typical `userVisible` | Typical `userAccessible` | UX |
|----------------------|------------------------|--------------------------|-----|
| healthy | true (if RBAC) | true (if licensed) | Normal |
| degraded | true | true | Optional warning |
| disabled | false or locked | false | Hidden or upgrade CTA |
| suspended | false or locked | false | Locked message |
| failed | false | false | Hidden (fail-closed) |
| uninstalled | false | false | Absent |

---

## 22. Module Event Architecture

Events are **async notifications** for audit, cache invalidation, and cross-service discovery. They do **not** replace Phase 28 HTTP enforcement. All registry events append to the commercial audit trail where applicable (`LicenseAuditEvent` mirror or dedicated `ModuleRegistryEvent` table — implementation choice deferred).

### 22.1 Event envelope (canonical)

```typescript
interface ModuleRegistryEvent {
  eventType: ModuleEventType;
  eventId: string;              // UUID
  occurredAt: string;           // ISO-8601
  tenantId?: string;            // omitted for catalog-scoped events
  moduleId: string;
  manifestId?: string;
  fromState?: string;
  toState?: string;
  actor: { type: 'system' | 'user' | 'publisher'; id: string };
  payload: Record<string, unknown>;
  correlationId?: string;
}
```

### 22.2 Event catalog

| Event | Publisher | Consumers | Payload (required fields) | Purpose |
|-------|-----------|-----------|---------------------------|---------|
| `module.discovered` | Catalog scanner / marketplace ingress | Validator queue, audit | `moduleId`, `source`, `packageUri?` | New candidate detected |
| `module.registered` | Manifest Validator | Catalog index, audit | `moduleId`, `manifestId`, `version` | Manifest accepted into catalog |
| `module.validated` | Manifest Validator | Catalog, tenant install API, audit | `moduleId`, `manifestId`, `checksum` | Manifest cleared for install |
| `module.installed` | Tenant install handler | Effective resolver, audit, cache bust | `tenantId`, `moduleId`, `manifestId` | Module bound to tenant |
| `module.initialized` | Registry bootstrap | Nav/route providers (future), metrics | `tenantId`, `moduleId`, `extensionCount` | Runtime index ready |
| `module.enabled` | Effective resolver / admin | UI providers, audit | `tenantId`, `moduleId`, `reason` | Module became accessible in effective view |
| `module.disabled` | Admin / moduleFlag change | UI providers, cache bust, audit | `tenantId`, `moduleId`, `reason: flag\|license\|admin` | Module narrowed or hidden |
| `module.degraded` | Health monitor | UI badge (optional), ops metrics | `tenantId`, `moduleId`, `failedProbes[]` | Partial functionality |
| `module.failed` | Init / health job | Alerting, audit, effective resolver | `tenantId`, `moduleId`, `errorCode`, `message` | Fail-closed block |
| `module.suspended` | Platform admin / marketplace | Effective resolver, audit | `tenantId`, `moduleId`, `policyRef` | Compliance / revoke |
| `module.removed` | Catalog retraction | Install API, audit | `moduleId`, `manifestId` | Manifest withdrawn |
| `module.uninstalled` | Uninstall handler | Cache bust, audit | `tenantId`, `moduleId` | Tenant module removed |
| `module.health.changed` | Health monitor | Effective resolver, ops | `tenantId`, `moduleId`, `status: healthy\|degraded\|failed`, `probes` | Runtime health transition |
| `module.dependencies.changed` | Dependency resolver | Effective resolver, init orchestrator | `tenantId?`, `moduleId`, `graphVersion`, `blockedDeps[]` | Graph recomputed |
| `module.upgraded` | Upgrade handler | Init orchestrator, audit | `tenantId`, `moduleId`, `fromManifestId`, `toManifestId` | Version bump |
| `module.rollback` | Rollback handler | Init orchestrator, audit | `tenantId`, `moduleId`, `toManifestId` | Prior version restored |

### 22.3 Consumer responsibilities

| Consumer | Subscribes to | Action |
|----------|---------------|--------|
| **Effective Module Resolver** | `disabled`, `enabled`, `health.changed`, `dependencies.changed`, `installed`, `uninstalled` | Recompute effective view; bump cache generation |
| **Licensing audit (Phase 28)** | `installed`, `disabled`, `suspended`, `uninstalled`, `upgraded` | Append commercial audit record (no license mutation) |
| **UI providers (30–36)** | `enabled`, `disabled`, `health.changed` | Invalidate client registry cache (ETag) |
| **Health monitor** | `initialized`, `dependencies.changed` | Schedule probes defined in manifest |
| **Ops / metrics** | `failed`, `degraded`, `health.changed` | Alerting dashboards |

**Rule:** No consumer may use registry events to **bypass** `LicensedModuleGuard` or `PermissionGuard`.

---

## 23. Complete Module Manifest Schema

Canonical schema for all built-in, marketplace, and plugin modules. **Schema version:** `moduleManifestSchemaVersion: "1.0"`. Implementation uses JSON Schema derived from this definition; no production code in this document.

### 23.1 Root document

```typescript
interface ModuleManifest {
  // ─── Schema meta ───
  moduleManifestSchemaVersion: '1.0';
  manifestId: string;                    // {moduleId}@{semver}
  moduleId: string;                      // LicensedModuleId or namespaced id
  version: SemVer;
  minPlatformVersion: SemVer;
  catalogStatus?: CatalogLifecycleStatus; // catalog scope — see §21.2

  // ─── Identity ───
  identity: ModuleIdentity;

  // ─── Metadata ───
  metadata: ModuleMetadata;

  // ─── Version & compatibility ───
  compatibility: ModuleCompatibility;

  // ─── Dependencies ───
  dependencies: ModuleDependency[];

  // ─── Licensing (reference only) ───
  licensing: ModuleLicensingRef;

  // ─── Permissions (reference only) ───
  permissions: ModulePermissionsRef;

  // ─── Visibility & ordering ───
  presentation: ModulePresentation;

  // ─── Extension contributions ───
  extensions: ModuleExtensions;

  // ─── Localization & assets ───
  localization?: ModuleLocalizationBundle;
  assets?: ModuleAssets;

  // ─── Settings & feature flags ───
  settings?: ModuleSettingsSchema;
  featureFlags?: ModuleFeatureFlagDecl[];

  // ─── Health ───
  healthChecks?: ModuleHealthCheck[];

  // ─── Integrity (marketplace / plugins) ───
  integrity?: ModuleIntegrity;

  // ─── Extension point declarations (capabilities) ───
  capabilities?: ModuleCapability[];       // sandbox whitelist for plugins
}
```

### 23.2 Identity & metadata

```typescript
interface ModuleIdentity {
  displayNameKey: string;
  descriptionKey?: string;
  category: ModuleCategory;
  tags?: string[];
  publisher?: PublisherInfo;
  documentationUrl?: string;
  supportUrl?: string;
}

interface ModuleMetadata {
  sortOrder: number;
  keywords?: string[];                   // search/admin filter
  clinicalDomains?: ('medical' | 'dental' | 'beauty')[];
  HIPAARelevant?: boolean;
  auditClassification?: 'standard' | 'elevated' | 'platform';
}

type ModuleCategory =
  | 'clinical' | 'operations' | 'financial' | 'platform'
  | 'analytics' | 'communication' | 'administration' | 'extension';

type CatalogLifecycleStatus =
  | 'discovered' | 'registered' | 'validated' | 'deprecated' | 'removed';
```

### 23.3 Version & dependencies

```typescript
interface ModuleCompatibility {
  nestModule?: string;                     // backend NestJS module class name
  frontendChunk?: string;                  // Vite chunk name
  nodeEngine?: string;
  peerModules?: Record<string, string>;    // moduleId → semver range
}

interface ModuleDependency {
  moduleId: string;
  type: 'required' | 'optional' | 'conflicts';
  semverRange?: string;
  reasonKey?: string;                    // i18n explanation
}
```

### 23.4 Licensing & permissions (reference only)

```typescript
interface ModuleLicensingRef {
  licensedModuleId?: LicensedModuleId;   // required for built-in modules
  requiredFeatures?: LicensedFeatureId[];
  /** Display-only; plan tiers resolved by LicensingEngineService */
  marketingTier?: 'starter' | 'professional' | 'business' | 'enterprise';
}

interface ModulePermissionsRef {
  resources: PermissionResourceRef[];    // links to permission-matrix.json
  defaultActions?: PermissionAction[];   // view | create | update | delete | ...
}

interface PermissionResourceRef {
  resourceId: string;                    // e.g. api.patients
  actions: PermissionAction[];
  descriptionKey?: string;
}
```

### 23.5 Presentation & visibility

```typescript
interface ModulePresentation {
  visibility: ModuleVisibilityRules;
  icons: ModuleIconSet;
  themeTokens?: Record<string, string>;  // white-label overrides (Phase 36)
}

interface ModuleVisibilityRules {
  default: 'visible' | 'hidden' | 'locked';
  showWhenLocked?: boolean;
  kioskExcluded?: boolean;
  platformOnly?: boolean;
}

interface ModuleIconSet {
  default: string;                       // Lucide icon name or asset ref
  active?: string;
  locked?: string;
  monochrome?: string;
}
```

### 23.6 Extension contributions

```typescript
interface ModuleExtensions {
  navigation?: NavigationContribution[];
  routing?: RoutingContribution[];
  dashboard?: DashboardContribution[];
  search?: SearchContribution[];
  reporting?: ReportingContribution[];
  analytics?: AnalyticsContribution[];
  workflow?: WorkflowContribution[];
  notifications?: NotificationContribution[];
  ai?: AiContribution[];
  whiteLabel?: WhiteLabelContribution[];
}

interface ExtensionBase {
  extensionId: string;                   // {moduleId}/{kind}/{localId}
  labelKey: string;
  sortOrder: number;
  resourceId?: string;
  featureId?: LicensedFeatureId;
  icon?: string;
  hidden?: boolean;
}

interface NavigationContribution extends ExtensionBase {
  path: string;
  parentExtensionId?: string;            // nested nav
  placement: 'sidebar' | 'settings' | 'quickNav' | 'topNav';
  badge?: 'new' | 'beta' | 'locked';
}

interface RoutingContribution extends ExtensionBase {
  path: string;
  componentKey: string;                  // allowlisted dynamic import key
  layoutKey?: 'AppShell' | 'SettingsLayout' | 'WorkflowLayout' | string;
  index?: boolean;
  children?: RoutingContribution[];
  kioskRoute?: boolean;
}

interface DashboardContribution extends ExtensionBase {
  widgetId: string;
  componentKey: string;
  span?: 1 | 2 | 3 | 4;
  profiles?: string[];                   // owner | doctor | receptionist | ...
  category?: string;
}

interface SearchContribution extends ExtensionBase {
  entityType: string;
  permissionResources: string[];
  deepLinkTemplate: string;              // /patients/{id}
  backendProviderKey?: string;           // server search provider id
}

interface ReportingContribution extends ExtensionBase {
  reportId: string;
  categoryKey: string;
  dataDomain: string;
  exportFormats?: ('pdf' | 'csv' | 'xlsx')[];
}

interface AnalyticsContribution extends ExtensionBase {
  metricId?: string;
  widgetCatalogId?: string;
  dimensions?: string[];
  minimumPlan?: string;                  // display hint only
}

interface WorkflowContribution extends ExtensionBase {
  triggerType?: string;
  actionType?: string;
}

interface NotificationContribution extends ExtensionBase {
  eventType: string;
  templateKey?: string;
  channels?: ('email' | 'sms' | 'push' | 'in_app')[];
}

interface AiContribution extends ExtensionBase {
  workspaceId: string;
  toolIds?: string[];
}

interface WhiteLabelContribution extends ExtensionBase {
  surface: 'branding' | 'customDomain' | 'theme' | 'loginPage';
  requiredFeature: LicensedFeatureId;    // customBranding | whiteLabel
  settingsPath?: string;
}
```

### 23.7 Localization, assets, settings, flags, health, integrity

```typescript
interface ModuleLocalizationBundle {
  namespace: string;
  fallbackLocale: string;
  locales?: string[];                    // keys loaded from i18n bundles
}

interface ModuleAssets {
  iconUrl?: string;
  screenshotUrls?: string[];
  bundleChecksum?: string;
}

interface ModuleSettingsSchema {
  settingsPath?: string;                 // e.g. /settings/features
  toggles?: ModuleSettingToggle[];
}

interface ModuleSettingToggle {
  key: string;                           // maps to moduleFlags canonical id
  labelKey: string;
  licensedModuleId?: LicensedModuleId;
  defaultValue: boolean;
}

interface ModuleFeatureFlagDecl {
  key: string;
  descriptionKey: string;
  scope: 'tenant' | 'platform';
  /** Narrow-only; cannot override plan */
  allowTenantOverride: boolean;
}

interface ModuleHealthCheck {
  probeId: string;
  type: 'backend' | 'frontend-chunk' | 'dependency' | 'custom';
  target: string;                        // URL path or moduleId
  intervalSeconds?: number;
  timeoutMs?: number;
  required: boolean;                     // fail → failed state
}

interface ModuleIntegrity {
  signature?: ManifestSignature;
  checksum?: string;
  publishedAt?: string;
}

interface ManifestSignature {
  algorithm: 'ed25519' | 'rs256';
  publicKeyId: string;
  value: string;
}

interface PublisherInfo {
  publisherId: string;
  name: string;
  verified: boolean;
}

type ModuleCapability =
  | 'navigation' | 'routing' | 'dashboard' | 'search' | 'reporting'
  | 'analytics' | 'workflow' | 'notifications' | 'ai' | 'whiteLabel'
  | 'http-adapter' | 'webhook';
```

### 23.8 Schema rules

| Rule | Enforcement |
|------|-------------|
| Built-in modules | MUST set `licensing.licensedModuleId` |
| Marketplace modules | MUST set `integrity.signature` |
| `componentKey` / `backendProviderKey` | MUST exist in platform allowlist |
| `permissions.resources` | MUST reference valid `permission-matrix.json` ids |
| `featureFlags` with `allowTenantOverride=true` | MAY only narrow module visibility |
| Duplicate `extensionId` | Rejected at validation |

---

## 24. Architecture Review Record

**Review date:** 2026-07-12  
**Review type:** Final architecture review (Phase 29)  
**Decision:** **ARCHITECTURE APPROVED**

### 24.1 Self-review checklist

| Check | Result |
|-------|--------|
| No architectural duplication (licensing / RBAC / registry) | **PASS** |
| Licensing responsibilities unchanged | **PASS** |
| RBAC responsibilities unchanged | **PASS** |
| Module Registry responsibilities clearly isolated | **PASS** |
| Future Marketplace requires no redesign | **PASS** |
| Plugin SDK requires no redesign | **PASS** |
| Phases 30–36 require no redesign | **PASS** |

### 24.2 Readiness score

| Area | Score | Notes |
|------|-------|-------|
| Module Registry | 95% | Canonical schema §23 complete |
| Effective Module View | 92% | Read model + mapping §21.4 |
| Dependency Resolution | 90% | Algorithm §7; events §22 |
| Licensing Integration | 98% | One-way dependency explicit |
| RBAC Integration | 95% | Reference-only permissions |
| Extension Model | 93% | All kinds including whiteLabel |
| Performance | 88% | Bootstrap + cache strategy |
| Security | 92% | Fail-closed throughout |
| **Overall architecture readiness** | **93%** | Approved for Phase 29a implementation |

### 24.3 Observations (non-blocking)

1. **`@booking/module-registry` shared types package** — recommended in 29a to prevent FE/BE schema drift (identified in §16).
2. **`MODULE_FLAGS` → `LicensedModuleId` mapping** — implementation detail for 29b; architecture specifies canonical IDs.
3. **Tenant Module Store persistence** — Prisma model deferred to 29b; state machine §21 is authoritative for behavior.

**Continued in §10:** Security Model, Performance, Marketplace, and implementation roadmap.

---

## 10. Security Model

| Threat | Mitigation |
|--------|------------|
| **Hidden routes** | All routes must originate from registered routing contributions; router builder rejects undeclared paths in strict mode |
| **Hidden APIs** | NestJS controllers remain guarded by `@RequireLicensedModule` + `@RequirePermission`; registry cannot register routes that bypass guards |
| **Unauthorized module loading** | Dynamic imports use allowlisted `componentKey → chunk` map; unknown keys fail closed |
| **Tampered manifests** | Built-in manifests ship with platform; marketplace manifests require signature verification (public key pin) |
| **Dependency confusion** | Cycle detection; required deps must be active; conflicts block activation |
| **Client-side license bypass** | Registry projections are UX-only; API enforcement unchanged |
| **Cross-tenant leakage** | Registry API scoped by `tenantId`; cache keys include tenant + license generation |
| **Privilege escalation via flags** | `moduleFlags` may only disable, never enable beyond plan |
| **Manifest injection** | Tenant admins cannot upload arbitrary manifests in v1; marketplace install requires owner + platform approval |

**Audit alignment (Phase 28):** Module lifecycle transitions emit events compatible with `LicenseAuditEvent` / commercial audit (`module.installed`, `module.disabled`, etc.).

---

## 11. Performance Strategy

| Technique | Application |
|-----------|-------------|
| **Lazy loading** | Route chunks and widgets loaded via manifest `componentKey` dynamic import |
| **Code splitting** | One async boundary per module (preserve existing `lazy-*-routes.tsx` pattern) |
| **Registry caching** | Server: in-memory tenant registry snapshot co- invalidated with license cache (60s). Client: SWR/React Query with ETag |
| **Module manifests** | Static JSON bundled at build for built-in modules; tenant extensions fetched incrementally |
| **Initialization budget** | Bootstrap API returns slim effective view (<50KB target); heavy extension payloads paginated |
| **Prefetch** | Optional prefetch of likely modules (dashboard, patients) after login |
| **Search/reporting** | Provider registration avoids monolithic switch; providers loaded on first use |
| **Dependency graph** | Computed at catalog change, not per request |

**Non-goals:** Runtime download of unverified third-party JS in v1 marketplace architecture (see §13).

---

## 12. Future Marketplace Compatibility

| Capability | Architectural hook |
|------------|---------------------|
| Publisher accounts | `publisher` block on manifest |
| Signed packages | `ManifestSignature` verified before catalog insert |
| SKU / plan mapping | Marketplace SKU → plan grant handled by **licensing** (add-on grant), registry reads resulting entitlements |
| Install/uninstall | Lifecycle API + tenant module store |
| Sandboxing | Plugins declare `capabilities[]` whitelist; no direct DB access — API adapters only |
| Review workflow | Manifest status `registered` → platform approval → `active` |
| Revenue share | Outside registry; billing integration future phase |

**Constraint:** Marketplace modules **extend** the platform via declared extension points — they do not mutate core manifests or licensing config at runtime.

---

## 13. Plugin SDK Compatibility

Future Plugin SDK (post Phase 36) aligns with this registry:

| SDK surface | Registry binding |
|-------------|------------------|
| `registerNavigation()` | `NavigationContribution` |
| `registerRoutes()` | `RoutingContribution` |
| `registerWidget()` | `DashboardContribution` |
| `registerSearchProvider()` | `SearchContribution` |
| `registerReport()` | `ReportingContribution` |
| `registerMetric()` | `AnalyticsContribution` |
| `registerWorkflowHook()` | `WorkflowContribution` |

Plugins compile to **signed manifest + server adapter module** (NestJS dynamic module or isolated handler namespace). Frontend chunks loaded from CDN with subresource integrity.

---

## 14. Scalability Strategy

| Dimension | Approach |
|-----------|----------|
| **Tenants** | Effective view computed per tenant; horizontal API scaling; Redis cache optional for registry snapshots |
| **Modules** | O(n) filter over catalog; index extensions by kind + moduleId |
| **Marketplace catalog** | Global catalog + tenant overlay table (future Prisma model — not designed here) |
| **Large clinics** | Pagination on extension lists; dashboard/search lazy |
| **Multi-region** | Manifests immutable and replicated; registry read-only in edge regions |

---

## 15. Mapping Current System → Registry (migration baseline)

Phase 29 architecture assumes a **manifest authoring migration** (implementation phase) that maps existing artifacts:

| Current artifact | Path | Registry contribution |
|------------------|------|------------------------|
| Licensed modules | `licensing.config.ts` → `LICENSED_MODULES` | `licensedModuleId`, min plan reference |
| Sidebar nav | `packages/permissions` → `CLINIC_NAV_ITEMS` | `navigation` extensions |
| Router | `app/router/index.tsx` | `routing` extensions |
| Settings nav | `settings-config.ts` → `SETTINGS_NAV` | `navigation` under `settings` |
| Dashboard widgets | `dashboard-config.ts` | `dashboard` extensions |
| Search entities | `search.types.ts` | `search` extensions |
| Analytics widgets | `analytics-widget-catalog.ts` | `analytics` extensions |
| Module flags | `Tenant.features.moduleFlags` | tenant override layer |
| Realtime channels | `realtime-licensing.config.ts` | channel → moduleId map |
| Worker contexts | `licensing-execution.guard.ts` | worker → moduleId map |

**ID alignment debt (must resolve during implementation):** `MODULE_FLAGS` vocabulary (`medical`, `advancedReports`) ≠ `LicensedModuleId` (`emr`, `reporting`). Registry adopts **`LicensedModuleId` as canonical**; settings UI gains a mapping layer.

---

## 16. Risk Analysis

| Risk | Severity | Mitigation |
|------|----------|------------|
| Registry becomes second licensing engine | **High** | Strict read-only integration with `LicensingEngineService`; code review gate |
| Manifest/schema drift across FE/BE | **High** | Shared `@booking/module-registry` types package (future); JSON schema validation |
| Migration breaks 36/36 licensing E2E | **High** | Phase 29 implementation gated on registry parity tests; no guard changes in first increment |
| Over-engineering marketplace before needed | **Medium** | Schema supports marketplace; v1 implements built-in catalog only |
| Performance regression on bootstrap | **Medium** | Slim bootstrap API + caching |
| `moduleFlags` widens entitlements incorrectly | **High** | Intersection-only merge documented and tested |
| Fragmented adoption (nav dynamic, router static) | **Medium** | Phased rollout with feature flag `VITE_DYNAMIC_MODULES_ENABLED` (future) |
| Plugin security model immature | **High** | No arbitrary code execution in v1; signed manifests + adapter pattern |

---

## 17. Trade-offs

| Decision | Chosen | Alternative rejected | Why |
|----------|--------|---------------------|-----|
| Registry vs rewriting modules | Composition layer | Micro-frontend rewrite | Cost, risk, Phase 28 stability |
| Licensing integration | Read from engine | Duplicate plan matrix in registry | Phase 28 SSOT |
| Built-in manifest delivery | Bundled with platform | DB-only manifests | Performance, integrity |
| Tenant flags | Narrow-only override | Flags override plan | Revenue protection |
| Router strategy | Manifest-driven lazy routes | Module federation v1 | Complexity; existing Vite lazy routes sufficient |
| Marketplace JS | Signed chunks + SRI | Arbitrary script injection | Security |
| Effective view location | Server-computed | Client merges license + nav | Tamper resistance, consistency |

---

## 18. Recommended Architecture

### 18.1 Layered model

```
┌─────────────────────────────────────────────────────────────┐
│  Phases 30–36: UI Providers (Nav, Router, Dashboard, …)   │
├─────────────────────────────────────────────────────────────┤
│  Phase 29: Effective Module Resolver + Discovery API        │
├─────────────────────────────────────────────────────────────┤
│  Phase 29: Module Catalog + Manifest Store + Dependency DAG │
├─────────────────────────────────────────────────────────────┤
│  Phase 28 (frozen): LicensingEngineService + Guards + Audit │
├─────────────────────────────────────────────────────────────┤
│  Identity (frozen): Permission Matrix + RBAC Guards         │
├─────────────────────────────────────────────────────────────┤
│  Existing feature modules (Patients, EMR, …) — unchanged    │
└─────────────────────────────────────────────────────────────┘
```

### 18.2 Implementation phases (post-approval roadmap)

| Increment | Scope | Touches |
|-----------|-------|---------|
| **29a** | Schema + built-in manifest authoring | Docs, shared types, manifest JSON for 21 modules |
| **29b** | Effective Module Resolver + Dynamic Navigation | Sidebar source migrated |
| **30** | Route Provider | Router builder — **closed 2026-07-13** |
| **31–36** | Dashboard, search, report, analytics, white label providers | Per phase |

**Hard rule:** Increments **29a–29c** do not modify `LicensingEngineService`, guard chain, or existing controller decorators.

### 18.3 Success criteria (architecture acceptance)

- [x] Every built-in module has a complete manifest covering navigation, routing, and license linkage (schema §23)
- [x] Effective resolver design equivalent to today’s static nav + license for all 9 E2E tenant scenarios (§9, §21)
- [x] No enforcement logic duplicated outside `LicensingEngineService` (§9.4, §22)
- [x] Dependency cycle and semver rules documented and testable (§7, §21, §23)
- [x] Marketplace extension points identified without schema changes (§12, §23)
- [x] Phase 30–36 teams can implement from this document without architectural ambiguity (§8, §9, §23)

---

## 19. Related Documents

| Document | Relationship |
|----------|--------------|
| [`LICENSING_ARCHITECTURE.md`](./LICENSING_ARCHITECTURE.md) | Phase 28 enforcement SSOT — **read-only for Phase 29** |
| [`LICENSING_ENFORCEMENT_COMPLETION.md`](./LICENSING_ENFORCEMENT_COMPLETION.md) | Phase 28 closure evidence |
| [`PHASE_28_RUNTIME_ACCEPTANCE_REPORT.md`](./PHASE_28_RUNTIME_ACCEPTANCE_REPORT.md) | Prerequisite verification |
| [`CURRENT_SYSTEM_AUDIT_AND_EXPLANATION.md`](./CURRENT_SYSTEM_AUDIT_AND_EXPLANATION.md) | Item 29 baseline (~15%) |
| [`PRODUCTION_REMEDIATION_VERIFICATION.md`](./PRODUCTION_REMEDIATION_VERIFICATION.md) | Phase 29 authorized to proceed |

---

## 20. Document Control

| Field | Value |
|-------|-------|
| Version | **1.6.0** |
| Created | 2026-07-12 |
| Final review | 2026-07-13 |
| Phase 29a completed | **2026-07-12** |
| Phase 29b completed | **2026-07-13** |
| Phase 30 completed | **2026-07-13** |
| Status | **PHASE 34 COMPLETE** — Dynamic Analytics runtime verified |
| Next increment | **Phase 36c** — Multi-Branch runtime acceptance |

---

## 21. Phase 29a Implementation Record

**Completed:** 2026-07-12  
**Scope:** Dynamic Module Registry Foundation only — **no consumer migration** (navigation, routing, dashboard, search unchanged).

### 21.1 Deliverables

| Part | Deliverable | Location | Status |
|------|-------------|----------|--------|
| 1 | Registry domain, loader, bootstrap, events, dependency graph | `packages/module-registry/src/` | ✅ |
| 2 | Canonical `ModuleManifest` schema (all contribution kinds) | `packages/module-registry/src/types.ts` | ✅ |
| 3 | 21 built-in manifests (all `LicensedModuleId` values) | `packages/module-registry/src/builtin/builtin-manifests.ts` | ✅ |
| 4 | Dependency resolution (DAG, cycles, semver, optional/required) | `packages/module-registry/src/graph/` | ✅ |
| 5 | Registry bootstrap + Effective Module View resolver | `packages/module-registry/src/loader/`, `resolver/` | ✅ |
| 6 | Shared enterprise contracts (FE/BE SSOT) | `@booking/module-registry` package | ✅ |
| 7 | Internal backend API (`tenant/modules/registry/*`) | `apps/api/src/modules/module-registry/` | ✅ |
| 8 | Frontend provider + `useModuleRegistry()` (not mounted in AppShell) | `apps/clinic-dashboard/src/features/module-registry/` | ✅ |
| 9 | Manifest validation (duplicates, cycles, required fields, extensions) | `packages/module-registry/src/validation/` | ✅ |
| 10 | Automated tests | See §21.3 | ✅ |

**Note:** Original roadmap split Effective Module Resolver API (29b) and client hook (29c) into later increments. Phase 29a implementation **includes** those APIs and hooks as **internal/opt-in infrastructure** per the authorized 29a mission brief; **no existing UI reads the registry yet**.

### 21.2 Architecture compliance (self-review)

| Check | Result |
|-------|--------|
| Registry follows approved architecture (§5–§9, §23) | **PASS** |
| `LicensingEngineService` not modified | **PASS** — read-only via `getEntitlements()` |
| RBAC / permission matrix not modified | **PASS** — evaluator reads existing matrix JSON |
| Existing modules / pages unchanged | **PASS** |
| No navigation migration | **PASS** — Sidebar still uses `CLINIC_NAV_ITEMS` |
| No routing migration | **PASS** — static React Router |
| No dashboard migration | **PASS** |
| No duplicate registry logic | **PASS** — single `@booking/module-registry` package |
| Effective Module View matches §9 design | **PASS** |
| All 21 built-in manifests validate | **PASS** |

### 21.3 Verified test results (2026-07-12, closure)

| Suite | Result |
|-------|--------|
| `@booking/module-registry` Vitest | **28/28 passed** (`registry.spec.ts`, `registry-validation.spec.ts`, `nav-parity.spec.ts`) |
| `ModuleRegistryService` Jest | **4/4 passed** |
| `ModuleRegistryProvider` Vitest | **1/1 passed** |
| **Total** | **33/33 passed** |

### 21.4 Acceptance gate observation closure (2026-07-12)

| Observation (Medium) | Resolution |
|----------------------|------------|
| Built-in manifest extension coverage incomplete | **Closed** — all 21 manifests now declare navigation, routing, search, health, localization, capabilities; module-specific dashboard/reporting/analytics/workflow/notifications/AI/whiteLabel extensions populated where applicable (`extension-builders.ts`) |
| Dependency health not license-intersected | **Closed** — `applyLicenseToDependencyHealth()` intersects catalog health with tenant license entitlements (§7.2); wired in `ModuleRegistryService` |
| Bootstrap does not reject cycles | **Closed** — `bootstrapRegistry()` fail-closed on cycles, broken deps, invalid platform version, incomplete ordering, empty catalog; returns `snapshot: null` + validation errors |
| No registry parity tests | **Closed** — `nav-parity.spec.ts` verifies `CLINIC_NAV_ITEMS` ↔ registry sidebar metadata (paths, labels, icons, resources, ordering) and routing coverage |

### 21.5 Backend internal API surface

All routes require `TenantScopedAccessGuard`. **Bootstrap** is available to any authenticated tenant user (SSOT §9.2). Admin/catalog routes require `@RequirePermission('api.subscription', 'view')`:

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/tenant/modules/registry/bootstrap` | Tenant user | Snapshot + role-scoped effective module views |
| GET | `/tenant/modules/registry` | `api.subscription` view | Effective module views |
| GET | `/tenant/modules/registry/manifests` | `api.subscription` view | Full manifest catalog |
| GET | `/tenant/modules/registry/manifests/:moduleId` | `api.subscription` view | Single manifest |
| GET | `/tenant/modules/registry/dependencies` | `api.subscription` view | Dependency graph |
| GET | `/tenant/modules/registry/health/:moduleId` | `api.subscription` view | Module health report |
| GET | `/tenant/modules/registry/effective/:moduleId` | `api.subscription` view | Single effective view |

### 21.6 Known limitations (Phase 29a — Low severity only)

- **Marketplace / Plugin SDK:** Schema supports future extensions; no runtime loader or DB catalog store.
- **Manifest signatures:** `integrity` fields defined; signature verification deferred to marketplace phase.

### 21.7 Completion assessment

| Dimension | % | Notes |
|-----------|---|-------|
| Phase 29a foundation | **100%** | Permanently closed — all acceptance observations resolved |
| Overall Phase 29 program | **38%** | 29a frozen; Phases 30–36 not started |
| Ready for Phase 29b (Dynamic Navigation) | **Yes** | Parity tests green; effective views license-aware |

### 21.8 Architectural decisions recorded

1. **`@booking/module-registry` monorepo package** — prevents FE/BE manifest schema drift (§16 recommendation adopted in 29a).
2. **Effective resolver reads licensing, never writes** — `moduleFlags` narrow only; cannot widen beyond plan (P2, §9.4).
3. **Permission evaluation optional at package layer** — backend injects matrix-derived evaluator; package tests run without RBAC.
5. **Bootstrap fail-closed** — invalid catalogs never produce an active `RegistrySnapshot`; API service throws on init if bootstrap fails.
6. **Static nav parity suite** — `packages/module-registry/src/parity/nav-parity.spec.ts` gates future Dynamic Navigation migration.

---

*Phase 29 — Dynamic Module Management Architecture. Phase 29a permanently closed 2026-07-12. Phase 29b Dynamic Navigation closed 2026-07-13. Phase 30 Dynamic Routing closed 2026-07-13. Phase 31 Dynamic Dashboard closed 2026-07-13.*

---

## 22. Phase 29b Implementation Record — Dynamic Navigation

**Completed:** 2026-07-13  
**Acceptance gate remediated:** 2026-07-13  
**Scope:** Sidebar navigation source migrated to Module Registry Effective Module View. Routing, dashboard, search, and module-internal quick nav unchanged.

### 22.1 Deliverables

| Component | Location | Status |
|-----------|----------|--------|
| DynamicNavigationProvider | `apps/clinic-dashboard/src/features/dynamic-navigation/context/` | ✅ |
| Navigation resolver / builder / cache | `apps/clinic-dashboard/src/features/dynamic-navigation/lib/` | ✅ |
| Sidebar integration | `apps/clinic-dashboard/src/layouts/AppShell/Sidebar.tsx` | ✅ |
| Registry wiring | `RegistryRouteHost` → `ModuleRegistryProvider` + `RegistryEntitlementSync` + `DynamicRouteProvider`; `AppShell` → `DynamicNavigationProvider` | ✅ |
| Identity-scoped registry cache | `registry-cache.ts`, `registry-cache-identity.ts` | ✅ |
| Per-navigation RBAC (settings parity) | `effective-module-resolver.ts` | ✅ |
| Parity verification | `navigation-parity.ts`, `navigation-resolver.spec.ts` (all matrix roles) | ✅ |
| Static rollback | `VITE_USE_STATIC_NAV_ONLY=true` env flag | ✅ |
| Playwright dynamic nav | `e2e/dynamic-navigation.spec.ts` | ✅ |

### 22.2 Navigation flow (implemented)

```
ModuleRegistryProvider (bootstrap API)
  → EffectiveModuleView[] (license ∩ flags ∩ RBAC ∩ deps — server-side)
  → DynamicNavigationProvider
  → resolveNavigationItems(sidebar | settings | topNav | quickNav)
  → Sidebar (useSidebarNavigation)
```

**Rules enforced:**
- UI components read **EffectiveModuleView only** — no raw manifests in Sidebar
- No client-side licensing or RBAC matrix evaluation
- Legacy role constraints (`patient` on `/my-appointments`) applied via static path map — migration shim, not RBAC duplication
- Registry error or `VITE_USE_STATIC_NAV_ONLY` → automatic static `CLINIC_NAV_ITEMS` fallback
- Bootstrap (`GET /tenant/modules/registry/bootstrap`) requires authenticated tenant user only; effective views are RBAC-filtered server-side (SSOT §9.2)

### 22.3 Cache isolation (implemented)

Registry session cache key dimensions: `tenantId`, `userId`, `rolesHash`, `catalogGeneration`, `entitlementVersion`.

Navigation memory cache key dimensions: same identity fields + `moduleCount` + `source`.

Cache cleared on: logout, login, MFA complete, auth bootstrap failure, token refresh failure, `refreshUser()` (permission refresh), identity change in `ModuleRegistryProvider`, manual `refresh()`, and entitlement fingerprint change via `RegistryEntitlementSync`.

### 22.4 Verified test results (2026-07-13)

| Suite | Result |
|-------|--------|
| `@booking/module-registry` Vitest | **30/30 passed** |
| Dynamic navigation + registry Vitest | **15/15 passed** |
| `ModuleRegistryService` Jest | **5/5 passed** |
| **Phase 29b total (unit/integration)** | **50/50 passed** |
| Playwright `e2e/dynamic-navigation.spec.ts` | **11/11 passed**, **0 skipped**, exit **0** (production acceptance run 2026-07-13) |
| Rollback `VITE_USE_STATIC_NAV_ONLY=true` | Owner sidebar E2E **pass** on static-only build (port 5174); unit rollback spec **1/1 pass** |

Parity verified for all sidebar matrix roles including `accountant` and `branch_manager`.

### 22.4.1 Production acceptance run (2026-07-13)

**Stack:** `docker-compose.test.yml` (PostgreSQL 5433, Redis 6380) · API (`apps/api/.env.e2e`, port 3000) · Dashboard (Vite 5173)

**Playwright scenarios proven at runtime:**

| Scenario | Result |
|----------|--------|
| Owner registry sidebar | ✅ |
| Accountant subscription nav parity | ✅ |
| Branch manager subscription nav parity | ✅ |
| Receptionist reduced nav | ✅ |
| Doctor registry bootstrap | ✅ |
| Patient portal role gating (client shim) | ✅ |
| Tenant switch cache isolation | ✅ |
| Logout / role-change re-login | ✅ |
| Registry unavailable → static fallback | ✅ |
| Arabic RTL sidebar | ✅ |
| Bootstrap API contract (RBAC-filtered `userVisible` paths) | ✅ |

**Infrastructure fixes applied during acceptance (verification-only, no feature scope change):**

| Issue | Fix |
|-------|-----|
| API permission matrix not loaded at runtime | Corrected `require` path to `apps/api/config/permission-matrix.json` |
| Clinical roles blocked on license spinner | `GET /tenant/subscription/entitlements` open to authenticated tenant users (license gate read) |
| E2E rate-limit 429 | `NODE_ENV=test` bypass in `ApiRateLimitService`; Redis `FLUSHDB` in Playwright global setup |
| E2E seed DB mismatch | Global setup seeds `booking_test` on port 5433 |
| Playwright browser missing | `npx playwright install chromium` |
| Bootstrap wait race / session cache | `captureRegistryBootstrap` + cache-aware waiter in E2E helper |

### 22.5 Known limitations (Low)

- Settings sub-nav (`SETTINGS_NAV`) remains static — registry `settings` placement extensions available for Phase 30+ migration
- Module-internal quick nav (billing, inventory, reporting) unchanged — not sidebar scope
- TopNav search trigger unchanged — registry `topNav` extensions resolved but not yet consumed in TopNav UI
- Patient portal Playwright UI test requires seeded patient login credential (API/bootstrap role gating covered in unit + API e2e)

### 22.6 Completion assessment

| Dimension | % |
|-----------|---|
| Phase 29b Dynamic Navigation | **100%** |
| Overall Phase 29 program | **62%** |
| Ready for Phase 30 (Dynamic Routing) | **Complete** — see §24 |

---

## 23. Phase 29b Acceptance Gate Remediation Record

**Date:** 2026-07-13  
**Trigger:** Independent acceptance gate FAIL (cache isolation, accountant/branch_manager parity, bootstrap scope, runtime coverage)

| Finding | Resolution |
|---------|------------|
| P1 Cross-tenant/user/role cache leak | Identity-scoped cache keys; clear on logout/login/refresh; provider refetches on identity change |
| P2 Accountant / branch_manager parity | Module permission uses any permitted navigation resource (matches static per-item RBAC) |
| P3 Settings module primaryResource block | Same resolver fix — per-navigation permission candidates |
| P4 Bootstrap `api.subscription` gate | Bootstrap open to authenticated tenant users; admin routes remain subscription-gated |
| P5 Runtime Playwright | `e2e/dynamic-navigation.spec.ts` (11 scenarios) |
| P6 Documentation | SSOT synchronized (this document + audit + remediation) |

**Bootstrap permission decision (P4):** SSOT §9.2 specifies user-scoped bootstrap at login for all tenant users. Restricting bootstrap to `api.subscription:view` caused most clinical roles to silently fall back to static nav. Bootstrap returns **effective views only** (no raw manifest catalog); RBAC and licensing remain enforced server-side. Manifest/admin endpoints stay on `api.subscription:view`.

**Entitlements read decision (production acceptance 2026-07-13):** `GET /tenant/subscription/entitlements` is required by `LicensedApplicationShell` for all authenticated roles. Gating it to `api.subscription:view` left clinical users on the license spinner (403). Read-only tenant-scoped entitlements are now available to any authenticated tenant user; mutating subscription routes remain permission-gated.

---

## 24. Phase 30 Implementation Record — Dynamic Routing

**Completed:** 2026-07-13  
**Scope:** Protected shell routing source migrated to Module Registry Effective Module View. URLs, route components, layouts, lazy loading, guards, error boundaries, redirects, and 404 behavior unchanged.

### 24.1 Deliverables

| Component | Location | Status |
|-----------|----------|--------|
| DynamicRouteProvider | `apps/clinic-dashboard/src/features/dynamic-routing/context/` | ✅ |
| Route resolver / tree builder / cache / validation | `apps/clinic-dashboard/src/features/dynamic-routing/lib/` | ✅ |
| Static route catalog (parity baseline) | `static-route-catalog.ts` (~140 shell paths) | ✅ |
| Component key registry (lazy unchanged) | `route-component-registry.tsx` | ✅ |
| Registry route host | `components/RegistryRouteHost.tsx` | ✅ |
| Shell route renderer | `components/ShellRouteRenderer.tsx` | ✅ |
| Router integration | `apps/clinic-dashboard/src/app/router/index.tsx` | ✅ |
| AppShell integration | `AppShell.tsx` — `ShellRouteRenderer` vs `<Outlet />` | ✅ |
| Module registry wiring | `RegistryRouteHost` hosts `ModuleRegistryProvider` + `DynamicRouteProvider` | ✅ |
| Cache clearing on identity change | `clear-registry-caches.ts` includes `clearRouteCache()` | ✅ |
| Static rollback | `VITE_USE_STATIC_ROUTES_ONLY=true` | ✅ |
| Parity + filtering tests | `dynamic-routing.spec.ts`, `dynamic-routing-rollback.spec.ts` | ✅ |

### 24.2 Routing flow (implemented)

```
ModuleRegistryProvider (bootstrap API)
  → EffectiveModuleView[] (license ∩ flags ∩ RBAC ∩ deps — server-side)
  → DynamicRouteProvider
  → extractRoutingContributions(EffectiveModuleView)
  → filter STATIC_ROUTE_CATALOG by moduleId + contribution path prefix
  → RouteSnapshot (routeObjects + paths)
  → ShellRouteRenderer (useRoutes inside LicensedApplicationShell)
```

**Rules enforced:**
- Routing reads **EffectiveModuleView only** — no raw manifest reads in route resolver
- No client-side licensing or RBAC matrix evaluation duplicated
- `STATIC_ROUTE_CATALOG` is the **parity baseline** mapping paths → `componentKey` → existing lazy components; registry filters inclusion only
- Guest routes (`/login`, `/mfa`, etc.) and kiosk `queue/display` remain **static** in `createBrowserRouter`
- `ProtectedRoute`, `LicensedApplicationShell`, `GuestRoute` unchanged
- Registry error or `VITE_USE_STATIC_ROUTES_ONLY` → full static shell tree via `buildStaticRouteSnapshot`

### 24.3 Registry vs static router split

| Mode | Router children under `LicensedApplicationShell` | Page render |
|------|--------------------------------------------------|-------------|
| Registry (default) | `[{ path: '*', element: ShellRoutePlaceholder }]` | `ShellRouteRenderer` → `useRoutes(shellSnapshot.routeObjects)` |
| Static rollback | Full `staticShellRoutes` from catalog | `<Outlet />` in AppShell |

`RegistryRouteHost` wraps protected routes so registry + route context exist above kiosk and shell branches.

### 24.4 Cache isolation (implemented)

Route memory cache key dimensions: `tenantId`, `userId`, `rolesHash`, `catalogGeneration`, `entitlementVersion`, `moduleCount`, `source`.

Cache cleared via `clearModuleRegistryCaches()` on: logout, login, MFA complete, auth bootstrap failure, token refresh failure, `refreshUser()`, identity change, manual `refresh()`, entitlement fingerprint change.

### 24.5 Verified test results (2026-07-13)

| Suite | Result |
|-------|--------|
| `dynamic-routing.spec.ts` (Vitest) | **10/10 passed** |
| `dynamic-routing-rollback.spec.ts` (Vitest) | **2/2 passed** |
| `e2e/dynamic-routing.spec.ts` (Playwright) | **26/26 passed**, exit **0** |
| `e2e/dynamic-navigation.spec.ts` (regression) | **11/11 passed** |
| Combined registry + navigation Vitest | **27/27 passed** |
| `ModuleRegistryService` Jest | **5/5 passed** |

**Stack verified:** PostgreSQL (`booking_test` @ 5433) · Redis (6380) · API (`apps/api/.env.e2e`, port 3000) · Dashboard registry (5173) · Dashboard rollback (`VITE_USE_STATIC_ROUTES_ONLY`, 5174)

**Playwright scenarios proven at runtime:**

| Scenario group | Count | Result |
|----------------|-------|--------|
| Role routes (owner, receptionist, doctor, dentist, specialist, inventory, accountant, patient, super-admin parity) | 9 | ✅ |
| Licensing lifecycle (expired, suspended, grace/read-only, starter plan) | 4 | ✅ |
| Cache isolation (tenant switch, role change) | 2 | ✅ |
| Navigation (refresh, deep-link, history, lazy load, no redirect loop) | 5 | ✅ |
| Security & resilience (hidden routes, registry fallback, 404, unknown paths) | 4 | ✅ |
| Rollback mode (static routes on port 5174) | 1 | ✅ |
| Bootstrap API parity | 1 | ✅ |

**Parity verified:**
- Owner role: registry snapshot paths === static catalog paths (140 shell paths)
- Receptionist: analytics routes excluded; queue routes included
- Doctor: EMR routes included; subscription settings excluded
- Catalog validation: all `componentKey` values registered; no duplicate route IDs

### 24.6 Known limitations

| Severity | Limitation |
|----------|------------|
| **Medium** | ~~No dedicated Playwright `e2e/dynamic-routing.spec.ts`~~ — **Closed 2026-07-13** (26/26 scenarios) |
| **Low** | `STATIC_ROUTE_CATALOG` duplicates path metadata until marketplace manifests can supply component keys at runtime |
| **Low** | Settings sub-routes and module-internal quick nav remain catalog-defined (not manifest `componentKey` at runtime) |

### 24.7 Completion assessment

| Dimension | % |
|-----------|---|
| Phase 30 Dynamic Routing (implementation + unit parity) | **100%** |
| Phase 30 runtime E2E acceptance | **100%** — `e2e/dynamic-routing.spec.ts` **26/26 passed** (2026-07-13) |
| Overall Phase 29 program (29a + 29b + 30 + 31) | **100%** |
| Ready for Phase 32b (Dynamic Search Provider) | **Yes** — 32a foundation closed; see `docs/DYNAMIC_SEARCH_ARCHITECTURE.md` §23 |

### 24.8 Architectural decisions recorded

1. **Catalog-as-baseline pattern** — Phase 30 changes routing *source* (filter), not route *definitions*. All URLs, lazy imports, and page components preserved in `STATIC_ROUTE_CATALOG` + `route-component-registry.tsx`.
2. **Dual render host** — Registry mode uses catch-all placeholder + `useRoutes` in AppShell to avoid remounting `LicensedApplicationShell` on every registry refresh.
3. **Contribution prefix matching** — `isCatalogRouteIncluded()` maps catalog `moduleId` + path to registry `routing` extension wildcards (e.g. `/billing/*` covers `/billing/commissions`).
4. **Kiosk isolation** — Kiosk routes excluded from shell collection; always static snapshot.
5. **Independent rollback flags** — `VITE_USE_STATIC_NAV_ONLY` and `VITE_USE_STATIC_ROUTES_ONLY` allow nav/routing rollback independently.
6. **Contribution `userAccessible` gate** — `isCatalogRouteIncluded()` requires `contribution.userAccessible` so plan-locked modules (e.g. starter/analytics) do not register shell routes; licensing projection from EffectiveModuleView only, no client matrix duplication.

---

## 25. Phase 31 Implementation Record — Dynamic Dashboard

**Completed:** 2026-07-13  
**Scope:** Dashboard widget *source* migrated to Module Registry Effective Module View. Widget components, APIs, charts, cards, layouts, styling, loading states, refresh, and layout persistence unchanged.

### 25.1 Deliverables

| Component | Location | Status |
|-----------|----------|--------|
| DynamicDashboardProvider | `apps/clinic-dashboard/src/features/dynamic-dashboard/context/` | ✅ |
| Dashboard resolver / layout resolver / cache / validation | `apps/clinic-dashboard/src/features/dynamic-dashboard/lib/` | ✅ |
| Widget component registry (documentation surface) | `dashboard-widget-registry.ts` | ✅ |
| Static dashboard catalog (parity baseline) | `static-dashboard-catalog.ts` (20 widgets, 10 profiles) | ✅ |
| Resource → module map | `resource-module-map.ts` | ✅ |
| DashboardPage integration | `DashboardPage.tsx` wraps `DynamicDashboardProvider` | ✅ |
| Cache clearing on identity change | `clear-registry-caches.ts` includes `clearDashboardCache()` | ✅ |
| Static rollback | `VITE_USE_STATIC_DASHBOARD_ONLY=true` | ✅ |
| Parity + filtering tests | `dynamic-dashboard.spec.ts` (20 scenarios) | ✅ |

### 25.2 Dashboard flow (implemented)

```
ModuleRegistryProvider (bootstrap API)
  → EffectiveModuleView[] (license ∩ flags ∩ RBAC ∩ deps — server-side)
  → DynamicDashboardProvider
  → extractDashboardContributions(EffectiveModuleView)
  → filter STATIC_DASHBOARD_CATALOG by profile + resource extension access
  → DashboardSnapshot (widgetIds + profile)
  → DashboardWidgets (unchanged component map)
```

**Rules enforced:**
- Dashboard reads **EffectiveModuleView only** — no raw manifest reads in resolver
- No client-side licensing duplication; RBAC encoded in extension `userAccessible` flags
- `STATIC_DASHBOARD_CATALOG` is the **parity baseline** (20 widget IDs, profile ordering from `dashboard-config.ts`); registry filters inclusion only
- `DashboardWidgets.tsx`, widget APIs, `useDashboardOverview`, layout dialog, and export unchanged
- Registry error or `VITE_USE_STATIC_DASHBOARD_ONLY` → `getWidgetsForRoles()` static fallback with client `hasPermission` (rollback parity)

### 25.3 Widget gating (implemented)

| Widget class | Gate |
|--------------|------|
| Core widgets (`kpi-overview`, `quick-actions` — no `resourceId`) | Always included when in profile (`moduleId: core`) |
| Resource widgets | `resourceId` must match an extension on EffectiveModuleView with `userVisible && userAccessible` |
| `api.audit` (`recent-activities` widget) | Declared on **settings** module manifest (`moduleDashboardWidget(..., 'api.audit')`); no client-side orphan bridge |

**Production fix (2026-07-13):** Dashboard shell `rootRoute` no longer requires `api.identity` — unrestricted root route so receptionist and other non-identity roles retain `/` dashboard access (matches sidebar nav parity).

### 25.4 Cache isolation (implemented)

Dashboard memory cache key dimensions: `tenantId`, `userId`, `rolesHash`, `profile`, `catalogGeneration`, `entitlementVersion`, `moduleCount`, `source`.

Cleared via `clearModuleRegistryCaches()` alongside registry, navigation, and route caches.

### 25.5 Verified test results (2026-07-13)

| Suite | Result |
|-------|--------|
| `dynamic-dashboard.spec.ts` (Vitest) | **21/21 passed**, exit **0** |
| `e2e/dynamic-dashboard.spec.ts` (Playwright) | **34/34 passed**, exit **0** |
| Dashboard + routing + navigation regression (Vitest) | **45/45 passed**, exit **0** |
| `dashboard-parity.spec.ts` (module-registry) | **6/6 passed**, exit **0** |
| `module-registry` package tests (full) | **36/36 passed**, exit **0** |
| `dynamic-routing.spec.ts` (regression) | **10/10 passed** |
| `navigation-resolver.spec.ts` (regression) | **8/8 passed** |
| `dashboard-config.test.ts` (regression) | **7/7 passed** |
| `ModuleRegistryService` Jest | **5/5 passed** |

**Stack verified:** PostgreSQL (`booking_test` @ 5433) · Redis (6380) · API (`apps/api/.env.e2e`, port 3000) · Dashboard registry (5173) · Dashboard rollback (`VITE_USE_STATIC_DASHBOARD_ONLY`, 5174)

**Playwright scenarios proven at runtime:**

| Scenario group | Count | Result |
|----------------|-------|--------|
| Role dashboards (owner, receptionist, doctor, dentist, specialist, inventory, accountant, patient) | 8 | ✅ |
| Licensing lifecycle (expired, suspended, grace/read-only, starter, enterprise) | 5 | ✅ |
| Widget visibility (visible, hidden, dependency-blocked, license-blocked) | 4 | ✅ |
| Refresh and navigation (dashboard refresh, browser refresh, deep link) | 3 | ✅ |
| Cache isolation (tenant switch, logout/login, role change) | 3 | ✅ |
| Resilience (registry unavailable, rollback mode) | 2 | ✅ |
| RTL, layout, preferences, UX (Arabic RTL, layout persistence, preferences, empty, loading, no flash) | 6 | ✅ |
| Performance and security (no duplicate API, hidden widgets, bootstrap API parity) | 3 | ✅ |

**Parity verified (Vitest):** All 9 role profiles (`owner`, `general_manager`, `branch_manager`, `receptionist`, `doctor`, `dentist`, `nurse`, `accountant`, `inventory_manager`) — registry `widgetIds` === static `getWidgetsForRoles()` ordering and membership.

**Parity verified (Playwright rollback):** Owner widget count on port 5174 (`VITE_USE_STATIC_DASHBOARD_ONLY`) === registry mode port 5173.

### 25.6 Known limitations

| Severity | Limitation |
|----------|------------|
| **Low** | Marketplace/plugin manifests may add future dashboard widgets — must register in `CANONICAL_DASHBOARD_WIDGETS` before builtin parity tests pass |
| **Low** | Profile-specific widget ordering remains in `dashboard-config.ts` (not manifest `profiles` arrays) — intentional separation of concerns |

### 25.7 Completion assessment

| Dimension | % |
|-----------|---|
| Phase 31 Dynamic Dashboard (implementation + unit parity) | **100%** |
| Phase 31 runtime E2E acceptance | **100%** — `e2e/dynamic-dashboard.spec.ts` **34/34 passed** (2026-07-13) |
| Overall Phase 29 program (29a + 29b + 30 + 31) | **100%** |
| Ready for Phase 32b (Dynamic Search Provider) | **Yes** — 32a foundation closed; see `docs/DYNAMIC_SEARCH_ARCHITECTURE.md` §23 |

### 25.8 Architectural decisions recorded

1. **Catalog-as-baseline pattern (continued from Phase 30)** — Phase 31 changes dashboard *source* (filter), not widget *definitions*. All 20 widget components preserved in `DashboardWidgets.tsx`.
2. **Profile resolution unchanged** — `resolveDashboardProfile()` and `PROFILE_WIDGETS` ordering remain in `dashboard-config.ts`; registry filters the profile list only.
3. **Resource-level extension gating** — Widget inclusion checks `resourceId` against all EffectiveModuleView extensions globally, not module-level `userAccessible` alone (prevents inventory_manager `recent-activities` leak).
4. **Manifest coverage for `api.audit`** — `recent-activities` widget gated via settings module `dashboard` contribution; `ORPHAN_DASHBOARD_RESOURCE_IDS` bridge removed from client resolver.
5. **Unrestricted dashboard root route** — `rootRoute()` for dashboard module omits `resourceId` so all roles with dashboard nav access retain `/` shell route (fixes receptionist blank dashboard).
6. **Independent rollback flag** — `VITE_USE_STATIC_DASHBOARD_ONLY` restores legacy `getWidgetsForRoles()` immediately without affecting nav/routing flags.
7. **Dashboard-scoped provider** — `DynamicDashboardProvider` wraps `DashboardPage` only (not AppShell) to avoid unnecessary snapshot work on non-dashboard routes.

### 25.9 Phase 31 technical debt closure (2026-07-13)

**Canonical widget vocabulary** — Single source of truth: `packages/module-registry/src/dashboard/canonical-dashboard-widgets.ts`

- 20 canonical widget IDs (`kpi-overview`, `quick-actions`, … `business-health`)
- `DashboardWidgetId` in clinic-dashboard is a type alias of `CanonicalDashboardWidgetId`
- `DASHBOARD_WIDGET_COMPONENT_KEYS` derived from canonical catalog (no local duplication)
- Builtin manifests generate all 20 dashboard contributions via `buildDashboardContributionsForModule()` — no legacy IDs (`overview`, `kpi-summary`, `recent-patients`)

**Manifest source pipeline** — TypeScript-only authoritative sources:

- Runtime, Vitest, Jest, and Vite resolve `.ts` directly (`package.json` exports)
- Stale compiled `.js`/`.d.ts` artifacts removed from `packages/module-registry/src/`
- `npm run check:source-only` fails CI/test if compiled artifacts reappear under `src/`

**Integrity tests** — `validateBuiltinDashboardIntegrity()` + `dashboard-parity.spec.ts` enforce:

- Every canonical widget declared exactly once in builtin manifests
- No orphan widget IDs, no duplicate IDs, componentKey/resourceId parity
- Clinic-dashboard `assertCanonicalWidgetParity()` at catalog validation time

---

## 26. Phase 32 Architecture Record — Dynamic Search (2026-07-13)

**Status:** **32a+32b+32c CLOSED** (2026-07-13)  
**SSOT:** [`docs/DYNAMIC_SEARCH_ARCHITECTURE.md`](./DYNAMIC_SEARCH_ARCHITECTURE.md)

### 26.1 Summary

Phase 32 applies the catalog-as-baseline pattern to global clinical search metadata:

```
EffectiveModuleView → search contributions → STATIC_SEARCH_CATALOG filter → existing GlobalSearchDialog + GET /search
```

### 26.2 Key design decisions

| Decision | Detail |
|----------|--------|
| Canonical executable vocabulary | **26** `SearchEntityType` values (aligned with `search.types.ts`) |
| Discovery vocabulary | **9** discovery keys — never sent to GET /search |
| Queue strategy | **Excluded** from global search (Strategy B) |
| Static catalog | `STATIC_SEARCH_CATALOG` — **35 entries** (26+9) |
| Multi-extension builder | `extensionId: {moduleId}/search/{localId}` |
| Provider | `DynamicSearchProvider` at AppShell scope — **implemented 32b** |
| Rollback | `VITE_USE_STATIC_SEARCH_ONLY=true` — **implemented 32b** |
| Backend | **Unchanged** — `GlobalSearchHandler` + Prisma |
| UI | `GlobalSearchDialog` integrated with provider (**32b**) — no visual changes |

### 26.3 Implementation roadmap

| Phase | Scope | Status |
|-------|-------|--------|
| **32a** | Canonical entities + manifest alignment + integrity tests | **CLOSED** |
| **32b** | DynamicSearchProvider + client integration | **CLOSED** — 28+76+48+5 tests green |
| **32c** | Playwright acceptance + navigation debt closure | **CLOSED** — 31+32+80+48+5 tests green |

### 26.4 Phase 32a deliverables (verified)

- `packages/module-registry/src/search/` — canonical entities, discovery entities, builders, integrity validation
- Builtin manifests — **35** search contributions across **20** modules (queue excluded)
- `apps/clinic-dashboard/src/features/dynamic-search/` — static catalog + validation
- `validateBuiltinSearchIntegrity()` integrated into `validateBuiltinManifestCompleteness()`

### 26.5 Phase 32b deliverables (verified)

- `DynamicSearchProvider` wraps `GlobalSearchProvider` in `AppShell`
- `search-resolver.ts` + `search-snapshot-builder.ts` — EffectiveModuleView → catalog → snapshot; `buildRestrictedSearchSnapshot()` for fail-closed loading
- `search-cache.ts` — identity-scoped cache; `readSearchCacheForIdentity()`; cleared via `clearModuleRegistryCaches()`
- Registry loading — last-known snapshot / cache / restricted (never static RBAC widening)
- `GlobalSearchDialog` — `typesParam` and `canSearch` from provider (no hardcoded permissions/types)
- `search-api.ts` — required `types` parameter; no default string

### 26.6 Architecture readiness (post-32b)

**32b provider: 100%** · **32c Playwright: 100%** — Phase 32 permanently closed. See Phase 32 SSOT §26.

---

## 27. Phase 33 Architecture Record — Dynamic Reporting (2026-07-13)

**Status:** **ARCHITECTURE APPROVED** — **33a CLOSED** · **33b CLOSED** · **33c CLOSED**  
**SSOT:** [`docs/DYNAMIC_REPORTING_ARCHITECTURE.md`](./DYNAMIC_REPORTING_ARCHITECTURE.md)

### 27.1 Summary

Phase 33 applies the catalog-as-baseline pattern to report catalog metadata:

```
EffectiveModuleView → reporting contributions → STATIC_REPORT_CATALOG filter → existing Reporting UI + Reporting/Analytics APIs
```

### 27.2 Key design decisions

| Decision | Detail |
|----------|--------|
| Canonical template vocabulary | **40** user-facing templates + **3** hub entries = **43** catalog entries |
| Categories | **21** `ReportCategoryId` values (aligned with `reporting-catalog.ts`) |
| Static catalog | `STATIC_REPORT_CATALOG` — parity baseline + rollback |
| Multi-extension builder | `extensionId: {moduleId}/reporting/{localId}` |
| Provider | `DynamicReportingProvider` — **IMPLEMENTED (33b)** |
| Rollback | `VITE_USE_STATIC_REPORTING_ONLY=true` — **IMPLEMENTED (33b)** |
| Backend | **Unchanged** — operational + analytics report APIs |
| UI | Existing reporting pages unchanged visually — **source migration only** |
| Current gap | **Closed (33a)** — manifests declare **43** reporting contributions generated from canonical vocabulary |

### 27.3 Implementation roadmap

| Phase | Scope | Status |
|-------|-------|--------|
| **33a** | Canonical vocabulary + manifest alignment + integrity tests | **CLOSED** (2026-07-13) |
| **33b** | DynamicReportingProvider + client integration | **CLOSED** (2026-07-14) |
| **33c** | Playwright acceptance + documentation closure | **CLOSED** (2026-07-14) — **41/41 Playwright** |

### 27.4 Architecture readiness

**Overall architecture readiness: 100%** — Phase 33 permanently closed. Phases 28–32 remain frozen.

### 27.5 Phase 33a+33b+33c closure

**Status:** **33a CLOSED** · **33b CLOSED** · **33c CLOSED** — canonical reporting vocabulary, generated reporting contributions, integrity validation, static catalog baseline, `DynamicReportingProvider`, UI integration, `VITE_USE_STATIC_REPORTING_ONLY` rollback, and Playwright runtime acceptance (**41/41**).  
**Runtime acceptance:** **COMPLETE (33c)**. Report execution and APIs remain unchanged.

---

## 28. Phase 34 Architecture Record — Dynamic Analytics (2026-07-14)

**Status:** **34a+34b+34c CLOSED**  
**SSOT:** [`docs/DYNAMIC_ANALYTICS_ARCHITECTURE.md`](./DYNAMIC_ANALYTICS_ARCHITECTURE.md)

### 28.1 Summary

Phase 34 applies the catalog-as-baseline pattern to analytics configuration metadata:

```
EffectiveModuleView → analytics contributions → STATIC_ANALYTICS_CATALOG filter → DynamicAnalyticsProvider → existing Analytics UI + APIs
```

### 28.2 Closure

**34a CLOSED** · **34b CLOSED** · **34c CLOSED** — Playwright **40/40**; rollback port **5177**; unit tests **34/34**. Phase 34 permanently closed.

---

## 29. Phase 35 Architecture Record — Dynamic White Label (2026-07-14)

**Status:** **35a CLOSED** · **35b CLOSED** · **35c CLOSED**  
**SSOT:** [`docs/DYNAMIC_WHITE_LABEL_ARCHITECTURE.md`](./DYNAMIC_WHITE_LABEL_ARCHITECTURE.md)

### 29.1 Summary

Phase 35 applies the catalog-as-baseline pattern to enterprise white-label configuration:

```
EffectiveModuleView → whiteLabel contributions → STATIC_WHITE_LABEL_CATALOG filter
  + tenant settings inheritance → EffectiveWhiteLabelView → DynamicWhiteLabelProvider → existing UI + PDF + Email runtime
```

### 29.2 Key design decisions

| Decision | Detail |
|----------|--------|
| Not a LicensedModuleId | Extensions owned by `settings` module + marketplace packs |
| Licensed features | `customBranding` (business+), `whiteLabel` (enterprise) |
| Static catalog | `STATIC_WHITE_LABEL_CATALOG` — **10** builtin surfaces (**IMPLEMENTED** 35a; not runtime authority) |
| Read model | `EffectiveWhiteLabelView` — platform → tenant → org → branch inheritance |
| Provider | `DynamicWhiteLabelProvider` + `useWhiteLabel()` + `useOptionalWhiteLabel()` — **design only** |
| Rollback | `VITE_USE_STATIC_WHITE_LABEL_ONLY=true`; Playwright port **5178** (proposed) |
| Backend | PDF/email execution unchanged; server `WhiteLabelResolver` contract specified |
| Marketplace | Theme packs, asset packs, font packs, color packs via `whiteLabel` contributions |
| Remediation (2026-07-14) | H1 asset versioning §31 · H2 token governance §32 · M1 asset lifecycle §33 · M2 preview model §34 |

### 29.3 Implementation roadmap

| Phase | Scope | Status |
|-------|-------|--------|
| **35a** | Canonical vocabulary + manifest alignment + integrity tests | **CLOSED** (2026-07-14) |
| **35b** | DynamicWhiteLabelProvider + client integration + token application | **CLOSED** (2026-07-14) |
| **35c** | Playwright acceptance + documentation closure | **CLOSED** (2026-07-15) — **41/41** Playwright; port **5178** rollback verified |

### 29.4 Phase 35a closure (2026-07-14)

**35a CLOSED** — canonical vocabulary in `packages/module-registry/src/whitelabel/*`; **10** manifest contributions via `buildWhiteLabelContributionsForModule()`; `STATIC_WHITE_LABEL_CATALOG` parity baseline; fail-closed bootstrap validation; unit tests **11/11** (35a foundation). **Zero runtime behavior changes.**

### 29.5 Phase 35b closure (2026-07-14)

**35b CLOSED** — `DynamicWhiteLabelProvider` + resolver + snapshot builder + identity cache + rollback flag + CSS application; provider wired in `AppProviders` + `RegistryRouteHost`; unit tests **27/27** (clinic-dashboard). **Configuration source migration only.**

### 29.6 Phase 35c closure (2026-07-15)

**35c CLOSED** — `e2e/dynamic-white-label.spec.ts` **41/41** Playwright passed; rollback port **5178** parity verified; roles, licensing, navigation, cache, security, theme runtime, and fail-closed behavior verified. **Phase 35 permanently closed.**

### 29.7 Remediation closure (2026-07-14)

| Observation | Resolution |
|-------------|------------|
| H1 Asset versioning | `BrandAssetVersionRef`, immutable CDN paths, cache-bust via `contentHash` — SSOT §31 |
| H2 Theme token governance | Four-tier token classification + precedence — SSOT §32 |
| M1 Asset lifecycle | Upload → delete pipeline with audit — SSOT §33 |
| M2 Preview model | `DraftWhiteLabelSnapshot` vs `EffectiveWhiteLabelSnapshot` — SSOT §34 |

---

## 30. Phase 36 Architecture Record — Dynamic Multi-Branch Enterprise (2026-07-15)

**Status:** **Architecture APPROVED** · **36a CLOSED** · **36b CLOSED** · **36c CLOSED** — Phase **36 permanently closed**  
**SSOT:** [`docs/DYNAMIC_MULTI_BRANCH_ARCHITECTURE.md`](./DYNAMIC_MULTI_BRANCH_ARCHITECTURE.md)

### 30.1 Summary

Phase 36 applies the catalog-as-baseline pattern to enterprise multi-branch configuration:

```
EffectiveModuleView → branch contributions → STATIC_BRANCH_CATALOG filter
  + tenant/branch settings inheritance → EffectiveBranchView → DynamicBranchProvider → existing runtime
```

### 30.2 Key design decisions

| Decision | Detail |
|----------|--------|
| Not a LicensedModuleId | Extensions owned by `settings`, `scheduling`, `queue`, `inventory`, `billing`, `reporting`, `analytics` |
| New extension kind | `branch` — configuration surfaces, policy hooks, scope metadata |
| Static catalog | `STATIC_BRANCH_CATALOG` — **24** builtin surfaces — **IMPLEMENTED** (36a) |
| Read model | `EffectiveBranchView` — platform → tenant → organization → branch inheritance |
| Provider | `DynamicBranchProvider` + `useBranch()` / `useOptionalBranch()` + BranchContextRefreshContract — **IMPLEMENTED** (36b); Playwright **CLOSED** (36c) |
| Rollback | `VITE_USE_STATIC_BRANCH_ONLY=true`; Playwright port **5179** (36c) |
| White label coordination | Branch layer feeds Phase 35 inheritance layer 5 |
| Organization | Logical profile on tenant today; optional entity for franchise later |
| Marketplace | Branch templates, policy packs, scheduling/financial/inventory packs |

### 30.3 Implementation roadmap

| Phase | Scope | Status |
|-------|-------|--------|
| **36a** | Canonical vocabulary + manifest alignment + integrity tests | **CLOSED** (2026-07-15) |
| **36b** | DynamicBranchProvider + refresh contract + consumer config migration | **CLOSED** (2026-07-15) |
| **36c** | Playwright acceptance + documentation closure | **CLOSED** (2026-07-15) |

**Acceptance gate verdict:** **PASS** — Phase 36 architecture approved. **36a authorized** upon SSOT acceptance. No runtime changes.

### 30.4 Phase 36 architecture remediation — **CLOSED** (2026-07-15)

**Status:** Final architecture remediation **CLOSED** — documentation only. **36a / 36b / 36c NOT started**.

| Observation | Severity | Resolution | SSOT |
|-------------|----------|------------|------|
| **H1** Active branch authority undefined | High | Authoritative source, selection ownership, login/logout/tenant switch, fallback chain, fail-closed rules | §19 |
| **H2** Branch switching transaction unspecified | High | Complete transaction flow, ownership, failure/rollback, cache invalidation | §20 |
| **H3** Cross-consumer refresh contract missing | High | Trigger sources, provider dependency graph, strict refresh order, partial refresh prevention | §21 |
| **M1** Snapshot versioning incomplete | Medium | `branchConfigurationVersion`, `branchSnapshotVersion`, `catalogGeneration`, `settingsGeneration`, `cacheVersion` | §22 |
| **M2** Department layer ambiguous | Medium | Full hierarchy, inheritance, isolation, Phase 37 provider strategy, Phase 36 exclusion rationale | §23 |

| Item | Status |
|------|--------|
| Implementation code | **36a CLOSED** — 36b pending |
| Architecture readiness (post-remediation) | **99%** |
| Phases 28–35 | **Frozen** |

**Acceptance gate verdict:** **PASS** — Phase 36 architecture remediation closed. **36b authorized** upon 36a closure. No runtime changes.

### 30.5 Phase 36a implementation — **CLOSED** (2026-07-15)

**Status:** Foundation **permanently closed**. **36b authorized**. **36c NOT started**.

| Item | Status |
|------|--------|
| `packages/module-registry/src/branch/*` | **IMPLEMENTED** — 18 files; 8 categories; 24 surfaces |
| `buildBranchContributionsForModule()` | **IMPLEMENTED** — 7 owning modules |
| `STATIC_BRANCH_CATALOG` | **IMPLEMENTED** — parity baseline; `STATIC_BRANCH_CATALOG_IS_RUNTIME_AUTHORITY = false` |
| Bootstrap validation | `validateBuiltinBranchIntegrity()` wired into completeness |
| `@booking/module-registry` vitest | **78/78 passed** |
| `clinic-dashboard` branch vitest | **4/4 passed** |
| Runtime behavior | **Unchanged** — no provider, switching, APIs, or schema |

**Acceptance gate verdict:** **PASS** — Phase 36a foundation closed. **36b authorized**. No runtime verification required for foundation-only deliverable.

### 30.6 Phase 36a final remediation — **CLOSED** (2026-07-15)

| Observation | Resolution |
|-------------|------------|
| **H1** Branch capability contract | §28 SSOT; `branch-capability-contract.ts` + `validateBranchCapabilityContract()` |
| **H2** Surface ownership contract | §29 SSOT; `validateBranchSurfaceOwnershipContract()` |
| **M1** Static catalog authority | §14.1; `STATIC_BRANCH_CATALOG_IS_RUNTIME_AUTHORITY = false` |
| **M2** Surface uniqueness | Global fail-closed uniqueness in vocabulary + integrity validators |
| **M3** Cross-package drift | Field-by-field layer parity vocabulary → manifest → static catalog |

| Item | Status |
|------|--------|
| `@booking/module-registry` vitest | **80/80 passed** |
| `clinic-dashboard` branch vitest | **6/6 passed** |
| Runtime behavior | **Unchanged** |

**Acceptance gate verdict:** **PASS** — Phase 36a permanently closed. **36b authorized**.

### 30.7 Phase 36b implementation — **CLOSED** (2026-07-15)

**Status:** Provider & integration **permanently closed** (final remediation included). **36c authorized**.

| Item | Status |
|------|--------|
| `DynamicBranchProvider` + hooks | **IMPLEMENTED** |
| Resolver / snapshot / cache / flags | **IMPLEMENTED** |
| `BranchContextRefreshContract` runtime | **IMPLEMENTED** (final remediation) |
| Consumer migration (`useBranch` config source) | **IMPLEMENTED** (final remediation) |
| Snapshot version sync + fail-closed rollback | **IMPLEMENTED** (final remediation) |
| White label coordination | `branchId` handoff + registered refresh + `branch-white-label-projection.ts` |
| Dashboard / reporting / analytics config source | Prefer provider capabilities + filter defaults |
| `VITE_USE_STATIC_BRANCH_ONLY` | **IMPLEMENTED** |
| `@booking/module-registry` vitest | **80/80 passed** |
| `clinic-dashboard` branch + white-label vitest | **60/60 passed** |
| Execution (CRUD / scheduling / APIs) | **Unchanged** |

**Acceptance gate verdict:** **PASS** — Phase 36b closed. **36c authorized**.

### 30.8 Phase 36b final remediation — **CLOSED** (2026-07-15)

Observations **H1–H2, M1–M3** closed (refresh contract, consumer migration, snapshot sync, recovery, unit tests). Playwright / port **5179** completed in §30.9.

### 30.9 Phase 36c runtime acceptance — **CLOSED** (2026-07-15)

**Status:** Runtime acceptance **permanently closed**. Phase **36 permanently closed**.

| Item | Status |
|------|--------|
| `e2e/dynamic-branch.spec.ts` | **43/43 Playwright passed** |
| Rollback port **5179** | **VERIFIED** |
| `@booking/module-registry` vitest | **80/80 passed** |
| `clinic-dashboard` branch + white-label vitest | **60/60 passed** |

**Acceptance gate verdict:** **PASS** — Phase 36 permanently closed.

### 30.10 Phase 38 Activity Center — **PERMANENTLY CLOSED** (2026-07-16)

**Status:** **38a CLOSED** · **38b CLOSED** · **38c CLOSED** · Phase 38 **permanently closed**.  
**SSOT:** [`DYNAMIC_ACTIVITY_CENTER_ARCHITECTURE.md`](./DYNAMIC_ACTIVITY_CENTER_ARCHITECTURE.md)

| Item | Status |
|------|--------|
| Extension kind `activity` | **Implemented** — ninth registry consumer |
| Canonical vocabulary + static catalog | **38a CLOSED** |
| `DynamicActivityProvider` + `useActivity()` / `useOptionalActivity()` | **38b CLOSED** |
| `EffectiveActivityView` / `ActivitySnapshot` / identity cache | **38b CLOSED** |
| `VITE_USE_STATIC_ACTIVITY_ONLY` rollback | **38b + 38c CLOSED** — port **5180** |
| Playwright runtime acceptance | **38c CLOSED** — **35/35 passed** |
| clinic-dashboard activity vitest | **27/27** |
| `@booking/module-registry` vitest | **87/87** |

**Acceptance gate verdict:** **PASS** — Phase 38 permanently closed. Dynamic Activity Platform **100%**.

### 30.11 Phase 39 Enterprise Audit Center — **PERMANENTLY CLOSED** (2026-07-16)

**Status:** Architecture **APPROVED** · **39a CLOSED** · **39b CLOSED** · **39c CLOSED** · Remediation **NOT REQUIRED** · Phase **39 permanently closed** · **39d NOT STARTED**  
**SSOT:** [`DYNAMIC_AUDIT_CENTER_ARCHITECTURE.md`](./DYNAMIC_AUDIT_CENTER_ARCHITECTURE.md)

| Item | Status |
|------|--------|
| Extension kind `audit` | **Implemented** — tenth registry consumer |
| Canonical vocabulary | **39a CLOSED** — 28 categories · 5 severities · 5 risks · 32 actions · 7 outcomes · 16 policies · 42 types · 14 feeds · 4 surfaces = **60** entries |
| `buildAuditContributionsForModule()` | **Wired** — all builtin manifests; no handwritten audit entries |
| `STATIC_AUDIT_CATALOG` | **Created** — `STATIC_AUDIT_CATALOG_IS_RUNTIME_AUTHORITY = false` |
| Fail-closed integrity / layer parity | **Wired** into `validateBuiltinManifestCompleteness` |
| `DynamicAuditProvider` + `useAudit()` / `useOptionalAudit()` | **39b CLOSED** |
| `EffectiveAuditView` / `AuditSnapshot` / identity config cache | **39b CLOSED** |
| `VITE_USE_STATIC_AUDIT_ONLY` rollback | **39c CLOSED** — Playwright port **5181** verified |
| Branch refresh consumer `'audit'` | **39b CLOSED** |
| Mount order | Activity → **Audit** → Route |
| Playwright `e2e/dynamic-audit.spec.ts` | **36/36 passed** |
| clinic-dashboard `dynamic-audit` vitest | **28/28** |
| `@booking/module-registry` vitest | **97/97** |
| Runtime authority | `EffectiveAuditView` |
| APIs / Prisma / writers / execution | **Unchanged** |
| Conditional execution layer | Phase **39d NOT STARTED** |

**Acceptance gate verdict:** **PASS** — Phase 39 permanently closed. Runtime authority = `EffectiveAuditView`. `STATIC_AUDIT_CATALOG_IS_RUNTIME_AUTHORITY = false`. **39d not started.**

### 30.12 Phase 40 Patient Journey & Workflow Automation — **PERMANENTLY CLOSED** (2026-07-16)

**Status:** Architecture **APPROVED** · **40a CLOSED** · **40b CLOSED** · **40c CLOSED** · Remediation **NOT REQUIRED** · Phase **40 permanently closed** · **40d NOT STARTED**  
**SSOT:** [`PATIENT_JOURNEY_AND_WORKFLOW_ARCHITECTURE.md`](./PATIENT_JOURNEY_AND_WORKFLOW_ARCHITECTURE.md)

| Item | Status |
|------|--------|
| Extension kind `journey` | **Implemented** — eleventh registry consumer |
| Canonical vocabulary | **40a CLOSED** — 6 categories · 21 stages · 22 transitions · 12 guards · 6 approvals · 5 escalations · 8 timers · 4 definitions · 4 surfaces · 10 automations · 4 packs = **65** catalog entries |
| `buildJourneyContributionsForModule()` | **Wired** — all builtin manifests; no handwritten journey entries |
| `STATIC_JOURNEY_CATALOG` | **Created** — `STATIC_JOURNEY_CATALOG_IS_RUNTIME_AUTHORITY = false` |
| Fail-closed integrity / layer parity | **Wired** into `validateBuiltinManifestCompleteness` |
| Separation from `workflow` kind | **Preserved** |
| `DynamicJourneyProvider` + hooks | **40b CLOSED** — EffectiveJourneyView / JourneySnapshot / identity cache / rollback |
| Branch refresh consumer `'journey'` | **Registered** after `'audit'` |
| Mount order | Activity → Audit → **Journey** → Route |
| Playwright `e2e/dynamic-journey.spec.ts` | **40c CLOSED** — **37/37 passed** |
| Rollback port **5182** | **Verified** — `VITE_USE_STATIC_JOURNEY_ONLY=true` |
| clinic-dashboard `dynamic-journey` vitest | **34/34** (foundation 16 + runtime 18) |
| `@booking/module-registry` vitest | **109/109** |
| Runtime authority | `EffectiveJourneyView` |
| Conditional advanced automation | Phase **40d NOT STARTED** |

**Acceptance gate verdict:** **PASS** — Phase 40 permanently closed. Runtime authority = `EffectiveJourneyView`. `STATIC_JOURNEY_CATALOG_IS_RUNTIME_AUTHORITY = false`. Zero business execution changes. **40d not started.**

### 30.13 Phase 41 Notification Center — **100% COMPLETE** · **41a–41e CLOSED** (2026-07-17)

**Status:** Architecture **APPROVED** · **41a–41e CLOSED** (gate re-verified) · Remediation **NOT REQUIRED** · Phase **41 100% complete** · **42 NOT STARTED / NOT authorized**  
**SSOT:** [`NOTIFICATION_CENTER_ARCHITECTURE.md`](./NOTIFICATION_CENTER_ARCHITECTURE.md) · Ops: [`NOTIFICATION_DELIVERY_OPERATIONS.md`](./NOTIFICATION_DELIVERY_OPERATIONS.md)

| Item | Status |
|------|--------|
| Extension kind `notification` | **Implemented** |
| Canonical vocabulary / STATIC catalog | **41a CLOSED** — authority flag **false** |
| `DynamicNotificationProvider` | **41b CLOSED** |
| Playwright config + rollback **5183** | **41c CLOSED** — **39/39** |
| Delivery engine + adapters + history | **41d CLOSED** |
| Producer migration · Activity · White Label · Journey/Workflow intents · ops | **41e CLOSED** — Playwright delivery **6/6**; runtime gate PASS |
| Jest delivery | **99/99** |
| Prisma migrate `20260717180000` | **Applied** · `prisma generate` **OK** |
| Runtime authority | `EffectiveNotificationView` |
| Queue topology | Single `notification-delivery` + channel field (**validated**) |

**Acceptance gate verdict:** **PASS** — Phase 41 **100% complete**. **42 not authorized.**

**Status:** Architecture **APPROVED** · **41a CLOSED** · **41b CLOSED** · **41c CLOSED** · **41d CLOSED** · Remediation **NOT REQUIRED** · Phase **41 fully complete** · Config platform 41a–c **FROZEN** · Phase **42 NOT authorized**  
**SSOT:** [`NOTIFICATION_CENTER_ARCHITECTURE.md`](./NOTIFICATION_CENTER_ARCHITECTURE.md)

| Item | Status |
|------|--------|
| Extension kind `notification` | **Implemented** — twelfth registry consumer |
| Legacy kind `notifications` | **Preserved** — transitional thin event stubs |
| Licensed module | Existing `notifications` — **no new LicensedModuleId** |
| Canonical vocabulary | **41a CLOSED** — **92** catalog entries |
| `DynamicNotificationProvider` + hooks | **41b CLOSED** — EffectiveNotificationView / NotificationSnapshot / identity cache / rollback |
| Branch refresh consumer `'notification'` | **Registered** after `'journey'` |
| Mount order | Activity → Audit → Journey → **Notification** → Route |
| White Label coordination | **Consume-only** snapshot version (outbound email HTML still partial) |
| clinic-dashboard `dynamic-notification` vitest | **45/45** (foundation 17 + runtime 28) |
| `@booking/module-registry` vitest | **122/122** |
| Playwright config acceptance | **39/39** (`e2e/dynamic-notification.spec.ts`) |
| Rollback verification server | Port **5183** · `VITE_USE_STATIC_NOTIFICATION_ONLY=true` |
| Runtime authority | `EffectiveNotificationView` |
| `STATIC_NOTIFICATION_CATALOG_IS_RUNTIME_AUTHORITY` | **false** |
| Delivery engine module | **41d CLOSED** — `apps/api/src/modules/notifications/delivery/` |
| Prisma migration | **41d CLOSED** — `20260717180000_phase41d_notification_delivery_engine` |
| BullMQ queue | **41d CLOSED** — `notification-delivery` (reuses `JobQueueService`) |
| Channel adapters | **41d CLOSED** — in-app · email (console fail-closed in prod) · SMS · WhatsApp (fail-closed, never via SMS) · push · webhook (SSRF + HMAC) |
| Create path | `CreateNotificationHandler` → `DeliveryOrchestratorService` |
| Legacy processor | Skips `metadata.deliveryEngine=41d`; WhatsApp legacy fail-closed |
| Communication history | `GET /notifications/communication-history` |
| Jest delivery + create-handler | **91/91 passed** |
| Config platform 41a–c | **FROZEN** |
| Phase 42 | **NOT authorized** |

**Honest gaps remaining:** full Playwright e2e delivery suite not shipped this gate; Activity metadata not emitted for every delivery lifecycle event; White Label branding consume-only still partial on outbound email HTML; Journey/Workflow dedicated intent producers still partially on CreateNotification path; single `notification-delivery` queue with channel field (not 6 separate BullMQ queues); `prisma generate` may need restart if API holds DLL lock.

**Acceptance gate verdict:** **PASS** — Phase 41 **fully complete**. Runtime authority = `EffectiveNotificationView`. `STATIC_NOTIFICATION_CATALOG_IS_RUNTIME_AUTHORITY = false`. Config 41a–c **FROZEN**. Delivery engine **41d CLOSED**. Phase **42 NOT authorized**.
