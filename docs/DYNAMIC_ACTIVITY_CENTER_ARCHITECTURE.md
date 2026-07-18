# Phase 38 — Dynamic Activity Center Architecture

**Phase:** 38 (**PERMANENTLY CLOSED** · Architecture APPROVED · Final Remediation CLOSED · **38a CLOSED** · **38b CLOSED** · **38c CLOSED**)  
**Status:** Phase **38c Runtime Acceptance complete** (2026-07-16) — Playwright **35/35**; Dynamic Activity Platform **100%**  
**Prerequisite:** Phase 36 — Dynamic Multi-Branch (**permanently closed**, 2026-07-15); Phases 28–36 **frozen**  
**Authoring panel:** CTO · Principal Enterprise SaaS · Healthcare ERP · Platform · Backend · Frontend · Security · DevOps  
**SSOT for:** Future Marketplace activity providers, Plugin SDK activity packs, patient-portal and super-admin consumers (Phase 39+)

**Numbering note:** Earlier roadmap drafts labeled “Activity Center” as Phase 37. **This architecture permanently assigns Activity Center to Phase 38.** Phase **37** remains reserved for **Department / franchise hardening** (see Multi-Branch §23) — not started here.  
**Remediation note:** Observations **H1–H3, M1–M5** closed in §§21–28 (2026-07-16). Phase **38a/38b/38c CLOSED**. Phase 38 **permanently closed**.

---

## 1. Executive Summary

Phase 38 defines the **Dynamic Activity Center** — the **ninth** registry consumer after navigation, routing, dashboard, search, reporting, analytics, white label, and multi-branch. It establishes a **centralized, read-only enterprise event stream** that aggregates business activity from every module into a **user-facing timeline** — **without** executing business logic, replacing notifications, or replacing compliance audit logs.

Activity Center follows the proven catalog-as-baseline pattern from Phases 30–36:

```
Module Registry
  ↓
EffectiveModuleView (activity contributions)
  ↓
STATIC_ACTIVITY_CATALOG filter (parity baseline)
  ↓
Server Activity Resolver (tenant / user / role / branch scope)
  ↓
EffectiveActivityView (read-only projection)
  ↓
DynamicActivityProvider (38b — configuration & feed discoverability)
  ↓
Existing Runtime (shell bell, inbox links, dashboard widgets, search deep links)
```

### Purpose

Provide one authoritative **Activity Timeline** for staff (and later portal/admin surfaces) so users can answer: *What happened across the clinic that I am allowed to see?* — filtered by licensing, RBAC, and active branch context.

### Scope

| In scope (architecture) | Out of scope (this phase) |
|-------------------------|---------------------------|
| Activity model, categories, priorities, feeds, timeline | React components, providers, hooks (38b) |
| `EffectiveActivityView` read model | Prisma schema / new Activity table migrations |
| `DynamicActivityProvider` responsibilities (named only) | Notification delivery redesign |
| Extension kind `activity` + `STATIC_ACTIVITY_CATALOG` | Audit module replacement |
| Registry, licensing, RBAC, branch, white-label coordination | WebSocket protocol redesign |
| Security, performance, marketplace, retention | Playwright acceptance (38c) |
| Migration roadmap 38a / 38b / 38c | Business workflow execution |

### Business value

- **Operational awareness:** One stream across clinical, financial, inventory, security, and system events.
- **Licensing coherence:** Discoverability of activity surfaces and event types follows EffectiveModuleView; enforcement remains on existing APIs.
- **Safety:** Fail-closed visibility; Activity Center **never** widens permissions beyond RBAC/license/branch isolation.
- **Marketplace readiness:** Signed activity providers with namespaced `providerKey`.

### Explicit non-goals

| Activity Center is **not** | Remains owned by |
|----------------------------|------------------|
| Notification composer / delivery engine | Notifications module (channels, templates, inbox delivery) |
| Compliance audit log of record | Audit module (`api.audit`, `auditLogs` feature) |
| Workflow executor | Workflow module |
| Domain mutation API | Each owning module’s handlers |

**Relationship rule:** Activity **may reference** a notification ID and/or audit entry ID. Notifications **may** optionally emit activity cards. Audit events **may** optionally project to activity **only** when RBAC allows. None of the three replace each other.

### Current state (evidence — 2026-07-15)

| Layer | State | Source |
|-------|-------|--------|
| Notifications center UI | Strong | `features/notifications/*` — inbox, bell, templates, automation |
| Automation event types | Partial catalog | `AUTOMATION_EVENT_TYPES` — appointments, invoices, security, inventory |
| Audit API | Compliance log | `modules/audit` — create/search; licensed `auditLogs` |
| Unified activity feed | **Absent** | No `Activity` domain / feed aggregator |
| Registry `activity` kind | **Not defined** | Extension catalog ends at `branch` (Phase 36) |
| Dashboard activity widget | Ad hoc notifications/KPI | Dashboard widgets — not a unified timeline |
| Search → activity | Not linked | Global search does not index activity stream |
| Branch-scoped activity | Partial via notification/API `branchId` | No unified branch filter on a single feed |

**Gap:** Staff experience is **fragmented** across notification inbox, dashboard cards, and audit search. No registry-driven activity vocabulary, no EffectiveActivityView, no branch-synchronized feed versioning.

---

## 2. Architecture Goals

| Goal | Success criterion |
|------|-------------------|
| Registry-driven activity | Event-type vocabulary, feed surfaces, and deep links derive from `kind=activity` contributions |
| Read-only aggregation | Activity Center never mutates patients, appointments, inventory, billing, etc. |
| Fail-closed visibility | Missing license / permission / branch access → omit or redact; never leak |
| Separation of concerns | Notifications remain delivery; Audit remains compliance; Activity is UX timeline |
| Multi-branch awareness | Feed scoped by `accessibleBranchIds` + `activeBranchId` from DynamicBranchProvider |
| White-label awareness | Timeline chrome reads WL tokens; content remains brand-agnostic for security events |
| Independent rollback | `VITE_USE_STATIC_ACTIVITY_ONLY=true`; Playwright port **5180** (38c) |
| Marketplace-ready | Signed activity providers with namespaced keys |

---

## 3. Design Principles

1. **Server remains authoritative** — EffectiveActivityView is computed server-side (or from signed bootstrap projections); client never invents invisible events.
2. **Catalog-as-baseline** — `STATIC_ACTIVITY_CATALOG` is parity + rollback truth only — **not** runtime authority after 38b registry mode.
3. **Configuration / discoverability migration only (38b)** — Existing notification/audit UIs continue; Activity Center consumes projections.
4. **No second systems** — No parallel RBAC, licensing, or branch selection engines.
5. **Stable IDs** — `activityId`, `eventTypeId` (catalog synonym `activityTypeId`), `feedId`, `extensionId`, `providerKey` are permanent (§21).
6. **Narrow-only** — Tenant / branch / role filters may only remove or redact events, never add unauthorized ones.
7. **Fail closed** — Integrity validation blocks duplicate type IDs, missing resources, unsigned marketplace providers, ambiguous feed ownership (§26).
8. **Execution boundary** — Workflow triggers, notification send, and audit write remain in owning modules; Activity **observes** (§23).
9. **Deterministic order** — Feed ordering follows Tenant → Branch → Feed → Timestamp → Sequence (§22).
10. **Static catalog is never runtime authority** — `STATIC_ACTIVITY_CATALOG_IS_RUNTIME_AUTHORITY = false` (§27).

---

## 4. Registry Integration

### 4.1 Consumer boundary

```
ModuleRegistryProvider (existing)
  └── EffectiveModuleView[]
        └── extensions[] where kind === 'activity'
              └── payload: ActivityContributionView
```

**Reads:** EffectiveModuleView for which activity **types** and **feeds** exist and are discoverable.  
**Also reads (38b):** Activity feed API / bootstrap projection — **never mutates** domain entities.  
**Does not write:** business tables, notification queues, audit stores (those remain owning-module writes that *emit* activity).

### 4.2 Extension kind

| Property | Value |
|----------|-------|
| Kind | `activity` |
| Ownership | Declared by owning modules (`patients`, `scheduling`, `billing`, `inventory`, `settings`, …) — **not** a new `LicensedModuleId` |
| Parallel kinds | Coexists with `notifications`, `workflow`, `ai`, `branch`, `whiteLabel` |
| Builder (38a) | `buildActivityContributionsForModule(moduleId)` |

### 4.3 Contribution shape (architecture)

```typescript
interface ActivityContribution {
  extensionId: string;           // {moduleId}/activity/{localId}
  moduleId: LicensedModuleId | 'core' | 'platform';
  localId: string;
  activityTypeId: string;        // stable canonical type (= eventTypeId in runtime identity §21)
  categoryId: ActivityCategoryId;
  defaultSeverity: ActivitySeverity;
  labelKey: string;
  descriptionKey: string;
  icon?: string;
  resourceId: string;            // permission resource for visibility
  actions: Array<'view' | 'export'>;  // typically view
  requiredFeature?: LicensedFeatureId;
  branchScoped: boolean;
  crossBranchAllowed: boolean;
  deepLinkTemplate: string;      // e.g. /patients/:patientId
  providerKey: string;           // backend projection key
  feedIds: string[];             // which feeds include this type
  redactFields?: string[];       // PHI fields to hide when denied
  sortOrder: number;
}
```

### 4.4 Pipeline (authoritative)

```
Canonical Vocabulary (packages/module-registry activity/*)
  ↓
Manifest Contributions (kind=activity)
  ↓
STATIC_ACTIVITY_CATALOG (parity / rollback only — NOT runtime authority)
  ↓
EffectiveModuleView → activity contributions join
  ↓
Server Activity Resolver (license + RBAC + branch + retention)
  ↓
EffectiveActivityView  ← **runtime authority**
  ↓
ActivitySnapshot
  ↓
DynamicActivityProvider (38b)
  ↓
consumers (timeline, bell summary, dashboard widget, search discoverability)
```

Field-by-field parity across vocabulary ↔ manifests ↔ static catalog is **mandatory** (§28).

---

## 5. Activity Model

### 5.1 Canonical entity (logical)

An **Activity** is an immutable (append-oriented) event projection. Identity fields in the table below are governed by the **Canonical Activity Event Identity Contract** (§21). Display/category fields remain as designed in §§6–7.

| Field | Type | Notes |
|-------|------|-------|
| `activityId` | string (UUID) | Permanent primary identity — §21 |
| `eventTypeId` | string | Catalog vocabulary ID; synonym `activityTypeId` in contributions |
| `eventVersion` | string (semver) | Payload schema for this type — §24 |
| `categoryId` | ActivityCategoryId | §6 |
| `severity` | ActivitySeverity | §7 |
| `occurredAt` | ISO datetime | Business event time — ordering key §22 |
| `sequence` | number (monotonic per feed scope) | Tie-breaker after timestamp — §22 |
| `recordedAt` | ISO datetime | Ingestion / projection time |
| `tenantId` | string | Required |
| `branchId` | string \| null | Null = tenant-wide / global |
| `producerModuleId` | string | Owning module that produced the business event — §21 |
| `producerEntityType` | string | e.g. `patient`, `appointment`, `invoice` |
| `producerEntityId` | string \| null | Entity PK in producer module |
| `actorUserId` | string \| null | Who caused it (system = null + `actorKind=system`) |
| `actorKind` | `user` \| `system` \| `automation` \| `ai` \| `marketplace` | |
| `titleKey` / `bodyKey` | i18n keys | Or resolved strings from server templates |
| `payload` | JSON (redacted) | Narrow fields only; schema keyed by `eventVersion` |
| `deepLink` | string \| null | Resolved from template |
| `notificationId` | string \| null | Optional link — Notifications own delivery |
| `auditEntryId` | string \| null | Optional link — Audit owns proof |
| `correlationId` | string \| null | Saga / cross-module group — §25 |
| `causationId` | string \| null | Direct cause event — §25 |
| `parentActivityId` | string \| null | Optional parent card — §25 |
| `batchId` | string \| null | Bulk / import batch — §25 |
| `providerKey` | string | Projector identity — §21 / §26 |
| `visibilityHash` | string | Cache invalidation aid |
| `schemaVersion` | string | Platform activity envelope version — §24 |
| `projectionVersion` | string | Projector transformation version — §24 |

### 5.2 Activity sources (emitters — not Activity Center itself)

| Domain | Example events |
|--------|----------------|
| Patients | registered, updated, merged, portal invited |
| Scheduling | booked, rescheduled, cancelled, checked in |
| Queue | ticket called, no-show, completed |
| EMR | encounter opened/closed, prescription issued |
| Dental | odontogram update, treatment plan approved |
| Beauty | session completed, package redeemed |
| Inventory | low stock, receive, transfer, stock count closed |
| Billing | invoice created, payment received, refund |
| Reporting | report generated, export completed |
| Analytics | scheduled analytics run finished |
| Workflow | automation fired / failed |
| AI Assistant | tool invoked (non-PHI summary), safety block |
| Settings | branding saved, hours changed |
| Users | invited, role changed, deactivated |
| Licensing | grace entered, feature revoked, plan changed |
| Modules | module enabled/disabled (registry lifecycle) |
| Navigation / Search | (discoverability only — rare system events) |
| White Label | branding publish / custom domain verified |
| Multi-Branch | branch created, switch recovered, access revoked |
| Future plugins | marketplace-declared types |

### 5.3 Ingestion contract (architecture)

1. Owning module completes business transaction.  
2. Owning module emits domain event (existing bus) **and/or** writes audit/notification as today.  
3. **Activity Projector** (38b backend slice — named only) maps domain event → Activity row/projection **if** type is registered.  
4. Activity Center reads projections; it does **not** re-run business rules.

Fail-closed: Unknown `activityTypeId` → drop + metrics; never invent.

---

## 6. Activity Categories (canonical)

| `categoryId` | Purpose |
|--------------|---------|
| `clinical` | EMR, dental, beauty, encounters |
| `financial` | Billing, payments, refunds |
| `operational` | Scheduling, queue, day-to-day ops |
| `administrative` | Users, settings, org/admin |
| `security` | Failed login, password reset, access alerts |
| `licensing` | Plan/lifecycle/feature changes |
| `inventory` | Stock, transfers, counts |
| `communication` | Portal invite, message-related summaries |
| `workflow` | Automation outcomes |
| `ai` | AI assistant outcomes (redacted) |
| `system` | Platform/module health, registry |
| `branch` | Branch lifecycle / access / recovery |
| `branding` | White-label / branding publishes |
| `other` | Explicit catch-all — discouraged for builtins |

**Rule:** Builtin contributions **must** use a canonical category; `other` reserved for marketplace with review.

---

## 7. Activity Severity (priority)

| `severity` | UX intent | Typical examples |
|-------------|-----------|------------------|
| `info` | Neutral awareness | Soft updates, settings saved |
| `success` | Positive completion | Payment received, booking confirmed |
| `warning` | Needs attention | Low stock, grace period |
| `critical` | Urgent action | Failed charge, workflow failure |
| `emergency` | Immediate response | Security breach signal, data integrity halt |

**Notification priority mapping (non-binding):** notifications `low|medium|high` may map into severity for linked cards; Activity severity vocabulary is **canonical for the timeline**.

---

## 8. Timeline Model

```
Activity (atomic event)
  ↓
Grouping (optional: by day / subject / correlationId)
  ↓
Timeline (ordered stream for a feed)
  ↓
Filters (category, severity, branch, actor, date, search text)
  ↓
Feed (named surface: global, clinical, security, …)
  ↓
Consumer (Activity page, bell summary, dashboard widget, deep link)
```

### 8.1 Feeds

| `feedId` | Description | Default visibility |
|----------|-------------|--------------------|
| `global` | All visible activities for user | Roles with `api.activity` view (proposed) or module-local aggregates |
| `clinical` | Clinical category | Clinical roles |
| `financial` | Financial category | Finance roles |
| `security` | Security + licensing critical | Owner / GM / security admins |
| `inventory` | Inventory category | Inventory roles |
| `branch` | Branch-scoped ops | Branch managers + multi-branch selectors |
| `mine` | Actor = current user | All authenticated |

Feeds are **projections**, not separate event stores. Every feed **must** declare complete ownership metadata (§26); ambiguous ownership **fails bootstrap**.

### 8.2 Ordering within a feed

Authoritative total order for a given feed scope is defined in §22:

```
Tenant → Branch → Feed → Timestamp (occurredAt) → Sequence → Activity
```

UI grouping (by day / subject / correlation) is **presentation only** and must not reorder severity-critical cards out of §22 sequence.

### 8.2 Grouping rules

| Mode | Rule |
|------|------|
| Chronological | Default — `occurredAt` desc |
| By day | UI group headers only |
| By subject | Collapse same `subjectType+subjectId` within window |
| By correlation | Show saga steps under one parent |

Grouping **never** merges severities upward to hide critical events.

### 8.3 Filters

Mandatory fail-closed filters applied **before** client display:

1. Tenant isolation  
2. License + feature gates  
3. RBAC on `resourceId` / actions  
4. Branch: `branchId ∈ accessibleBranchIds` OR (`branchId=null` AND cross-branch allowed)  
5. Retention window  
6. Redaction map  

Optional UX filters: category, severity, feed, date range, actor, free-text on title (non-PHI fields).

---

## 9. EffectiveActivityView

### 9.1 Definition

`EffectiveActivityView` is the **server-authoritative, read-only, fail-closed** projection of what the current identity may see in Activity Center.

Scoped **per:** `tenantId` · `userId` · `roles` · `activeBranchId` / `accessibleBranchIds`.

```typescript
interface EffectiveActivityView {
  tenantId: string;
  userId: string;
  locale: string;
  activeBranchId: string | null;
  accessibleBranchIds: string[];
  feeds: ActivityFeedDescriptor[];
  accessibleTypes: ActivityTypeDescriptor[];
  lockedTypes: Array<{ activityTypeId: string; reason: 'licensing' | 'permission' | 'branch' | 'retention' }>;
  capabilities: ActivityCapabilityFlags;
  cursor?: string | null;          // pagination
  items?: ActivityListItem[];      // optional page payload
  activitySnapshotVersion: string;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  source: 'registry' | 'static-only' | 'static-fallback' | 'restricted';
  resolvedAt: string;
}

interface ActivityCapabilityFlags {
  canViewActivity: boolean;
  canExportActivity: boolean;
  canViewSecurityFeed: boolean;
  canViewCrossBranchActivity: boolean;
  canLinkToAudit: boolean;         // requires auditLogs + permission
}
```

### 9.2 Fail-closed / restricted

| Condition | Behavior |
|-----------|----------|
| Registry loading / error | Restricted or static-fallback — **no events** or parity-safe empty feeds |
| License lacks module | Types from that module omitted |
| No `view` permission | Type locked; deep link disabled |
| Branch inaccessible | Event omitted (not shown greyed with payload) |
| Retention expired | Omitted or archived stub without PHI |

### 9.3 Snapshot

`ActivitySnapshot` wraps `EffectiveActivityView` for client caching (identity-scoped keys including `activitySnapshotVersion` + `branchSnapshotVersion`).

---

## 10. Provider Architecture (38b — names only)

### 10.1 Components (future)

| Symbol | Role |
|--------|------|
| `DynamicActivityProvider` | Holds snapshot; exposes feed metadata + page hooks; registers as BranchContextRefreshContract consumer |
| `useActivity()` | Required context |
| `useOptionalActivity()` | Safe optional |

### 10.2 Responsibilities

| Does | Does not |
|------|----------|
| Publish resolved feeds/types/capabilities | Send SMS/email/push |
| Invalidate caches on branch/registry refresh | Write audit entries |
| Coordinate with search deep-link vocab | Execute workflows |
| Supply dashboard activity widget **config** | Redesign notification inbox |
| Fail-closed restricted snapshot | Bypass RBAC |

### 10.3 Mount order (proposed)

```
ModuleRegistryProvider
  → DynamicBranchProvider
    → DynamicWhiteLabelProvider
      → DynamicActivityProvider
        → routes / AppShell
```

Activity refreshes **after** branch + white-label (non-critical tier — degraded OK per Branch §21 if activity cache warm).

### 10.4 Rollback

| Flag | Effect |
|------|--------|
| `VITE_USE_STATIC_ACTIVITY_ONLY=true` | Ignore registry activity extensions; use `STATIC_ACTIVITY_CATALOG` discoverability only; hide unified timeline routes or show empty restricted feed |
| Playwright port | **5180** |

---

## 11. Static Baseline

### 11.1 `STATIC_ACTIVITY_CATALOG`

| Property | Rule |
|----------|------|
| Location (38a) | `apps/clinic-dashboard/src/features/dynamic-activity/lib/static-activity-catalog.ts` |
| Authority flag | **`STATIC_ACTIVITY_CATALOG_IS_RUNTIME_AUTHORITY = false`** (exported const — mandatory) |
| Runtime authority | **`EffectiveActivityView`** only (after 38b registry mode) |
| Purpose | Parity tests, rollback reference, 38b allowlist join |
| Contents | Builtin activity types + feeds aligned to registry vocabulary field-by-field (§28) |

### 11.2 Isolation

Direct imports from production UI **forbidden** after 38b registry mode — same isolation pattern as STATIC_BRANCH_CATALOG / STATIC_WHITE_LABEL_CATALOG.

---

## 12. Security Model

| Concern | Rule |
|---------|------|
| **Tenant isolation** | Every query keyed by `tenantId`; no cross-tenant cursor reuse |
| **RBAC** | Visibility via contribution `resourceId` + action; mirrors notification/audit patterns |
| **Licensing** | `requiredFeature` / owning module access; proposed feature `activityCenter` (enterprise+) **or** per-module visibility without new SKU until commercial decision |
| **Branch isolation** | Events for inaccessible branches omitted; cross-branch requires capability + license |
| **PHI** | Payload redaction list; clinical bodies never appear in global feed without clinical permission |
| **Security feed** | Restricted roles; emergency severity may notify but timeline still RBAC-gated |
| **Audit relationship** | `canLinkToAudit` only if `auditLogs` feature + `api.audit` view; Activity is **not** immutable legal evidence |
| **Notification relationship** | Deep-link to inbox item optional; read-state may sync later — not Phase 38 architecture mandate |
| **Marketplace** | Only signed providers; type IDs namespaced `vendor.pack.type` |
| **Client trust** | Client filters are UX; server resolver is authority |

### 12.1 Proposed resources (38a vocabulary — not implemented)

| Resource | Actions |
|----------|---------|
| `api.activity` | `view`, `export` |
| (reuse) `api.audit` | link only |
| (reuse) `api.notifications` | link only |

---

## 13. Performance Strategy

| Mechanism | Design |
|-----------|--------|
| **Caching** | Identity + `activitySnapshotVersion` + `branchSnapshotVersion` + cursor page keys |
| **Pagination** | Cursor-based (`occurredAt,activityId`); default page size 30–50 |
| **Incremental loading** | Infinite scroll / “load older”; no full-history bootstrap |
| **Realtime** | Optional subscribe to new activity IDs (metadata only); hydrate page on demand |
| **Retention** | Hot store (e.g. 90 days) + archive store; hot queries never scan archive by default |
| **Archive** | Job moves aged rows; archived items require explicit “include archive” + permission |
| **Fan-in control** | Projectors async; backpressure; drop non-critical on overload (never silent-drop security/emergency) |
| **No duplicate registry bootstrap** | Activity refresh reuses EffectiveModuleView; HTTP refetch only when catalog/entitlement stale |

---

## 14. Marketplace Model

| Item | Rule |
|------|------|
| Pack type | Activity provider packs |
| Integrity | Signature required (`integrityRequired`) |
| Namespace | `providerKey = {vendor}/{pack}/{projector}` |
| Type IDs | Must not collide with builtin IDs |
| Categories | Prefer canonical; `other` allowed with review |
| Install | Owner + platform approval path (same as module marketplace) |
| Uninstall | Types locked; historical activities retained redacted or orphan-labeled |

---

## 15. Cross-Consumer Coordination

| Consumer | Relationship |
|----------|--------------|
| **Dashboard** | Optional activity widget — config from Activity provider; execution = fetch page API |
| **Search** | Discovery entities for “Activity” / deep links — execution unchanged |
| **Reporting** | Activity volume reports — future; Activity Center does not generate report bytes |
| **Analytics** | Optional metrics catalog entries for “activities by category” — Phase 34 patterns |
| **White Label** | Timeline uses tokens/layout from WL snapshot |
| **Multi-Branch** | Subscribes to `branch.context.changed`; same version gate pattern |
| **Notifications** | Parallel UX; Activity may summarize delivery outcomes |
| **Routing / Navigation** | Register `/activity` (or `/activity-center`) via existing routing/nav contributions in 38b |

---

## 16. Migration Roadmap

### Phase 38a — Foundation (**CLOSED** — 2026-07-16)

**Goal:** Canonical vocabulary, `activity` extension kind, builders, integrity validation, `STATIC_ACTIVITY_CATALOG`, zero runtime impact. **Complete.**

| Deliverable | Location | Status |
|-------------|----------|--------|
| `packages/module-registry/src/activity/*` | Categories, severities, types, feeds, hubs, cross-module, builders, validators | **Done** |
| Builtin contributions via `buildActivityContributionsForModule()` | `builtin-manifests.ts` — no handwritten activity entries | **Done** |
| `STATIC_ACTIVITY_CATALOG` + `STATIC_ACTIVITY_CATALOG_IS_RUNTIME_AUTHORITY = false` | `apps/clinic-dashboard/src/features/dynamic-activity/lib/` | **Done** |
| Vitest parity / integrity | module-registry **87** tests; clinic-dashboard activity **12** tests | **Done** |
| Counts | 14 categories · 5 severities · 33 types · 7 feeds · 3 hubs · 3 cross-module = **46** catalog entries | **Stable** |

### Phase 38b — Provider & Integration (**CLOSED** — 2026-07-16)

**Goal:** `DynamicActivityProvider`, snapshot/cache, branch coordination, configuration-source migration; no notification/audit redesign. **Complete.**

| Deliverable | Location | Status |
|-------------|----------|--------|
| `DynamicActivityProvider` + `useActivity()` / `useOptionalActivity()` | `features/dynamic-activity/context/` | **Done** |
| `EffectiveActivityView` resolver + `ActivitySnapshot` builder | `lib/activity-resolver.ts`, `lib/activity-snapshot-builder.ts` | **Done** |
| Identity-scoped cache + fail-closed restricted snapshot | `lib/activity-cache.ts` | **Done** |
| Aggregate capabilities (7 flags) | `lib/activity-capabilities.ts` | **Done** |
| `VITE_USE_STATIC_ACTIVITY_ONLY` rollback | `lib/activity-flags.ts` | **Done** |
| Registry mount order (after branch + WL) | `RegistryRouteHost.tsx` | **Done** |
| Dashboard `recent-activities` config migration | `DashboardWidgets.tsx` → `useOptionalActivity()` | **Done** |
| Vitest provider / rollback / resolver | **27** activity tests green | **Done** |

### Phase 38c — Runtime Acceptance (**CLOSED** — 2026-07-16)

**Goal:** Production-like Playwright verification of the Activity pipeline. **Complete.**

| Deliverable | Location | Status |
|-------------|----------|--------|
| `e2e/dynamic-activity.spec.ts` | **35** scenarios | **Done — 35/35 passed** |
| `e2e/helpers/dynamic-activity.ts` | Probe + rollback helpers | **Done** |
| Rollback port **5180** (`VITE_USE_STATIC_ACTIVITY_ONLY=true`) | `playwright.config.ts` | **Done** |
| Runtime probe `__BOOKING_ACTIVITY_RUNTIME__` | `DynamicActivityProvider` | **Done** (acceptance probe only) |
| Vitest regression | activity **27/27**; module-registry **87/87** | **Done** |
| Production closure docs | Four SSOTs | **Done** |

---

## 17. Architecture Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Conflating Activity with Notifications | High | High | Explicit non-goals §1; separate modules |
| PHI leakage in global feed | Medium | Critical | Redaction + RBAC + clinical feed segregation |
| Event volume / storage cost | High | Medium | Retention + archive + pagination |
| Dual-write inconsistency (domain vs activity) | Medium | Medium | Projector idempotency keys; eventual consistency SLA |
| Marketplace malicious types | Low | High | Signatures + namespace + review |
| Branch mix on partial refresh | Medium | High | Reuse BranchContextRefreshContract + snapshot versions |
| Audit impersonation via activity links | Low | High | `canLinkToAudit` gated; Activity not legal source of truth |

---

## 18. Technical Debt (acknowledged)

| Item | Severity | Target |
|------|----------|--------|
| No unified Activity persistence today | High | 38b read-model decision |
| Notification automation catalog ≠ activity vocabulary | Medium | 38a alignment map |
| Audit incomplete PHI coverage | Medium | Unrelated — Phase 37+/security backlog |
| Phase number drift (37 vs 38 in old audits) | Low | Corrected by this SSOT |
| Department-scoped activity | Low | Phase 37 Department provider |

---

## 19. Implementation Authority Boundaries

| Layer | Owner |
|-------|-------|
| License enforcement | Phase 28 `LicensingEngineService` |
| Permissions | `@booking/permissions` matrix |
| Branch selection | Phase 36 `DynamicBranchProvider` |
| Branding tokens | Phase 35 `DynamicWhiteLabelProvider` |
| Notification delivery | Notifications module |
| Audit persistence | Audit module |
| Activity projection vocabulary | Phase 38 registry `activity` kind |
| Activity feed UX projection | Phase 38 `DynamicActivityProvider` (38b) |

---

## 20. Architecture Acceptance Gate

**Decision:** Phase 38 Dynamic Activity Center architecture **APPROVED**; final architecture remediation **CLOSED** (2026-07-16).

| Gate | Status |
|------|--------|
| Architecture approval | **APPROVED** |
| Final remediation (H1–H3, M1–M5) | **CLOSED** — §§21–28 |
| Phase 38a | **CLOSED** (2026-07-16) |
| Phase 38b | **CLOSED** (2026-07-16) — provider + integration |
| Phase 38c | **CLOSED** (2026-07-16) — Playwright **35/35** |
| Phase 38 overall | **PERMANENTLY CLOSED** — Dynamic Activity Platform **100%** |
| Phases 28–36 | **Frozen** |

**Architecture readiness:** **100%**. **Foundation (38a):** **100%**. **Provider (38b):** **100%**. **Runtime (38c):** **100%**.

**Acceptance gate verdict:** **PASS** — Phase 38 Dynamic Activity **permanently closed**. Ready for Phase 39 (roadmap).

---

## 21. Canonical Activity Event Identity (H1)

This section defines the **permanent identity contract** for every activity event projected into Activity Center.

### 21.1 Required identity fields

| Field | Type | Permanence | Notes |
|-------|------|------------|-------|
| **`activityId`** | UUID string | Immutable PK | Assigned once by Activity projector store (or deterministic idempotency derivation) |
| **`eventTypeId`** | string | Permanent vocab | Catalog type; contribution field may use synonym `activityTypeId` |
| **`eventVersion`** | semver string | Mutable only via new version | Schema of `payload` for this `eventTypeId` |
| **`occurredAt`** | ISO-8601 | Immutable | Business occurrence time (not projection time) |
| **`producerModuleId`** | string | Immutable | Licensed module / platform id that owned the business write |
| **`producerEntityId`** | string \| null | Immutable | Source entity PK |
| **`producerEntityType`** | string | Immutable | Stable entity kind (`patient`, `invoice`, …) |
| **`providerKey`** | string | Immutable | Projector that mapped the domain event → activity |
| **`tenantId`** | string | Immutable | Tenant scope — never null |
| **`branchId`** | string \| null | Immutable | Branch scope; null = tenant-global |
| **`correlationId`** | string \| null | Immutable once set | Saga / workflow group — §25 |
| **`causationId`** | string \| null | Immutable once set | Direct cause (activityId or domain event id) — §25 |

Optional identity extensions (still immutable when present): `parentActivityId`, `batchId`, `sequence` (§22).

### 21.2 Uniqueness rules

| Rule | Enforcement |
|------|-------------|
| `activityId` unique per platform (or at least per tenant) | Primary key / unique index |
| Idempotency key | `(tenantId, providerKey, producerModuleId, producerEntityType, producerEntityId, eventTypeId, occurredAt, causationId?)` — duplicate ingest → **no second row** |
| `eventTypeId` unique in vocabulary | Bootstrap integrity (38a) |
| `(eventTypeId, eventVersion)` schema registry | Forward docs; invalid combo → drop fail-closed |
| No reuse of `activityId` after soft-delete/archive | Archive retains identity; tombstones do not free IDs |

### 21.3 Immutability

After successful projection commit:

1. Identity fields in §21.1 **must not** be updated in place.  
2. Corrections emit a **new** activity (e.g. `*.corrected` / `*.voided`) with `causationId` / `parentActivityId` pointing at the original.  
3. Redaction for privacy updates `payload` / visibility only under controlled retention jobs — never changes `activityId` or `occurredAt`.  
4. Client must treat received activities as append-only.

### 21.4 Event bus compatibility (future)

| Concern | Contract |
|---------|----------|
| Transport | Identity envelope travels with the message regardless of Kafka / NATS / outbox |
| Headers | Prefer `activityId`, `eventTypeId`, `eventVersion`, `tenantId`, `branchId`, `correlationId`, `causationId` |
| Partitioning | Recommended key `tenantId` (+ optional `branchId`) for order locality |
| Consumers | Notifications and Audit may subscribe to the **same domain bus** without owning Activity identity |

---

## 22. Event Ordering Contract (H2)

### 22.1 Authoritative hierarchy

```
Tenant
  ↓
Branch
  ↓
Feed
  ↓
Timestamp (occurredAt)
  ↓
Sequence
  ↓
Activity (activityId tie-break)
```

### 22.2 Ordering guarantees

| Scope | Guarantee |
|-------|-----------|
| Single tenant + branch + feed | Total order by `(occurredAt ASC|DESC as API param, sequence, activityId)` |
| Cross-branch global feed | Ordered after visibility filter; events from inaccessible branches **absent** (not reordered below) |
| Concurrent timestamps | `sequence` monotonic per `(tenantId, branchId|null, feedId)` assigned at projection commit |
| Clock skew | Prefer business `occurredAt` from producer; projector may cap clock drift; never invent future reorder after publish |

### 22.3 Conflict resolution

| Conflict | Resolution |
|----------|------------|
| Duplicate idempotency key | Keep first committed; ignore subsequent |
| Same `occurredAt` + same `sequence` | Impossible if sequence assignment is atomic; if race, higher `activityId` lex order as last resort |
| Late arrival with older `occurredAt` | Insert by order; UI incremental pages may show “gap filled” — does not rewrite earlier pages’ identity |
| Out-of-order projection workers | Serialize sequence allocation via tenant/branch feed counter (or conditional DB update) |

### 22.4 Projector ordering

1. Domain transaction commits.  
2. Domain event published (or transactional outbox).  
3. Activity projector consumes **idempotently**.  
4. Sequence allocated.  
5. Activity durable write.  
6. Feed cursors advance.

Projectors **must not** require global wall-clock ordering across tenants.

### 22.5 Distributed processing compatibility

| Pattern | Rule |
|---------|------|
| Multiple projector replicas | Idempotency + atomic sequence |
| Replay from outbox | Same identity → same `activityId` (deterministic) preferred |
| Shard by tenant | Ordering only claimed within shard key = tenant (and branch when scoped) |
| No claim | Global total order across all tenants — **out of scope** |

---

## 23. Enterprise Event Projection Model (H3)

### 23.1 Pipeline

```
Business Module (mutates domain)
        ↓
   Domain Event / Outbox
        ↓
   Activity Projector          →  Activity Center (observes / timelines)
        ↘
         → Notification Center  (notifies / delivers)
        ↘
         → Audit Center         (proves / compliance log)
```

### 23.2 Responsibility matrix

| Concern | Activity Center | Notification Center | Audit Center |
|---------|-----------------|---------------------|--------------|
| Primary verb | **Observes** | **Notifies** | **Proves** |
| User timeline UX | Yes | Inbox is delivery inbox, not enterprise timeline | Search/admin compliance UX |
| Delivery channels | No | Yes (in-app, email, SMS, push, WhatsApp) | No |
| Legal immutability | Projection immutability (§21); **not** legal SoR | Delivery logs | **Source of legal record** |
| Mutates patients / invoices | **Never** | Never | Never |
| May link to others | `notificationId`, `auditEntryId` optional | May emit activity card optionally | May project summary to activity when RBAC allows |

### 23.3 No duplication rules

| Forbidden | Correct design |
|-----------|----------------|
| Activity Center re-implements charge / booking | Business module executes; projector maps |
| Notifications stores the only timeline | Notifications store delivery; Activity stores timeline projections |
| Audit UI renamed as Activity without separation | Separate modules + optional links |
| Two modules both claim feed ownership | Feed ownership §26 — single owner |

### 23.4 Ownership

| Artifact | Owner |
|----------|-------|
| Domain write | Business module |
| Activity row / projection | Activity Center storage/projector |
| Notification message | Notifications module |
| Audit entry | Audit module |
| Discoverability of types/feeds | Registry `activity` contributions |

---

## 24. Event Versioning (M1)

| Version field | Scope | Mutates when |
|---------------|-------|--------------|
| **`eventVersion`** | Per `eventTypeId` payload schema | Additive schema evolution of that type |
| **`schemaVersion`** | Platform activity envelope (identity + headers) | Platform-wide envelope changes |
| **`projectionVersion`** | Projector mapping rules | Projector logic changes (reproject may require rebuild job) |
| **`activitySnapshotVersion`** / client **`snapshotVersion`** | EffectiveActivityView cache | Catalog/entitlement/branch/settings generation (compose like Phase 36 §22) |

### 24.1 Compatibility

| Kind | Rule |
|------|------|
| **Forward** | Newer readers must accept older `eventVersion` payloads (ignore unknown fields) |
| **Backward** | Older readers must ignore newer optional fields; breaking changes require new `eventTypeId` or major `eventVersion` + dual-write window |
| **Retention** | Archived rows keep original `eventVersion` / `schemaVersion`; rehydrate using registered schemas or sealed JSON |
| **Reprojection** | Allowed only via jobs that write **new** activities or versioned supersedes — never silent rewrite of identity |

---

## 25. Correlation Contract (M2)

| Field | Meaning | Future consumers |
|-------|---------|------------------|
| **`correlationId`** | Shared id for a business saga / multi-step story | Workflow runs, AI tool chains, automation batches |
| **`causationId`** | Immediate precursor (activity or domain event id) | Causal graphs, debugging |
| **`parentActivityId`** | UI/parent activity card | Nested timeline groups |
| **`batchId`** | Bulk import / mass update | Import hub, inventory receive batches |

### 25.1 Rules

1. Correlation fields are optional but **immutable once set**.  
2. Workflow (future) should reuse the same `correlationId` across steps.  
3. AI assistant outcomes that summarize a chain should set `correlationId` to the conversation/run id and `actorKind=ai`.  
4. Automations set `actorKind=automation` and prefer `batchId` for multi-target runs.  
5. Missing correlation must not block projection.

---

## 26. Activity Feed Ownership (M3)

Every feed descriptor **must** declare:

| Field | Required | Notes |
|-------|----------|-------|
| `feedId` | Yes | Stable |
| `ownerModuleId` | Yes | Single owning module (or `platform` for builtins) |
| `providerKey` | Yes | Feed assembler / query provider |
| `visibility` | Yes | Role/profile policy id or explicit rules |
| `licensing` | Yes | Feature/module gates |
| `rbac` | Yes | `resourceId` + actions |
| `branchScope` | Yes | `tenant` \| `branch` \| `cross-branch` |
| `retentionPolicy` | Yes | Hot retention window |
| `archivePolicy` | Yes | Archive after / purge rules |

### 26.1 Fail-closed ownership

| Condition | Bootstrap / runtime |
|-----------|---------------------|
| Two owners claim same `feedId` | **Fail bootstrap** |
| Missing `providerKey` | **Fail bootstrap** |
| Feed referenced by type but undeclared | **Fail bootstrap** |
| Marketplace feed without signature | **Reject install** |
| Ambiguous `branchScope` | **Fail validation** |

Types may appear in multiple feeds; feeds must still have unique ownership metadata.

---

## 27. Static Catalog Authority (M4)

Mirror Reporting / Analytics / White Label / Multi-Branch:

| Flag / authority | Value |
|------------------|-------|
| `STATIC_ACTIVITY_CATALOG_IS_RUNTIME_AUTHORITY` | **`false`** always |
| Runtime authority (registry mode) | **`EffectiveActivityView`** |
| Static catalog roles | Parity tests, rollback baseline, 38b allowlist join |
| Static-only mode | `VITE_USE_STATIC_ACTIVITY_ONLY=true` — discoverability from catalog; empty/restricted events if no server feed |

**Rule:** After 38b, production UI and feed assembly **must not** treat `STATIC_ACTIVITY_CATALOG` as the live event source or live type authority when registry mode is enabled.

---

## 28. Cross-Package Drift Prevention (M5)

### 28.1 Authoritative chain

```
Canonical Vocabulary
  ↓
Manifest Contributions (kind=activity)
  ↓
STATIC_ACTIVITY_CATALOG
  ↓
EffectiveActivityView
  ↓
DynamicActivityProvider
```

### 28.2 Field-by-field parity (38a validators — named)

| Check | Requirement |
|-------|-------------|
| Type inventory | Every canonical `eventTypeId` appears exactly once in builtins + static catalog |
| Contribution fields | `eventTypeId`/`activityTypeId`, `categoryId`, `defaultSeverity`, `providerKey`, `feedIds`, `resourceId`, `branchScoped`, `deepLinkTemplate`, `labelKey` match vocabulary |
| Feed inventory | Every `feedId` in types exists in feed ownership table (§26) |
| Extension IDs | `{moduleId}/activity/{localId}` unique |
| No orphan catalog rows | Static entry without vocabulary → fail |
| No orphan contributions | Manifest type missing from vocabulary → fail |

### 28.3 Drift failure mode

Integrity validators run at bootstrap / CI (38a). Drift → **fail closed** (build or registry bootstrap error) — never silently widen or invent types at runtime.

---

## 29. Final Remediation Record (2026-07-16)

| Observation | Severity | Resolution | Section |
|-------------|----------|------------|---------|
| **H1** Canonical activity event identity | High | Identity fields, uniqueness, immutability, bus headers | §21 |
| **H2** Event ordering contract | High | Tenant→Branch→Feed→Timestamp→Sequence; conflicts; projector; distributed | §22 |
| **H3** Enterprise event projection model | High | Observe / Notify / Prove separation; no ownership duplication | §23 |
| **M1** Event versioning | Medium | eventVersion, schemaVersion, projectionVersion, snapshotVersion + compat | §24 |
| **M2** Correlation contract | Medium | correlationId, causationId, parentActivityId, batchId | §25 |
| **M3** Activity feed ownership | Medium | Required ownership metadata; fail bootstrap on ambiguity | §26 |
| **M4** Static catalog authority | Medium | `STATIC_ACTIVITY_CATALOG_IS_RUNTIME_AUTHORITY = false`; EffectiveActivityView authority | §27 |
| **M5** Cross-package drift prevention | Medium | Vocabulary→manifest→catalog→view→provider parity | §28 |

| Item | Status |
|------|--------|
| Implementation code | **38a + 38b + 38c CLOSED** |
| Architecture readiness | **100%** |
| Foundation completeness (38a) | **100%** |
| Provider completeness (38b) | **100%** |
| Runtime acceptance (38c) | **100%** — Playwright **35/35** |
| Phases 28–36 | **Frozen** |

**Acceptance gate verdict:** **PASS** — Phase 38 permanently closed. Dynamic Activity Platform **100%**.

---

*Phase 38 — Dynamic Activity Center. Permanently closed 2026-07-16 (38a foundation + 38b provider + 38c runtime). Zero business behavior changes. Ready for Phase 39.*
