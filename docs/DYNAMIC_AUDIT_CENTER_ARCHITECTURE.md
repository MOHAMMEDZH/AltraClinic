# Phase 39 — Enterprise Audit Center Architecture

**Phase:** 39 (**PERMANENTLY CLOSED** · Architecture APPROVED · **39a CLOSED** · **39b CLOSED** · **39c CLOSED**)  
**Status:** **ARCHITECTURE APPROVED** (2026-07-16) · Final Remediation **NOT REQUIRED** · Phase **39a CLOSED** (2026-07-16) · Phase **39b CLOSED** (2026-07-16) · Phase **39c CLOSED** (2026-07-16) · Phase **39d NOT STARTED** (conditional execution layer)  
**Prerequisite:** Phase 38 — Dynamic Activity Center (**permanently closed**, 2026-07-16); Phases 1–38 **frozen**  
**Authoring panel:** CTO · Principal Enterprise SaaS · Healthcare ERP · Platform · Backend · Frontend · Security · Compliance · DevOps  
**SSOT for:** Enterprise Audit Center configuration platform (39a / 39b / 39c closed); optional Phase 39d execution layer; Marketplace audit providers, Plugin SDK audit packs, compliance export, legal hold

**Numbering note:** Enterprise Audit Center is **Phase 39**. Activity Center remains Phase **38** (closed). Phase **37** remains reserved for Department / franchise hardening — not started here.  
**Authority note:** This document is the permanent SSOT. Phase **39a Foundation CLOSED**. Phase **39b Provider CLOSED**. Phase **39c Runtime CLOSED**. Phase **39 permanently closed**. Runtime authority = `EffectiveAuditView`. `STATIC_AUDIT_CATALOG_IS_RUNTIME_AUTHORITY = false`. Phase **39d NOT STARTED**.

---

## 1. Executive Summary

Phase 39 defines the **Enterprise Audit Center** — the **tenth** registry consumer after navigation, routing, dashboard, search, reporting, analytics, white label, multi-branch, and activity. It establishes the **authoritative, immutable, legally defensible record** of security-sensitive and business-critical actions across the Healthcare ERP.

### Permanent separation

| Concern | Verb | Owner |
|---------|------|-------|
| Activity Center | **Observes** | Phase 38 (closed) |
| Notification Center | **Notifies** | Notifications module |
| Audit Center | **Proves** | Phase 39 (this SSOT) |

Audit is **not** an activity timeline, notification system, analytics surface, or application logging / observability stack.

### Pipeline (authoritative)

```
EffectiveModuleView
  ↓
audit contributions (kind=audit)
  ↓
STATIC_AUDIT_CATALOG          ← parity baseline only
  ↓
Server-side audit policy & visibility resolution
  ↓
EffectiveAuditView            ← **runtime authority**
  ↓
DynamicAuditProvider (39b)
  ↓
Enterprise Audit Center UI + existing authorized runtime
```

### Static catalog authority

```
STATIC_AUDIT_CATALOG_IS_RUNTIME_AUTHORITY = false
```

Runtime authority is always **`EffectiveAuditView`**.

### Scope

| In scope (architecture) | Out of scope (this phase) |
|-------------------------|---------------------------|
| Canonical identity, event model, categories, severity, risk | Production code, React, providers, hooks |
| Feeds/views, retention, archive, legal hold, export controls | Prisma migrations, workers, projectors |
| Integrity / tamper evidence strategy | Message bus / realtime implementation |
| Registry `audit` kind + contribution contract | Playwright / unit tests |
| `EffectiveAuditView` + `DynamicAuditProvider` design | Phase 39a / 39b / 39c implementation |
| Write reliability model (documented only) | Business behavior changes |
| Marketplace readiness | Redesign of Phases 1–38 |

### Business value

- **Legal defensibility:** Append-only evidence with integrity strategy.
- **Investigation:** Authorized search across security, clinical, financial, and administrative actions.
- **Compliance:** Retention, archive, legal hold, controlled exports.
- **Safety:** Fail-closed visibility; never widens RBAC, license, or branch scope.
- **Platform coherence:** Same registry → Effective*View → Provider lifecycle as Phases 30–38.

---

## 2. Enterprise Audit Center Boundaries

### 2.1 Responsibilities (must)

| Responsibility | Notes |
|----------------|-------|
| Record security-sensitive actions | Authn/authz, grants, impersonation, privileged access |
| Record business-critical mutations | Clinical, financial, inventory, configuration, licensing |
| Preserve immutable evidence | Append-only store; no ordinary edit/delete |
| Support authorized investigation | Server-authoritative search and detail views |
| Support compliance review | Feeds, filters, retention-aware visibility |
| Support controlled exports | Authorized, redacted, integrity-verified manifests |
| Preserve tenant and branch context | Hard tenant isolation; explicit branch grants |
| Link related actions | `correlationId`, `causationId`, `parentAuditId` |
| Remain server-authoritative | Client never invents or widens audit visibility |

### 2.2 Non-responsibilities (must not)

| Forbidden | Remains owned by |
|-----------|------------------|
| Execute business operations | Owning business modules |
| Replace module authorization | RBAC + licensing engines |
| Replace Activity Center | Phase 38 |
| Replace Notification Center | Notifications module |
| Replace operational application logs | Observability / logging stack |
| Replace monitoring and APM | System monitoring roadmap |
| Reconstruct permissions on the client | Server policy + EffectiveAuditView |
| Allow ordinary edit/delete of audit records | Application workflows must not mutate SoR |

---

## 3. Architecture Goals

| Goal | Success criterion |
|------|-------------------|
| Registry-driven discoverability | Event types, feeds, policies derive from `kind=audit` contributions |
| Legal immutability | Append-only records; corrections via compensating entries |
| Fail-closed visibility | Unknown type / ownership / policy → hidden or non-exportable |
| Separation of concerns | Activity observes; Notifications notify; Audit proves |
| Multi-branch awareness | Scope from DynamicBranchProvider + server grants |
| Independent rollback | `VITE_USE_STATIC_AUDIT_ONLY=true`; Playwright port **5181** (39c) |
| Marketplace-ready | Signed audit providers with namespaced keys |
| No second engines | No parallel RBAC, licensing, or branch engines |

---

## 4. Design Principles

1. **Server remains authoritative** — EffectiveAuditView is computed server-side; client never invents invisible records.
2. **Catalog-as-baseline** — `STATIC_AUDIT_CATALOG` is parity + rollback truth only — **not** runtime authority after registry mode.
3. **Configuration / discoverability migration (39b)** — Existing domain audit UIs continue; Audit Center consumes projections and authorized APIs.
4. **No second systems** — No parallel RBAC, licensing, or branch selection engines.
5. **Stable IDs** — `auditId`, `auditEventTypeId`, `feedId`, `extensionId`, `providerKey`, policy IDs are permanent.
6. **Narrow-only** — Tenant / branch / role / redaction filters may only remove or redact, never add unauthorized visibility.
7. **Fail closed** — Integrity validation blocks duplicate type IDs, missing ownership, unsigned marketplace providers, ambiguous feed ownership.
8. **Execution boundary** — Business modules execute; Audit **proves**; Activity **observes**; Notifications **notify**.
9. **Deterministic order** — Tenant → Branch scope → Occurred → Recorded → Sequence → Audit ID (§19).
10. **Static catalog is never runtime authority** — `STATIC_AUDIT_CATALOG_IS_RUNTIME_AUTHORITY = false` (§25).
11. **Audit-of-audit** — Accessing sensitive audit details itself creates an audit event.
12. **Storage growth is a first-class concern** — Hot/warm/cold + archive jobs are architectural, not afterthoughts.

---

## 5. Registry Integration

### 5.1 Consumer boundary

```
ModuleRegistryProvider (existing)
  └── EffectiveModuleView[]
        └── extensions[] where kind === 'audit'
              └── payload: AuditContributionView
```

**Reads:** EffectiveModuleView for which audit **event types**, **feeds**, and **policies** are discoverable.  
**Also reads (39b+):** Authorized audit search/detail APIs — **never** stores unrestricted audit records in browser persistence.  
**Does not write:** business tables, notification queues, activity stores (those remain owning-module concerns).

### 5.2 Extension kind

| Property | Value |
|----------|-------|
| Kind | `audit` |
| Ownership | Declared by modules that produce audited actions — **not** a new `LicensedModuleId` unless licensing SSOT later requires it |
| Licensing feature (existing) | `auditLogs` (Phase 28) gates audit read/export surfaces |
| Permission resource (existing) | `api.audit` (`view`, `create`, `export`, `manage`) |
| Parallel kinds | Coexists with `activity`, `notifications`, `reporting`, `branch`, `whiteLabel`, … |
| Builder (39a) | `buildAuditContributionsForModule(moduleId)` |

**Licensing note:** Audit remains gated by feature `auditLogs` and resource `api.audit`. Do **not** invent a new `LicensedModuleId` named `audit` unless Phase 28 licensing SSOT is explicitly extended in a future authorized phase.

### 5.3 Contribution ownership (owning modules)

Audit contributions are owned by modules that produce the audited actions, including at minimum:

| Owning module | Example audit domains |
|---------------|----------------------|
| `patients` | Patient create/update, merge, export |
| `scheduling` | Appointment create/cancel/reschedule |
| `queue` | Ticket state changes |
| `emr` | Encounter open/sign/amend |
| `dental` | Chart mutations |
| `beauty` | Treatment mutations |
| `inventory` | Stock adjustments |
| `billing` | Invoice, payment, refund |
| `reporting` | Report generate/export |
| `analytics` | Sensitive analytics access |
| `workflow` | Workflow approve/execute |
| `ai` | Inference / privileged AI actions |
| `settings` | Configuration changes |
| `users` / identity | User CRUD, grants, impersonation |
| `subscription` | Plan/feature changes (also `LicenseAuditEvent`) |
| module registry | Install/enable/disable/upgrade |
| `whiteLabel` | Branding publish/rollback |
| `branch` | Branch create/policy changes |
| `activity` | Activity feed policy changes (if audited) |
| future marketplace modules | Namespaced provider contributions |

### 5.4 Contribution contract (minimum fields)

Every audit contribution **must** declare:

| Field | Purpose |
|-------|---------|
| `extensionId` | `{moduleId}/audit/{localId}` |
| `auditEventTypeId` | Stable canonical type ID |
| `localId` | Module-local stable key |
| `owningModuleId` | Single owner module |
| `providerKey` | Builtin or marketplace projector key |
| `categoryId` | Canonical category (§7) |
| `severity` | Canonical severity (§8) |
| `action` | Canonical action (§9) |
| `resourceType` | Audited resource type |
| `permissionResource` | RBAC resource for visibility |
| `permissionAction` | RBAC action for visibility (action-aware) |
| `tenantScoped` | Always true for tenant data |
| `branchScoped` | Whether branch context applies |
| `retentionPolicyId` | Retention policy reference |
| `redactionPolicyId` | Redaction policy reference |
| `integrityPolicyId` | Integrity policy reference |
| `exportPolicyId` | Export eligibility policy |
| `schemaVersion` | Contribution schema version |
| `sortOrder` | Deterministic catalog order |
| `labelKey` | i18n label |
| `descriptionKey` | i18n description |

Optional (recommended): `defaultRisk`, `requiredFeature`, `crossBranchAllowed`, `feedIds`, `securityClassification`, `phiClassification`.

### 5.5 Fail-closed ownership

| Condition | Behavior |
|-----------|----------|
| Missing `owningModuleId` | Contribution rejected at bootstrap integrity |
| Ambiguous dual owners for same `auditEventTypeId` | Fail-closed — type hidden |
| Unknown `retentionPolicyId` / `redactionPolicyId` / `exportPolicyId` | Type hidden or non-exportable |
| Unsigned marketplace `providerKey` | Rejected |
| Collision with builtin IDs | Rejected |

### 5.6 Pipeline (authoritative)

```
Canonical Vocabulary (packages/module-registry audit/*)
  ↓
Manifest Contributions (kind=audit)
  ↓
STATIC_AUDIT_CATALOG (parity / rollback only — NOT runtime authority)
  ↓
EffectiveModuleView → audit contributions join
  ↓
Server Audit Policy Resolver (license + RBAC + branch + legal visibility + redaction)
  ↓
EffectiveAuditView  ← **runtime authority**
  ↓
AuditSnapshot
  ↓
DynamicAuditProvider (39b)
  ↓
consumers (Audit Center UI, domain audit panels, search discoverability, export gates)
```

---

## 6. Canonical Audit Event Identity

### 6.1 Required identity fields

| Field | Notes |
|-------|-------|
| `auditId` | Primary durable ID (UUID) |
| `auditEventTypeId` | Canonical type from vocabulary |
| `eventVersion` | Semantic version of this event type payload |
| `schemaVersion` | Storage / projection schema version |
| `occurredAt` | Business occurrence time |
| `recordedAt` | Persistence time |
| `actorType` | `user` \| `system` \| `service` \| `patient` \| `platform` |
| `actorId` | Actor identifier (nullable for pure system) |
| `actorDisplaySnapshot` | Redacted display snapshot at write time |
| `impersonatorId` | Present when acting under impersonation |
| `subjectType` | Primary subject (patient, user, invoice, …) |
| `subjectId` | Subject identifier |
| `resourceType` | Resource class |
| `resourceId` | Resource identifier |
| `action` | Canonical action (§9) |
| `outcome` | Canonical outcome (§9) |
| `tenantId` | Hard isolation boundary |
| `branchId` | Nullable; never silently global |
| `organizationId` | Future-safe (nullable) |
| `departmentId` | Future-safe (nullable; Phase 37) |
| `requestId` | HTTP / job request ID |
| `sessionId` | Session correlation |
| `correlationId` | Cross-action correlation |
| `causationId` | Immediate cause event ID |
| `parentAuditId` | Compensating / child entry link |
| `providerKey` | Builtin or marketplace producer |
| `producerModuleId` | Owning module |
| `sourceSystem` | `api` \| `worker` \| `portal` \| `platform` \| `import` |
| `clientIp` | Request IP (policy-controlled retention) |
| `userAgent` | Client UA (policy-controlled retention) |
| `integrityHash` | Record hash |
| `previousRecordHash` | Optional hash chain predecessor |

### 6.2 Uniqueness, idempotency, immutability

| Rule | Contract |
|------|----------|
| Uniqueness | `auditId` globally unique; natural key may include `(tenantId, requestId, auditEventTypeId, resourceId)` for idempotent writes |
| Idempotency | Writers must use stable idempotency keys for retries; duplicates do not create second legal facts |
| Immutability | No UPDATE/DELETE via ordinary application workflows; DB trigger preferred |
| Append-only corrections | Mistakes → new compensating audit entry with `parentAuditId` / `causationId` |
| Event bus compatibility | Identity fields must survive outbox / projector / rehydration without rewrite |
| Distributed projectors | Projectors may build read models; SoR remains append-only audit store |
| Legal exports | Export manifests include `auditId`, hashes, scope metadata, redaction policy version |

---

## 7. Audit Event Model

### 7.1 Canonical record (logical)

| Group | Fields |
|-------|--------|
| Identity | §6.1 |
| Actor | `actorType`, `actorId`, `actorDisplaySnapshot`, `actorRolesSnapshot` |
| Impersonation | `impersonatorId`, `impersonationReason?` |
| Subject | `subjectType`, `subjectId`, `subjectDisplaySnapshot?` |
| Resource | `resourceType`, `resourceId` |
| Action / outcome | `action`, `outcome`, `reason` |
| Change summary | Field-level allowlisted diffs (preferred over raw payloads) |
| Before / after | Reference IDs, allowlisted snapshots, encrypted payload refs, or hash-only proofs |
| Request context | `requestId`, `sessionId`, `clientIp`, `userAgent` |
| Tenant / branch | `tenantId`, `branchId`, future `organizationId` / `departmentId` |
| Correlation | `correlationId`, `causationId`, `parentAuditId` |
| Classification | `securityClassification`, `phiClassification`, severity, risk |
| Policies | `retentionPolicyId`, `redactionPolicyId`, `integrityPolicyId`, `exportPolicyId` (+ versions) |
| Integrity | `integrityHash`, `previousRecordHash?`, signature refs (phased) |
| Legal | `legalHoldState`, `exportEligibility` |

### 7.2 Safe before/after patterns (required)

Do **not** require unrestricted raw before/after payload storage.

| Pattern | When to use |
|---------|-------------|
| Field-level change summaries | Default for mutable business entities |
| Allowlisted snapshots | Explicit allowlist per `auditEventTypeId` |
| Encrypted sensitive payload references | When detail must be rehydratable under break-glass |
| Hash-only proof | Secrets, tokens, passwords — never retain plaintext |
| Redacted display projections | UI/search/export consumers |

**Forbidden in audit payloads:** passwords, refresh tokens, API keys, full payment card numbers, unrestricted clinical note dumps without classification + redaction policy.

---

## 8. Canonical Audit Categories

Frozen vocabulary for Phase 39a (exact IDs frozen at implementation; labels below are SSOT intent):

| Category ID (intent) | Label |
|----------------------|-------|
| `authentication` | Authentication |
| `authorization` | Authorization |
| `user-management` | User Management |
| `tenant-administration` | Tenant Administration |
| `branch-administration` | Branch Administration |
| `clinical` | Clinical |
| `patient-records` | Patient Records |
| `scheduling` | Scheduling |
| `queue` | Queue |
| `financial` | Financial |
| `billing` | Billing |
| `inventory` | Inventory |
| `reporting` | Reporting |
| `analytics` | Analytics |
| `workflow` | Workflow |
| `ai` | AI |
| `configuration` | Configuration |
| `licensing` | Licensing |
| `module-management` | Module Management |
| `white-label` | White Label |
| `data-export` | Data Export |
| `data-import` | Data Import |
| `security` | Security |
| `privacy` | Privacy |
| `integration` | Integration |
| `system-administration` | System Administration |
| `compliance` | Compliance |
| `other` | Other |

Unknown category at runtime → **fail closed** (hide contribution).

---

## 9. Canonical Audit Severity and Risk

### 9.1 Severity (operational / investigative priority)

| Severity | Use |
|----------|-----|
| `informational` | Expected routine evidence |
| `low` | Minor configuration / low-impact |
| `medium` | Notable business mutation |
| `high` | Privileged or sensitive mutation |
| `critical` | Security breach indicators, destructive overrides, legal-hold actions |

### 9.2 Security / compliance risk

| Risk | Use |
|------|-----|
| `none` | No elevated compliance risk |
| `low` | Limited exposure |
| `moderate` | PHI-adjacent or financial sensitivity |
| `high` | Direct PHI / payment / privilege change |
| `severe` | Cross-tenant risk, mass export, impersonation abuse indicators |

### 9.3 Why severity ≠ risk

| Concern | Severity | Risk |
|---------|----------|------|
| Filtering / triage UX | Primary | Secondary |
| Retention floor | May raise minimum retention | May raise retention + hold eligibility |
| Export controls | May require elevated export permission | May force redaction or block export |
| Alert linkage | Ops / SOC triage | Compliance / privacy escalation |
| Example | Successful password change = medium severity, high risk | Failed login flood = high severity, moderate risk |

They are **not interchangeable**. Both must be stored when applicable.

---

## 10. Canonical Audit Actions and Outcomes

### 10.1 Actions (frozen intent)

`view` · `list` · `search` · `create` · `update` · `delete` · `archive` · `restore` · `approve` · `reject` · `export` · `import` · `login` · `logout` · `impersonate` · `grant` · `revoke` · `enable` · `disable` · `publish` · `rollback` · `switch` · `execute` · `download` · `upload` · `print` · `sign` · `verify` · `override`

### 10.2 Outcomes

`success` · `denied` · `failed` · `partial` · `cancelled` · `expired` · `blocked`

### 10.3 Action-aware evaluation

Visibility and export authorization use **`(permissionResource, permissionAction)`** — never discovery-only permission checks.

Denied and failed outcomes remain auditable; visibility of those records still requires authorization.

---

## 11. EffectiveAuditView

### 11.1 Definition

Read-only, server-authoritative projection resolved for:

- tenant
- user
- roles
- active branch
- license and entitlements
- locale
- legal visibility
- data-classification permissions

### 11.2 Exposed surface (minimum)

| Field | Notes |
|-------|-------|
| Accessible categories | Filtered category set |
| Accessible event types | Filtered type set |
| Accessible feeds / saved views | Feed discoverability |
| Locked event types | Present but locked (license/RBAC) |
| Aggregate capabilities | §12 |
| Retention visibility | Which retention classes user may see |
| Export constraints | Export policy projection |
| Redaction level | Display / search redaction |
| Branch scope | `activeBranchId` + `accessibleBranchIds` (narrow-only) |
| Searchable fields | Server-enforced allowlist |
| Allowed time range | Max searchable window |
| Pagination contract | Cursor-only |
| `snapshotVersion` | Configuration snapshot version |
| `registryStatus` | healthy / degraded / restricted |
| `source` | `registry` \| `static-only` \| `static-fallback` \| `restricted` |

### 11.3 Fail-closed rules

| Condition | Behavior |
|-----------|----------|
| Unknown event type | Hidden |
| Unknown ownership | Hidden |
| Unknown redaction policy | Hidden |
| Unknown export policy | Non-exportable |
| Missing branch context | Never widen to all branches |
| Registry loading | Never expose broader static permission snapshot |
| Registry errors | Documented static fallback **must not widen** access |

---

## 12. Aggregate Audit Capability Contract

Capabilities are derived **only** from the resolved snapshot (Phase 39b). Architecture names them here; no runtime projection in this phase.

| Capability | Intent |
|------------|--------|
| `canViewAuditCenter` | Enter Audit Center shell |
| `canViewSecurityAudit` | Security category / feed |
| `canViewClinicalAudit` | Clinical / patient-records |
| `canViewFinancialAudit` | Financial / billing |
| `canViewCrossBranchAudit` | Explicit cross-branch search |
| `canSearchAudit` | Execute search API |
| `canExportAudit` | Start export job |
| `canVerifyAuditIntegrity` | Run / view integrity verification |
| `canManageRetentionPolicies` | Retention policy administration |
| `canPlaceLegalHold` | Place / release legal hold |
| `canViewSensitiveAuditDetails` | Break-glass / elevated detail |

### 12.1 Derivation rules

| Mode | Behavior |
|------|----------|
| Derivation source | EffectiveAuditView / AuditSnapshot only |
| Fail-closed defaults | All capabilities `false` until proven |
| Restricted snapshot | Shell may load; capabilities false; no search/export |
| Registry mode | Capabilities ⊆ intersection of license + RBAC + legal visibility |
| Static rollback | Same or narrower than registry; never wider |
| Licensing | Feature `auditLogs` required for view/search/export |
| RBAC | Action-aware `(api.audit, view|export|manage)` (+ domain resources as declared) |

---

## 13. DynamicAuditProvider Architecture

### 13.1 Components (39b — design only)

| Component | Role |
|-----------|------|
| `DynamicAuditProvider` | Configuration provider |
| `useAudit()` | Required consumer hook |
| `useOptionalAudit()` | Optional consumer (domain panels) |

### 13.2 Responsibilities

- Consume EffectiveModuleView and EffectiveAuditView
- Resolve client-visible **configuration** (not unrestricted records)
- Expose immutable `AuditSnapshot`
- Expose capabilities, categories, types, feeds, policies
- Maintain identity-scoped **configuration** cache
- Fail closed
- Support `refresh()`
- Support rollback mode (`VITE_USE_STATIC_AUDIT_ONLY`)

### 13.3 Must never

- Create or mutate audit records
- Evaluate licensing or RBAC engines locally as authority
- Perform legal authorization
- Generate integrity signatures
- Export raw audit records from the browser
- Execute audit queries without the server API
- Store sensitive audit record data in browser persistence (localStorage/IndexedDB)

### 13.4 Mount order (proposed)

```
AuthProvider
  └── ModuleRegistryProvider
        └── DynamicBranchProvider
              └── DynamicWhiteLabelProvider
                    └── DynamicActivityProvider
                          └── DynamicAuditProvider   ← after activity; before route consumers that need audit config
                                └── RegistryRouteHost / routes / navigation
```

**Rationale:** Branch and white-label context exist first; Activity observes independently; Audit configuration mounts next so Audit Center and authorized panels share one snapshot. Routing/navigation consume capabilities without rebuilding policy.

---

## 14. Audit Feeds and Views

### 14.1 Canonical feeds (intent)

| feedId (intent) | Purpose |
|-----------------|---------|
| `all-authorized` | All Authorized Audit |
| `security` | Security |
| `clinical` | Clinical |
| `financial` | Financial |
| `administration` | Administration |
| `user-access-changes` | User and Access Changes |
| `data-exports` | Data Exports |
| `configuration-changes` | Configuration Changes |
| `licensing-module-changes` | Licensing and Module Changes |
| `branch-audit` | Branch Audit |
| `my-actions` | My Actions |
| `failed-denied` | Failed and Denied Actions |
| `critical-events` | Critical Events |
| `legal-hold` | Legal Hold |

### 14.2 Feed declaration (minimum)

Every feed must declare: `feedId`, `ownerModuleId`, `providerKey`, visibility policy, licensing requirements, RBAC action, branch scope, retention policy, redaction policy, export policy, default filters, sort order.

Ambiguous feed ownership → **fail bootstrap** (39a integrity).

---

## 15. Activity, Notification, and Audit Relationship

### 15.1 Enterprise projection model

```
Business Module
  ↓
Business transaction or security action
  ↓
Independent projections
  ├── Activity Center     → observes
  ├── Notification Center → notifies
  └── Audit Center        → proves
```

### 15.2 Rules

| Rule | Contract |
|------|----------|
| Activity → Audit link | Only when user has `canLinkToAudit` / equivalent audit view permission |
| Notifications → Audit | May reference `correlationId`; never become legal evidence |
| Audit storage independence | Audit must not depend on Activity or Notification storage for legal integrity |
| Projection failure | Failure of Activity or Notification **must not** remove audit evidence |
| Critical audit failure | Explicit write-before-success or compensating failure policy (§16) |
| No ownership duplication | One SoR owner per concern |

---

## 16. Audit Write Path and Reliability

Architecture only — no projectors/workers in this phase.

### 16.1 Preferred pattern: hybrid

| Class | Pattern | Examples |
|-------|---------|----------|
| **Critical** | Synchronous audit write **within** the business transaction (or same atomic unit) | Authz grant/revoke, impersonation, PHI export, payment void, legal hold, user delete |
| **Important** | Transactional outbox → durable projector with retry | Clinical updates, billing mutations, config publish |
| **Informational** | Async projection allowed with lag SLO | Successful routine views where audited |

### 16.2 Reliability contract

| Concern | Contract |
|---------|----------|
| Write-before-success | Critical actions must not report success if audit write fails (or must roll back) |
| Async projection | Important/informational via outbox; never lose critical legal facts to “best effort” |
| Retry | Exponential backoff; idempotent keys |
| Dead-letter | Failed audit jobs visible to ops; alert on critical class |
| Projector lag | Observable metric; SLO documented in 39d/ops |
| Failure visibility | Admin health surface for audit write failures |
| Reprojection | Read models only; SoR never rewritten |
| Duplicate prevention | Idempotency keys + unique constraints |

### 16.3 Backend increment note

If production-grade storage hardening (triggers, archive jobs, integrity chain, export jobs) exceeds provider scope, execute under **Phase 39d — Audit Execution Layer** (or an explicitly authorized execution increment). Do **not** hide major backend work inside 39b or 39c.

---

## 17. Tamper Evidence and Integrity

| Capability | Architecture stance |
|------------|---------------------|
| Append-only records | Application + preferred DB trigger |
| Record hashes | `integrityHash` required for new schema generations |
| Optional hash chaining | `previousRecordHash` supported without redesign |
| Signed export manifests | Required for controlled exports |
| Integrity verification jobs | Periodic verify + on-demand `canVerifyAuditIntegrity` |
| Encryption at rest | Platform storage encryption |
| Key rotation | Supported; verification uses key version metadata |
| Separation of duties | Manage retention / legal hold ≠ unrestricted delete |
| Administrative access | Platform privileged access audited |
| Detection | Missing sequence / hash mismatch alerts |

Full cryptographic signing may be **phased**; architecture must support it without redesign.

---

## 18. Retention, Archive, and Legal Hold

| Concept | Contract |
|---------|----------|
| `RetentionPolicyId` | Stable policy ID on every type/contribution |
| Hot retention | Queryable primary store |
| Warm archive | Compressed / secondary store; rehydratable |
| Cold archive | Long-term; slower rehydration |
| Legal hold | Overrides deletion/archive purge; deletion prohibited under hold |
| Tenant offboarding | Policy-driven export + hold check before purge |
| Regional variation | Durations configurable and jurisdiction-aware — **no universal invented durations** |
| Export retention | Export artifacts follow separate retention |
| Rehydration | Archive → hot for authorized investigation |
| Integrity after archive | Re-verify hashes on restore |
| Policy versioning | `retentionPolicyVersion` on records and snapshots |

Existing UI setting `auditRetentionDays` is acknowledged as **configuration debt** until enforcement jobs exist (§28).

---

## 19. Privacy, PHI, and Redaction

| Concern | Contract |
|---------|----------|
| PHI/PII classification | Per field / per event type |
| Allowlists / denylists | Redaction policies declare both |
| Redacted display projections | Default for UI and search |
| Restricted detail views | `canViewSensitiveAuditDetails` |
| Break-glass | Reason required; creates audit-of-audit event |
| Audit of audit access | Mandatory for sensitive detail and exports |
| Export redaction | Export policy + redaction policy intersection |
| Search-index redaction | Indexes never store forbidden plaintext |
| Non-retention | Secrets, passwords, tokens, raw credentials never stored |

---

## 20. Tenant, Branch, and Future Department Isolation

| Rule | Contract |
|------|----------|
| Tenant | Hard isolation boundary |
| Branch visibility | Constrained by server grants |
| Cross-branch | Requires `canViewCrossBranchAudit` (or equivalent) |
| Active branch filters | Must not silently become global scope |
| GLOBAL users | Still require audit-specific authorization |
| Department (future) | Narrow-only; Phase 37 |
| Cache keys | Include tenant, user, roles, branch, snapshot versions |
| Exports | Preserve scope metadata (tenant/branch/time/redaction versions) |

---

## 21. Search and Filtering Architecture

Server-authoritative audit search only.

### 21.1 Filters

Time range · Actor · Impersonator · Subject · Resource · Action · Outcome · Category · Severity · Risk · Tenant · Branch · Correlation ID · Request ID · Provider · Module · Legal hold · Export status

### 21.2 Requirements

| Requirement | Contract |
|-------------|----------|
| Cursor pagination | Mandatory |
| Deterministic ordering | §22 |
| Bounded date ranges | Server-enforced max window |
| Searchable fields | Server allowlist only |
| Redaction-aware results | Apply redaction before response |
| No client-only security filtering | Forbidden |

Existing `GET /audit/entries` is the seed API; Enterprise Audit Center extends authorization, redaction, and feed projection without inventing client-side security.

---

## 22. Deterministic Ordering and Versioning

### 22.1 Ordering hierarchy

```
Tenant
  ↓
Branch scope
  ↓
Occurred timestamp
  ↓
Recorded timestamp
  ↓
Sequence
  ↓
Audit ID
```

### 22.2 Version fields

| Version | Purpose |
|---------|---------|
| `eventVersion` | Event type payload compatibility |
| `schemaVersion` | Storage schema generation |
| `projectionVersion` | Read-model projector version |
| `snapshotVersion` | EffectiveAuditView / AuditSnapshot |
| `retentionPolicyVersion` | Retention policy generation |
| `redactionPolicyVersion` | Redaction policy generation |
| `integrityPolicyVersion` | Integrity policy generation |

Conflict handling: newer schema must read older records; unknown newer fields fail closed on write from old producers.

---

## 23. Cache and Snapshot Strategy

**Configuration cache only.** Browser must never cache unrestricted audit record payloads.

### 23.1 Cache key

`tenantId` · `userId` · `rolesHash` · `activeBranchId` · `catalogGeneration` · `entitlementVersion` · `auditPolicyVersion` · `auditSnapshotVersion` · `cacheVersion`

### 23.2 Invalidation triggers

login · logout · tenant switch · branch switch · role change · permission refresh · entitlement change · registry refresh · audit policy change · legal hold policy change

---

## 24. Rollback Strategy

```
VITE_USE_STATIC_AUDIT_ONLY=true
```

| Property | Value |
|----------|-------|
| Proposed Playwright port | **5181** |
| Behavior | Bypass registry configuration; build static `AuditSnapshot` |
| Authorization | Server-side authorization **preserved** |
| Legal visibility | Never bypassed |
| Export | Never widened |
| Testability | Independently testable in 39c |

Do **not** implement rollback in this architecture phase.

---

## 25. Security Model

| Control | Contract |
|---------|----------|
| Server-authoritative authorization | Always |
| Action-aware permission checks | `(resource, action)` |
| Tenant isolation | Hard |
| Branch isolation | Grant-constrained |
| PHI redaction | Policy-driven |
| Audit-of-audit | Sensitive access + exports |
| Export authorization | `canExportAudit` + export policy |
| Legal hold authorization | `canPlaceLegalHold` |
| Separation of duties | Policy manage ≠ unrestricted mutate |
| Impersonation evidence | `impersonatorId` required when applicable |
| Session / request correlation | `sessionId`, `requestId` |
| No ordinary delete | Application + DB controls |
| No client-side permission authority | Snapshot capabilities are projections only |
| Rate limiting | Heavy search and export |
| Signed / integrity-verified exports | Required |
| Spreadsheet formula injection | Sanitize CSV/XLSX cell prefixes |

---

## 26. Performance and Scalability

| Strategy | Notes |
|----------|-------|
| Append-oriented writes | Hot path optimized for insert |
| Indexed query dimensions | tenant + time, actor, resource, correlation |
| Cursor pagination | No deep OFFSET |
| Date partitioning | Strategy for large tenants (ops) |
| Hot / warm / cold | Align with retention |
| Archive jobs | Async |
| Query budgets | Server-enforced |
| Export jobs | Async for large exports |
| Incremental loading | UI feeds |
| Snapshot payload budget | Configuration-sized; not record dumps |
| Multi-replica sequences | Sequence/hash chain design must tolerate replicas |
| Observability | Projector lag, failed writes, export queue depth |

No schema implementation in this phase.

---

## 27. Marketplace Model

Future signed audit provider contributions require:

| Requirement | Contract |
|-------------|----------|
| Namespaced `providerKey` | No collision with `activity.builtin` / audit builtin |
| Namespaced event type IDs | Prefix required |
| Signed packages | Signature verification at install |
| Ownership validation | Single owner |
| Version compatibility | Manifest + schemaVersion |
| Retention / redaction / export policies | Declared and validated |
| No builtin ID collisions | Integrity fail |
| Uninstall | Historical audit remains readable |
| Provider metadata retention | Metadata retained after plugin uninstall |
| Authorization | Marketplace providers **never** bypass server auth or retention |

---

## 28. Static Audit Catalog

### 28.1 Definition

`STATIC_AUDIT_CATALOG` is generated from canonical vocabulary for parity and compatibility testing.

```
STATIC_AUDIT_CATALOG_IS_RUNTIME_AUTHORITY = false
```

### 28.2 Layer parity

```
Canonical Vocabulary
  ↓
Manifest Contributions
  ↓
STATIC_AUDIT_CATALOG
  ↓
EffectiveAuditView
  ↓
DynamicAuditProvider
```

All layers fail closed on drift (field-by-field validators in 39a).

---

## 29. Migration Roadmap

### Phase 39a — Foundation (**CLOSED** — 2026-07-16)

**Scope completed:**

- Canonical audit categories (28), severities (5), risks (5), actions (32), outcomes (7)
- Canonical policies (16): retention / redaction / integrity / export
- Canonical event types (42), feeds (14), nav surfaces (4) → **60** catalog entries
- Manifest builders + extension kind `audit` (`buildAuditContributionsForModule`)
- `STATIC_AUDIT_CATALOG` with `STATIC_AUDIT_CATALOG_IS_RUNTIME_AUTHORITY = false`
- Fail-closed integrity + cross-package layer parity
- Zero runtime behavior change

**Evidence:** `@booking/module-registry` vitest **97/97**; clinic-dashboard `dynamic-audit` foundation vitest **12/12** (39a)

**Explicitly not included:** Provider, APIs, Prisma, storage, UI, Playwright

### Phase 39b — Provider and Integration (**CLOSED** — 2026-07-16)

**Scope completed:**

- `DynamicAuditProvider`, `useAudit()`, `useOptionalAudit()`
- EffectiveAuditView / AuditSnapshot builder from EffectiveModuleView + STATIC_AUDIT_CATALOG
- Identity-scoped configuration cache (no audit records)
- Aggregate capabilities from snapshot only
- `VITE_USE_STATIC_AUDIT_ONLY` rollback flag
- Mount after Activity; branch refresh consumer `'audit'`
- Existing Audit Settings page configuration-source wiring (`useOptionalAudit`)
- Zero business behavior / API / Prisma changes

**Evidence:** clinic-dashboard `dynamic-audit` vitest **28/28**; `@booking/module-registry` vitest **97/97**; branch refresh contract updated

**Separation rule:** Optional API/storage hardening remains **Phase 39d** — not hidden inside 39b.

### Phase 39c — Runtime Acceptance and Production Closure (**CLOSED** — 2026-07-16)

**Scope completed:**

- Playwright acceptance (`e2e/dynamic-audit.spec.ts` + helpers)
- Rollback server on port **5181** (`VITE_USE_STATIC_AUDIT_ONLY=true`)
- Role and licensing scenarios (Owner, GM, Doctor, Dentist, Receptionist, Accountant, Inventory Manager; Patient fail-closed)
- Starter / Professional / Enterprise / Licensed; Grace / Suspended / Expired fail-closed shell
- Tenant and branch isolation; branch consumer `'audit'` synchronization
- Capabilities projected from AuditSnapshot only (no client RBAC widen)
- Cache and refresh (no unrestricted audit records in browser storage)
- Security and performance verification (bounded bootstrap; no redirect loops; no rebuild storms)
- Acceptance probes `__BOOKING_AUDIT_RUNTIME__` / `__BOOKING_AUDIT_ACTIONS__`
- SSOT production closure

**Evidence:** Playwright **36/36 passed**; clinic-dashboard `dynamic-audit` vitest **28/28**; `@booking/module-registry` vitest **97/97**

**Runtime authority:** `EffectiveAuditView` · `STATIC_AUDIT_CATALOG_IS_RUNTIME_AUTHORITY = false`

Acceptance-only defects fixed where required; zero architecture redesign; zero business behavior / API / Prisma / writer changes.

### Phase 39d — Audit Execution Layer (conditional · **NOT STARTED**)

Authorize only if production closure requires:

- DB immutability triggers for `audit_entries`
- Retention / archive / legal-hold workers
- Integrity hash backfill + verification jobs
- First-class export API + async export jobs
- Outbox hardening for critical/non-critical classes

Do **not** misclassify 39d work as 39c acceptance.

---

## 30. Architecture Risks

| Risk | Class | Mitigation |
|------|-------|------------|
| Audit records altered or deleted | Critical | Append-only API + DB triggers; no update paths; compensating entries |
| Failed critical audit writes | Critical | Write-before-success; transaction rollback; ops alerts |
| Cross-tenant leakage | Critical | Tenant RLS + app guards; fail-closed search |
| PHI leakage | Critical | Redaction policies; allowlists; audit-of-audit |
| Excessive storage growth | High | Hot/warm/cold; partitioning; retention jobs |
| Slow search | High | Indexes; cursor pagination; bounded ranges; query budgets |
| Export abuse | High | Capability + rate limits + async jobs + manifests |
| Misuse as application logging | High | Boundaries §2; Observability remains separate |
| Activity/Audit duplication | Medium | Observe/Notify/Prove; optional links only |
| Plugin ownership loss after uninstall | Medium | Retain provider metadata; historical readability |
| Hash-chain operational complexity | Medium | Optional chain; verify jobs; phased signing |
| Legal retention by jurisdiction | Medium | Configurable policies; no universal durations |
| Impersonation ambiguity | Medium | Required `impersonatorId` + reason when applicable |
| Before/after overcollection | Medium | Allowlists; hash-only; encrypted refs |
| Partial branch scope | Medium | Explicit grants; never silent global |
| Missing correlation IDs | Medium | Middleware injection; fail metrics |
| Clock skew and ordering | Medium | Occurred + recorded + sequence + auditId |

---

## 31. Technical Debt Inventory (repository evidence — 2026-07-16)

### 31.1 What exists (verified)

| Artifact | Path / evidence | Assessment |
|----------|-----------------|------------|
| Prisma `AuditEntry` / `audit_entries` | `schema.prisma` | Real central trail; fields subset of §6/§7 |
| Prisma `LicenseAuditEvent` | Append-only triggers in Phase 28 migration | Real licensing audit |
| Domain trails | `EncounterEvent`, `QueueTicketEvent` | Domain-specific — not Enterprise Audit Center SoR |
| Nest audit module | `apps/api/src/modules/audit/` | Create / search / get by id |
| APIs | `POST/GET /audit/entries`, `GET /audit/entries/:id` | Real |
| Domain writers | Identity, notifications, platform-admin, portal, licensing, AI, reporting, workflow | Real adapters |
| Domain UIs | Users audit, workflow audit, EMR encounter audit panel, report audit panel | Partial surfaces |
| Settings UI | `/settings/audit` | Retention/toggles/exportEnabled — **config only** |
| Permissions | `api.audit` view/create/export/manage; feature `auditLogs` | Real matrix + licensing |
| Reporting | `security-audit` operational report reads audit entries | Partial export path |
| Registry metadata | `auditClassification` on manifests; reporting `dataDomain: 'audit'` | Not extension kind `audit` |
| Activity link | `canLinkToAudit` in activity types | Registry intent; not fully wired in UI |

### 31.2 What is missing or incomplete

| Gap | Notes |
|-----|-------|
| Extension kind `audit` | Not in registry catalog |
| Canonical vocabulary / STATIC_AUDIT_CATALOG | Absent |
| EffectiveAuditView / AuditSnapshot / DynamicAuditProvider | Absent |
| Global Audit Center browser UI | `/settings/audit` is settings, not log browser |
| `GET /audit/entries/export` | Permission exists; endpoint missing |
| `audit_entries` DB immutability trigger | Documented in DATABASE.md; **not** in migrations |
| Retention enforcement | `auditRetentionDays` stored, not applied |
| Track toggles enforcement | Settings stored, writers ignore |
| `exportEnabled` enforcement | Stored, not checked |
| Integrity hashes / hash chain | Absent on `AuditEntry` |
| Legal hold | Absent |
| Archive / cold storage jobs | Absent |
| AuditPolicy vs permission-matrix role mismatch | `admin`/`auditor`/`tenant_admin` vs matrix roles — authorization debt |
| Platform RLS bypass “audit” | Application logger only — not `AuditEntry` |
| `AuditEntryCreatedEvent` consumers | Published; no Activity projection listener |
| Misleading “audit” naming | Subscription license UI labels; SECURITY-AUDIT.md (code review) |

### 31.3 Logging mistaken for audit

| Item | Reality |
|------|---------|
| `PlatformRlsBypassAudit` logs | `logger.warn` JSON — not SoR |
| Nest `Logger` in audit services | Operational logging on write failure |
| Docs titled “audit” | Engineering documents, not runtime Audit Center |

---

## 32. Cross-Consumer Coordination

| Consumer | Coordination |
|----------|--------------|
| Activity (38) | Optional `auditEntryId` link when authorized |
| Notifications | May carry `correlationId`; not evidence |
| Reporting (33) | Compliance reports consume authorized audit queries |
| Analytics (34) | Must not treat audit SoR as analytics warehouse without redaction |
| Search (32) | May discover Audit Center routes; must not index forbidden PHI |
| White label (35) | Chrome tokens only; audit content brand-agnostic for security events |
| Multi-branch (36) | Branch scope from DynamicBranchProvider + server grants |
| Module registry (29) | Lifecycle events already expected to append commercial / central audit |

---

## 33. Implementation Authority Boundaries

| Layer | Authority |
|-------|-----------|
| This SSOT | Architecture decisions for Phase 39 |
| Phase 39a | Vocabulary + catalog + validators only |
| Phase 39b | Provider + configuration migration only |
| Phase 39c | Runtime acceptance only |
| Phase 39d (conditional) | Storage / jobs / export execution |
| Phases 1–38 | **Frozen** — no redesign |

---

## 34. Architecture Acceptance Gate

| Criterion | Status |
|-----------|--------|
| Boundaries documented | **PASS** |
| Registry `audit` kind designed | **PASS** |
| Canonical identity + event model | **PASS** |
| Categories / severity / risk / actions / outcomes | **PASS** |
| EffectiveAuditView + capabilities | **PASS** |
| Provider design + mount order | **PASS** |
| Observe / Notify / Prove preserved | **PASS** |
| Write reliability + integrity + retention | **PASS** |
| Privacy / isolation / search / cache / rollback | **PASS** |
| Security / performance / marketplace | **PASS** |
| Static catalog non-authority explicit | **PASS** |
| Roadmap 39a/39b/39c/(39d) | **PASS** |
| Risks + mitigations | **PASS** |
| Technical debt from repo inspection | **PASS** |
| Companions updated | **PASS** (Module Management, Current System Audit, Production Remediation) |
| Production code / runtime providers changed in architecture phase | **NONE** (required) |
| Phase 39a foundation | **CLOSED** (2026-07-16) |
| Phase 39b provider | **CLOSED** (2026-07-16) |
| Phase 39c runtime acceptance | **CLOSED** (2026-07-16) |
| Phase 39 permanently closed | **YES** |
| Runtime authority | `EffectiveAuditView` |
| `STATIC_AUDIT_CATALOG_IS_RUNTIME_AUTHORITY` | **false** |

**Architecture readiness:** **100%** (configuration platform)  
**Phase 39a foundation:** **100%**  
**Phase 39b provider:** **100%** · Remediation **NOT REQUIRED**  
**Phase 39c runtime:** **100%** · Playwright **36/36**  
**Phase 39 permanently closed:** **YES**  
**Phase 39d:** **NOT STARTED** (conditional execution layer only)

---

## 35. Final Architecture Decision

**APPROVED** — Phase 39 Enterprise Audit Center Architecture is the permanent SSOT.  
**Phase 39a Foundation CLOSED.** **Phase 39b Provider CLOSED.** **Phase 39c Runtime CLOSED.**  
**Phase 39 permanently closed.** Runtime authority = `EffectiveAuditView`. `STATIC_AUDIT_CATALOG_IS_RUNTIME_AUTHORITY = false`.

| Gate | Status |
|------|--------|
| Architecture | **APPROVED** |
| Phase 39a | **CLOSED** |
| Phase 39b | **CLOSED** |
| Phase 39c | **CLOSED** |
| Remediation | **NOT REQUIRED** |
| Phase 39 | **PERMANENTLY CLOSED** |
| Phase 39d | **NOT STARTED** (conditional — if execution layer required) |

Do **not** redesign Phase 39a–39c. Do **not** begin Phase 39d without explicit authorization.
