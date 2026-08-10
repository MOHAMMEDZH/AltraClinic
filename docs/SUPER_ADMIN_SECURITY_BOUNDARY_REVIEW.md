# Release 47 — Flexible Super Admin MVP
## Step 03 — Security Boundary Review

| Field | Value |
|-------|--------|
| **Document type** | Security Discovery, Threat Model, and Decision Freeze |
| **Release** | **47** — Flexible Super Admin MVP |
| **Status** | **REVIEW COMPLETE — pending approval** — no security mitigations implemented |
| **Date** | 2026-07-21 |
| **Authority** | Authoritative security boundary input for Step 04 Execution Plan |
| **Inputs** | Playbook v4; [`Architecture_Discovery_Report.md`](./Architecture_Discovery_Report.md); [`SUPER_ADMIN_V4_STEP01_CATALOG_ENTITLEMENT_DISCOVERY.md`](./SUPER_ADMIN_V4_STEP01_CATALOG_ENTITLEMENT_DISCOVERY.md); [`SUPER_ADMIN_MVP_SCOPE.md`](./SUPER_ADMIN_MVP_SCOPE.md) |
| **Evidence priority** | Verified runtime code overrides conflicting documentation |
| **Methodology** | STRIDE-informed threat modeling + repository evidence inspection |

**RFC 2119:** MUST / MUST NOT / SHOULD / SHOULD NOT / MAY apply to frozen target requirements.

---

## 1. Document Status and Authority

1. This document freezes **target** security boundaries for Release 47 platform identity, tokens/sessions, cross-tenant access, RLS stance, privileged access, commercial entitlement administration, MFA/step-up, audit, PHI, and required security tests.
2. It does **not** authorize implementation. Mitigations begin only after this review and Step 04 are approved.
3. Step 02 scope (`SUPER_ADMIN_MVP_SCOPE.md`) remains unchanged and authoritative for product/terminology scope.
4. Current-state claims cite repository paths/symbols. Unverified items are marked **Not verified from repository evidence.**

---

## 2. Executive Summary

**Current reality:** Platform administration is exercised by **tenant-scoped staff JWTs** carrying roles `super_admin` or `system_administrator`, authenticated via the same Bearer JWT pipeline as clinic staff (`aud=clinic`, `sessionClass=staff`). There is **no distinct platform principal type or token audience**. Patient sessions use `sessionClass=patient` / `aud=patient-portal`. Integration API keys are a separate machine path.

**Critical gaps for Release 47:**

| Gap | Severity |
|-----|----------|
| No platform vs tenant token separation; role string alone gates `/platform/*` | **Critical** |
| `PermissionGuard` / `RolesGuard` universal `super_admin` bypass | **Critical** |
| `GetIdentityFeaturesHandler` spreads `tenant.features` over license booleans | **High** |
| Privileged-access grants modeled but not wired into tenant data paths | **High** |
| Platform control-plane tables lack RLS; list uses root Prisma | **High** |
| Process-local 60s license cache; multi-instance staleness | **Medium** |
| MFA assurance not represented on access JWT; step-up not implemented | **High** |
| MFA secret “AES” claimed in schema comment; persistence not verified encrypted | **High** |
| No CSRF (Bearer-only today); future cookie sessions need CSRF | **Medium** |
| Realtime CORS `origin: '*'` with credentials | **Medium** |

**Frozen stance:** Introduce a **verifiable platform principal boundary** (extend identity with distinct audience/principal type); keep Phase 28 licensing + RLS for tenant data; use **narrow server-only platform paths** for cross-tenant metadata; wire privileged access with time-bound scopes; eliminate tenant self-grant of commercial entitlements; deny Feature Flags as commercial grants.

---

## 3. Scope and Methodology

**In scope:** Security boundaries for dedicated Super Admin, platform auth, commercial entitlement administration, cross-tenant ops, RLS, privileged access, MFA/step-up, audit/logging, workers, PHI.

**Out of scope:** Implementing mitigations; Patient Portal product work; Platform Core rewrite; payment security beyond noting deferred billing.

**Method:** STRIDE-informed categories (Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege) mapped to repository assets. Severity: **Critical** (immediate R47 blocker / isolation or authz bypass), **High** (likely exploit or integrity failure), **Medium** (significant with compensating controls), **Low**, **Informational**. Exploitability and impact considered together; release-blocker = Critical/High unless Step 04 accepts residual risk with compensating control.

---

## 4. Repository Evidence Reviewed

| Area | Paths |
|------|-------|
| JWT claims | `apps/api/src/modules/auth/domain/value-objects/jwt-claims.vo.ts`, `mfa-challenge-claims.vo.ts` |
| Token service / strategy | `jwt-token.service.ts`, `jwt.strategy.ts` |
| Auth controller | `auth/api/auth.controller.ts` |
| Guards | `jwt-auth.guard.ts`, `permission.guard.ts`, `roles.guard.ts`, `platform-admin-permission.guard.ts` |
| Tenant context | `tenant-context.service.ts`, `jwt-tenant-resolver.service.ts`, `tenant-scope.util.ts` |
| RLS | `apps/api/prisma/rls-policies.sql`, `prisma.service.ts` (`withTenantContext`, `withPlatformBypass`) |
| Platform-admin | `platform-admin.controller.ts`, `platform-admin-policy.service.ts`, privileged-access handlers/entities |
| Licensing | `licensing-engine.service.ts`, `get-identity-features.handler.ts` |
| Bootstrap CORS | `apps/api/src/main.ts` |
| FE admin | `SubscriptionAdminPage.tsx`, `useSubscription.ts`, `subscription-api.ts` |
| Prior docs | Architecture Discovery; Step 01 Catalog/Entitlement; Step 02 Scope |

---

## 5. Current Security Architecture

```text
[Clinic Dashboard / Portal]
        | Bearer JWT (access) + optional x-tenant-id
        v
JwtAuthGuard → ApiRateLimit → RolesGuard → PermissionGuard → LicensedModuleGuard
        |
        +-- sessionClass staff + aud clinic  → tenant APIs / platform APIs if role super_admin
        +-- sessionClass patient + aud patient-portal → portal APIs
        +-- Integrations API key path (gateway) skips JWT when authenticated

Tenant DB access: ALS + set_config(app.current_tenant_id) + RLS
Platform list: Prisma root / optional platform_rls_bypass session var
License: LicensingEngineService (Map cache TTL 60s)
```

**Verified:** Bearer-only HTTP auth (no auth cookies). Redis JTI blacklist on access verification. Refresh rotation with replay revoke-all. Login rate limits + account lockout.

---

## 6. Principal Taxonomy

| Principal Type | Auth Source | Token/Session | Intended APIs | Tenant Context | Default Scope | Permissions | Audit Identity | Risks | R47 Treatment |
|----------------|-------------|---------------|---------------|----------------|---------------|-------------|----------------|-------|---------------|
| Tenant staff | Login → JWT | Access+refresh; `sessionClass=staff`, `aud=clinic` | Tenant ERP APIs | JWT `tenantId` | Home tenant | Matrix roles | `sub` + roles | Used for platform-admin today | Remain for tenant ERP |
| Platform staff | **Same JWT + role** today | Same as staff | `/platform/*` | Home tenant in JWT; ops are cross-tenant | Cross-tenant metadata | `super_admin` / `system_administrator` | actorId | **Token confusion / role spoofing surface** | **New/extend: distinct platform principal** |
| Patient | Portal login | `sessionClass=patient`, `aud=patient-portal` | Portal APIs | Patient tenant | Own portal data | `patient` + portal guards | `sub` | Must not reach platform | Keep; reject on platform APIs |
| Integration / machine | API key | Gateway auth | Integrations gateway | Tenant-scoped credential | Integration scopes | Credential scopes | Credential id | Confused deputy if mis-scoped | Keep; not platform human auth |
| Background worker | Process identity | No end-user JWT | Internal jobs | Explicit tenant or bypass | Job-scoped | `LicensingExecutionGuard` | Job/correlation | Implicit cross-tenant if mis-coded | Explicit tenant context required |
| Privileged-access actor | Platform role + grant | Grant record (not separate token verified) | Intended: scoped tenant support | Target tenant on grant | Scoped | Grant scopes | actor + grantId | **Not wired to data paths** | Wire + step-up; no standing access |
| Anonymous / pre-auth | Public routes | MFA challenge JWT | login, mfa/verify, refresh | Challenge may carry tenantId | None | None | IP/UA | Challenge replay | Keep with short TTL |

**Freeze:** A principal type MUST NOT be accepted outside its intended security boundary.

---

## 7. Platform Identity Boundary

### Target freeze

- Platform users authenticate through a **dedicated platform authentication flow**.
- Platform users use a **distinct token audience** (or equivalent verifiable boundary), e.g. `aud=platform` / `principalType=platform`.
- Platform tokens MUST NOT be accepted by tenant-only APIs by default.
- Tenant tokens MUST NOT be accepted by platform APIs.
- Patient tokens MUST NOT be accepted by platform or tenant-staff APIs.
- Platform sessions contain **no** implicit tenant entitlement.
- Platform users receive **no** standing PHI access.
- Cross-tenant access limited to approved platform metadata and governed operations.
- When tenant context is required, it MUST be **explicit and auditable**.
- Privileged tenant access MUST use a governed grant, not ordinary platform auth alone.

### Current support assessment

| Approach | Fit |
|----------|-----|
| Reuse as-is | **Insufficient** — role-only gate on shared clinic JWT |
| Extension | **Recommended** — extend auth identity with platform principal type + audience + validation |
| Adapter | Temporary: stricter platform guard rejecting `sessionClass≠platform` once claims exist |
| New platform-auth domain | Optional if extension cannot isolate secrets/issuance; Decision D-21 |

See §40 for D-21 recommendation.

---

## 8. Tenant Identity Boundary

- Tenant staff JWT binds `tenantId` (required claim). Evidence: `JwtClaimsVO`.
- Active resolver: `JwtTenantResolver` prefers JWT over header (`auth.module.ts`).
- Header `x-tenant-id` used for public/login and FE API client; mismatch enforcement via `requireTenantScope` / `TenantScopedAccessGuard` — **not global**.
- Patient portal rejects staff sessions (`PatientPortalSessionGuard`).

**Freeze:** Tenant-facing requests MUST resolve exactly one permitted tenant. A tenant-provided header MUST NOT override server-authorized JWT tenant context. Platform APIs MUST NOT rely on home-tenant JWT as the target tenant.

---

## 9. Token and Session Separation

### Current (verified)

| Aspect | Behavior |
|--------|----------|
| Transport | Bearer Authorization; tokens in JSON body |
| Access claims | `sub`, `tenantId`, `branchId`, `roles`, `sessionId`, `jti`, `type=access`, `sessionClass`, `aud` |
| Issuer (`iss`) | **Missing** |
| MFA assurance on access | **Missing** |
| Refresh | Separate secret; rotation; replay → revoke all |
| Revocation | Session revoke + Redis JTI blacklist |
| Cookies | **Missing** on auth path |
| CSRF | **Missing** (acceptable for pure Bearer if tokens not in cookies) |

### Target freeze

- Platform and tenant token validation MUST be distinguishable **server-side**.
- Token type MUST NOT be inferred only from a role string.
- Cookie names/scopes MUST NOT collide if cookies are introduced (platform vs clinic vs portal).
- Logout MUST revoke the intended platform session.
- Session revocation MUST be testable; expired/revoked rejected.
- Auth failures MUST NOT reveal sensitive details (email enumeration minimized where already rate-limited).

---

## 10. MFA and Step-Up Boundary

### Current MFA (verified)

| Aspect | Evidence |
|--------|----------|
| Factor | TOTP (`TotpService`) |
| Enroll/confirm/disable | `POST auth/mfa/*` handlers |
| Backup codes | SHA-256 hashed; regenerate endpoint |
| Challenge token | `type=mfa_challenge`, TTL via `JWT_MFA_CHALLENGE_EXPIRES` (default 300s) |
| Secret storage | `User.mfaSecret`; schema comment claims AES — **encryption not verified in repository persistence code** |
| Assurance claim | Not on subsequent access JWT |

### Target freeze

- MFA MUST be required for platform users.
- MFA secrets MUST be encrypted at rest.
- Recovery codes MUST be one-way protected (current hashing aligns).
- Recovery-code use MUST be audited.
- Reset MUST use a governed security flow.
- High-impact actions MUST require **fresh MFA assurance** (verifiable server-side).
- Exact freshness duration: **not frozen here** — assign to Step 04 / security policy (no approved duration found in repo).

### Step-up (target)

See Privileged Action Matrix (§34). Step-up is **Missing** in current codebase.

---

## 11. Cross-Tenant Access Boundary

### Current

- `GET /platform/tenants` lists tenants via `ListPlatformTenantsHandler` / Prisma `platformTenant.findMany` without `TenantScopedAccessGuard`.
- Authorization: `PlatformAdminPermissionGuard` + `api.platform_admin` + roles `super_admin` \| `system_administrator`.
- FE sends staff JWT + home `x-tenant-id` while calling cross-tenant APIs.

### Target freeze

| Rule | Status |
|------|--------|
| Tenant-facing: exactly one permitted tenant | Freeze |
| Platform cross-tenant reads: explicit platform permission | Freeze |
| Platform cross-tenant writes: explicit target tenant + reason + authorization + audit | Freeze |
| Header cannot override JWT tenant | Freeze |
| Cross-tenant lists MUST NOT expose PHI | Freeze |
| Tenant IDs in cache and audit context | Freeze |
| Missing tenant filters / RLS context = release-blocking | Freeze |
| Platform RLS bypass: narrow, documented, server-only | Freeze |

---

## 12. RLS Review

| Topic | Finding |
|-------|---------|
| Mechanism | `set_config('app.current_tenant_id')` + `app.platform_rls_bypass`; `FORCE ROW LEVEL SECURITY` |
| Entry | `PrismaService.withTenantContext` / `withPlatformBypass`; `TenantExecutionService` |
| Protected tables | Catalog in `rls-policies.sql` + later migrations (license audit, integrations, etc.) |
| Platform tables | **No RLS found** on `platform_tenants`, `privileged_access_grants`, `tenants` in `rls-policies.sql` |
| Bypass | Explicit session var; also root Prisma when no ALS tenant store |
| Docs drift | `docs/DATABASE.md` BYPASSRLS role vs runtime session-var bypass — mark **stale/unresolved** |
| Background jobs | Must use tenant execution helpers; not fully audited for every job in this review |
| Entitlement future tables | Platform-owned catalogs MAY be platform-scoped; tenant subscription/override rows need tenant RLS or platform-only ownership with filters |

**Future security requirements for gaps:** G-RLS-01 … see Gap Register.

---

## 13. Privileged Tenant Access

### Current (verified)

| Aspect | Behavior |
|--------|----------|
| Model | `PrivilegedAccessGrant` entity + Prisma |
| Scopes | `read_only`, `support`, `billing`, `configuration`, `emergency_write` |
| Duration | Cap **8 hours** (`MAX_PRIVILEGED_ACCESS_DURATION_MS`) |
| Approval | Approver ≠ requester; break-glass activates immediately + audit |
| PHI scope | **No dedicated PHI/clinical chart scope**; schema comments mentioning `read_emr` appear **stale** |
| Runtime enforcement | `PrivilegedAccessDomainService` **not verified wired** into EMR/patient data controllers |

### Target freeze

- No unrestricted impersonation.
- No standing privileged tenant access.
- Time-bound + explicit scope.
- Sensitive scopes require approval.
- Step-up required.
- Tenant context visible.
- Actions attributable to platform user **and** grant id.
- Automatic expiry.
- PHI access, if ever allowed, separately governed — **not** ordinary Super Admin experience.

---

## 14. Platform Roles and Segregation of Duties

Step 02 frozen roles vs current `super_admin`:

| Role | Allowed domains | Prohibited | Cross-tenant | PHI | Step-up | Approval deps |
|------|-----------------|------------|--------------|-----|---------|---------------|
| Platform Owner | Governance / break-glass dual control | Standing PHI | Metadata | None default | Break-glass | Dual control destructive |
| Platform Administrator | Tenant lifecycle, provisioning | Self-approve overrides; plan publish alone | Metadata | None | Suspend/archive | Override SoD |
| Security Administrator | Users, MFA, roles, kill switches | Plan publish; sales commissions | Identity | None | Role escalation | Self-grant ban |
| Plans & Subscription Manager | Catalog, versions, subscriptions | Security roles | Commercial views | None | Publish/migrate | Creator ≠ publisher |
| Sales Manager | Pipeline, commissions review | Security; publish | Sales | None | Commission finalize | Review vs create |
| Sales Representative | Leads, trials | Suspend; override approve | Assigned only | None | Trial if policy | No self-approve override |
| Operations Engineer | Jobs, backups, integrations | Commercial grants | Ops telemetry | None | Restore | Dual control restore |
| Auditor | Read audit | Mutations | Evidence | Minimized | Export | Read-only |

**Conflict:** Current matrix grants all `api.platform_admin` actions to `super_admin` only, and `PermissionGuard` bypasses matrix entirely for `super_admin` — conflicts with SoD model.

---

## 15. Universal Super Admin Risk

| Aspect | Evidence |
|--------|----------|
| Bypass | `PermissionGuard`: `if (user.roles.includes('super_admin')) return true` |
| RolesGuard | Hierarchy / always-bypass comments + tests |
| Matrix util | `rolesCanAccessResource` short-circuit |
| Platform policy | `super_admin` \| `system_administrator` for all lifecycle/privileged ops |
| UI | Clinic-dashboard subscription admin if matrix permission present |
| Audit | Platform actions audited; bypass itself not separately flagged |
| Tenant isolation | Does not bypass RLS by role alone; platform paths use root/bypass |

**Freeze:**

- No future universal permission MAY bypass tenant isolation.
- No role MAY bypass audit, step-up, or required dual-control approval.
- Platform Owner is **not** an authorization bypass.
- Emergency access MUST be explicit, time-bound, audited, independently reviewable.

Do not refactor the role in this step.

---

## 16. Platform API Boundary

| Item | Current |
|------|---------|
| Prefix | `/platform/tenants` |
| AuthN | Global `JwtAuthGuard` (Bearer) |
| AuthZ | `PlatformAdminPermissionGuard` + `@RequirePermission('api.platform_admin', …)` |
| Principal | Staff JWT with role — **not** platform audience |
| Consumers | Clinic-dashboard subscription admin |

**Target:** Every platform API MUST validate a **platform principal** explicitly. A tenant role named `super_admin` MUST NOT be sufficient by itself unless the principal is verified as a platform principal under the approved boundary.

---

## 17. Tenant API Boundary

Tenant-facing paths that affect commercial posture (verified):

| Path / area | Risk |
|-------------|------|
| Settings → `Tenant.features` / `moduleFlags` / `clinicProfile` | Config mutation; moduleFlags can hide modules; JSON may affect identity features |
| `POST /tenant/subscription/plan-change` | Tenant `owner` or `super_admin` can change SaaS plan | 
| Identity features GET | Returns license **overridden** by tenant JSON |
| Entitlement grants on tenant-subscription controller | Platform permission, but same JWT model |

### Deny-by-default freeze (target)

Tenant APIs MUST NOT:

- grant Plans / Plan Versions / Add-ons  
- create or approve Overrides  
- increase commercial Limits  
- grant Specialties beyond effective allowance  
- grant Modules/Features denied by authoritative entitlement  

Tenant configuration MAY customize an **already-entitled** capability but MUST NOT create contractual access.

---

## 18. Plan Publication Threat Model

| Threat | Required future control |
|--------|-------------------------|
| Unauthorized publication | `plan-version.publish` only |
| Creator self-approval | Dual control; creator ≠ publisher |
| Post-publish mutation | Immutability of published versions |
| Stale review / races | Idempotency + version state machine |
| Plan-name / hidden grants | Stable keys; full before/after review |
| Audit omission | Mandatory audit + correlation ID |
| Step-up missing | Fresh assurance before publish |

---

## 19. Subscription Assignment and Migration Threat Model

| Threat | Required future control |
|--------|-------------------------|
| Unpublished version assigned | Only published Plan Versions |
| Incompatible assignment | Compatibility validation |
| Incomplete legacy updates | Single governed service path |
| Stale cache | Mandatory invalidation |
| Silent privilege change | Entitlement impact preview |
| Operator vs tenant SoR drift | Unify paths (recorded Step 01/02; not fixed here) |
| Display-name mutation | Forbidden |

---

## 20. Add-on Threat Model

Required controls: explicit permission; active subscription; effective dates; compatibility; quantity; audit; step-up for high-impact; idempotent assignment; clear precedence; MUST NOT rescue invalid/suspended subscription unless policy allows.

---

## 21. Tenant Override Threat Model

Freeze: separate request/approve; dual control for high-impact; mandatory reason; requester/approver; start/end; exceptional indefinite governance; ticket/contract where applicable; risk classification; before/after; expiry enforced; cache invalidation; ordinary settings MUST NOT create overrides; tenant-facing APIs MUST NOT self-grant.

---

## 22. Tenant Self-Grant Prevention

**Verified risk:** `GetIdentityFeaturesHandler` returns `{ ...licenseDerived, ...tenantFeatures, smsInvites: AND }` — raw `tenant.features` can override license-derived booleans (except `smsInvites`). Evidence: `get-identity-features.handler.ts`.

**Also:** Settings writes to `moduleFlags` / features JSON; tenant plan-change for owners; dual plan-change inconsistency with operator path.

**Freeze:** prohibitions in §17. Do not fix in this step.

---

## 23. Effective Entitlement Resolver Security Contract

Future operations: `canUse`, `canUseSpecialty`, `getLimit`, `explainEntitlement`, `validateProvisioningSelection`.

**Rules:** explicit authorized tenantId; capability key validated against catalog; tenant-scoped cache keys with version/revision; invalidate on commercial changes; deterministic deny precedence; ignore expired; deny suspended; explanations without secrets/unauthorized commercial metadata; reproducible decisions; unknown keys **fail closed**; safe error policy; **no raw tenant JSON grant** of denied access.

---

## 24. Entitlement Cache Security

| Aspect | Current |
|--------|---------|
| Technology | In-process `Map` |
| Key | `tenantId` |
| TTL | 60_000 ms |
| Invalidation | Handlers + commercial audit listener |
| Distributed | **No** — multi-instance drift |
| Tests | Licensing engine specs |

**Threats:** collision (mitigated if key always tenantId), missing tenant, stale grants/denials, cross-tenant leakage (low if key correct), race, partial invalidation, deployment inconsistency.

**Assign:** D-13/D-14 → Step 04 / Effective Entitlement Runtime (Step 16 in scope gating). Required tests: tenant isolation of cache; invalidation after subscription change; no cross-tenant read.

---

## 25. Feature Flags vs Entitlements Security Boundary

- `*_CENTER_ENABLED` = operational kill/rollout — MUST NOT grant commercial access.
- Entitlement = contractual allowance.
- Flag MAY deny entitled capability; MUST NOT create purchase.
- Identity-features merge currently blurs this boundary (Gap).

---

## 26. Tenant Lifecycle Security

Suspend/resume/archive via platform-admin: audited; licensing listener sets lifecycle + invalidates cache. Target: step-up + reason for suspend/archive/delete requests; reactivation may require step-up when risk warrants; all with audit.

---

## 27. Background Jobs and Integration Security

- `LicensingExecutionGuard.allowWorkerExecution` fail-closed for suspended/expired/cancelled; module/feature checks; `worker.denied` audit.
- Integrations: API-key principal separate from human JWT.
- **Freeze:** workers MUST NOT inherit unrestricted cross-tenant access implicitly; tenant jobs carry explicit tenant context; retries idempotent; entitlement jobs invalidate caches; sensitive execution auditable.

---

## 28. Audit and Evidence Requirements

| System | Fields (summary) | Fit for R47 |
|--------|------------------|-------------|
| Platform admin audit | actor, roles, tenantId, action, reason, details, correlationId, EN/AR descriptions | Extend for commercial lifecycle |
| LicenseAuditEvent | tenantId, actor, eventType, plan/status deltas, decision, source, metadata | Extend for publish/migrate/override |

**Target events (not created here):** plan publish/retire; subscription assign/migrate; add-on; override request/approve; limit change; suspend/reactivate; privileged access; role escalation; security reset; entitlement cache invalidation.

**Freeze:** immutable append-only evidence; reason; correlation; target tenant; before/after; privileged-grant attribution; export permission-gated; no PHI by default.

---

## 29. Logging and Observability Requirements

**Freeze:** no passwords, tokens, MFA secrets, API keys, recovery codes in logs; no PHI in global platform logs; entitlement explanations must not log sensitive contract details unnecessarily; denied high-risk actions observable; repeated cross-tenant authz failures detectable; correlation IDs for investigation without secrets.

Realtime gateway CORS `origin: '*'` with credentials — security gap (G-CORS-01).

---

## 30. PHI and Privacy Boundary

### Classification (future Super Admin)

| Class | Examples |
|-------|----------|
| Public configuration | Marketing plan names |
| Internal operational metadata | Job status, health |
| Commercial metadata | Plan version, limits, subscription status |
| Security-sensitive | Roles, MFA status flags (not secrets) |
| Tenant admin contacts | Contract email — minimized |
| PHI-prohibited | Charts, diagnoses, patient identifiers |
| Secrets-prohibited | Tokens, keys, MFA secrets |

**Freeze:** no clinical chart browsing; no global patient search; no PHI dashboards/metrics/notifications/analytics/fixtures; privileged clinical access = separate governed workflow.

---

## 31. Principal Boundary Matrix

| Principal Type | Authentication Source | Intended APIs | Tenant Context | Default Data Scope | Token or Session Boundary | Current Status | Target Requirement |
|----------------|----------------------|---------------|----------------|--------------------|---------------------------|----------------|--------------------|
| Tenant staff | Password (+MFA) → JWT | Tenant ERP | JWT tenantId | Home tenant | `aud=clinic`, staff | Verified | Unchanged for ERP |
| Platform staff | TBD platform login | `/platform/*`, Super Admin | Explicit target | Metadata only | Distinct `aud`/principal | Missing (role reuse) | Dedicated platform principal |
| Patient | Portal auth | Portal | Portal tenant | Self | `aud=patient-portal` | Verified | Reject on platform |
| Integration | API key | Gateway | Credential tenant | Integration | Non-JWT | Verified | Keep |
| Worker | Runtime | Jobs | Explicit | Job scope | N/A | Partial | Explicit + fail-closed |
| Privileged grant | Platform + grant | Scoped tenant ops | Grant target | Scope-limited | Grant id + platform actor | Partial model | Wire + expire |

---

## 32. Token and Session Boundary Matrix

| Flow | Current Mechanism | Issuer | Audience / Equivalent | Cookie or Storage | Revocation | MFA Assurance | Risk | Target Requirement |
|------|-------------------|--------|----------------------|-------------------|------------|---------------|------|--------------------|
| Clinic login | Bearer access+refresh | Missing `iss` | `aud=clinic` | FE memory/storage (app-dependent) | Session + JTI | Challenge only | Token theft; storage XSS | Keep Bearer; harden storage guidance |
| Portal login | Same service | Missing | `aud=patient-portal` | Portal storage | Same | Challenge + patient class | Cross-app misuse | Reject on platform |
| Platform (today) | Same clinic JWT | Missing | clinic + role | Clinic dashboard | Same | Missing on access | **Critical** confusion | Distinct audience + principal |
| MFA challenge | Short-lived JWT | Missing | type claim | Client held | TTL | N/A | Replay | Keep short TTL |
| Future platform cookies | N/A | — | — | Must not collide | Required | Required | Collision | Separate names/paths/domains |

---

## 33. Cross-Tenant and RLS Matrix

| Operation | Current Enforcement | RLS Behavior | Application Filter | Required Permission | Audit | Risk | Target Decision |
|-----------|---------------------|--------------|--------------------|---------------------|-------|------|-----------------|
| List platform tenants | Role + matrix | No RLS on platform_tenants | Prisma findMany | api.platform_admin view | List may be partial | Over-broad role | Platform principal + permission |
| Change plan (operator) | Role + manage | N/A (platform row) | By platformTenantId | manage | Yes | Incomplete SoR sync | Governed subscription service |
| Tenant data support | Grants exist | Tenant RLS unless bypass | **Not wired** | privileged scopes | Grant audit | Grant without enforcement | Wire grant into data access |
| Tenant ERP read | JWT + RLS | withTenantContext | tenantId | Resource perms | Domain audits | Header ignore if JWT | Keep; global scope check |
| Platform bypass path | withPlatformBypass | bypass=true | Caller discipline | Server-only | Log bypass | Abuse if exposed | Narrow documented path |

---

## 34. Privileged Action Matrix

| Action | Required Permission | Step-Up | Reason | Approval | Dual Control | Audit | Target Scope |
|--------|---------------------|---------|--------|----------|--------------|-------|--------------|
| Publish Plan Version | plan-version.publish | Yes | Yes | Reviewer | Recommended | Required | Commercial catalog |
| Retire Plan Version | plan-version.retire | Yes | Yes | Yes | Optional | Required | Catalog |
| Migrate Subscription | subscription.migrate | Yes | Yes | Yes | Recommended | Required | Tenant commercial |
| High-impact Add-on | addon.manage | Yes | Yes | Policy | Optional | Required | Subscription |
| Request high-impact Override | override.request | Yes | Yes | No | — | Required | Tenant |
| Approve Override | override.approve | Yes | Yes | Approver≠requester | Required | Required | Tenant |
| Increase sensitive Limits | override/catalog | Yes | Yes | Yes | Recommended | Required | Tenant |
| Suspend Tenant | tenant.suspend | Yes | Yes | Optional | Optional | Required | Tenant lifecycle |
| Reactivate (risk) | tenant.resume | Yes | Yes | Optional | Optional | Required | Lifecycle |
| Archive request | tenant.archive-request | Yes | Yes | Yes | Recommended | Required | Lifecycle |
| Deletion request | tenant.delete-request | Yes | Yes | Yes | Required | Required | Lifecycle |
| Restore backup | operations.execute | Yes | Yes | Yes | Required | Required | Ops |
| Dangerous job retry | operations.execute | Yes | Yes | Optional | Optional | Required | Ops |
| Global kill switch | feature-flag.manage | Yes | Yes | Optional | Recommended | Required | Ops |
| Privileged tenant access | privileged-access.* | Yes | Yes | Non-break-glass | Existing SoD | Required | Grant scopes |
| Platform role escalation | role.manage | Yes | Yes | Yes | Recommended | Required | Security |
| MFA reset | platform-user.manage | Yes | Yes | Yes | Recommended | Required | Security |
| Session revoke (other user) | session.revoke | Yes | Optional | Optional | Optional | Required | Security |
| Security configuration change | feature-flag / security | Yes | Yes | Yes | Recommended | Required | Security |

---

## 35. Entitlement Administration Attack Surface

| Operation | Entry Point | Principal | Target | Current Authorization | Integrity Risk | Required Future Control | Test Scenario |
|-----------|-------------|-----------|--------|----------------------|----------------|-------------------------|---------------|
| Operator plan change | PATCH `/platform/tenants/:id/plan` | Staff JWT + super_admin | PlatformTenant | api.platform_admin manage | Incomplete sync | Unified subscription path | ST-26, ST-27 |
| Tenant plan change | POST `/tenant/subscription/plan-change` | owner/super_admin | Platform + features | api.subscription manage | Self-service commercial | Restrict vs platform-only | ST-10 |
| Identity features | GET identity features | Tenant staff | Feature map | AuthN | JSON overrides license | Resolver precedence | ST-15 |
| Module flags | Settings PATCH | Tenant admin | features.moduleFlags | Settings perms | Hide vs grant confusion | Cannot grant denied modules | ST-15 |
| Entitlement grant | PATCH platform-tenants entitlements | super_admin | features grants | platform manage | Unlimited grant | Add-on/override model | ST-12 |
| Trial grant | POST trial | super_admin | Trial dates | platform manage | Abuse | Sales + step-up | Sales tests |
| Publish Plan Version | Future | Plans manager | Plan Version | Missing | N/A | SoD + immutability | ST-24, ST-25 |

---

## 36. Threat Register

Severity method: see §3.

| ID | Asset | Threat | Attack Path | Current Control | Gap | Severity | Required Mitigation | Responsible Step |
|----|-------|--------|-------------|-----------------|-----|----------|---------------------|------------------|
| T-01 | Platform APIs | Spoofing / token confusion | Staff JWT with forged/escalated role | Role check | No platform aud/principal | Critical | Platform identity + audience | 05–07 |
| T-02 | AuthZ | Elevation via super_admin bypass | Any endpoint with PermissionGuard | Bypass | Universal bypass | Critical | Remove bypass; granular roles | 07–08 |
| T-03 | Entitlements | Tampering self-grant | Settings/features JSON | Partial license guards | Identity merge override | High | Fail-closed resolver | 16 |
| T-04 | Isolation | Tenant isolation failure | Missing RLS context | RLS + ALS | Root Prisma paths | High | Enforce tenant tx; tests | 04, 16 |
| T-05 | Platform metadata | IDOR cross-tenant | Guess platformTenantId | Permission only | Object-level auth tests thin | High | Explicit object authz | 14–17 |
| T-06 | Privileged access | Unsafe privileged access | Break-glass without data binding | Grant lifecycle | Not wired | High | Wire scopes + step-up | 07, 17 |
| T-07 | Cache | Stale / cross-tenant cache | Multi-instance / wrong key | tenantId key | No distributed invalidation | Medium | Shared cache + revision | 16 |
| T-08 | Sessions | Session theft | XSS steals Bearer | Short access TTL | Storage depends on FE | High | Platform app CSP; no localStorage secrets if possible | 05–06 |
| T-09 | MFA | Weak secret storage | DB leak | Hash for backup codes | Secret encryption unverified | High | Encrypt secrets | 06 |
| T-10 | CSRF | CSRF | N/A Bearer today | None | Cookie future | Medium | CSRF if cookies | 05–06 |
| T-11 | CORS | Misconfiguration | Realtime `*` + credentials | HTTP CORS list | Gateway broad | Medium | Tighten realtime CORS | 04 / ops |
| T-12 | Audit | Repudiation | Missing events | Partial audits | Future commercial gaps | Medium | Event catalog | 19 |
| T-13 | PHI | Information disclosure | Super Admin UI search | Product rules | Embed UI risk | Critical if violated | PHI freeze + tests | 09, 22 |
| T-14 | Plan publish | Publication abuse | Future API | Missing | Missing | High | SoD + step-up | 11–12 |
| T-15 | Subscription | Migration abuse / race | Dual plan paths | Partial | Inconsistency | High | Single path | 14 |
| T-16 | Workers | Confused deputy | Job without tenant | LicensingExecutionGuard | Incomplete inventory | Medium | Explicit context | 19 |
| T-17 | DoS | Auth flooding | Login | Rate limits | — | Low–Med | Keep / tune | Existing |
| T-18 | Replay | MFA challenge replay | Stolen challenge | Short TTL | — | Medium | One-time challenge bind | 06 |

---

## 37. Security Gap Register

| Gap ID | Evidence | Affected Boundary | Severity | Exploitability | Impact | Release Blocker? | Assigned Step | Required Acceptance Evidence |
|--------|----------|-------------------|----------|----------------|--------|-------------------|---------------|------------------------------|
| G-ID-01 | JwtClaimsVO aud clinic only for staff; PlatformAdminPolicy roles | Platform identity | Critical | Medium (needs role) | Full control plane | **Yes** | 05–07 (D-21) | Platform token rejected on tenant APIs and vice versa |
| G-AUTHZ-01 | permission.guard.ts super_admin bypass | Authorization | Critical | High if role obtained | All permissions | **Yes** | 07–08 | No matrix bypass in tests |
| G-ENT-01 | get-identity-features.handler.ts spread | Entitlements | High | Medium | UI/feature confusion; possible soft bypass | **Yes** | 16 | License-denied stays denied |
| G-PRIV-01 | PrivilegedAccess not wired to data | Privileged access | High | Low–Med | False sense of control | **Yes** | 07, 17 | Grant required for scoped access |
| G-RLS-01 | No RLS on platform_tenants | Cross-tenant | High | Medium | App-filter only | **Yes** | 04 / 14 (D-16) | Documented path + tests |
| G-MFA-01 | No acr on access JWT; step-up missing | Step-up | High | Medium | Stale MFA for high-impact | **Yes** | 06–07 | Step-up tests |
| G-MFA-02 | mfaSecret encryption unverified | Secrets | High | Low (needs DB) | Secret disclosure | **Yes** | 06 | Encryption verified |
| G-CACHE-01 | 60s Map cache | Entitlement freshness | Medium | Low | Stale allow/deny | Partial | 16 | Invalidation tests |
| G-CORS-01 | realtime origin `*` | Browser | Medium | Medium | Cross-origin WS risk | Partial | 04 | Tight origins |
| G-CSRF-01 | No CSRF | Browser cookies future | Medium | N/A today | Future state-change CSRF | If cookies | 05–06 | CSRF tests |
| G-PLAN-01 | Dual plan-change paths | Commercial integrity | High | Medium | SoR divergence | **Yes** | 14 | Single path acceptance |
| G-ROLE-01 | super_admin vs 8-role model | SoD | High | High | No publish/approve split | **Yes** | 07–08 | SoD tests |

---

## 38. Security Test Plan

| Test ID | Scenario | Principal | Target | Expected | Setup | Level | Step |
|---------|----------|-----------|--------|----------|-------|-------|------|
| ST-01 | Tenant token → platform API | Tenant staff | `/platform/*` | 401/403 | Non-platform token | API | 05–07 |
| ST-02 | Patient token → platform API | Patient | `/platform/*` | Reject | Portal JWT | API | 05–07 |
| ST-03 | Platform token → tenant-only API | Platform | Tenant ERP route | Reject unless approved flow | Platform aud | API | 05–07 |
| ST-04 | Platform token no implicit tenant | Platform | Entitlement/resolve | Requires explicit tenant | — | API | 16 |
| ST-05 | Cross-tenant read needs permission | Platform | List/get tenants | Deny without perm | — | API | 07 |
| ST-06 | Cross-tenant write needs target+audit | Platform | Suspend/plan | Audit+reason | — | API+audit | 14–17 |
| ST-07 | Header cannot override JWT tenant | Staff | Tenant API | Ignore/mismatch deny | Mismatched header | API | 05 |
| ST-08 | RLS tenant A ≠ B | Staff A | Tenant B rows | Empty/deny | Two tenants | RLS | Existing+extend |
| ST-09 | Platform bypass narrow | Server | withPlatformBypass | Not callable from client | — | Integration | 04 |
| ST-10–14 | Tenant cannot grant Plan/Version/Add-on/Override/Limit | Tenant | Settings/subscription | Deny | — | API | 14–16 |
| ST-15 | Tenant JSON cannot enable license-denied module | Tenant | Identity features / guards | Denied server-side | features JSON | API | 16 |
| ST-16 | Unknown capability fail closed | Any | Resolver | Deny | Bad key | Unit | 16 |
| ST-17–18 | Cache tenant isolation + invalidation | Platform | Cache | Isolated; refreshed | Plan change | Integration | 16 |
| ST-19–21 | Expired add-on/override; suspended+addons | Resolver | canUse | Deny | Fixtures | Unit | 16 |
| ST-22–23 | Kill switch deny; flag alone cannot grant | Ops | Flags+resolver | Deny / no grant | Env flag | Integration | 18 |
| ST-24–27 | Publish immutability; no self-approve; no unpublished assign; migration audit | Plans mgr | Catalog/subscription | Enforce | Dual users | API | 11–14 |
| ST-28–30 | Override step-up; privileged expire; actor+grant attribution | Platform | Override/priv | Enforce | — | API | 07–13 |
| ST-31–35 | IDOR; audit export; audit immutable; role escalate revokes sessions; suspend revokes | Various | IDs/sessions | Enforce | — | API | 07–08 |
| ST-36–37 | MFA recovery replay; auth failure protection | User | MFA/login | Reject / lock | — | API | 06 |
| ST-38–39 | CSRF; cookie non-collision | Browser | State change | Reject / isolate | If cookies | E2E | 05–06 |
| ST-40 | No PHI in Super Admin search/dashboard/logs/notifications | Platform | Super Admin | No PHI | Fixtures | E2E+manual | 09, 22 |

**Release-blocking scenarios:** ST-01–04, ST-08, ST-10–15, ST-17–18, ST-24–28, ST-31, ST-40.

---

## 39. D-16 RLS Decision

| Field | Value |
|-------|--------|
| **Status** | **Partially Resolved** — recommendation frozen; implementation in later steps |
| **Recommendation** | **Hybrid model by domain** |
| **Detail** | (1) **Tenant clinical/operational data** remains under existing RLS + `withTenantContext`. (2) **Platform control-plane metadata** (`platform_tenants`, grants, future plan catalogs owned by platform) uses **application authorization + narrow server-only access** (root Prisma or `withPlatformBypass` only inside platform repositories), with mandatory permission checks and audit — not broad client-exposed bypass. (3) **Tenant-owned commercial rows** (future subscription/override if stored per tenant) SHOULD use tenant RLS **or** platform-only tables with explicit tenantId filters — choose in Step 04 schema design. |
| **Evidence** | `rls-policies.sql`; `prisma.service.ts`; platform tables without RLS; `withPlatformBypass` exists; platform list uses root client |
| **Risks** | App-filter bugs on platform tables; accidental bypass leakage |
| **Required controls** | Repository-only bypass; no HTTP toggle; object-level authz tests; audit all cross-tenant writes; inventory jobs for context |
| **Responsible step** | Step 04 (pattern freeze) + Steps 14–17 (implementation) |

---

## 40. D-21 Platform Identity Decision

| Field | Value |
|-------|--------|
| **Status** | **Partially Resolved** — recommendation frozen |
| **Recommendation** | **Extend existing identity/auth domain with a distinct platform principal type** (preferred over greenfield identity product) |
| **Detail** | Issue platform access/refresh with verifiable boundary (`aud=platform` or `principalType=platform` + `sessionClass` extension), separate login entry for Super Admin, reject clinic/patient audiences on platform routes and platform audience on tenant-only routes. Reuse MFA, refresh rotation, JTI blacklist, rate limits. Decompose `super_admin` into Step 02 roles over time; transitional mapping allowed under bridge. |
| **Evidence** | Shared `JwtTokenService`; clinic vs patient already split by `sessionClass`/`aud`; platform-admin role-only gate; no `iss` |
| **Migration impact** | Clinic-dashboard embedded admin must switch to platform tokens or be replaced by dedicated Super Admin app; existing `super_admin` users need provisioning into platform identity |
| **Token/session** | Distinct audience; no implicit tenant entitlement; explicit tenantId only when operating on a tenant |
| **Alternative rejected for MVP default** | Fully separate identity domain — higher cost; revisit only if extension cannot isolate issuance secrets |
| **Responsible step** | Step 04 detailing + Steps 05–07 implementation |

---

## 41. Risks

1. Role-as-platform-identity enables control-plane access from clinic app sessions.  
2. Universal permission bypass defeats SoD for publish/approve.  
3. Entitlement integrity undermined by tenant JSON merge.  
4. Privileged-access false confidence without data-path enforcement.  
5. Multi-instance license cache staleness after commercial changes.  
6. MFA secrets may be stored without verified encryption.  
7. Realtime CORS broadness.  
8. PHI accidental exposure if Super Admin reuses clinic patient UI patterns.

---

## 42. Blockers

| Blocker | Blocks | Resolution |
|---------|--------|------------|
| Approval of this review | Step 04 detail / implementation | Approve Step 03 |
| D-21 implementation design | Super Admin auth scaffold | Step 04 + 05 |
| D-16 hybrid pattern in execution plan | Platform data access coding standards | Step 04 |
| G-ENT-01 design | Runtime entitlement migration | Step 04 + 16 |
| SoD role model vs `super_admin` | RBAC step | Step 07–08 |

---

## 43. Acceptance Criteria Evidence

| Criterion | Result |
|-----------|--------|
| No production code / schema / deps / scaffold changes | **Passed** |
| Document exists and complete | **Passed** |
| Step 02 unchanged | **Passed** |
| Principals, identity, token/session, MFA, step-up, revocation documented | **Passed** |
| Tenant/patient tokens prohibited from platform (target freeze) | **Passed** |
| Platform tokens no implicit tenant (target freeze) | **Passed** |
| Cookie/session collision evaluated | **Passed** |
| Cross-tenant + RLS documented; D-16 assigned/partially resolved | **Passed** |
| D-21 assigned/partially resolved | **Passed** |
| Privileged access reviewed; universal role risk documented | **Passed** |
| Tenant self-grant prohibitions frozen | **Passed** |
| Plan/subscription/add-on/override threats documented | **Passed** |
| Resolver + cache + Feature Flag boundaries defined | **Passed** |
| PHI, audit, logging, workers defined | **Passed** |
| Matrices + Threat/Gap/Test registers complete | **Passed** |
| Critical/High marked blockers | **Passed** |
| Evidence cited; unknowns marked; no mitigations implemented | **Passed** |
| Recommends Step 04; does not implement it | **Passed** |

---

## 44. Recommended Next Step

**Step 04 — Execution Plan Freeze**

Expected document: `docs/PHASE_47_EXECUTION_PLAN.md`

Must incorporate: D-16 hybrid RLS, D-21 platform identity extension, security test plan ST-01–40, gap closures for G-ID-01 / G-AUTHZ-01 / G-ENT-01 / G-PRIV-01 / G-PLAN-01, and step gating from Step 02.

Do **not** implement Step 04 in this review.

---

## Document Control

| Item | Value |
|------|--------|
| Created | 2026-07-21 |
| Prior file | None (new) |
| Rollback | Revert this file only |

*End of Security Boundary Review — no mitigations implemented.*
