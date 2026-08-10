# Super Admin — Platform Authentication (Release 47 Step 06)

Authoritative implementation record for the dedicated platform authentication boundary used by `apps/super-admin`.

## 1. Current authentication baseline (verified)

| Principal | Audience (`aud`) | Identity store | Tenant claim | Entry |
|-----------|------------------|----------------|--------------|-------|
| Tenant staff | `clinic` | `User` (+ roles) | required `tenantId` | `/auth/login` |
| Patient portal | `patient-portal` | `User` + `PortalAccount` | required `tenantId` | portal auth |
| Platform (new) | `platform` | `PlatformUser` | **none** | `/platform/auth/login` |

Existing reuse: bcrypt `PasswordHasher`, refresh rotation + replay revoke, Redis JTI blacklist, `LoginAttempt` rate/lockout patterns, domain event publisher for audit, Nest JWT + Passport.

## 2. Target platform principal

- `sessionClass=platform`
- `principalType=platform` (validated server-side; **not** inferred from `super_admin` / `system_administrator`)
- `aud=platform`
- `iss` = `JWT_PLATFORM_ISSUER` (default `booking-platform`)
- `type=access` | refresh tokens use `type=refresh`
- No `tenantId`, no patient identity, no commercial entitlements, no PHI, empty `roles[]` in Step 06

## 3. Identity persistence decision

**Distinct `PlatformUser` + `PlatformRefreshToken` tables** (additive migration `20260721180000_phase47_platform_auth`).

Rationale (D-21): extending clinic `User` would keep a required `tenantId` / shared refresh table and encourage role-only platform auth. Platform identity must not require a tenant.

Minimum fields: id, email (unique normalized), passwordHash, displayName, isActive, lockout counters, auth timestamps.

**Bootstrap:** no default credentials, no seed users, no `.env` passwords. Step 08 (or an explicit ops command later) creates the first platform user. Tests use fixtures only.

## 4. Token contracts

### Access

- Short-lived (`JWT_PLATFORM_ACCESS_EXPIRES`, default 900s)
- Signed with `JWT_PLATFORM_ACCESS_SECRET` (required in production; non-prod may fall back to clinic access secret — residual risk documented)
- Validated: signature, expiry, `type`, `aud`, `iss`, `principalType`/`sessionClass`, JTI blacklist

### Refresh

- Stored as SHA-256 hash in `platform_refresh_tokens`
- Rotation on each refresh; previous token revoked
- Reuse of a revoked token revokes the refresh **family** and all user sessions
- Clinic/patient refresh tokens rejected by `/platform/auth/refresh`
- Platform refresh rejected by `/auth/refresh`

## 5. Browser session strategy — **Option A**

| Item | Choice |
|------|--------|
| Access token | Memory only (module variable in Super Admin SPA) |
| Refresh token | HttpOnly cookie `sa_platform_rt`, `Path=/platform/auth`, `SameSite=Strict`, `Secure` in production |
| CSRF | Exact Origin/Referer allowlist + double-submit cookie `sa_platform_csrf` echoed as `X-Platform-CSRF` on cookie-authenticated refresh/logout |
| Isolation | Cookie names and in-memory keys are Super Admin–specific; never `booking.refreshToken` / patient keys |

**Why not Option C:** Clinic dashboard stores refresh in `sessionStorage` — forbidden for platform by Step 06 requirements.

## 6. CORS / CSP

- API CORS: exact origins from `CORS_ORIGINS` ∪ `SUPER_ADMIN_CORS_ORIGINS` (defaults include `http://127.0.0.1:5176` / `4176`). Wildcard `*` with credentials is rejected at boot.
- Super Admin CSP `connect-src` already allows local API `http://127.0.0.1:3000` / `localhost:3000` (Step 05). No broad production API wildcard added.

## 7. API surface (`/platform/auth`)

| Method | Route | Auth | Rate limit | Audit |
|--------|-------|------|------------|-------|
| POST | `/platform/auth/login` | Public | IP + email via LoginAttempt + edge `/platform/auth` IP policy | password verified / fail / lock — **no session until MFA (Step 07)** |
| POST | `/platform/auth/mfa/enrollment/*` | Preauth | — | enrollment |
| POST | `/platform/auth/mfa/challenge` | Preauth | MFA attempt limits | challenge |
| POST | `/platform/auth/refresh` | Public + cookie/body refresh | edge IP policy | success/fail/reuse + idle/absolute **checks** (rotation does **not** extend interactive idle activity; see Step 07 correction) |
| POST | `/platform/auth/logout` | Platform JWT + `@PlatformAuthRoute` | — | logout |
| GET | `/platform/auth/me` | Platform JWT + `@PlatformAuthRoute` | — | passive — does **not** extend idle |
| GET/POST | `/platform/auth/sessions*`, `/mfa/*`, `/step-up/*`, `/activity` | Platform JWT | — | Step 07 security events; only `POST /activity` extends interactive idle |

Login ignores `x-tenant-id` as authority. Generic public error: `Invalid email or password.` (including locked/disabled).

**Step 07:** After valid password, login returns only `mfa_enrollment_required` or `mfa_challenge_required` with a `platform_preauth` token. Normal access/refresh cookies are issued only after MFA completion. See `docs/SUPER_ADMIN_MFA_AND_SESSION_SECURITY.md`.

## 8. Guards / legacy compatibility

- Global `JwtAuthGuard` rejects platform tokens on non-`@PlatformAuthRoute` APIs and rejects clinic/patient tokens on platform-auth routes.
- `PatientPortalSessionGuard` rejects non-patient sessions (including platform).
- `TenantDbInterceptor` skips `/platform/*` (no RLS tenant context).
- `PermissionGuard`: platform principals never receive the legacy `super_admin` bypass.
- **Legacy** `/platform/tenants*` / embedded clinic-dashboard platform-admin continue to use clinic JWT + role/permission checks temporarily. They are **not** exposed through Super Admin as the new boundary. Migration to platform principal is owned by later domain steps.

## 9. Lockout / rate limiting (verified)

- IP: 30 failures / 15 minutes → 429
- Email: 5 failures / 15 minutes → 429
- Account lockout: 5 consecutive bad passwords → `lockedUntil` (+15 minutes); public response still generic
- Successful login clears failed count / lock

## 10. Password recovery

**Deferred.** Tenant forgot-password is tenant-scoped and notification-tied. Super Admin login shows an informational recovery note only. Full platform recovery belongs with a later security step when a safe reuse path exists.

## 11. MFA / RBAC

- **Step 07 (implemented):** mandatory MFA, encrypted secrets, recovery codes, sessions, timeouts, step-up — see `docs/SUPER_ADMIN_MFA_AND_SESSION_SECURITY.md`.
- **Step 08:** Platform User admin, granular RBAC, admin-assisted MFA recovery.

## 12. Environment variables (placeholders only)

**API:** `JWT_PLATFORM_*`, `PLATFORM_MFA_*`, `PLATFORM_SESSION_*`, `PLATFORM_STEP_UP_SECONDS`, `SUPER_ADMIN_CORS_ORIGINS`, existing `CORS_ORIGINS` — see `.env.example` and Step 07 doc.

**Super Admin:** `VITE_API_BASE_URL`, `VITE_SUPER_ADMIN_ENV`, `VITE_SUPER_ADMIN_APP_NAME` — no secrets.

## 13. Rollback

1. Disable/remove `PlatformAuthController` routes (or feature-flag off).
2. Revert Super Admin auth provider/login to Step 05 placeholder if needed.
3. Revert CORS/CSP additions carefully without removing clinic/portal origins.
4. If migration **not** deployed: drop migration. If **deployed**: retain additive tables; stop writes; revoke `platform_refresh_tokens`.
5. Preserve audit/event history; do not delete.
6. Leave tenant/patient auth and legacy platform-admin untouched.

## 14. Operational assumptions

- First platform user created out-of-band (Step 08 or approved ops command).
- Production must set dedicated platform JWT secrets **and** `PLATFORM_MFA_ENCRYPTION_KEY`.
- Super Admin origin must be listed for credentialed CORS.

## 15. Recommended next step

**Step 08 — RBAC and Platform Users** (after Step 07 MFA/session security).
