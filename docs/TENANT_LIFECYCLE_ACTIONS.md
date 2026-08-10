# Flexible Step 19 — Tenant Lifecycle Actions

**Canonical roadmap:** Super Admin Flexible Plans & Entitlements Implementation Playbook v4  
**Release:** 47 — Flexible Super Admin MVP  
**Status:** **Accepted / Complete** — functional/security gates + evidence hygiene closure (2026-08-03); Flexible Steps 20–29 remain unauthorized  
**Authority order:** Playbook v4 → `SUPER_ADMIN_ARCHITECTURE.md` / Super Admin docs → `PHASE_47_EXECUTION_PLAN.md` → this freeze → Steps 16–18 / U01 / Step 17 docs → repository evidence  

**Flexible Steps 20–29 remain unauthorized.**

---

## 1. Discovery Summary (repository evidence)

| Concern | Evidence | Decision |
|---------|----------|----------|
| Operator lifecycle SoR | `PlatformTenant.status` (`PROVISIONING` \| `ACTIVE` \| `SUSPENDED` \| `ARCHIVED`) | **Extend** — do not invent a second enum |
| Domain aggregate | `platform-admin/domain/entities/platform-tenant.entity.ts` — `activate` / `suspend` / `resume` / `archive` | Harden via Step 19 service; keep methods |
| Clinic identity projection | `Tenant.status` / `Tenant.lifecycleStatus` / `deletedAt` | Sync on Step 19 transitions; not independent SoR |
| Step 17 onboarding SoR | `PlatformTenantProvisioningRequest` + checkpoints | **Separate forever** — Step 19 must not merge statuses |
| Legacy HTTP | `POST /platform/tenants/:id/{activate,suspend,resume,archive}` via clinic JWT + `api.platform_admin` | Retain for backward compat; **new** Platform-auth lifecycle API is authoritative for Super Admin |
| Session revocation on suspend | **Missing** bulk clinic revoke-by-tenant | Add `revokeAllSessionsForTenant` |
| Clinic login deny SUSPENDED/ARCHIVED | **Missing** (only PROVISIONING denied) | Add fail-closed in `LoginHandler` (+ refresh) |
| Archive/delete **request** workflow | RBAC keys only (`dualControlLater`) | **New** request tables + approve/reject/cancel |
| Physical deletion executor | **Absent** | Deletion request = governed handoff only; never raw DELETE |
| PlatformTenant `rowVersion` | **Absent** | Add additive `rowVersion Int @default(1)` |
| Idempotency for lifecycle | **Absent** | New `platform_tenant_lifecycle_idempotency` |
| Permissions | `tenant.view\|activate\|suspend\|resume\|archive-request\|delete-request` | **Reuse**; add narrow `tenant.request.approve` for dual control |
| Step-up | Catalog `stepUpExpected` / `dualControlLater`; service-level `PlatformAssuranceService` | Enforce on all mutations |
| EER invalidation | `EffectiveEntitlementRuntimeService.invalidateTenant` | Call after every successful transition |
| Step 16 | Commercial blocked when tenant SUSPENDED/ARCHIVED | Lifecycle does **not** rewrite commercial history; may call Step 16 contracts only if eligibility requires |
| U01 | Flags default OFF; no lifecycle writes | Preserve; no invented counters |
| Notifications | No PlatformTenant lifecycle templates wired | Emit bounded outbox/domain events; non-critical delivery failure does not roll back transition |
| Super Admin UI | Directory/detail read-only | Add lifecycle panel on Tenant Detail |
| Containment | Step 17 `TENANT_PROVISIONING_ENABLED` pattern | Add `TENANT_LIFECYCLE_ENABLED` default **false** |

---

## 2. Source-of-Record Freeze

### 2.1 Tenant lifecycle SoR

**Authoritative:** `platform_tenants.status` (`PlatformTenantStatus`).

Domain VO values (lowercase): `provisioning` | `active` | `suspended` | `archived`.

### 2.2 Step 17 boundary (initial onboarding activation)

- Step 17 owns creation, commercial config, invitation, and **first** transition of a managed onboarded tenant to `ACTIVE` via the activation barrier.
- Step 19 **MUST NOT** activate a tenant whose latest Step 17 workflow (when present) is not `COMPLETED`.
- Step 19 **MUST NOT** activate while `PlatformTenant.status === PROVISIONING` unless an approved non-Step-17 path exists **and** provisioning history shows no open request (legacy tenants only).
- Step 19 **MUST NOT** create commercial configs, activation snapshots, or invitations.

### 2.3 Step 19 general activation

Eligible when:

- `PlatformTenant.status === PROVISIONING` **only** for **legacy** tenants with **no** Step 17 request, **or**
- Prefer: do **not** use Step 19 activate for normal Step 17 graduates (already ACTIVE).  
  **Frozen rule:** Step 19 `ACTIVATE_TENANT` is allowed only when status is `PROVISIONING`, there is **no** incomplete Step 17 request, and commercial/EER readiness passes — used to graduate **legacy** control-plane records.  
  Suspended tenants use **REACTIVATE** (`tenant.resume`), never activate.

### 2.4 Step 16 commercial boundary

- Step 16 remains SoR for commercial configuration / subscription commercial lifecycle.
- Tenant lifecycle transitions **do not** write Step 16 tables directly.
- Suspension / archive: **tenant lifecycle only** + EER/licensing derived denial (existing listeners). Commercial history unchanged unless a future Step 16 contract is explicitly invoked (none required for MVP suspend).
- Reactivation: require commercial eligibility read via Step 16 / EER readiness checks; **do not** create a replacement subscription or rewrite snapshots.

### 2.5 Flexible Step 18 boundary

- EER remains authoritative runtime resolver.
- Suspension → invalidate tenant cache; subsequent resolve must deny (via PlatformTenant status / license suspended path).
- Reactivation → invalidate then resolve; never Legacy for managed tenants.

### 2.6 U01 boundary

- Supplemental; flags remain default OFF.
- No usage fabrication on suspend/reactivate.

### 2.7 Session SoR

- Clinic refresh tokens: existing `RefreshToken` repository (tenant-scoped rows).
- Suspension: revoke **all active clinic refresh tokens for `tenantId`**.
- Platform sessions: **not** revoked when a tenant is suspended.
- Reactivation: **does not** restore revoked sessions; users must log in again.

### 2.8 Notification / outbox SoR

- Reuse existing outbox / domain-event publisher.
- Bounded event types only; no PHI/tokens/snapshots.

### 2.9 Archival / deletion executor boundary

- **Archival request** → after approval, executor may call existing aggregate `archive(reason)` (soft terminal status). Not one-click from UI.
- **Deletion request** → request + approval only. **No** physical DELETE of tenant, clinical, audit, idempotency, snapshot, subscription, U01, or provisioning history in Step 19.
- No legal-hold / backup-deletion / restore product in Step 19.

### 2.10 Rejected duplicate designs

- Second lifecycle enum
- Merging Step 17 workflow statuses into PlatformTenantStatus
- `tenant.lifecycle.*` permission namespace (reuse `tenant.*`)
- Direct one-click archive/delete
- Process-local locks as concurrency authority
- Billing / invoice / payment creation

---

## 3. Status Names and Transition Matrix

| Current status | Allowed commands | Forbidden | Resulting status | Subscription effect | EER effect | Session effect | Jobs | Notification | Reversible | Approval |
|----------------|------------------|-----------|------------------|---------------------|------------|----------------|------|--------------|------------|----------|
| `PROVISIONING` | Activate (legacy-only prerequisites); Archive-request (policy: deny if Step 17 incomplete) | Suspend, Reactivate, Delete-request | → `ACTIVE` on activate | unchanged | invalidate+resolve | none on activate | licensing gate | activated | yes | no (activate); archive-request needs approve |
| `ACTIVE` | Suspend; Archive-request | Activate; Reactivate; Delete-request (must archive first) | → `SUSPENDED` / request PENDING | unchanged | invalidate / deny | revoke clinic sessions on suspend | workers deny via license | suspended / archive requested | suspend→reactivate yes; archive terminal after exec | archive-request: dual control |
| `SUSPENDED` | Reactivate; Archive-request | Activate; Suspend; Delete-request | → `ACTIVE` / request | commercial must be eligible on reactivate | invalidate+recalculate | no auto session restore | resume via license | reactivated / archive requested | yes until archived | archive-request: dual control |
| `ARCHIVED` | Deletion-request | Activate; Suspend; Reactivate; Archive-request | request PENDING only | unchanged | remains denied | none | remain denied | deletion requested | deletion request cancellable before exec; archive not undone in Step 19 | dual control |

**Invalid jumps:** rejected with safe domain error (409/400).  
**Terminal:** `ARCHIVED` cannot reactivate in Step 19 (no restore workflow).

### Command class names (API operations / idempotency)

| Command | Permission | Idempotency operation |
|---------|------------|----------------------|
| Preview (read) | `tenant.view` | none |
| `ACTIVATE_TENANT` | `tenant.activate` | `TENANT_LIFECYCLE_ACTIVATE` |
| `SUSPEND_TENANT` | `tenant.suspend` | `TENANT_LIFECYCLE_SUSPEND` |
| `REACTIVATE_TENANT` | `tenant.resume` | `TENANT_LIFECYCLE_REACTIVATE` |
| `REQUEST_TENANT_ARCHIVAL` | `tenant.archive-request` | `TENANT_ARCHIVAL_REQUEST_CREATE` |
| `REQUEST_TENANT_DELETION` | `tenant.delete-request` | `TENANT_DELETION_REQUEST_CREATE` |
| Approve / Reject / Cancel request | `tenant.request.approve` (approve/reject); requester or approver for cancel per policy | `TENANT_LIFECYCLE_REQUEST_APPROVE` / `_REJECT` / `_CANCEL` |

---

## 4. Impact Preview Contract

**Input:** `tenantId`, `action`, optional reason.  
**Output (bounded):** current status, proposed action/status, commercial lifecycle summary (codes only), EER provenance code, session count (active refresh tokens), active user count (non-PHI), module/feature **counts**, job policy summary, integration summary, retention/backup **warnings** (static text), blockers[], requiredApprovals, reversible/irreversible, `previewFingerprint` (sha256 of canonical payload), `expiresAt`.  
**Mutation:** none.  
**Staleness:** command must recompute fingerprint; mismatch → 409 `preview_stale`.

Redaction: no PHI, tokens, session IDs, raw snapshots, SQL, stacks, secrets.

---

## 5. Suspension Policy (customer impact)

| Surface | Effect |
|---------|--------|
| Clinic login | **Denied** (fail-closed) |
| Existing clinic sessions / refresh | **Revoked** |
| API / module writes | Denied via licensing/EER (readOnly/suspended) |
| Reads | Fail-closed where licensing requires; workers denied via `LicensingExecutionGuard` |
| Background jobs | Stop new execution for suspended license; in-flight finish without cross-tenant effects |
| Integrations / webhooks | Follow existing licensing deny; no new Step 22 console |
| Notifications | Lifecycle event emitted; clinic product notifications may continue for safety messaging only if existing infra allows — no PHI |
| Data retention / backups | Unchanged; no deletion |
| EER | Invalidate; subsequent resolve denies |
| U01 | No fabricated usage; enforcement follows EER when flags ON |
| Platform sessions | Unaffected |
| Other tenants | Unaffected |

---

## 6. Reactivation Policy

- Only from `SUSPENDED`.
- Preserve historical suspension audit; clear current suspension fields on aggregate per existing `resume()`.
- Require commercial eligibility + immutable activation snapshot when managed by Step 16/17.
- EER invalidate + resolve; no Legacy.
- Sessions: new login required.

---

## 7. Archival Request Workflow

1. Create request (PENDING) with reason, impact fingerprint, expectedRowVersion, correlationId.  
2. Approval by different actor with `tenant.request.approve` (self-approval **denied**).  
3. On approve → execute soft `archive(reason)`; revoke privileged grants (existing); invalidate EER; revoke clinic sessions.  
4. Cancel allowed while PENDING by requester or approver role.  
5. Reject leaves tenant unchanged.

**No physical deletion.**

---

## 8. Deletion Request Workflow

1. Create only from `ARCHIVED`.  
2. Typed confirmation required (`displayName` exact match).  
3. Dual control; self-approval denied.  
4. Status remains REQUESTED / APPROVED_HANDOFF — **executor not implemented in Step 19** (document handoff).  
5. Never cascade-delete clinical/audit/commercial/provisioning/U01 data.

---

## 9. Idempotency, OCC, Locking

- Completed-only durable idempotency table (mirror Step 17 shape).
- Every mutation requires `expectedRowVersion`; bump `PlatformTenant.rowVersion` on success.
- Prefer `pg_advisory_xact_lock` on tenantId hash within transaction (Step 17 pattern).
- Stale version → 409.

---

## 10. Audit Cardinality

External commands: activate, suspend, reactivate, archive-request create, deletion-request create, approve, reject, cancel.

- First success → exactly one Platform audit success row.  
- Exact replay → zero additional success audits.  
- Failure → no success audit.  
- Redaction: no PHI/tokens/session IDs/raw snapshots/SQL/stacks/sentinel.

---

## 11. API Shape (Platform JWT)

Namespace under existing Platform conventions:

- `GET  /platform/tenants/:tenantId/lifecycle`
- `POST /platform/tenants/:tenantId/lifecycle/preview`
- `POST /platform/tenants/:tenantId/lifecycle/activate`
- `POST /platform/tenants/:tenantId/lifecycle/suspend`
- `POST /platform/tenants/:tenantId/lifecycle/reactivate`
- `POST /platform/tenants/:tenantId/lifecycle/archive-requests`
- `POST /platform/tenants/:tenantId/lifecycle/deletion-requests`
- `GET  /platform/tenant-lifecycle-requests`
- `GET  /platform/tenant-lifecycle-requests/:requestId`
- `POST /platform/tenant-lifecycle-requests/:requestId/approve`
- `POST /platform/tenant-lifecycle-requests/:requestId/reject`
- `POST /platform/tenant-lifecycle-requests/:requestId/cancel`

Reads: `tenant.view`, private/no-store, no activity extension.  
Commands: permission + fresh step-up + Idempotency-Key + expectedRowVersion + reason + previewFingerprint + high-impact rate limit.

---

## 12. RBAC and Segregation

| Role | Lifecycle |
|------|-----------|
| `platform_owner` / `platform_administrator` | Bounded grants per catalog (+ new `tenant.request.approve` for admin/owner only) |
| `plans_subscription_manager` | Commercial only — **no** tenant suspend/archive/delete/approve |
| `security_administrator` | **No** tenant lifecycle |
| `operations_engineer` / `auditor` | `tenant.view` only |
| Sales roles | `tenant.view` (+ provision view) — **no** lifecycle mutations |
| Clinic / tenant principals | Rejected on Platform routes |

Platform Owner has **no** bypass of step-up / dual-control / containment flag.

---

## 13. Containment / Rollback

- Flag: `TENANT_LIFECYCLE_ENABLED` default **false** (`envFlag`).
- When off: mutations → 503 `tenant_lifecycle_disabled`; reads may return status summary only or also 503 — **freeze:** mutations disabled; **GET lifecycle** allowed with `tenant.view` for observability.
- Rollback: disable flag; preserve requests/audit/history; do not auto-reactivate.

---

## 14. Privacy Classification

Lifecycle payloads: **non-PHI**. Reasons are operational text (bounded length). No clinical fields.

---

## 15. Non-Goals

Step 20 Feature Flags admin · Audit Center · Operations Console · Sales CRM · trial conversion · notification template admin · billing/invoices/payments/tax/proration · physical tenant deletion · legal hold · backup deletion · restore workflow · G-PRIV-01 full data-path (may remain documented gap unless already in scope — **defer full privileged data-path to keep Step 19 focused on lifecycle**; note in risks) · Steps 21–29.

---

## 16. Schema Additions (additive)

1. `PlatformTenant.rowVersion Int @default(1)`  
2. `PlatformTenantLifecycleRequest` — id, tenantId, platformTenantId, type (`ARCHIVE`\|`DELETE`), status, reason, impactFingerprint, expectedRowVersionAtCreate, typedConfirmation, requesterId, approverId, correlationId, timestamps, bounded JSON impact summary  
3. `PlatformTenantLifecycleIdempotencyRecord` — mirror provisioning idempotency  
4. Unique partial: at most one PENDING request per (tenantId, type)

Migration creates **zero** automatic requests/transitions/revocations/subscription/EER/U01 changes.

---

## 17. Conflicts Documented

| Topic | Conflict | Resolution |
|-------|----------|------------|
| Legacy clinic-JWT platform-admin lifecycle routes | Overlap with new Platform API | Keep legacy; Super Admin uses new Platform-auth API |
| Aggregate `resume()` clears suspensionReason | Need historical evidence | Persist reason in audit; DB current fields follow aggregate |
| Immediate `archive()` handler vs request workflow | One-click exists | New path is request+approve; deprecate Super Admin use of one-click |
| PHASE_47 mentions G-PRIV-01 with Step 19 | Large scope | Lifecycle product first; privileged data-path wiring tracked as residual if not completed |

---

## 18. Implementation Checklist Pointer

Implement in order: schema/validators → domain service → session/login enforcement → Platform API → RBAC approve key → Super Admin UI → matrices → one-pass regression.

**Step 20 remains unauthorized.**

---

## 19. Correction-Gate Reconciliation (repository evidence 2026-07-31)

### 19.1 rowVersion mutation inventory

| Writer | expectedRowVersion | Increments rowVersion | Correction |
|--------|--------------------|----------------------|------------|
| `TenantLifecycleService.bumpStatus` | Yes | Yes | Keep — authoritative Super Admin path |
| Step 17 `runActivationBarrier` PlatformTenant update | No (OCC on provisioning request) | **Must bump** | Internal transition: `rowVersion: { increment: 1 }` with `status: PROVISIONING` guard |
| `PrismaPlatformTenantRepository.save` (legacy handlers) | No | **Must bump** | Always `rowVersion: { increment: 1 }` on update so Step 19 OCC races safely |
| `GrantTenantTrialHandler` activate path | No | Avoid new activate | Do not call domain activate when Step 19 flag ON; leave existing trialEndsAt update |
| Tenant Directory | N/A | N/A | Read-only — no change |

### 19.2 Suspension ordering (fail-closed)

1. Authorize + step-up + preview + rowVersion  
2. Transaction: lock → bump PlatformTenant SUSPENDED → sync Tenant status → complete idempotency  
3. **Commit**  
4. Post-commit: `revokeAllByTenantId` → domain event/outbox → `eer.invalidateTenant` → audit  
5. Access path always re-reads PostgreSQL (`LoginHandler`, licensing, EER) — stale cache cannot grant write access after commit  

### 19.3 Reactivation ordering

1. Authorize + step-up + preview  
2. **Pre-ACTIVE EER readiness** (`invalidateTenant` + `resolveEffectiveEntitlements`) — managed tenants must not resolve Legacy  
3. Pre-checks (still SUSPENDED): no pending archive/delete; no incomplete Step 17; commercial config not terminal when managed; activation snapshot present when managed  
4. Transaction: bump ACTIVE + clear suspension fields + sync Tenant  
5. Commit → invalidate EER → audit (no session restore)  

### 19.4 Session policy

| Actor | Suspend/Archive | Reactivate |
|-------|-----------------|------------|
| Clinic refresh tokens (tenant) | Revoke all post-commit | Not restored |
| Clinic login | Denied for SUSPENDED/ARCHIVED/PROVISIONING | New login required |
| Clinic refresh | Denied when PlatformTenant suspended/archived (RefreshTokenHandler) | New login |
| Platform sessions | Unaffected | Unaffected |
| Other tenants | Unaffected | Unaffected |

### 19.5 RBAC / self-approval

| Permission | Roles |
|------------|-------|
| `tenant.view` | owner, admin, ops, auditor, sales (view) |
| `tenant.activate\|suspend\|resume\|archive-request\|delete-request` | owner, admin |
| `tenant.request.approve` | owner, admin only — **not** security/plans/ops/sales |
| Self-approval | **Denied** on approve **and** reject (reject is not an approval substitute) |
| Cancel | Requester **or** approve permission |
| Platform Owner | No wildcard bypass; self-approval still denied |

Kept `tenant.request.approve` (narrow lifecycle approval) rather than inventing a full `tenant.lifecycle.*` namespace.

### 19.6 Job / notification policy

| Workload | On suspend | On reactivate |
|----------|------------|---------------|
| Workers via `LicensingExecutionGuard` | Deny when license suspended | Resume when license active |
| Outbox/domain events | Enqueue post-commit; replay-safe via idempotency | Same |
| Queued healthcare jobs | Finish in-flight; no cross-tenant discard | No duplicate enqueue from lifecycle |
| Webhooks/integrations | Follow licensing deny | Follow licensing allow |

### 19.7 Archive / deletion executor

- Archive approve → soft `ARCHIVED` + revoke sessions/grants (executed in Step 19).  
- Delete approve → `APPROVED_HANDOFF` only — **no physical DELETE**; no clinical cascade.  

### 19.8 Idempotency / audit operations

See §3 command table. Audit actions: `tenant_lifecycle.{activate,suspend,reactivate,archive_request,deletion_request}` and `tenant_lifecycle.request.{approved,rejected,cancelled}`.

---

## 20. Final Correction Gate — Coverage Inventory (Phase A)

| Requirement ID | Exact test name | Suite path | Class | Existing/Missing | Expected persisted assertions | Final result |
|----------------|-----------------|------------|-------|------------------|-------------------------------|--------------|
| F01 | F01 rolls back suspend before commit… | `tenant-lifecycle-failure-injection.postgres.integration.spec.ts` | PG | existing | ACTIVE rv=1; 0 audit/idem/revoke | executable |
| F02 | F02 rolls back suspend before commit… | same | PG | existing | same | executable |
| F03 | F03 rolls back suspend before commit… | same | PG | existing | same | executable |
| F04 | F04 rolls back suspend before commit… | same | PG | existing | same | executable |
| F05 | F05 rolls back suspend before commit… | same | PG | existing | same | executable |
| F06 | F06 rolls back suspend before commit… | same | PG | existing | same | executable |
| F07 | F07 rolls back suspend before commit… | same | PG | existing | same | executable |
| F08 | F08 after EER invalidation staging… | same | PG | existing | SUSPENDED committed; revoke ran | executable |
| F09 | F09 rolls back archive request creation | same | PG | existing | requests=0 | executable |
| F10 | F10 rolls back deletion request creation | same | PG | existing | requests=0; ARCHIVED retained | executable |
| F11 | F11 rolls back archive approval staging… | same | PG | existing | request PENDING; ACTIVE | executable |
| F12 | F12 rolls back rejection staging… | same | PG | existing | request PENDING | executable |
| F13 | F13 rolls back cancellation staging… | same | PG | existing | request PENDING | executable |
| F14 | F14 rolls back suspend before commit… | same | PG | existing | ACTIVE | executable |
| F15 | F15 after audit staging… | same | PG | existing | SUSPENDED; audits=0 | executable |
| F16 | F16 rolls back suspend before commit… | same | PG | existing | ACTIVE | executable |
| F17 | F17 rolls back suspend before commit… | same | PG | existing | ACTIVE | executable |
| F18 | F18 after commit before response… | same | PG | existing | SUSPENDED; revoke not yet | executable |
| F19 | F19 service recreation before retry… | same | PG | existing | audit=1; rv=2 | executable |
| F20 | F20 rolls back suspend before commit… | same | PG | existing | ACTIVE | executable |
| F21 | F21 notification delivery failure… | same | PG | existing | SUSPENDED | executable |
| F22 | F22 session-revocation failure… | same | PG | existing | SUSPENDED; revoke empty | executable |
| F23 | F23 EER invalidation failure… | same | PG | existing | SUSPENDED | executable |
| F24 | F24 EER recalculation failure… | same | PG | existing | SUSPENDED rv=1 | executable |
| F25 | F25 Step 16 subscription-adapter staging… | same | PG | existing | SUSPENDED | executable |
| F26 | F26 request execution-handoff failure… | same | PG | existing | PENDING; tenant row exists | executable |
| F27 | F27 compensation/recovery failure… | same | PG | existing | SUSPENDED | executable |
| H01–H20 × routes | Step 19 exhaustive Passport HTTP matrix | `tenant-lifecycle-passport-auth.postgres.integration.spec.ts` | HTTP | existing | deny=0 side effects; no-store; safe errors | executable |
| O01–O08 | Step 19 OCC matrix O01-O08 | `tenant-lifecycle-occ.postgres.integration.spec.ts` | PG | existing | CAS/Model B; no lost status | executable |
| Access token | F-access: same unexpired Clinic access token… | `tenant-lifecycle-access-token.postgres.integration.spec.ts` | PG | existing | Unauthorized after suspend | executable |
| EER cache | G01 warmed allow cache + failed invalidation… | `tenant-lifecycle-eer-cache.postgres.integration.spec.ts` | PG | existing | platform_tenant_suspended | executable |
| UI | TenantLifecyclePanel focused UI | `apps/super-admin/src/tenants/tenant-lifecycle-panel.spec.tsx` | UI | existing | RTL/a11y/i18n/no-flash | executable |
| Upgrade | isolated canonical upgrade validator | `scripts/validate-tenant-lifecycle-upgrade.mjs` | PG | existing | Catalog 68/136/68/13; requests=0 | executable |
| Clean | clean migration validator | `scripts/validate-tenant-lifecycle-clean.mjs` | PG | existing | Catalog + zero lifecycle rows | executable |
| C01–C25 | concurrency suite | `tenant-lifecycle-concurrency.postgres.integration.spec.ts` | PG | existing | races safe | executable |
| Transitions | transitions suite | `tenant-lifecycle-transitions.postgres.integration.spec.ts` | PG | existing | activate/suspend/… | executable |
| Sessions | sessions suite | `tenant-lifecycle-sessions.postgres.integration.spec.ts` | PG | existing | revoke scoped | executable |

**Step 20 schema/routes/code:** absent (forbidden tables asserted in clean/upgrade validators).

---

## 21. Acceptance Pointer

**Flexible Step 19 — Tenant Lifecycle Actions is Accepted / Complete.**

- Functional and security gate passed (2026-08-02 one-pass: exit 0; failures/retries/database restarts/product edits during sequence = 0).
- Evidence hygiene passed (2026-08-03): prohibited local evidence count is **zero** (`step19-final-onepass*`, `br-step19-*`, `step19-*.txt` removed; not retained in-tree).
- Full one-pass was **not** rerun for hygiene closure because changes were artifact deletion, evidence-only ignore narrowing, and documentation wording/status only — no executable behavior changed.
- Ambiguous EER wording corrected below; executable EER/Step 17 behavior unchanged.

### EER / PROVISIONING access boundary (accepted invariant)

- **PROVISIONING tenants remain inaccessible** (Clinic login/refresh fail-closed; runtime does not grant productive access).
- **Managed pending tenants never fall back to Legacy** (Step 17 AWAITING_ACTIVATION yields SNAPSHOT `runtime_pending_activation`, not LEGACY).
- **Step 19 preserves the accepted Step 17 provisioning access boundary** (lifecycle does not rewrite provisioning semantics; EER SUSPENDED/ARCHIVED denies remain authoritative after lifecycle actions).

**Flexible Steps 20–29 remain unauthorized. Flexible Step 20 (Feature Flags and Global Settings) is Not Authorized.**

