# Patient Portal — Caregiver Delegation & Patient-Safe Data Access (Phase 46d)

**Status:** Implemented (QG-D)  
**Architecture:** Frozen — no Architecture Decision changes  

Related:

- [`PATIENT_PORTAL_ARCHITECTURE.md`](./PATIENT_PORTAL_ARCHITECTURE.md)
- [`PHASE_46_EXECUTION_PLAN.md`](./PHASE_46_EXECUTION_PLAN.md)
- [`PATIENT_PORTAL_APPOINTMENTS_AND_SCHEDULING.md`](./PATIENT_PORTAL_APPOINTMENTS_AND_SCHEDULING.md)

---

## Scope

Caregiver grant lifecycle, per-request delegated authorization with mandatory scope checks, acting context (`self` | `caregiver`), patient-safe profile facade (Patients SoR), delegated appointment **reads** (Scheduling facade), and result-release **gate plumbing** (no clinical results product).

Out of scope: clinical records/results display, messaging, billing, payments, documents, 46e–46f UX expansion.

---

## Caregiver lifecycle

Statuses: `invited` → `active` | `declined` | `revoked` (+ temporal expiry via `expiresAt`).

| Action | API |
|--------|-----|
| Invite | `POST /patient-portal/me/caregivers` |
| List (owner) | `GET /patient-portal/me/caregivers` |
| Revoke | `POST /patient-portal/me/caregivers/:grantId/revoke` |
| Accept | `POST /patient-portal/me/caregiver-invitations/accept` |
| Decline | `POST /patient-portal/me/caregiver-invitations/decline` |
| Delegated subjects | `GET /patient-portal/me/delegated-patients` |

Staff/admin grant/revoke on `/patient-portal/accounts/:id/caregiver-access*` remains available for clinic administration.

Storage ownership unchanged: `PortalAccount` aggregate + `CaregiverAccessGrant`.

---

## Authorization model

Roles alone **never** authorize caregiver PHI.

Per delegated request:

1. Patient session class + enrollment  
2. `PATIENT_PORTAL_CAREGIVER_ENABLED`  
3. License feature `caregiverAccess`  
4. Active grant (tenant, subject patient, caregiver user/email)  
5. Non-expired, non-revoked  
6. Required scope  
7. Explicit acting context  

---

## Acting context contract

Stable headers:

| Header | Values |
|--------|--------|
| `X-Portal-Acting-Context` | `self` (default) \| `caregiver` |
| `X-Portal-Subject-Patient-Id` | Required when `caregiver` |

Ambiguous or missing caregiver subject → deny.

---

## Scope model

Registered scopes include `profile`, `appointments`, and deferred scopes (`medical_records`, etc.).

**Phase 46d MVP product surfaces enforce only:** `profile`, `appointments`.

---

## Patient-safe profile

`GET /patient-portal/me/profile` → Patients SoR `findDetailById`, minimized DTO:

- patientId, firstName, lastName, dateOfBirth, gender, actingContext  

No phone/email/nationalId/notes/bloodGroup/admin fields.

---

## Delegated appointments

Reuse Phase 46c Scheduling facade list/detail with acting headers + `appointments` scope.

Caregiver **mutations** (book/reschedule/cancel) are rejected.

---

## Result-release gate plumbing

`PatientPortalResultReleaseGate` + `GET /patient-portal/me/results/gate`.

Always fail-closed for product display in 46d. No clinical payloads.

---

## Notification / Audit / Activity / Observability

- Notification intents: invite, accept, revoke  
- Audit: lifecycle + delegated reads + authz/scope denials  
- Activity: non-PHI event refs  
- Observability: Release 45 structured logs (`phi: false`)

---

## Feature flags & licensing

| Gate | Default |
|------|---------|
| `PATIENT_PORTAL_CENTER_ENABLED` | OFF |
| `PATIENT_PORTAL_CAREGIVER_ENABLED` | OFF |
| `VITE_PATIENT_PORTAL_CAREGIVER_ENABLED` | OFF |
| `patientPortal` module | enforced |
| `caregiverAccess` plan feature | enforced |
| `allowPatientPortal` | existing tenant gate |

---

## Security controls

Scope enforcement before PHI, tenant isolation, IDOR prevention, revoked/expired deny, flag/license fail-closed, PHI minimization, secure errors.

---

## Test coverage

`apps/api/src/modules/patient-portal/tests/portal-caregiver-46d.spec.ts` (+ regression 46a–46c).

Frontend routes: `/profile`, `/caregivers`.

---

## Known limitations

- Invitation token returned once to inviter (share out-of-band); no email delivery engine in portal.  
- Deferred scopes registered but not product-exposed.  
- Results gate does not call Clinical SoR release state yet (plumbing only).

---

## Deferred functionality

46e portal home/dashboard/settings polish; clinical results display; messaging/billing/payments/documents products.
