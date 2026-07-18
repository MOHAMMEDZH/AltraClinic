# Authentication & Authorization System

## Overview

Enterprise-grade auth system for the Multi-Tenant SaaS EMR/ERP platform.  
Built on Clean Architecture + DDD principles, consistent with existing module patterns.

---

## Architecture

```
src/modules/auth/
├── domain/
│   ├── entities/           RefreshToken, LoginAttempt, PasswordResetToken, EmailVerificationToken
│   ├── value-objects/      JwtClaimsVO, RefreshTokenClaimsVO, DeviceInfoVO, PasswordPolicyVO, TokenPairVO
│   ├── repositories/       Four repository interfaces (pure domain contracts)
│   ├── events/             UserLoggedIn, UserLoggedOut, LoginFailed, SuspiciousLogin, PasswordChanged
│   └── exceptions/         Domain-specific typed exceptions (never raw Error)
├── application/
│   ├── handlers/           Login, Logout, LogoutAll, RefreshToken, ForgotPassword, ResetPassword,
│   │                       VerifyEmail, SendVerificationEmail, ListSessions
│   └── dto/                Validated DTOs (class-validator)
├── infrastructure/
│   ├── strategies/         JwtStrategy (passport-jwt)
│   ├── repositories/       PrismaRefreshToken, PrismaLoginAttempt, PrismaPasswordResetToken, PrismaEmailVerification
│   └── services/           JwtTokenService, InMemoryRateLimiter, ConsoleEmailSender, JwtTenantResolver
└── api/
    ├── auth.controller.ts  All auth endpoints
    ├── guards/             JwtAuthGuard (global), RolesGuard (global), PermissionGuard
    └── decorators/         @Public(), @CurrentUser(), @Roles(), @RequirePermission()
```

---

## Token Architecture

### Access Token (JWT)
| Field       | Value                               |
|-------------|-------------------------------------|
| Algorithm   | HS256 (RS256 in Phase 2)            |
| Expiry      | 15 minutes (JWT_ACCESS_EXPIRES)     |
| Secret      | JWT_ACCESS_SECRET (min 32 chars)    |
| Claims      | sub, tenantId, branchId, roles, sessionId, type="access" |

### Refresh Token (JWT + DB hash)
| Field       | Value                               |
|-------------|-------------------------------------|
| Algorithm   | HS256                               |
| Expiry      | 7 days (JWT_REFRESH_EXPIRES)        |
| Secret      | JWT_REFRESH_SECRET (different!)     |
| Storage     | SHA-256 hash stored in `refresh_tokens` table |
| Rotation    | Full rotation on every use — old token immediately revoked |

> **Why store a hash?**  
> Storing the raw token would be a credential breach if the DB is compromised.  
> The SHA-256 hash is non-reversible. The JWT signature provides integrity — we
> verify the JWT first (fast, no DB), then check the hash (confirms not revoked).

---

## Authentication Flow

### Login
```
POST /auth/login
Body: { email, password, tenantId, deviceName? }

1. IP rate-limit check (30 failures / 15min window)
2. Email rate-limit check (5 failures / 15min window)
3. User lookup by email + tenantId
4. Account state: locked? inactive?
5. bcrypt.compare(password, hash)  — constant-time
6. Suspicious IP detection (new IP vs last login IP)
7. Issue access + refresh token pair
8. Persist RefreshToken (hash + sessionId + device info)
9. Update User.lastLoginAt, lastLoginIp, failedLoginCount=0
10. Publish UserLoggedInEvent, record LoginAttempt(success=true)
```

### Refresh Token Rotation
```
POST /auth/refresh
Body: { refreshToken }

1. Verify JWT signature (no DB — fast path)
2. SHA-256 hash the raw token, look up in DB
   → Not found: revokeAll (replay attack) → 401
   → Already revoked: revokeAll (replay detected) → 401
   → Expired: 401
3. Revoke the old sessionId
4. Issue new token pair with NEW sessionId
5. Save new RefreshToken to DB
```

### Logout
```
POST /auth/logout   (requires Bearer token)

1. Extract sessionId from JWT claims
2. Set revokedAt on the matching RefreshToken row
3. Publish UserLoggedOutEvent
```

---

## Tenant Resolution

The system upgrades tenant resolution from header-based to JWT-based after auth:

| Route Type         | Resolution Source           |
|--------------------|-----------------------------|
| Public auth routes | `x-tenant-id` request header |
| Protected routes   | `tenantId` claim in access JWT |

`JwtTenantResolver` (in AuthModule) overrides the global `HeaderTenantResolver`
from InfrastructureModule. The JWT claim **always wins** on protected routes.
The fallback to header is safe because protected routes require a valid JWT first.

---

## Brute Force & Rate Limiting

| Scenario             | Threshold          | Action                   |
|----------------------|--------------------|--------------------------|
| Failed logins per email | 5 / 15 min    | RateLimitExceeded (429)  |
| Failed logins per IP | 30 / 15 min        | RateLimitExceeded (429)  |
| Account hard lock    | 5 consecutive fails | `lockedUntil` = +15 min |

**Current implementation**: `InMemoryRateLimiter` (suitable for single-instance dev).  
**Production**: Replace with `RedisRateLimiter` (see Phase 2 below).

### Suspicious Login Detection
- Detects new IP address vs last login IP
- Publishes `SuspiciousLoginEvent` for audit logging / alerting
- Phase 2: geolocation-based anomaly detection

---

## Password Policy

Default policy (Phase 1):
- Minimum 8 characters, maximum 128
- At least 1 uppercase, 1 lowercase, 1 digit, 1 special character

Policy is implemented as `PasswordPolicyVO` — a value object, not a static function.
This allows tenant-specific policies to be injected from DB in Phase 2 without
changing any call sites.

---

## Authorization

### RBAC (Role-Based Access Control)

12 roles aligned with the permission matrix:

| Role               | Description                |
|--------------------|----------------------------|
| `super_admin`      | Platform-level (SaaS operator) |
| `owner`            | Clinic owner               |
| `general_manager`  | Clinic GM                  |
| `doctor`           | Medical doctor              |
| `dentist`          | Dental specialist          |
| `specialist`       | Other medical specialist   |
| `nurse`            | Nursing staff              |
| `assistant`        | Clinical assistant         |
| `receptionist`     | Front desk                 |
| `accountant`       | Finance/billing            |
| `inventory_manager`| Supply chain               |
| `patient`          | Patient self-service       |

### Role Inheritance (Static — Phase 1)

| Role              | Inherits from               |
|-------------------|-----------------------------|
| `super_admin`     | All roles                   |
| `owner`           | All except super_admin      |
| `general_manager` | All clinical + admin roles  |

### Guards Execution Order

```
Request → JwtAuthGuard → RolesGuard → PermissionGuard → Controller
```

1. **JwtAuthGuard** (global) — validates JWT, populates `request.user: JwtClaimsVO`
2. **RolesGuard** (global) — checks `@Roles()` metadata with inheritance
3. **PermissionGuard** (opt-in) — evaluates `@RequirePermission(resource, action)` against permission matrix JSON
4. **Existing module guards** (e.g., `BillingPermissionGuard`) — policy-based checks

All guards are registered globally via `APP_GUARD` in AppModule —
**security-by-default**: all routes require auth unless decorated with `@Public()`.

---

## MFA Architecture (MFA-Ready — Phase 1)

The foundation is in place:
- `User.mfaEnabled: Boolean` (DB column)
- `User.mfaSecret: String?` (base32 TOTP secret, to be AES-encrypted at rest)
- `enableMfa(secret)` / `disableMfa()` domain methods

**Phase 2 implementation**:
1. `POST /auth/mfa/setup` — generate TOTP secret, return QR code URI
2. `POST /auth/mfa/verify` — verify TOTP code, enable MFA on user
3. `POST /auth/mfa/totp` — after login, require 6-digit TOTP before issuing tokens
4. Backup codes stored as hashed array in `User.mfaBackupCodes: String[]`

---

## Security Review — Competing-Architect Analysis

### 🔴 CRITICAL WEAKNESSES IDENTIFIED

#### 1. HS256 vs RS256 for JWT Signing
**Weakness**: HS256 (symmetric) means any service with the secret can forge tokens.  
In a microservices future, sharing the JWT_ACCESS_SECRET across services is dangerous.  
**Resolution**: HS256 is acceptable for a monolith. When splitting to microservices,
rotate to RS256 (private key signs, public key verifies). The `JwtStrategy` and
`JwtTokenService` are isolated — changing the algorithm requires only two files.  
**Action**: Document RS256 migration as Phase 2 task. Add `TODO: RS256` comment.

#### 2. InMemoryRateLimiter in Production
**Weakness**: Multi-instance deployments (horizontal scaling) bypass rate limits
because counters are not shared.  
**Resolution**: `RateLimiterPort` interface is already in place. Replace
`InMemoryRateLimiter` with `RedisRateLimiter` (ioredis + sliding window Lua script)
when deploying behind a load balancer. Set `REDIS_URL` in `.env`.  
**Phase 2 task**: Implement `RedisRateLimiter` with Lua atomic increment.

#### 3. Access Token Revocation Gap
**Weakness**: If a session is compromised and logout is performed, the access token
remains valid for up to 15 minutes.  
**Resolution**: This is a deliberate trade-off (15 min window is acceptable for most
threats). For high-security endpoints (e.g., password change, payment), add a
`sessionId` blacklist in Redis checked by JwtStrategy. Token TTL is intentionally
short to limit the window.  
**Phase 2 task**: Redis-based `sessionId` blacklist for immediate revocation.

#### 4. PasswordHasher is a Static Class
**Weakness**: `PasswordHasher.hash()` is a static method — hard to mock in unit tests
and cannot be easily swapped (e.g., for Argon2).  
**Resolution**: Tests mock the static method directly (works with Jest's spyOn).
Phase 2 should convert to an injectable service with an `PasswordHasherPort` interface.
**Action**: Note the tech debt.

#### 5. JWT Secret in Constructor, Not Environment Validated Early
**Weakness**: `buildJwtConfig()` throws at module load time — but error message is
only useful if the server starts. In container orchestration, missing env vars should
fail the health check.  
**Resolution**: Phase 2 add `@nestjs/config` + Joi validation at bootstrap.

#### 6. `require()` in PermissionGuard for Matrix Loading
**Weakness**: `require('../../../../../config/permission-matrix.json')` is a relative
path that breaks if the guard is moved. Uses CommonJS `require` in an ESM context.  
**Resolution**: Move permission matrix loading to a `PermissionMatrixService` that is
injected into `PermissionGuard`. Cache it in the service.  
**Phase 2 task**: Inject `PermissionMatrixService`.

#### 7. Email Verification Not Required Before Login
**Weakness**: `LoginHandler` does not check `user.emailVerified`. Unverified accounts
can fully authenticate. The domain exception `EmailNotVerifiedException` exists but
is not invoked.  
**Decision**: Intentional for Phase 1 (avoid breaking existing user flows). Enforcing
email verification requires a migration + user communication plan.  
**Action**: Add `if (!user.emailVerified) throw new EmailNotVerifiedException()` when
ready. The handler is already structured to add this in one line.

### 🟡 MEDIUM RISKS

#### 8. Audit Log is Event-Based, Not Synchronous
**Weakness**: Login audit (LoginAttempt save) could fail silently if the event
publisher is down. Security audit logs should be durable.  
**Resolution**: `LoginAttempt.save()` is called directly in `LoginHandler` — it is
synchronous with the request, NOT event-based. It will fail the login if the DB write
fails. This is intentional for security audit durability.

#### 9. DeviceInfo.label() Over-Simplified
**Weakness**: Device name derived from UA string is coarse (just "Mobile Browser").  
**Resolution**: Phase 2 integrate a UA parser library (e.g., `ua-parser-js`) for
richer device fingerprinting.

#### 10. No CSRF Protection
**Weakness**: API-only JWT Bearer auth is immune to CSRF. However, if the app ever
uses cookies for token storage, CSRF protection is mandatory.  
**Resolution**: As long as tokens are stored in memory (not cookies), no CSRF needed.
Document this constraint — never use httpOnly cookies without SameSite + CSRF token.

### ✅ CORRECT DECISIONS

- **Replay attack detection**: revoke-all on hash mismatch is the correct OWASP response
- **User enumeration prevention**: ForgotPassword always returns 200
- **Timing attack prevention**: Always hash a dummy password when user not found
- **No PII in JWT**: Roles only, not permission bits or patient data
- **Separate secrets**: Access and refresh tokens use different secrets
- **Security-by-default guards**: Opt-out (@Public) safer than opt-in (@UseGuards)
- **Immutable domain entities**: User.recordFailedLogin() returns new instance
- **Login attempts stored synchronously**: Audit durability is preserved

---

## API Endpoints

| Method | Path                    | Auth     | Description                      |
|--------|-------------------------|----------|----------------------------------|
| POST   | /auth/login             | Public   | Authenticate + get token pair    |
| POST   | /auth/refresh           | Public   | Rotate refresh token             |
| POST   | /auth/logout            | JWT      | Revoke current session           |
| POST   | /auth/logout-all        | JWT      | Revoke all other sessions        |
| POST   | /auth/forgot-password   | Public   | Request password reset email     |
| POST   | /auth/reset-password    | Public   | Apply new password via token     |
| POST   | /auth/verify-email      | Public   | Verify email via token           |
| POST   | /auth/resend-verification| JWT     | Resend verification email        |
| GET    | /auth/sessions          | JWT      | List active sessions             |
| GET    | /auth/me                | JWT      | Current user claims              |

---

## Database Schema Additions

```sql
-- User model: new auth fields
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN mfa_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN mfa_secret VARCHAR(88);
ALTER TABLE users ADD COLUMN locked_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN failed_login_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE users ADD COLUMN last_login_ip VARCHAR(45);

-- RefreshToken: new fields
ALTER TABLE refresh_tokens ADD COLUMN session_id UUID UNIQUE NOT NULL;
ALTER TABLE refresh_tokens ADD COLUMN device_name VARCHAR(255);

-- New tables (managed by Prisma migration)
CREATE TABLE login_attempts ( ... );
CREATE TABLE password_reset_tokens ( ... );
CREATE TABLE email_verification_tokens ( ... );
```

Run migration:
```bash
cd apps/api
npx prisma migrate dev --name "phase-2-auth-system"
```

---

## Environment Variables

```bash
# Required
JWT_ACCESS_SECRET=<min 32 random chars>
JWT_REFRESH_SECRET=<min 32 random chars, DIFFERENT from access>

# Optional (with defaults)
JWT_ACCESS_EXPIRES=900       # 15 minutes
JWT_REFRESH_EXPIRES=604800   # 7 days

# Phase 2
REDIS_URL=redis://localhost:6379
```

---

## Phase 2 Roadmap

| Priority | Task |
|----------|------|
| P0 | Replace `InMemoryRateLimiter` with `RedisRateLimiter` |
| P0 | Add `@nestjs/config` + Joi validation for all env vars |
| P1 | RS256 JWT signing (private/public key pair) |
| P1 | Redis-based sessionId blacklist for immediate access token revocation |
| P1 | TOTP MFA implementation (setup + verify endpoints) |
| P2 | Inject `PermissionMatrixService` (remove `require()` from guard) |
| P2 | Convert `PasswordHasher` to injectable service with Argon2 support |
| P2 | Tenant-configurable password policies |
| P2 | Email verification enforcement at login (behind a feature flag) |
| P3 | Geolocation-based suspicious login detection |
| P3 | UA parser for rich device fingerprinting |
