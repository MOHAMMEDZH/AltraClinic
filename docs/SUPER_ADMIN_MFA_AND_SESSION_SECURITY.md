# Super Admin — MFA and Session Security (Release 47 Step 07)

Authoritative implementation record for mandatory platform MFA, session inventory/timeouts/revocation, and reusable step-up assurance.

Companion: `docs/SUPER_ADMIN_PLATFORM_AUTHENTICATION.md` (Step 06).

Includes the **Step 07 focused security correction**: idle-timeout integrity, MFA encryption-key policy, device-metadata minimization, and MFA-bypass removal.

---

## 1. Step 06 baseline (preserved)

| Boundary | Status |
|----------|--------|
| `aud=platform`, `iss`, `principalType=platform` | Enforced |
| No tenant context on platform tokens | Enforced |
| Cross-audience rejection | Enforced |
| HttpOnly `sa_platform_rt` + CSRF | Enforced |
| Production dedicated `JWT_PLATFORM_*` secrets | Fail-closed (no silent prod fallback) |
| Role name ≠ platform principal | Enforced |

**Change from Step 06:** password success **no longer** issues a normal platform session. Login returns only a short-lived **preauth** token until MFA enrollment or challenge succeeds.

---

## 2. Mandatory MFA policy

- MFA is **mandatory** for all active platform users.
- Without enrollment → `mfa_enrollment_required` after valid password.
- With enrollment → `mfa_challenge_required` after valid password.
- Roles cannot bypass MFA (including names like `super_admin` or Platform Owner).
- `PLATFORM_DISABLE_MFA` is **not a runtime bypass**. Outside `NODE_ENV=test`, any non-empty value **fails startup**. Under `NODE_ENV=test` the variable may appear in the environment but **handlers never skip MFA**.
- Developers must complete MFA normally in local development — there is no development disable flag.
- Administrator-assisted lost-factor recovery is **deferred to Step 08** (SoD). Self-service uses TOTP + recovery codes + step-up.

---

## 3. Authentication state machine

```
unauthenticated
  → password OK + !mfaEnabled → mfa_enrollment_required (preauth purpose=mfa_enrollment)
  → password OK + mfaEnabled  → mfa_challenge_required (preauth purpose=mfa_challenge)
  → enrollment confirm / challenge success → fully authenticated platform session
  → step-up verify → step-up satisfied (session-bound, short TTL)
  → idle/absolute expiry or revoke → session expired/revoked → login
```

Frontend mirrors server status; never invents MFA completion locally.

---

## 4. Factor and TOTP parameters

| Parameter | Value |
|-----------|--------|
| Factor | TOTP (otplib) |
| Digits | 6 |
| Period | 30 seconds |
| Issuer label | `PLATFORM_MFA_ISSUER` (default `Booking Platform`) |
| Clock window | otplib default verification window |
| Replay | accepted TOTP step stored in `lastTotpStep`; same step rejected |

SMS / email / WebAuthn / passkeys: **not** implemented.

---

## 5. Secret encryption

- AES-256-GCM envelope (auth-owned helper; same pattern as Integrations secrets, **separate key**).
- Env: `PLATFORM_MFA_ENCRYPTION_KEY`.
- **Policy:** deterministic test-only key is used **only** when `NODE_ENV=test` and the env var is unset.
- For every other environment (development, QA, preview, demo, staging, production, or unset `NODE_ENV`), an explicit valid key is **required** or startup fails.
- Validation: non-empty; min 32 characters; rejects known placeholders; rejects equality with JWT signing secrets; rejects the test-only key outside `NODE_ENV=test`.
- Key material is hashed with SHA-256 before AES use (entropy via length, not raw 32-byte decoding).
- Do **not** silently generate an ephemeral key at startup.
- Do **not** fall back to clinic/platform JWT secrets, refresh secrets, frontend env, or a committed repository key.
- Key version metadata: `mfaKeyVersion` (current `"1"`).
- Errors may name `PLATFORM_MFA_ENCRYPTION_KEY` but **never** log or return key material.
- Tenant `User.mfaSecret` remains plaintext today (pre-existing gap G-MFA-02) — **not copied** into platform MFA; do not treat tenant MFA as platform MFA.

Pending enrollment secrets are encrypted separately (`mfaPendingSecretEncrypted`) with TTL; abandoned enrollments expire; new begin replaces pending.

---

## 6. Preauth challenge token

| Claim | Value |
|-------|--------|
| `type` | `platform_preauth` |
| `aud` | `platform-preauth` |
| `iss` | platform issuer |
| `purpose` | `mfa_enrollment` \| `mfa_challenge` |
| `principalType` / `sessionClass` | `platform` |
| TTL | enrollment / challenge TTL env |
| tenantId | absent |

Rejected by normal access JWT strategy (`type !== 'access'`). Not accepted on tenant/patient/business APIs or refresh.

---

## 7. Recovery codes

- Count: `PLATFORM_RECOVERY_CODE_COUNT` (default 10).
- Secure random charset (same family as tenant backup codes).
- Display plaintext **once**; persist **SHA-256** hashes only (`platform_mfa_recovery_codes`).
- Atomic one-time consumption; reuse rejected.
- Regeneration requires **fresh step-up**; invalidates previous set.
- Never logged or audited in plaintext/hash form beyond non-secret metadata.

---

## 8. Session model

Extended `platform_refresh_tokens` (session identity = `sessionId` + `familyId`):

- `lastActivityAt` — **interactive** activity only (see §8.1)
- `absoluteExpiresAt` — fixed at session creation; never extended
- `mfaCompletedAt`, `assuranceLevel`, `stepUpVerifiedAt`
- `deviceLabel`, `authMethod` (`totp` \| `recovery`), `revocationReason`
- Raw `userAgent` / IP may remain stored for investigation; ordinary self-service APIs return a **privacy-minimized device summary** instead (e.g. `Chrome on Windows`). Raw UA is not returned on session list DTOs and should not appear in routine audit payloads.

No access/refresh plaintext, no MFA secrets, no tenant context, no PHI.

### 8.1 Interactive activity policy (idle integrity)

**Rule:** Passive requests must not extend platform session idle expiry. Refresh-token rotation is not human interaction.

**Selected mechanism:** dedicated authenticated activity signal.

| Updates interactive activity? | Operation |
|-------------------------------|-----------|
| No | `POST /refresh`, `GET /me`, `GET /sessions`, `GET /step-up/status`, MFA status, bootstrap, background polling, health/status, anonymous/failed/rejected requests, token validation alone |
| Yes | `POST /platform/auth/activity` after verified platform principal + alive current session, server-throttled |

Frontend: listens for `pointerdown` / `keydown` / `touchstart` only while fully authenticated; client throttle default 60s; sends empty body (no keystrokes, coordinates, page content, or PHI); stops on logout; network failure does not invent local session extension.

Server: uses server time; updates only the current session from the access-token claims; never accepts client timestamps or arbitrary session IDs; never extends absolute expiry; never grants step-up; throttled by `PLATFORM_ACTIVITY_MIN_INTERVAL_SECONDS` (default 60). Rejects idle-/absolute-expired sessions. No high-volume audit per signal.

### Timeouts (server-enforced)

| Policy | Default | Env |
|--------|---------|-----|
| Idle | 1800s (30m) from last **interactive** activity | `PLATFORM_SESSION_IDLE_SECONDS` |
| Absolute | 43200s (12h) from session creation | `PLATFORM_SESSION_ABSOLUTE_SECONDS` |
| Activity throttle | 60s | `PLATFORM_ACTIVITY_MIN_INTERVAL_SECONDS` |

Idle expiry = `lastActivityAt + idleSeconds`. Absolute expiry is fixed and **cannot** be extended by refresh rotation or activity. Production rejects non-positive or absolute &lt; idle.

### Revocation

| Action | Step-up? | Behavior |
|--------|----------|----------|
| Logout (current) | No | Revoke session + JTI blacklist + clear cookies |
| Revoke one (own) | No | Target family; IDOR blocked |
| Revoke all other | Yes | Preserve current |
| Revoke all | Yes | Terminate current + clear cookies |

Hooks: `PlatformSessionRevocationService` for password change, MFA reset/replace, disablement, refresh reuse, revoke-all (reusable by Step 08).

Clinic/patient sessions are unaffected.

---

## 9. Step-up assurance

- Proves **fresh** MFA for the **current** platform user + session only.
- Prefer TOTP; recovery code may be accepted by verify handler where implemented.
- Stored as `stepUpVerifiedAt` on the session row (server-side).
- Freshness: `PLATFORM_STEP_UP_SECONDS` (default 300).
- Does **not** grant permissions.
- Invalidated when the session is revoked.
- Used in Step 07 for: regenerate recovery codes, MFA replace begin/confirm, revoke-others, revoke-all.
- Later domains (Plan publish, Override, privileged access, etc.) must call `PlatformAssuranceService.requireStepUp` + Step 08 permissions.

API code on missing assurance: `PLATFORM_STEP_UP_REQUIRED`.

---

## 10. Self-service MFA replacement vs lost factor

**Replacement:** authenticated session + step-up → pending new secret → confirm TOTP → revoke other sessions → new recovery codes.

**Lost factor without recovery codes:** informational only; admin-assisted reset deferred to Step 08 (SoD, identity verification, audit). No email-only disable; no production env bypass.

---

## 11. APIs (`/platform/auth`)

### Public

| Method | Route | State |
|--------|-------|-------|
| POST | `/login` | password → preauth only |
| POST | `/mfa/enrollment/begin` | preauth enrollment |
| POST | `/mfa/enrollment/confirm` | issues session + recovery codes |
| POST | `/mfa/challenge` | issues session |
| POST | `/refresh` | cookie/CSRF; idle/absolute checks; **does not** extend interactive activity |
| POST | `/logout` | platform access + CSRF if cookie |

### Authenticated (`@PlatformAuthRoute`)

| Method | Route | Step-up | Activity |
|--------|-------|---------|----------|
| POST | `/activity` | — | Updates interactive idle clock (throttled) |
| GET | `/me` | — | Passive — no activity update |
| GET | `/mfa/status` | — | Passive |
| POST | `/mfa/recovery-codes/regenerate` | Yes | — |
| POST | `/mfa/replace/begin` | Yes | — |
| POST | `/mfa/replace/confirm` | Yes | — |
| GET | `/sessions` | — | Passive; returns `deviceSummary` / category, not raw UA |
| POST | `/sessions/:id/revoke` | — | — |
| POST | `/sessions/revoke-others` | Yes | — |
| POST | `/sessions/revoke-all` | Yes | — |
| POST | `/step-up/verify` | — | — |
| GET | `/step-up/status` | — | Passive |

---

## 12. Frontend (`apps/super-admin`)

- Auth statuses: loading / unauthenticated / mfa_enrollment_required / mfa_challenge_required / authenticated
- Pages: `/mfa/enroll`, `/mfa/challenge`, `/security` (+ StepUpModal)
- Access + preauth + recovery codes: **memory only**
- Enrollment shows otpauth URI + manual secret (no external QR service)
- Recovery codes shown once until acknowledged
- Throttled interactive activity signaling while authenticated
- Security page renders `deviceSummary` (not raw user-agent)

---

## 13. Audit events (no secrets/factors/codes/tokens)

Including: enrollment started/confirmed, challenge succeeded/failed, recovery used/regenerated, replace started/confirmed, step-up succeeded/failed, session revoked / others / all, idle/absolute expiry, refresh reuse, password verified (pre-MFA).

Routine activity signals are **not** audited per request (avoid high-volume noise).

---

## 14. Environment (placeholders only)

See `apps/api/.env.example`: `PLATFORM_MFA_ENCRYPTION_KEY` (required outside tests), issuer, TTLs, idle/absolute/step-up, recovery count, activity throttle. Never commit production values. Do not set `PLATFORM_DISABLE_MFA` outside automated tests.

---

## 15. Migration

Additive: `20260721200000_phase47_platform_mfa_sessions` — MFA columns on `platform_users`, session columns on `platform_refresh_tokens`, `platform_mfa_recovery_codes`. Existing platform users without MFA must enroll on next login. No auto-enrollment secrets.

This focused correction did **not** require an additional schema migration: `lastActivityAt` is redefined strictly as interactive activity; all writers were updated accordingly.

---

## 16. Rollback

**Focused correction rollback (preferred):** revert activity endpoint + frontend listeners; revert session DTO summarization; keep mandatory MFA and encryption-key fail-closed behavior. Prefer disabling activity extension entirely over restoring refresh-extends-idle.

**Do not restore:** non-test deterministic encryption-key fallback; production/dev MFA disablement; role-based MFA bypass; absolute-expiry extension; tenant context in platform sessions; weakened token validation.

**Before full Step 07 deploy:** revert migration + Step 07 APIs/UI/docs; restore Step 06 login-token behavior if required.

**After deploy:** disable MFA write routes safely; retain tables/audit; revoke platform sessions; force reauth; keep Step 06 audience/issuer validation; do not plaintext downgrade.

---

## 17. Tests added/updated (focused correction)

- Idle integrity: refresh/`me`/sessions/step-up-status do not touch activity; activity endpoint extends idle for current session only; rejects foreign/tenant/patient/expired; absolute fixed across refresh and activity
- Encryption config: test-only key; fail-closed outside test; placeholders/JWT reuse rejected; `PLATFORM_DISABLE_MFA` rejected outside test
- Device summary unit tests + session list omits raw UA
- Frontend activity throttle + session UI uses `deviceSummary`

---

## 18. Step 08 integration points

- Admin-assisted MFA reset / session revoke for other users
- Role/permission assignment with assurance hooks
- Call `PlatformAssuranceService` + permissions for sensitive commercial actions later

## 19. Recommended next step

**Final acceptance of Step 07**, then **Step 08 — RBAC and Platform Users** (do not implement in this correction).
