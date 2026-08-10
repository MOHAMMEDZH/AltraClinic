# Super Admin — RBAC and Platform Users (Release 47 Step 08)

Authoritative implementation record for Platform Permission catalog, built-in roles, Platform User administration, invitations, lifecycle, MFA-reset governance, and deny-by-default authorization.

Companions: `SUPER_ADMIN_PLATFORM_AUTHENTICATION.md` (Step 06), `SUPER_ADMIN_MFA_AND_SESSION_SECURITY.md` (Step 07).

---

## 1. Authorization architecture

Order of enforcement on Platform APIs:

1. Platform JWT signature / issuer / audience / type  
2. Platform principal type  
3. Active platform session (idle + absolute)  
4. Active Platform User account state  
5. Fresh step-up when required  
6. Required Platform Permission (deny-by-default)  
7. Scope / segregation-of-duties  
8. Action + audit  

Authentication assurance (MFA / step-up) does **not** grant permissions. Role **names** do not establish platform identity. Platform Owner is **not** a wildcard bypass.

Legacy clinic `super_admin` short-circuit remains only on tenant `PermissionGuard` paths. New Platform controllers use `@RequirePlatformPermission` + `PlatformPermissionGuard` and never consult the tenant matrix bypass.

---

## 2. Permission key convention

- Lowercase, **dot-separated** action keys (Step 02 examples): `platform-user.view`
- Independent of UI labels and role keys
- Server-authoritative catalog in `platform-rbac.catalog.ts`
- Frontend may use keys for visibility only

Unknown or inactive permission keys fail closed.

---

## 3. Built-in roles (immutable)

| Key | Display | Scope | High-impact |
|-----|---------|-------|-------------|
| `platform_owner` | Platform Owner | all | yes |
| `platform_administrator` | Platform Administrator | all | yes |
| `security_administrator` | Security Administrator | all | yes |
| `plans_subscription_manager` | Plans & Subscription Manager | all | yes |
| `sales_manager` | Sales Manager | all | no |
| `sales_representative` | Sales Representative | **assigned_only** | no |
| `operations_engineer` | Operations Engineer | all | no |
| `auditor` | Auditor | read_only | no |

No role contains `*` or equivalent. Custom role creation is deferred.

Sales Representative `assigned_only` is frozen as role metadata for later sales domains — no sales records in Step 08.

---

## 4. Segregation of duties

Implemented now:

- MFA reset: requester ≠ approver ≠ target  
- No self-elevation / self-role-assign via admin APIs  
- No self-suspend / self admin session revoke  
- Last active `platform_owner` cannot be suspended or have that role removed  
- Last active `security_administrator` cannot be removed when it would strand recovery  

Foundations (helpers / dualControlLater flags) for later Plan publish and Override approve (creator ≠ approver). No fake Plan/Override entities.

---

## 5. Platform User lifecycle

Statuses: `invited` | `pending_activation` | `active` | `suspended` | `disabled` | `invitation_expired`

### Invitation secret handling

Invitation tokens are bearer secrets. Raw tokens and complete activation URLs must never appear in:

- application logs, console output, audit payloads, analytics, diagnostics  
- inviting-administrator API responses or delivery-status responses  
- exception messages or dead-letter metadata  

Only a SHA-256 token hash is persisted. The application service may pass the activation URL to `PLATFORM_INVITATION_DELIVERY` solely as outbound delivery payload. Delivery results return safe metadata only (`invitationId`, `platformUserId`, channel, status, redacted recipient).

**Local development:** `DevMailboxPlatformInvitationDelivery` queues the secret-bearing payload in a process-local mailbox (`PlatformInvitationDevMailbox`). Logs record only redacted metadata. Developers retrieve the link from the in-process mailbox during tests or a controlled local operator workflow — never from logs. Production-like environments (`NODE_ENV=production|staging` or `PLATFORM_INVITATION_REQUIRE_SMTP=true`) refuse the dev mailbox and must not fall back to console URL printing.

**Production failure policy:** If delivery is not configured or fails, invitation creation may remain `pending` with `deliveryStatus=failed`. The API returns a safe DTO; audit/logs record failure without the token. Do not silently print the URL.

### Activation and lifecycle

- Invite: hashed single-use token, TTL, roles assigned, secret-safe delivery  
- Accept: password policy → consume token → preauth MFA enrollment (no access/refresh session)  
- Suspend: permission + step-up + reason → revoke sessions → supersede invites  
- Reactivate: permission + step-up + reason → new login required; old sessions not restored  
- Role assign/remove: high-impact step-up; elevation revokes target sessions; `authzRevision` bumped  

Existing Step 06/07 users remain valid with **no implicit roles** (deny-by-default).

---

## 5b. Explicit safe response DTOs

All Platform User / RBAC / security API responses pass through field-by-field mappers in `platform-response.mappers.ts`. Controllers must not return Prisma records, domain entities, or unrestricted spreads.

DTO categories:

| Category | Mapper | Forbidden examples |
|----------|--------|--------------------|
| Current principal | `mapPlatformPrincipalResponse` | passwordHash, MFA secrets, refresh data |
| User list / detail | `mapPlatformUserListItem` / `mapPlatformUserDetail` | passwordHash, MFA secrets, raw IP |
| Invitation admin | `mapPlatformInvitationAdmin` | token, URL, tokenHash |
| Invitation validate/accept | `mapPlatformInvitationValidation` / `Accept` | tokenHash, password |
| Admin sessions | `mapPlatformAdminSession` | userAgent, IP, token hashes, familyId |
| MFA reset | `mapPlatformMfaResetRequest` | MFA secrets, recovery hashes |
| Role / permission catalog | catalog mappers | mutation/persistence internals |

Future Prisma fields are ignored by default.

---

## 6. Bootstrap

`npm run bootstrap:platform-owner` → `scripts/bootstrap-platform-owner.mjs`

**Interactive (preferred):**

```bash
npm run bootstrap:platform-owner -- --email owner@example.com
```

Prompts for password and confirmation without echo (TTY required).

**Non-interactive:** `--password-stdin` reads password then confirmation from stdin (no CLI password args).

**Test-only:** `PLATFORM_BOOTSTRAP_PASSWORD_TEST_ONLY` is accepted only when `NODE_ENV=test`. Ordinary `PLATFORM_BOOTSTRAP_PASSWORD` is rejected outside tests and must not be used for operations.

Rules:

- Fails if any Platform User exists (transactional advisory lock `pg_advisory_xact_lock`)  
- Creates exactly one Owner role assignment; no session; no tenant context  
- MFA enrollment required at first login  
- Never prints password, hash, or tokens  
- Output is a small JSON success object (id, email, roleKey, mfaEnrollmentRequired)

---

## 6b. Database-backed security verification gate

**Status (local evidence):** PostgreSQL-backed suites **executed and passed** against `booking_test` on `localhost:5433` (PostgreSQL **16.14** via `docker-compose.test.yml`).

Production-equivalent engine: **PostgreSQL 16** (`postgres:16-alpine`).

### Isolation and safety

- Dedicated test database name `booking_test` (or `*_test` / `*_integration` / `test_*`)
- Local hosts only (`localhost` / `127.0.0.1` / `postgres-test`)
- Requires `RUN_PLATFORM_DB_SECURITY=true` (or `RUN_INTEGRATION=true`) **and** `ALLOW_TEST_DATABASE_RESET=true` before truncate
- Truncates only Platform tables (`platform_users`, roles, invitations, refresh tokens, MFA reset/recovery)
- Never targets production/staging names or remote hosts

### Commands

```bash
# From apps/api (Docker Desktop required)
npm run db:test:up
npm run db:test:migrate
npm run db:test:upgrade-validate   # duplicate pending-invitation upgrade path (sets safety flags)
npm run test:platform-db-security
```

Verified locally: clean migrate on `booking_test`; upgrade path on `booking_test_upgrade` returns `ok:true` with one pending + one superseded invitation and index present; DB security suites **5/5** (11 tests).


Suites (`*.postgres.integration.spec.ts`, ignored by unit Jest; enabled by `jest.integration.config.cjs`):

| Suite | Proves | Local result |
|-------|--------|--------------|
| `platform-invitation.db-concurrency` | Concurrent accept → one winner; resend supersession | Passed |
| `platform-invitation-pending-uniqueness` | Partial unique index enforcement | Passed |
| `platform-bootstrap.db-concurrency` | Concurrent bootstrap → one owner; rollback on injected failure | Passed |
| `platform-session-admin.db-security` | Session IDOR denial; revoke-all; suspension persistence | Passed |
| `platform-mfa-reset.db-atomicity` | Atomic approve; concurrent terminal decision; rollback injection | Passed |

Upgrade validation (`db:test:upgrade-validate` on `booking_test_upgrade`):

- Migrate through `20260721220000_phase47_platform_rbac`
- Insert two pending invitations for one user
- Apply `20260722180000_phase47_platform_rbac_db_security`
- Newest remains pending; older becomes superseded; history retained; index present

### Persistence corrections in this gate

- Invitation accept: conditional `updateMany` on `status=pending` (30s interactive txn timeout)
- Invitation resend: `supersedeAndCreate` transaction + partial unique index one pending invite per user
- MFA reset approve/reject: row lock + conditional terminal update + MFA/session clears in one transaction (30s timeout)
- Bootstrap: PostgreSQL advisory transaction lock `470008001`
- Session revoke-one: ownership-scoped `revokeBySessionIdForUser`
- Migration compatibility: supersede older duplicate pending rows before unique index

Migration: `20260722180000_phase47_platform_rbac_db_security` (additive partial unique index + data repair).

### Audit publication

Session revocation publishes domain events **after** persistence (best-effort publisher). MFA reset / invitation accept persistence is transactional; audit payloads must remain secret-free (no tokens/URLs/secrets).

### CI

Workflow: `.github/workflows/platform-db-security-ci.yml`  
Configured to: Postgres 16 service → `db:test:migrate` → `db:test:upgrade-validate` → `test:platform-db-security` → Super Admin tests.  
**Local commands matching the workflow were executed and passed.** No remote GitHub Actions run was triggered from this session.

### Invitation mailbox allowlist (hardened)

| Classification | Dev mailbox |
|----------------|-------------|
| `NODE_ENV=test` | Allowed |
| `local` / `development` + `PLATFORM_ALLOW_DEV_INVITATION_MAILBOX=true` + mode `dev-mailbox` | Allowed |
| Prefer `APP_ENV=local` for developer mailbox use | Recommended |
| `qa`, `preview`, `demo`, `uat`, `staging`, `production`, unknown | Denied |
| Default mode outside test | `smtp` |
| Unknown `PLATFORM_INVITATION_DELIVERY_MODE` | Fail closed |

No console URL delivery mode.

---

## 7. APIs (summary)

| Method | Route | Permission | Step-up | Response DTO |
|--------|-------|------------|---------|--------------|
| GET | `/platform/users` | platform-user.view | — | list DTO |
| GET | `/platform/users/:id` | platform-user.view | — | detail DTO |
| POST | `/platform/users/invitations` | platform-user.invite | yes | invitation admin DTO |
| POST | `/platform/users/:id/invitations/resend` | platform-user.invite | yes | invitation admin DTO |
| POST | `/platform/users/:id/suspend` | platform-user.suspend | yes | `{ ok }` |
| POST | `/platform/users/:id/reactivate` | platform-user.activate | yes | `{ ok }` |
| POST | `/platform/users/:id/roles` | platform-user.role.assign | high-impact | `{ ok }` |
| DELETE | `/platform/users/:id/roles/:roleKey` | platform-user.role.remove | yes | `{ ok }` |
| GET | `/platform/users/:id/sessions` | platform-user.session.view | — | admin session DTOs |
| POST | `/platform/users/:id/sessions/...` | platform-user.session.revoke | yes | `{ ok }` |
| POST | `/platform/users/:id/mfa-reset-requests` | platform-user.mfa.reset-request | yes | MFA reset DTO |
| POST | `/platform/mfa-reset-requests/:id/approve\|reject` | platform-user.mfa.reset-approve | yes | MFA reset DTO |
| GET | `/platform/roles` | platform-role.view | — | role catalog DTOs |
| GET | `/platform/permissions` | platform-permission.view | — | permission catalog DTOs |
| GET/POST | `/platform/auth/invitation/*` | public token | — | validate/accept DTOs |

`/platform/auth/me` returns the principal DTO (`roleKeys`, `permissions`, `status`, `authzRevision`).

---

## 8. Frontend

Permission-aware nav and `RequirePermission` route gate. Screens: directory, invite, detail, roles matrix, activate invitation, MFA reset approve. Authorization remains server-side. Invite success UI does not display invitation URLs; delivery failure shows a generic status. Frontend types omit password hashes, token hashes, MFA secrets, and raw user-agents.

---

## 9. Data

Additive migrations:

- `20260721220000_phase47_platform_rbac` — status/suspension/authzRevision, roles, invitations, MFA-reset requests  
- `20260722180000_phase47_platform_rbac_db_security` — partial unique index: one `pending` invitation per Platform User  

Roles/permissions remain code-governed.

---

## 10. Environment

See `apps/api/.env.example`: invitation TTL/origin/resend, delivery mode, mailbox allow flag, MFA reset TTL, DB security test flags.

Do **not** set `PLATFORM_BOOTSTRAP_PASSWORD` for ordinary operations.

---

## 11. Critical integration coverage

Executable suites under `apps/api/src/modules/auth/tests/`:

- invitation secret redaction (`platform-invitation-security.spec.ts`)  
- mailbox environment policy (`platform-invitation-mailbox-policy.spec.ts`)  
- safe DTO serialization sentinels (`platform-response-serialization.spec.ts`)  
- invitation lifecycle application scenarios (`platform-invitation-lifecycle.spec.ts`)  
- authorization/SoD application path (`platform-rbac-security-integration.spec.ts`)  
- bootstrap CLI input security (`bootstrap-platform-owner.spec.ts`)  
- DB harness safety (`platform-db-security.harness.spec.ts`)  
- **PostgreSQL DB security gate** (`*.db-*.postgres.integration.spec.ts`) via `npm run test:platform-db-security`  

**Remaining limitations:** Remote GitHub Actions execution of `platform-db-security-ci.yml` was not triggered in this session (workflow is configured and locally validated). Prefer `APP_ENV=local` for developer mailbox use even though `development` + allow-flag is accepted by policy.

---

## 12. Rollback

**Invitation delivery:** may swap adapters; never restore raw token/URL logging. Prefer fail-safe pending invitations.

**DTO mapping:** if a mapper regresses, return a smaller safe DTO — never raw Prisma/entities.

**Bootstrap:** do not restore ordinary env/CLI password input. Disable bootstrap until a secure input path is available.

**Tests:** retain security regression tests even if implementation rolls back.

**Data:** retain additive tables/audit after deploy. Do not delete invitation/MFA-reset history merely to roll back API behavior.

Do not restore Platform `super_admin` bypass, weaken MFA/session controls, or affect tenant/patient sessions.

---

## 13. Deferred / next

Custom roles, catalog/plans/subscriptions/overrides/sales records, Audit Center UI, Operations Console, notification-template admin — later steps.

**Recommended next:** final acceptance of Step 08, then Step 09 — Super Admin Design System Shell (not implemented here).
