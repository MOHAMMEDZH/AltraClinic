# Flexible Step 17 — Tenant Creation and Provisioning

**Canonical roadmap:** Super Admin Flexible Plans & Entitlements Implementation Playbook v4  
**Release:** 47 — Flexible Super Admin MVP  
**Status:** **Accepted / Complete** — final one-pass functional/security gate passed (2026-07-31); evidence hygiene closure passed (local `step17-*` / `sa-*` / `clinic-*` console dumps and `step17-final-onepass.jsonl` removed from the tree; ignore rules narrowed; no production/schema/test/runner/package change; full 88-minute sequence not rerun). Containment default-OFF; Catalog 68/136/68/13; Passport A01–A15 + C/F/H green. Flexible Step 19 is authorized separately (`docs/TENANT_LIFECYCLE_ACTIONS.md`) and must not merge into this onboarding SoR.  
**Authority order:** Playbook v4 → `SUPER_ADMIN_ARCHITECTURE.md` → `PHASE_47_EXECUTION_PLAN.md` → Steps 12–18 / U01 docs → repository evidence

### Containment (required until acceptance)

- Server flag: `TENANT_PROVISIONING_ENABLED` (default **false** via `envFlag`).
- Controllers and application service call `assertEnabled()` → safe **503** `tenant_provisioning_disabled` when off.
- Frontend cannot enable; Platform Owner cannot bypass.
- Disabled path must create no provisioning request, tenant, commercial config, invitation, success audit, completed idempotency, or U01 state.
- **Activation procedure:** set `TENANT_PROVISIONING_ENABLED=true` in the API process environment and restart the API (documented in `apps/api/.env.example`).

### RBAC (correction)

| Role | Before (unjustified) | After |
|------|----------------------|-------|
| `platform_administrator` | Had `subscription.assign` / `subscription.migrate` for onboarding | **Removed** those grants; has `tenant.provision.view\|create\|execute\|retry\|compensate\|activate` |
| `plans_subscription_manager` | Commercial authority | Unchanged — retains `subscription.assign` / `subscription.migrate` |
| `sales_representative` / `sales_manager` | — | `tenant.provision.view` (+ existing `sales-trial.create`); no activate/compensate/arbitrary commercial |
| Step 16 bridge | Caller needed subscription.* | Orchestrator calls Step 16 with `{ provisioningAuthority: true }` after provisioning authz |

---

## 1. Purpose

Controlled Platform onboarding only:

Facility Type → Specialties → Published Plan Version → Compatibility Validation → Add-ons → Subscription Commercial Configuration → Calculated Entitlement Preview → Tenant Resource Provisioning → Initial Limit Integration → Tenant Administrator Invitation → Commercial Activation → Effective Entitlement Verification → Tenant Onboarding Activation

Must be: evidence-based, idempotent, recoverable after partial failure, tenant-isolated, non-PHI, compatible with Steps 12–18 and supplemental U01, independently reversible, limited to onboarding activation, free from general tenant lifecycle management (Step 19).

---

## 2. Discovery Summary (Repository Evidence)

### 2.1 Existing Sources of Record (reuse — do not duplicate)

| Concern | Source of Record | Evidence |
|--------|------------------|----------|
| Tenant identity / registry | `Tenant` + `CreateTenantHandler` | `apps/api/src/modules/tenant/…`, Prisma `Tenant` |
| Platform control-plane tenant | `PlatformTenant` + `ProvisionPlatformTenantHandler` | `apps/api/src/modules/platform-admin/…` |
| Facility Type / Specialty / Module / Feature / Limit / Compatibility | Step 12 Healthcare Catalog | `platform-healthcare-catalog` (68/136/68/13) |
| Plan / immutable Plan Version | Step 13 | `platform-plans` |
| Entitlement grants / typed Limits | Step 14 | Plan Version entitlement APIs |
| Add-ons / governed Overrides | Step 15 | `platform-add-ons-overrides` |
| Commercial subscription configuration | Step 16 | `PlatformSubscriptionsService` (`create`, `assignPlanVersion`, add-ons, `preview`, `readiness`, `activate`) |
| Runtime entitlement decisions | Flexible Step 18 | `EffectiveEntitlementRuntimeService` |
| Usage observations / counters | Supplemental U01 | `usage-metering` (flags default OFF) |
| Staff invitation / one-time token | Identity `StaffInvitation` + `PasswordResetToken` | `InviteStaffUserHandler` (today clinic-tenant scoped) |
| Platform audit | Accepted Platform audit infrastructure | platform audit ports / RLS |
| Durable idempotency pattern | Step 16 commercial idempotency (completed-only) | `SubscriptionIdempotencyService` |

### 2.2 Gaps (Step 17 must own)

| Gap | Decision |
|-----|----------|
| No end-to-end onboarding orchestrator | **New** Step 17 application service + durable workflow rows |
| No provisioning workflow / checkpoint / compensation SoR | **New** minimal provisioning request + checkpoint + owned-resource tables (not a generic workflow engine) |
| Human slug reservation beyond UUID-as-slug | Normalize requested slug; uniqueness against `Tenant.slug` / domain; reserve via workflow |
| Platform-initiated clinic admin invitation | **Adapter** over identity invitation SoR: prepare under tenant context after registry exists; dispatch only after onboarding activation (or outbox at activation boundary) |
| Super Admin onboarding UI | New focused routes under `/tenants/onboarding…` (not general lifecycle UX) |
| `tenant.create` not wired to orchestrator | Wire Platform routes to Step 17 service |
| CreateTenant defaults `status=ACTIVE` | Onboarding creates Tenant + PlatformTenant in **non-active** gate: PlatformTenant `PROVISIONING`; Clinic auth must fail closed until `ACTIVE` |

### 2.3 Rejected Duplicate Designs

- Do **not** create a second Catalog, Plan, entitlement, Add-on, Override, commercial, EER, or U01 SoR.
- Do **not** write Step 16 / 15 / 14 / 12 / EER / U01 tables directly from Step 17.
- Do **not** build BullMQ/generic workflow platform; use smallest durable checkpoint saga.
- Do **not** treat `PlatformTenant.plan` as commercial authority (legacy tier column only).
- Do **not** invent billing / payment / invoice schema.
- Do **not** implement Step 19 suspend/resume/archive/delete operator workflows (handlers may exist; Step 17 must not expand them).
- Do **not** use display names, aliases, translations, or fuzzy matching as authorization authority.

### 2.4 Workflow Engine Decision

**Synchronous durable-checkpoint saga** in the API process:

- Persist request + status + `rowVersion` + checkpoint history + owned-resource provenance.
- Each external mutation uses completed-only idempotency (clone Step 16 pattern).
- Prefer **retry/resume** over destructive compensation after durable tenant creation.
- No cross-context distributed DB transaction; saga steps call application services.

### 2.5 Transaction Boundaries

| Boundary | Scope |
|----------|--------|
| Single DB TX | One Step 17 table mutation + its checkpoint/idempotency/audit staging for that command |
| Cross-context | Explicit service calls (`CreateTenantHandler`, `ProvisionPlatformTenantHandler`, `PlatformSubscriptionsService.*`, Catalog validate, EER resolve, invitation adapter) — at-least-once safe via checkpoints |
| Activation barrier | Ordered: Step 16 `activate` → snapshot → EER verify → PlatformTenant `activate` → invitation dispatch → workflow `COMPLETED` |

---

## 3. Product Boundary

### Included (Step 17)

Onboarding request, compatibility validation, deterministic preview, tenant registry creation, initial tenant configuration, facility type + specialties assignment, commercial configuration creation via Step 16, Add-on assignment via Step 16, module/resource provisioning derived from preview, safe initial Limit/U01 integration under U01 flags, admin invitation prepare/dispatch, progress/retry/compensation, final onboarding activation, post-activation EER verification.

### Excluded (Step 19 or later / out of scope)

General suspend/reactivate/archive/deletion/restoration/transfer; bulk onboarding; cloning; self-service signup/checkout; billing/invoicing/payment/tax/proration/overage; sales CRM/lead management/trial conversion product; Feature Flag admin; Audit Center; Operations Console; Support Access; Patient Portal; Step 19+.

**Final onboarding activation = Step 17.** Post-onboarding lifecycle = Step 19 (`docs/TENANT_LIFECYCLE_ACTIONS.md`).

---

## 4. Source-of-Record Contract (Frozen)

| Domain | Owner |
|--------|--------|
| Tenant identity and registry | Existing Tenant SoR |
| Facility Type / Specialty definitions | Step 12 |
| Plan / immutable Plan Version | Step 13 |
| Entitlement grants / typed Limits | Step 14 |
| Add-ons / Overrides | Step 15 |
| Commercial subscription configuration | Step 16 |
| Runtime entitlement decisions | Flexible Step 18 |
| Usage observations / counters | U01 |
| Tenant administrator identity/invitation | Existing identity/invitation SoR |
| **Provisioning workflow state** | **Step 17** (new; no reusable workflow SoR found) |

Cross-context actions use explicit application-service contracts only.

---

## 5. Activation Boundaries (Frozen)

### 5.1 Tenant onboarding activation

- PlatformTenant transitions `PROVISIONING` → `ACTIVE` only via Step 17 finalize after commercial activation + EER verification.
- No Clinic principal may obtain a usable tenant session before this barrier.
- Managed pending commercial state must **not** fall through to broad Legacy authorization (coordinate Flexible Step 18 provenance).

### 5.2 Commercial activation

- Owned exclusively by Step 16 `activate` / immutable snapshot APIs.
- Step 17 calls services; never writes commercial tables; never mutates snapshots.

### 5.3 Invitation dispatch

- **Prepare** invitation record (and hashed token) after tenant registry exists and before or at activation barrier.
- **Dispatch** email only after successful onboarding activation (or via outbox committed at that boundary).
- No usable invitation while tenant remains in unsafe partial state.
- Compensation may revoke undispatched / safe PENDING invitations created by this workflow only.

### 5.4 U01 boundary

- Flags remain default OFF.
- Provisioning does not require U01 enabled.
- No invented observations or nonzero counters.
- Zero counters only when authoritative source proves zero and U01 contract requires persistence.
- Hard enforcement must not activate before tenant onboarding activation.
- Failed provisioning leaves no U01 orphan; invitation has no metering side effect.

### 5.5 Step 19 boundary

Do not implement or expose general lifecycle administration, archival, deletion, restoration, or transfer under Step 17 routes/UI. Existing suspend/archive handlers remain untouched and unauthorized for this step’s acceptance scope.

---

## 6. Provisioning Request Contract

Typed request (repository-aligned; only verified fields):

```ts
type TenantProvisioningRequest = {
  organization: {
    legalOrDisplayName: string; // bounded
    requestedSlug?: string;     // normalized per Tenant rules
    regionOrEnvironment?: string;
    timezone?: string;
  };
  facilityTypeKey: string;              // canonical Catalog key
  specialtyKeys: string[];              // unique canonical keys
  publishedPlanVersionId: string;       // published immutable Plan Version id
  addOnSelections: Array<{
    addOnId: string;
    quantity?: string;
    effectiveFrom?: string;
    effectiveUntil?: string;
  }>;
  tenantAdmin: {
    email: string;                      // identity-normalized
    displayName?: string;
    locale?: string;
  };
  onboardingType: 'STANDARD' | 'TRIAL_REQUEST';
  requestedStartAt?: string;
  salesAttributionId?: string;
  externalRequestId?: string;
};
```

### Input rules

- Normalize email and slug; reject unknown/inactive Catalog keys; reject duplicate specialties/Add-ons.
- Reject unpublished/mutable/retired-unassignable Plan Versions; inactive/incompatible Add-ons; invalid dates/quantities; unsupported regions; secrets; clinical/PHI; arbitrary metadata; oversized payloads.
- **Reject** raw module grants, raw Limit values, raw entitlement snapshots, arbitrary Overrides from the client.
- Privacy: **non-PHI**; admin email is identity PII — redacted in logs/metrics/audit payloads per Platform rules.

### Idempotency identity

Per durable operation: `(actorId, operation, idempotencyKey)` completed-only, with request hash conflict → 409. Optional `externalRequestId` uniqueness for create when present.

---

## 7. Compatibility Validation

Read-only operation. Reuses Catalog `validateSelection` / `evaluateCompatibilitySelection` plus Plan Version assignability, Add-on compatibility via Step 15/16 contracts, specialty count vs typed Limit (missing ≠ Unlimited), slug/domain uniqueness, admin eligibility, sales attribution policy.

Returns bounded:

```ts
type ProvisioningValidationResult = {
  valid: boolean;
  errors: Array<{ code: string; field?: string; catalogKey?: string }>;
  warnings: Array<{ code: string; field?: string }>;
  previewFingerprint?: string;
  compatibilityFingerprint?: string;
};
```

No raw DB rows, snapshots, SQL, Prisma errors, stack traces, tokens, secrets, unrestricted Override reasons.

Validation must produce/reference a deterministic preview fingerprint; execution revalidates and rejects stale inputs.

Validation must **not** create tenant, permanent slug reservation, commercial state, invitation, U01 state, or mutation success audits; must not extend Platform session activity.

---

## 8. Workflow State Model

Repository names (deterministic):

`REQUESTED` → `VALIDATING` → `READY` → `PROVISIONING` → `AWAITING_ACTIVATION` → `COMPLETED`  
Failure: `FAILED_RETRYABLE` | `FAILED_TERMINAL`  
Compensation: `COMPENSATING` → `COMPENSATED`  
`CANCELLED_BEFORE_ACTIVATION` when cancelled prior to commercial/tenant activation barrier.

Do **not** merge this with general tenant lifecycle (`PlatformTenantStatus` / Tenant `lifecycleStatus`).

### Checkpoints (durable; may combine atomic pairs)

1. request_accepted  
2. validation_completed  
3. tenant_identity_reserved  
4. tenant_registry_created  
5. initial_tenant_configuration_created  
6. facility_type_assigned  
7. specialties_assigned  
8. commercial_configuration_prepared  
9. add_ons_assigned  
10. entitlement_preview_frozen  
11. tenant_resources_provisioned  
12. enabled_modules_provisioned  
13. initial_limit_integration_completed  
14. administrator_invitation_prepared  
15. activation_prerequisites_confirmed  
16. commercial_activation_completed  
17. eer_verification_completed  
18. tenant_onboarding_activation_completed  
19. administrator_invitation_dispatched  
20. workflow_completed  

Never mark completed before durable effect commits.

### Durable operations (external)

| Operation | Permission (reuse) | Step-up | Rate |
|-----------|-------------------|---------|------|
| `VALIDATE_PROVISIONING` | `tenant.view` or `tenant.create` or `sales-trial.create` | no | readHeavy |
| `CREATE_PROVISIONING_REQUEST` | `tenant.create` or (`sales-trial.create` ∧ `TRIAL_REQUEST`) | no* | mutation |
| `START_PROVISIONING` | `tenant.create` | no* | highImpact |
| `RETRY_PROVISIONING` | `tenant.create` | yes after security-sensitive failure | highImpact |
| `COMPENSATE_PROVISIONING` | `tenant.activate` | yes | highImpact |
| `FINALIZE_ONBOARDING_ACTIVATION` | `tenant.activate` | yes | highImpact |

\* Fresh step-up also required when changing admin identity after validation, overriding slug/domain conflict, or other high-impact accepted commands.

Sales representatives: may create allowed `TRIAL_REQUEST` only; **cannot** final activate; cannot select arbitrary enterprise Plans/Add-ons/Overrides/modules/Limits; cannot bypass compatibility; cannot view unrelated requests.

---

## 9. Retry and Compensation Contracts

**Retry:** explicit permission; expected `rowVersion`; durable idempotency; resume last committed checkpoint; revalidate mutable deps; no repeat of completed side effects; preserve correlation; bounded audit; reject concurrent start/retry/activate conflicts.

**Compensation:** explicit; evidence-based. May revoke undispatched workflow-owned invitations; deactivate/release workflow-owned resources; mark tenant resources unavailable; release reserved slug when safely supported; mark commercial failed/superseded **only** via Step 16 contracts; preserve immutable evidence/audit/workflow history.

Must **not:** delete pre-existing resources; delete clinical records; rewrite activation snapshots; delete completed audit/idempotency; mutate another tenant; perform Step 19 archival/deletion; conceal failure; fabricate success.

**Preference:** retry/resume over destructive compensate after durable tenant creation. Partial tenants remain inaccessible and recoverable.

---

## 10. Module Provisioning Ownership

Provision only modules/capabilities derived from validated commercial preview (Step 16) — never frontend-injected modules.

For every Step 17-created resource record provenance: `created_by_workflow` | `adopted_preexisting` | `externally_managed`; `safe_to_compensate`; correlation + request IDs.

Compensation never deletes/disables pre-existing resources the workflow did not create.

Reuse existing module/tenant-initialization mechanisms; no second module registry.

---

## 11. Entitlement Preview vs EER

| Phase | Authority |
|-------|-----------|
| Pre-activation | Step 16 deterministic commercial entitlement preview + fingerprint |
| Post-commercial activation | Flexible Step 18 authoritative runtime |

Do not misrepresent preview as EER. Stale fingerprint / Catalog / Plan Version / Add-on / commercial `rowVersion` mismatch → reject.

Preserve CONFIGURED / UNLIMITED / UNCONFIGURED; missing ≠ Unlimited.

---

## 12. Platform API Shape (reuse conventions)

Under Platform namespace (exact paths may align with existing `/platform/...` style):

- `POST /platform/tenant-provisioning/validate` (read-only)
- `POST /platform/tenant-provisioning/requests`
- `GET  /platform/tenant-provisioning/requests`
- `GET  /platform/tenant-provisioning/requests/:requestId`
- `POST /platform/tenant-provisioning/requests/:requestId/start`
- `POST /platform/tenant-provisioning/requests/:requestId/retry`
- `POST /platform/tenant-provisioning/requests/:requestId/compensate`
- `POST /platform/tenant-provisioning/requests/:requestId/activate`

Reads: Platform auth, explicit permission, tenantless context, bounded pagination/filter, `Cache-Control: private, no-store`, passive (no session activity extension), no PHI/secrets/tokens/raw snapshots.

Commands: Platform auth, permission, step-up when required, Idempotency-Key, expected rowVersion, high-impact rate limit, reason when required, safe errors, no side effects after auth/rate rejection, exact audit cardinality.

---

## 13. Super Admin UI

Focused onboarding (not workflow designer): form → compatibility + entitlement/Limit preview → confirm → progress → retry/compensate (authorized) → activation confirmation (step-up) → completed summary with tenant link.

No fields for raw modules/features/Limits/Overrides/snapshot JSON/billing/payment/patient/clinical data.

Localization: en-US / ar-SY key parity; do not translate canonical keys. RTL, a11y, mobile required states per playbook. Direct-link denial; no restricted-content flash.

---

## 14. Audit / Observability / Rate Limits

Audit high-impact **external** commands only (create/start/retry/compensate/activate/admin change) — exactly one success row; none on failure; no duplicate on replay; redacted payloads; no tokens/passwords/PHI/raw snapshots.

Internal progress → workflow history (not one Platform audit per checkpoint).

Metrics: bounded labels only (no tenant ID, email, slug, request ID, fingerprint, etc.).

Rate: validate = readHeavy; create = mutation; start/retry/compensate/activate = highImpact. Prove real 429 with zero side effects after rejection. No Platform Owner bypass.

---

## 15. Schema / Migration Plan

Additive tables (names subject to Prisma conventions):

- `platform_tenant_provisioning_request` — stable id, status, rowVersion, request payload (bounded), fingerprints, tenant/commercial associations, last safe error, correlation, actor, sales attribution, externalRequestId, timestamps  
- `platform_tenant_provisioning_checkpoint` — requestId, checkpoint key, status, completedAt, evidence (bounded)  
- `platform_tenant_provisioning_owned_resource` — provenance for compensation safety  
- `platform_tenant_provisioning_idempotency` — completed-only `(actorId, operation, idempotencyKey)`  

Constraints: no secrets, no invitation tokens, no PHI, no raw snapshots, no unbounded JSON, no automatic tenant/request/subscription/invitation/module/U01 creation on migrate.

Clean validator: empty DB → migrate → Catalog 68/136/68/13; zero Step 17 automatic creations; no billing/Step 19 schema.

Representative upgrade: preserve Steps 06–18 + U01; Step 17 automatic counts = 0.

Rollback: feature/disable new requests; pause workers; prevent final activation; retain failed workflows; revoke safe invitations; disable workflow-owned modules when safe; retain audit/workflow/Step 16/EER/U01 read-only; SA route read-only/unavailable. No hard-delete clinical data; no snapshot/audit rewrite; no Legacy rescue; no Step 19 delete semantics.

---

## 16. Privacy Classification

| Field / artifact | Class |
|------------------|-------|
| Organization name, slug, region, timezone | Business metadata |
| Facility/specialty/plan/add-on keys | Catalog commercial |
| Admin email / display name | Identity PII (non-PHI) — redact in logs/metrics/audit bodies |
| Invitation raw token | Secret — never persist plaintext; never log/API/audit |
| Workflow status / checkpoints | Operational non-PHI |
| Clinical / patient data | **Forbidden** in Step 17 |

---

## 17. Security Permissions (Frozen Policy)

Narrow provisioning permissions (preferred — segregation of duties):

- `tenant.provision.view`
- `tenant.provision.create`
- `tenant.provision.execute`
- `tenant.provision.retry`
- `tenant.provision.compensate`
- `tenant.provision.activate`
- `sales-trial.create` for restricted trial request submission only

Do **not** grant `subscription.assign` / `subscription.migrate` to `platform_administrator` merely for onboarding. Step 16 commercial mutations during provisioning use explicit `provisioningAuthority` after the caller passed provisioning authorization.

Do **not** add wildcard or role-name bypass. Platform Owner has no bypass of step-up/audit/idempotency/rate limits. Tenant/Clinic principals cannot call provisioning routes. Tenant headers never grant Platform authority.

---

## 18. U01 Integration (post–Step 17 matrix)

Execute deferred cases from `USAGE_METERING_AND_LIMIT_ENFORCEMENT.md` § Mandatory post–Flexible Step 17 integration matrix. Update that section from “deferred” to “executed by Step 17 tests” when green.

---

## 19. Conflicts Documented

| Topic | Conflict | Resolution |
|-------|----------|------------|
| PHASE_47 §46–47 historical “blocks 18–19” vs Flexible playbook (EER already Complete) | PHASE_47 linear gate text predates Flexible reordering | Preserve Flexible identity: Step 17 onboarding now; Step 18 EER Complete; do not re-implement EER |
| `CreateTenantHandler` creates ACTIVE Tenant | Onboarding requires inaccessible until barrier | Gate on PlatformTenant `PROVISIONING` + auth fail-closed; do not broaden Legacy |
| Clinic invite requires TenantContext | Platform onboarding needs first OWNER | Step 17 invitation adapter sets tenant context / system invite path without granting Platform token Clinic authority |
| Existing PlatformTenant activate/suspend/archive handlers | Overlap with Step 19 | Step 17 may call **activate** only as onboarding completion; must not ship Step 19 UX/APIs |

---

## 20. Non-Goals (Reminder)

No billing, no Step 19 lifecycle product, no duplicate SoRs, no generic workflow engine, no self-service signup, no PHI, no invented U01 usage, no direct Step 16 table writes, no `plan.business`, no display-name authorization.

---

## 21. Acceptance Pointer

Step 17 is eligible for acceptance only when the playbook’s full matrices (concurrency, failure-injection, clean/upgrade, Steps 12–18 + U01 + Clinic + Super Admin gates) pass with evidence. Status: **Complete**.

**Flexible Step 19** is authorized as a separate product (`docs/TENANT_LIFECYCLE_ACTIONS.md`) and must not merge provisioning workflow statuses into `PlatformTenantStatus`.

---

## 22. Final Acceptance Correction Gate — Coverage Inventory

Generated for Flexible Step 17 final correction gate. Each requirement maps to an independently named executable test.

### 22.1 Concurrency (C01–C29) — PostgreSQL

| ID | Exact test name | Suite path | Class | Status |
|----|-----------------|------------|-------|--------|
| C01 | `C01: equivalent create request versus equivalent create request` | `apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-concurrency.postgres.integration.spec.ts` | PostgreSQL | Executable |
| C02 | `C02: same idempotency key with conflicting payload` | same | PostgreSQL | Executable |
| C03 | `C03: two requests for the same normalized slug` | same | PostgreSQL | Executable |
| C04 | `C04: same supported domain — N/A domain unset; slug is routing identity` | same | PostgreSQL | Executable (N/A domain: `customDomain` unset; slug SoR) |
| C05 | `C05: two requests for the same external request ID` | same | PostgreSQL | Executable |
| C06 | `C06: same tenant administrator identity — policy allows distinct slugs` | same | PostgreSQL | Executable (no adminEmail unique policy) |
| C07 | `C07: validation versus Plan Version retirement` | same | PostgreSQL | Executable |
| C08 | `C08: validation versus Add-on deactivation` | same | PostgreSQL | Executable |
| C09 | `C09: validation versus Catalog compatibility change` | same | PostgreSQL | Executable |
| C10 | `C10: start versus stale preview` | same | PostgreSQL | Executable |
| C11 | `C11: commercial configuration creation versus duplicate start` | same | PostgreSQL | Executable |
| C12 | `C12: commercial activation versus duplicate activation` | same | PostgreSQL | Executable |
| C13 | `C13: activation versus commercial rowVersion change` | same | PostgreSQL | Executable |
| C14 | `C14: activation versus successor configuration creation` | same | PostgreSQL | Executable |
| C15 | `C15: start versus start` | same | PostgreSQL | Executable |
| C16 | `C16: start versus retry` | same | PostgreSQL | Executable |
| C17 | `C17: retry versus retry` | same | PostgreSQL | Executable |
| C18 | `C18: retry versus compensation` | same | PostgreSQL | Executable |
| C19 | `C19: activation versus retry` | same | PostgreSQL | Executable |
| C20 | `C20: activation versus compensation` | same | PostgreSQL | Executable |
| C21 | `C21: Worker A versus Worker B on the same checkpoint` | same | PostgreSQL | Executable |
| C22 | `C22: service restart after checkpoint commit but before acknowledgement` | same | PostgreSQL | Executable |
| C23 | `C23: duplicate module provisioning` | same | PostgreSQL | Executable |
| C24 | `C24: module provisioning versus compensation` | same | PostgreSQL | Executable |
| C25 | `C25: invitation prepare versus invitation prepare` | same | PostgreSQL | Executable |
| C26 | `C26: invitation dispatch versus worker replay` | same | PostgreSQL | Executable |
| C27 | `C27: activation versus invitation dispatch failure` | same | PostgreSQL | Executable |
| C28 | `C28: tenant activation versus duplicate activation` | same | PostgreSQL | Executable |
| C29 | `C29: commercial activation versus EER verification` | same | PostgreSQL | Executable |

### 22.2 Failure injection (F01–F33) — PostgreSQL

| ID | Exact test name | Suite path | Class | Status |
|----|-----------------|------------|-------|--------|
| F01–F03, F28–F30 | `F0n: <point>` create-path | `tenant-provisioning-failure-injection.postgres.integration.spec.ts` | PostgreSQL | Executable |
| F04–F17 | `F0n: <point>` start-path | same | PostgreSQL | Executable |
| F18–F27, F31 | `F0n: <point>` activate-path | same | PostgreSQL | Executable |
| F32 | `F32: compensation_failure` | same | PostgreSQL | Executable |
| F33 | `F33: retry_after_service_recreation` | same | PostgreSQL | Executable |

Point names match `PROVISIONING_FAILURE_POINTS_F01_F33` / `maybeInjectFailure` (F33 is test orchestration only).

### 22.3 HTTP route-security (H01–H34 × routes) — Nest HTTP

| Routes | Suite path | Class |
|--------|------------|-------|
| validate, create, trial-requests, list, get, start, retry, compensate, activate | `tenant-provisioning-http-security.postgres.integration.spec.ts` | HTTP integration (Nest TestingModule + real `PlatformPermissionGuard` + controller `@Header Cache-Control` + rate-limit path) |

Per route: independently named `H01`…`H19`; reads add `H20`…`H24`; commands add `H25`…`H34`. H13 N/A when route has no UI entry (activate has UI entry). Containment OFF case included.

### 22.5 Production Passport authentication E2E (A01–A15)

| ID | Exact test name | Suite path | Class | Status |
|----|-----------------|------------|-------|--------|
| A01–A15 | A0n: ... independently named | 	enant-provisioning-passport-auth.postgres.integration.spec.ts | HTTP + production Passport/JWT | Executable |

Uses real JwtStrategy Bearer verification (signature, issuer, audience, expiry), JTI revocation blacklist, suspended-user denial via PlatformAuthorizationService, real session step-up lookup for activate, rate-limit 429, and containment OFF. Does **not** use x-test-claims.

### 22.4 Runner

`npm run test:tenant-creation-provisioning-db` includes all suites matching `tenant-provisioning/.*\.spec\.ts$`.

**Flexible Step 19** is authorized as a separate product (`docs/TENANT_LIFECYCLE_ACTIONS.md`) and must not merge provisioning workflow statuses into `PlatformTenantStatus`.
