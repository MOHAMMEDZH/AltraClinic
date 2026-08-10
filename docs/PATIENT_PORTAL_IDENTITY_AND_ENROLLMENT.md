# Patient Portal Identity & Enrollment (Phase 46b)

**Phase:** 46b — Patient Identity, Enrollment & Session Security  
**Status:** **IMPLEMENTED** · 2026-07-19  
**Architecture SSOT:** [`PATIENT_PORTAL_ARCHITECTURE.md`](./PATIENT_PORTAL_ARCHITECTURE.md)  
**Execution plan:** [`PHASE_46_EXECUTION_PLAN.md`](./PHASE_46_EXECUTION_PLAN.md)  
**Foundation:** [`PATIENT_PORTAL_FOUNDATION.md`](./PATIENT_PORTAL_FOUNDATION.md)  
**Quality gate:** **QG-B — Identity & Enrollment Security Ready**

---

## Enrollment lifecycle

```
Staff invite → INVITED + enrollment token (hash stored)
  → Patient enroll (token + email + password + consent)
  → User (role=patient) created via Identity
  → PortalAccount ACTIVE + consent timestamp
  → Patient sessionClass tokens issued
```

| Step | API |
|------|-----|
| Invite | `POST /patient-portal/accounts` (staff) → returns `enrollmentToken` once |
| Status | `POST /patient-portal/auth/enrollment-status` |
| Complete | `POST /patient-portal/auth/enroll` |
| Staff activate | `POST /patient-portal/accounts/:id/activate` (also records consent) |

Incomplete enrollment **cannot** access `/patient-portal/me/*` (`PatientPortalEnrollmentCompleteGuard`).

---

## Identity integration

- Reuses Identity `User` + `PasswordHasher` + Auth `JwtTokenService` / `LoginCompletionService` / `TotpService` / `MfaBackupCodeService` / refresh + reset token repositories.
- **No second authentication or MFA engine.**
- Orchestration: `PatientPortalIdentityService`.

---

## Session lifecycle

| Concern | Behavior |
|---------|----------|
| Session class | JWT `sessionClass: 'patient'` + `aud: patient-portal` |
| Staff default | Missing `sessionClass` → `staff` (backward compatible) |
| Create | Login / enroll / MFA verify via `LoginCompletionService` with `sessionClass: 'patient'` |
| Renew | `POST /patient-portal/auth/refresh` (rejects non-patient refresh) |
| Logout | `POST /patient-portal/auth/logout` |
| Logout all | `POST /patient-portal/auth/logout-all` |
| Guard | `PatientPortalSessionGuard` rejects staff JWTs on portal identity APIs |

Staff clinic JWTs **cannot** authenticate patient portal identity/product paths.

---

## MFA

- Policy-driven via tenant `mfaRequired` / user `mfaEnabled`.
- Challenge tokens carry `sessionClass: 'patient'`.
- Setup/confirm reuse Auth TOTP + backup codes.
- Endpoints: `/patient-portal/auth/mfa/setup|confirm|verify`.

---

## Password lifecycle

| Flow | Endpoint |
|------|----------|
| Initial setup | Enrollment `password` |
| Forgot | `POST /patient-portal/auth/forgot-password` (enumeration-safe) |
| Reset | `POST /patient-portal/auth/reset-password` |
| Change | `POST /patient-portal/auth/change-password` |

Uses Auth password-reset token repository; resets revoke all sessions.

---

## Security protections

- Center flag + `allowPatientPortal` fail-closed  
- IP / email rate limits on login; forgot-password rate limit  
- Timing-equalized credential failures  
- Enumeration-resistant enroll / forgot / reset messages  
- Enrollment token SHA-256 at rest; TTL 7 days  
- Session fixation mitigated by new session IDs on login/refresh  
- CSRF readiness: Bearer tokens (no cookie auth in 46b)

---

## Licensing & flags

- `PATIENT_PORTAL_CENTER_ENABLED` default **OFF**  
- Tenant gate `allowPatientPortal` default **OFF**  
- Module license `patientPortal` on staff account APIs  

---

## Audit / Activity / Observability

Audit actions include enrollment completed, token issued, session created/revoked, password reset/change, MFA setup/enabled.

Activity emitter logs non-PHI structured events (`kind: patient_portal`, `phi: false`).

Observability contracts from 46a remain the telemetry registration surface.

---

## Frontend (46b)

Routes under `apps/patient-portal`: `/login`, `/enroll`, `/mfa`, `/account`.

Session keys allowlisted in secure storage: `portal.accessToken`, `portal.refreshToken`, `portal.sessionId`, `portal.tenantId`.

---

## Schema

Additive on `portal_accounts`:

- `enrollmentTokenHash`
- `enrollmentTokenExpiresAt`
- `enrollmentConsentAt`

Migration: `20260719020000_phase46b_portal_enrollment`.

---

## Known limitations

- Notification delivery of invite/reset emails still intent-oriented (raw reset token returned only for test/dev paths).  
- Trusted-device MFA skip not enabled for portal in 46b.  
- Remember-me not implemented.  
- No appointments / caregiver / PHI product surfaces.

---

## Deferred functionality

Appointments · caregiver · clinical · messaging · billing · payments · documents · portal home/dashboard beyond identity account shell.

---

## Test coverage

| Suite | Focus |
|-------|-------|
| `patient-portal-identity.spec.ts` | sessionClass separation, guards, enrollment tokens, MFA challenge class |
| `portal-account.entity.spec.ts` | enrollment token + consent |
| `invite-portal-account.handler.spec.ts` | token issuance on invite |
| Frontend foundation | secure storage allowlist |

No appointment / caregiver / PHI access tests (by design).
